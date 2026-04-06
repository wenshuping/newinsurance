import {
  toBindWechatIdentityCommand,
  toResolveWechatH5SessionCommand,
  toResolveWechatIdentityCommand,
  toSendAuthCodeCommand,
  toVerifyBasicCommand,
} from '../dto/write-commands.dto.mjs';
import {
  appendTrackEvent,
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
  persistTrackEventsByIds,
  reloadStateFromStorage,
  resolveTenantPointsRuleConfig,
} from '../common/state.mjs';
import { authRequired, validateBody } from '../common/middleware.mjs';
import { ensurePublicPoolTenantState, PUBLIC_POOL_TENANT_CODE } from '../common/public-pool-tenant.mjs';
import { recordPoints } from '../services/points.service.mjs';
import {
  assignSharedCustomerOwner,
  resolveShareTrackingContext,
  resolveTenantIdFromRecentShareRequest,
  resolveTenantIdFromShareCode,
  settleCustomerShareIdentifyReward,
} from '../services/share.service.mjs';
import {
  bindWechatIdentityBodySchema,
  resolveWechatH5SessionBodySchema,
  resolveWechatIdentityBodySchema,
  sendCodeBodySchema,
  verifyBasicBodySchema,
} from '../schemas/auth.schemas.mjs';
import {
  executeBindWechatIdentity,
  executeResolveWechatH5Session,
  executeResolveWechatIdentity,
  executeSendAuthCode,
  executeVerifyBasic,
} from '../usecases/auth-write.usecase.mjs';
import { resolveWechatH5IdentityByCode } from '../services/wechat-h5.service.mjs';

