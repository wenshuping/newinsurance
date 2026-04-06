import { tenantContext } from '../common/access-control.mjs';
import { authRequired } from '../common/middleware.mjs';
import { getState, persistAgentsByIds, runInStateTransaction } from '../common/state.mjs';

function toAdvisorProfile(agent) {
  if (!agent) return null;
  return {
    id: Number(agent.id || 0),
    tenantId: Number(agent.tenantId || 1),
    orgId: Number(agent.orgId || agent.tenantId || 1),
    teamId: Number(agent.teamId || agent.tenantId || 1),
    name: String(agent.name || '顾问'),
    mobile: String(agent.mobile || ''),
    title: String(agent.title || '').trim() || '保险顾问',
    bio: String(agent.bio || ''),
    avatarUrl: String(agent.avatarUrl || agent.avatar_url || ''),
    wechatId: String(agent.wechatId || agent.wechat_id || ''),
    wechatQrUrl: String(agent.wechatQrUrl || agent.wechat_qr_url || ''),
  };
}

function findAgentForCustomer({ state, customer }) {
  const ownerUserId = Number(customer?.ownerUserId || 0);
  if (ownerUserId <= 0) return null;
  const tenantId = Number(customer?.tenantId || 0);
  const agents = Array.isArray(state?.agents) ? state.agents : [];
  return (
    agents.find(
      (row) => Number(row?.id || 0) === ownerUserId && Number(row?.tenantId || 0) === tenantId
    ) ||
    agents.find((row) => Number(row?.id || 0) === ownerUserId) ||
    null
  );
}

function findCurrentAgent({ state, actor, tenantContext: currentTenantContext, user }) {
  const actorId = Number(actor?.actorId || user?.id || 0);
  const tenantId = Number(currentTenantContext?.tenantId || actor?.tenantId || user?.tenantId || 0);
  if (actorId <= 0) return null;
  const agents = Array.isArray(state?.agents) ? state.agents : [];
  return (
    agents.find(
      (row) => Number(row?.id || 0) === actorId && (!tenantId || Number(row?.tenantId || 0) === tenantId)
    ) || null
  );
}

export function resolveCustomerAdvisorProfile({ state, user }) {
  return toAdvisorProfile(findAgentForCustomer({ state, customer: user }));
}

export function resolveCurrentBAdvisorProfile({ state, actor, tenantContext: currentTenantContext, user }) {
  return toAdvisorProfile(findCurrentAgent({ state, actor, tenantContext: currentTenantContext, user }));
}

export function updateCurrentAdvisorProfile({ state, actor, tenantContext: currentTenantContext, user, body }) {
  const agent = findCurrentAgent({ state, actor, tenantContext: currentTenantContext, user });
  if (!agent) throw new Error('ADVISOR_NOT_FOUND');

  const normalizedBio = String(body?.bio ?? agent.bio ?? '')
    .replace(/\r\n/g, '\n')
    .trim();
  const normalizedAvatarUrl = String(body?.avatarUrl ?? agent.avatarUrl ?? '')
    .replace(/\s+/g, '')
    .trim();
  const normalizedWechatId = String(body?.wechatId ?? agent.wechatId ?? '').trim();
  const normalizedWechatQrUrl = String(body?.wechatQrUrl ?? agent.wechatQrUrl ?? '')
    .replace(/\s+/g, '')
    .trim();

  if (normalizedBio.length > 200) throw new Error('ADVISOR_BIO_TOO_LONG');
  if (normalizedAvatarUrl.length > 1024) throw new Error('ADVISOR_AVATAR_TOO_LONG');
  if (normalizedWechatId.length > 120) throw new Error('ADVISOR_WECHAT_ID_TOO_LONG');
  if (normalizedWechatQrUrl.length > 1024) throw new Error('ADVISOR_WECHAT_QR_TOO_LONG');

  agent.bio = normalizedBio;
  agent.avatarUrl = normalizedAvatarUrl;
  agent.wechatId = normalizedWechatId;
  agent.wechatQrUrl = normalizedWechatQrUrl;
  agent.updatedAt = new Date().toISOString();

  return toAdvisorProfile(agent);
}

function advisorErrorResponse(res, err) {
  const code = String(err?.code || err?.message || 'ADVISOR_PROFILE_FAILED');
  if (code === 'ADVISOR_NOT_FOUND') return res.status(404).json({ code, message: '顾问资料不存在' });
  if (code === 'ADVISOR_BIO_TOO_LONG') return res.status(400).json({ code, message: '个人简介不能超过 200 字' });
  if (code === 'ADVISOR_AVATAR_TOO_LONG') return res.status(400).json({ code, message: '头像图片地址不能超过 1024 字' });
  if (code === 'ADVISOR_WECHAT_ID_TOO_LONG') return res.status(400).json({ code, message: '微信号不能超过 120 字' });
  if (code === 'ADVISOR_WECHAT_QR_TOO_LONG') return res.status(400).json({ code, message: '微信二维码图片地址不能超过 1024 字' });
  return res.status(400).json({ code, message: '顾问资料处理失败' });
}

export function registerCAdvisorRoutes(app) {
  app.get('/api/advisor/me', authRequired, tenantContext, (req, res) => {
    try {
      const advisor = resolveCustomerAdvisorProfile({ state: getState(), user: req.user });
      return res.json({ ok: true, advisor });
    } catch (err) {
      return advisorErrorResponse(res, err);
    }
  });
}

export function registerBAdvisorRoutes(app) {
  app.get('/api/b/me/advisor-profile', tenantContext, (req, res) => {
    try {
      const advisor = resolveCurrentBAdvisorProfile({
        state: getState(),
        actor: req.actor,
        tenantContext: req.tenantContext,
        user: req.user,
      });
      return res.json({ ok: true, advisor });
    } catch (err) {
      return advisorErrorResponse(res, err);
    }
  });

  app.put('/api/b/me/advisor-profile', tenantContext, async (req, res) => {
    try {
      const advisor = await runInStateTransaction(
        async () => {
          const nextAdvisor = updateCurrentAdvisorProfile({
            state: getState(),
            actor: req.actor,
            tenantContext: req.tenantContext,
            user: req.user,
            body: req.body || {},
          });
          await persistAgentsByIds([nextAdvisor.id]);
          return nextAdvisor;
        },
        { persistMode: 'manual' }
      );
      return res.json({ ok: true, advisor });
    } catch (err) {
      return advisorErrorResponse(res, err);
    }
  });
}
