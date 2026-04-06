import { validateBody } from '../../skeleton-c-v1/common/middleware.mjs';
import {
  createSession,
  dateOnly,
  formatUser,
  getState,
  nextId,
  persistCustomersByIds,
  persistPointTransactionsByIds,
  persistSessionsByTokens,
  persistSmsCodesByIds,
  persistState,
  resolveTenantPointsRuleConfig,
} from '../../skeleton-c-v1/common/state.mjs';
import { toSendAuthCodeCommand, toVerifyBasicCommand } from '../../skeleton-c-v1/dto/write-commands.dto.mjs';
import { sendCodeBodySchema, verifyBasicBodySchema } from '../../skeleton-c-v1/schemas/auth.schemas.mjs';
import { recordPoints } from '../../skeleton-c-v1/services/points.service.mjs';
import {
  resolveTenantIdFromRecentShareRequest,
  resolveTenantIdFromShareCode,
  settleCustomerShareIdentifyReward,
} from '../../skeleton-c-v1/services/share.service.mjs';
import { executeSendAuthCode, executeVerifyBasic } from '../../skeleton-c-v1/usecases/auth-write.usecase.mjs';

function toPositiveInt(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function resolveTenantForRegistration(state, req) {
  const tenantIdCandidates = [
    toPositiveInt(req.headers['x-tenant-id']),
    toPositiveInt(req.body?.tenantId),
  ].filter((x) => Number.isFinite(Number(x)) && Number(x) > 0);

  for (const candidate of tenantIdCandidates) {
    const found = (state.tenants || []).find((t) => Number(t.id) === Number(candidate));
    if (found) return found;
  }

  const rawKey = String(
    req.headers['x-tenant-code'] || req.headers['x-tenant-key'] || req.body?.tenantCode || req.body?.tenantKey || '',
  )
    .trim()
    .toLowerCase();

  if (!rawKey) return null;

  return (
    (state.tenants || []).find((t) => {
      const key = String(t.tenantCode || t.code || t.tenantKey || `tenant_${t.id}`)
        .trim()
        .toLowerCase();
      return Boolean(key) && key === rawKey;
    }) || null
  );
}

function resolveShareCodeFromRequest(req) {
  const directCode = String(req.body?.shareCode || req.query?.shareCode || '').trim();
  if (directCode) return directCode;
  const clientPath = String(req.headers['x-client-path'] || '').trim();
  if (clientPath) {
    try {
      const parsed = new URL(clientPath, 'http://local.invalid');
      const sharePathMatch = String(parsed.pathname || '').match(/^\/share\/([^/?#]+)/);
      if (sharePathMatch?.[1]) return decodeURIComponent(sharePathMatch[1]);
      const queryCode = String(parsed.searchParams.get('shareCode') || '').trim();
      if (queryCode) return queryCode;
    } catch {
      // fall through to referer parsing
    }
  }
  const referer = String(req.headers.referer || req.headers.referrer || '').trim();
  if (!referer) return '';
  try {
    const parsed = new URL(referer);
    const sharePathMatch = String(parsed.pathname || '').match(/^\/share\/([^/?#]+)/);
    if (sharePathMatch?.[1]) return decodeURIComponent(sharePathMatch[1]);
    const queryCode = String(parsed.searchParams.get('shareCode') || '').trim();
    if (queryCode) return queryCode;
  } catch {
    return '';
  }
  return '';
}

function resolveTenantFromShareRequest(state, req) {
  const shareCode = resolveShareCodeFromRequest(req);
  if (!shareCode) return null;
  try {
    const tenantId = resolveTenantIdFromShareCode(shareCode);
    if (!tenantId) return null;
    return (state.tenants || []).find((t) => Number(t.id) === Number(tenantId)) || null;
  } catch {
    return null;
  }
}

function resolveTenantFromRecentClientShare(state, req) {
  const tenantId = resolveTenantIdFromRecentShareRequest(req);
  if (!tenantId) return null;
  return (state.tenants || []).find((t) => Number(t.id) === Number(tenantId)) || null;
}

export function registerUserServiceAuthRoutes(app) {
  app.post('/api/auth/send-code', validateBody(sendCodeBodySchema), (req, res) => {
    const state = getState();
    const tenant =
      resolveTenantForRegistration(state, req) ||
      resolveTenantFromShareRequest(state, req) ||
      resolveTenantFromRecentClientShare(state, req);
    const command = toSendAuthCodeCommand({
      body: req.body,
      tenant,
      deps: { getState, nextId, persistState, persistSmsCodesByIds, dateOnly },
    });

    executeSendAuthCode(command)
      .then((payload) => res.json(payload))
      .catch((err) => {
        const code = String(err?.code || err?.message || '');
        if (code === 'SMS_LIMIT_REACHED') return res.status(429).json({ code, message: '今日验证码次数已达上限' });
        return res.status(400).json({ code: code || 'SEND_CODE_FAILED', message: '验证码发送失败' });
      });
  });

  app.post('/api/auth/verify-basic', validateBody(verifyBasicBodySchema), (req, res) => {
    const state = getState();
    const tenant =
      resolveTenantForRegistration(state, req) ||
      resolveTenantFromShareRequest(state, req) ||
      resolveTenantFromRecentClientShare(state, req);
    const command = toVerifyBasicCommand({
      body: req.body,
      headers: req.headers,
      tenant,
      deps: {
        getState,
        nextId,
        createSession,
        formatUser,
        persistState,
        persistCustomersByIds,
        persistSessionsByTokens,
        persistSmsCodesByIds,
        persistPointTransactionsByIds,
        recordPoints,
      },
    });

    executeVerifyBasic(command)
      .then(async (payload) => {
        const shareCode = resolveShareCodeFromRequest(req);
        if (shareCode && payload?.isNewlyVerified) {
          const rewardConfig = resolveTenantPointsRuleConfig(Number(command.tenant?.id || payload?.user?.tenantId || 1), getState());
          const rewardOutcome = settleCustomerShareIdentifyReward({
            req,
            shareCode,
            identifiedCustomerId: Number(payload?.user?.id || 0),
            rewardPoints: Number(rewardConfig.customerShareIdentifyPoints || 0),
            recordPoints,
          });
          if (rewardOutcome.rewarded) {
            await persistState();
          }
        }
        return res.json(payload);
      })
      .catch((err) => {
        const code = String(err?.code || err?.message || '');
        if (code === 'CODE_NOT_FOUND') return res.status(400).json({ code, message: '验证码错误或已失效' });
        if (code === 'CODE_EXPIRED') return res.status(400).json({ code, message: '验证码已过期' });
        if (code === 'NAME_REQUIRED') return res.status(400).json({ code, message: '请输入真实姓名' });
        if (code === 'TENANT_REQUIRED') {
          return res.status(400).json({
            code,
            message: '缺少租户标识，请携带 tenantId（或 tenantCode/tenantKey 兜底）',
          });
        }
        if (code === 'CUSTOMER_REALNAME_MISMATCH') {
          return res.status(409).json({ code, message: '该手机号已实名，姓名与历史实名信息不一致' });
        }
        return res.status(400).json({ code: code || 'VERIFY_BASIC_FAILED', message: '实名验证失败' });
      });
  });
}