function toPositiveInt(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function readRegistrationTenantHint(req) {
  const tenantIdCandidates = [toPositiveInt(req.headers['x-tenant-id']), toPositiveInt(req.body?.tenantId)].filter(
    (x) => Number.isFinite(Number(x)) && Number(x) > 0,
  );
  const tenantCode = String(
    req.headers['x-tenant-code'] || req.headers['x-tenant-key'] || req.body?.tenantCode || req.body?.tenantKey || '',
  )
    .trim()
    .toLowerCase();
  return {
    tenantIdCandidates,
    tenantCode,
    hasHint: tenantIdCandidates.length > 0 || Boolean(tenantCode),
  };
}

function resolveTenantForRegistration(state, req) {
  const { tenantIdCandidates, tenantCode } = readRegistrationTenantHint(req);
  for (const candidate of tenantIdCandidates) {
    const found = (state.tenants || []).find((t) => Number(t.id) === Number(candidate));
    if (found) return found;
  }
  if (!tenantCode) return null;
  return (
    (state.tenants || []).find((t) => {
      const key = String(t.tenantCode || t.code || t.tenantKey || `tenant_${t.id}`)
        .trim()
        .toLowerCase();
      return Boolean(key) && key === tenantCode;
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

async function resolveRegistrationTenantWithFallback(state, req) {
  const explicitTenant = resolveTenantForRegistration(state, req);
  if (explicitTenant) return explicitTenant;

  const shareTenant = resolveTenantFromShareRequest(state, req) || resolveTenantFromRecentClientShare(state, req);
  if (shareTenant) return shareTenant;

  const { hasHint, tenantCode } = readRegistrationTenantHint(req);
  if (hasHint && tenantCode !== PUBLIC_POOL_TENANT_CODE) return null;

  const ensured = ensurePublicPoolTenantState({ state, nextId });
  if (ensured.changed) await persistState();
  return ensured.tenant || null;
}

function maskMobile(value) {
  const text = String(value || '').trim();
  if (text.length < 7) return text;
  return `${text.slice(0, 3)}****${text.slice(-4)}`;
}

export function registerAuthRoutes(app) {
  app.post('/api/auth/wechat/resolve', validateBody(resolveWechatIdentityBodySchema), async (req, res) => {
    await reloadStateFromStorage();
    const command = toResolveWechatIdentityCommand({
      body: req.body,
      deps: { getState },
    });
    try {
      const payload = await executeResolveWechatIdentity(command);
      return res.json(payload);
    } catch (err) {
      const code = String(err?.code || err?.message || '');
      return res.status(400).json({ code: code || 'WECHAT_RESOLVE_FAILED', message: '微信身份解析失败' });
    }
  });

  app.post('/api/auth/wechat/h5/resolve-session', validateBody(resolveWechatH5SessionBodySchema), async (req, res) => {
    await reloadStateFromStorage();
    const command = toResolveWechatH5SessionCommand({
      body: req.body,
      deps: { getState, createSession, formatUser, persistState, resolveWechatH5IdentityByCode },
    });
    try {
      const payload = await executeResolveWechatH5Session(command);
      return res.json(payload);
    } catch (err) {
      const code = String(err?.code || err?.message || '');
      if (code === 'WECHAT_H5_CODE_REQUIRED') {
        return res.status(400).json({ code, message: '缺少微信授权 code' });
      }
      if (code === 'WECHAT_H5_CREDENTIALS_MISSING') {
        return res.status(503).json({ code, message: '微信 H5 配置缺失' });
      }
      return res.status(400).json({ code: code || 'WECHAT_H5_RESOLVE_FAILED', message: '微信 H5 登录恢复失败' });
    }
  });

  app.post('/api/auth/send-code', validateBody(sendCodeBodySchema), async (req, res) => {
    const state = getState();
    const tenant = await resolveRegistrationTenantWithFallback(state, req);
    const command = toSendAuthCodeCommand({
      body: req.body,
      tenant,
      deps: { getState, nextId, persistState, persistSmsCodesByIds, dateOnly },
    });
    try {
      const payload = await executeSendAuthCode(command);
      return res.json(payload);
    } catch (err) {
      const code = String(err?.code || err?.message || '');
      console.warn(
        '[auth.send-code.failed]',
        JSON.stringify({
          code: code || 'SEND_CODE_FAILED',
          mobile: maskMobile(req.body?.mobile),
          tenantId: command.tenant?.id || null,
          clientPath: String(req.headers['x-client-path'] || '').trim() || null,
          referer: String(req.headers.referer || req.headers.referrer || '').trim() || null,
        }),
      );
      if (code === 'SMS_LIMIT_REACHED') return res.status(429).json({ code, message: '今日验证码次数已达上限' });
      return res.status(400).json({ code: code || 'SEND_CODE_FAILED', message: '验证码发送失败' });
    }
  });

  app.post('/api/auth/verify-basic', validateBody(verifyBasicBodySchema), async (req, res) => {
    const state = getState();
    const tenant = await resolveRegistrationTenantWithFallback(state, req);
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
    try {
      const payload = await executeVerifyBasic(command);
      const shareCode = resolveShareCodeFromRequest(req);
      if (shareCode && payload?.user?.id) {
        try {
          const bindReq = {
            ...req,
            user: {
              ...(payload.user || {}),
              actorType: 'customer',
            },
          };
          const updatedCustomer = assignSharedCustomerOwner({ req: bindReq, shareCode });
          if (updatedCustomer?.id) {
            await persistCustomersByIds([updatedCustomer.id]);
          }
          if (payload?.isNewlyVerified) {
            const trackRow = appendTrackEvent(
              resolveShareTrackingContext({
                req: bindReq,
                shareCode,
                eventName: 'share_customer_identified',
              }),
            );
            await persistTrackEventsByIds([trackRow.id]);
          }
        } catch (shareBindErr) {
          console.warn(
            '[auth.verify-basic.share-bind-failed]',
            JSON.stringify({
              customerId: Number(payload?.user?.id || 0) || null,
              mobile: maskMobile(payload?.user?.mobile),
              tenantId: command.tenant?.id || payload?.user?.tenantId || null,
              shareCode,
              code: String(shareBindErr?.code || shareBindErr?.message || 'SHARE_BIND_FAILED'),
            }),
          );
        }
      }
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
    } catch (err) {
      const code = String(err?.code || err?.message || '');
      console.warn(
        '[auth.verify-basic.failed]',
        JSON.stringify({
          code: code || 'VERIFY_BASIC_FAILED',
          mobile: maskMobile(req.body?.mobile),
          tenantId: command.tenant?.id || null,
          shareCode: resolveShareCodeFromRequest(req) || null,
          clientPath: String(req.headers['x-client-path'] || '').trim() || null,
          referer: String(req.headers.referer || req.headers.referrer || '').trim() || null,
        }),
      );
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
      if (code === 'WECHAT_IDENTITY_CONFLICT') {
        return res.status(409).json({ code, message: '该微信身份已绑定其他客户' });
      }
      if (code === 'WECHAT_APP_TYPE_REQUIRED') {
        return res.status(400).json({ code, message: 'openId 场景下必须提供 appType' });
      }
      return res.status(400).json({ code: code || 'VERIFY_BASIC_FAILED', message: '实名验证失败' });
    }
  });

  app.post('/api/auth/wechat/bind', authRequired, validateBody(bindWechatIdentityBodySchema), (req, res) => {
    const command = toBindWechatIdentityCommand({
      body: req.body,
      user: req.user,
      deps: { getState, persistState },
    });
    executeBindWechatIdentity(command)
      .then((payload) => res.json(payload))
      .catch((err) => {
        const code = String(err?.code || err?.message || '');
        if (code === 'CUSTOMER_ID_REQUIRED') {
          return res.status(400).json({ code, message: '缺少客户标识' });
        }
        if (code === 'CUSTOMER_NOT_FOUND') {
          return res.status(404).json({ code, message: '客户不存在' });
        }
        if (code === 'WECHAT_BIND_FORBIDDEN') {
          return res.status(403).json({ code, message: '不能绑定其他客户的微信身份' });
        }
        if (code === 'WECHAT_IDENTITY_CONFLICT') {
          return res.status(409).json({ code, message: '该微信身份已绑定其他客户' });
        }
        if (code === 'WECHAT_APP_TYPE_REQUIRED') {
          return res.status(400).json({ code, message: 'openId 场景下必须提供 appType' });
        }
        return res.status(400).json({ code: code || 'WECHAT_BIND_FAILED', message: '微信身份绑定失败' });
      });
  });
}
