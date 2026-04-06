import { getDefaultPointsRuleConfig, resolveTenantPointsRuleConfig } from '../common/state.mjs';

function toNonNegativeInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

function pointsRuleErrorResponse(res, err) {
  const code = String(err?.code || err?.message || '');
  if (code === 'TENANT_CONTEXT_REQUIRED') {
    return res.status(400).json({ code, message: '缺少租户上下文' });
  }
  if (code === 'SIGN_IN_POINTS_INVALID') {
    return res.status(400).json({ code, message: '签到积分必须是大于等于0的整数' });
  }
  if (code === 'NEW_CUSTOMER_VERIFY_POINTS_INVALID') {
    return res.status(400).json({ code, message: '新客户积分必须是大于等于0的整数' });
  }
  if (code === 'CUSTOMER_SHARE_IDENTIFY_POINTS_INVALID') {
    return res.status(400).json({ code, message: '分享实名积分必须是大于等于0的整数' });
  }
  return res.status(400).json({ code: code || 'POINTS_RULE_SAVE_FAILED', message: '积分规则保存失败' });
}

export function registerPAdminPointsRuleRoutes(app, deps) {
  const { tenantContext, permissionRequired, getState, nextId, persistState, appendAuditLog } = deps;

  app.get('/api/p/points-rules/config', tenantContext, permissionRequired('customer:read'), (req, res) => {
    const tenantId = Number(req.tenantContext?.tenantId || 0);
    if (!Number.isFinite(tenantId) || tenantId <= 0) {
      return res.status(400).json({ code: 'TENANT_CONTEXT_REQUIRED', message: '缺少租户上下文' });
    }

    const state = getState();
    const config = resolveTenantPointsRuleConfig(tenantId, state);
    return res.json({
      ok: true,
      config: {
        tenantId,
        signInPoints: Number(config.signInPoints),
        newCustomerVerifyPoints: Number(config.newCustomerVerifyPoints),
        customerShareIdentifyPoints: Number(config.customerShareIdentifyPoints),
        updatedAt: config.updatedAt || null,
      },
    });
  });

  app.post('/api/p/points-rules/config', tenantContext, permissionRequired('customer:write'), async (req, res) => {
    try {
      const tenantId = Number(req.tenantContext?.tenantId || 0);
      if (!Number.isFinite(tenantId) || tenantId <= 0) throw new Error('TENANT_CONTEXT_REQUIRED');

      const defaults = getDefaultPointsRuleConfig();
      const rawSignInPoints = req.body?.signInPoints;
      const rawNewCustomerVerifyPoints = req.body?.newCustomerVerifyPoints;
      const rawCustomerShareIdentifyPoints = req.body?.customerShareIdentifyPoints;
      const signInPoints = toNonNegativeInt(rawSignInPoints, Number.NaN);
      const newCustomerVerifyPoints = toNonNegativeInt(rawNewCustomerVerifyPoints, Number.NaN);
      const customerShareIdentifyPoints = toNonNegativeInt(rawCustomerShareIdentifyPoints, Number.NaN);

      if (!Number.isFinite(signInPoints)) throw new Error('SIGN_IN_POINTS_INVALID');
      if (!Number.isFinite(newCustomerVerifyPoints)) throw new Error('NEW_CUSTOMER_VERIFY_POINTS_INVALID');
      if (!Number.isFinite(customerShareIdentifyPoints)) throw new Error('CUSTOMER_SHARE_IDENTIFY_POINTS_INVALID');

      const state = getState();
      if (!Array.isArray(state.pointsRuleConfigs)) state.pointsRuleConfigs = [];

      const now = new Date().toISOString();
      const existing = state.pointsRuleConfigs.find((row) => Number(row?.tenantId || 1) === tenantId);
      const nextConfig = {
        id: existing ? Number(existing.id) : nextId(state.pointsRuleConfigs),
        tenantId,
        signInPoints,
        newCustomerVerifyPoints,
        customerShareIdentifyPoints,
        createdBy: Number(req.actor?.actorId || 0) || null,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };

      if (existing) {
        Object.assign(existing, nextConfig);
      } else {
        state.pointsRuleConfigs.push(nextConfig);
      }

      appendAuditLog({
        tenantId,
        actorType: req.actor?.actorType || 'employee',
        actorId: Number(req.actor?.actorId || 0),
        action: 'points_rule_config.update',
        resourceType: 'points_rule_config',
        resourceId: String(tenantId),
        result: 'success',
        meta: {
          signInPoints,
          newCustomerVerifyPoints,
          customerShareIdentifyPoints,
          defaults,
        },
      });
      await persistState();

      return res.json({
        ok: true,
        config: {
          tenantId,
          signInPoints,
          newCustomerVerifyPoints,
          customerShareIdentifyPoints,
          updatedAt: now,
        },
      });
    } catch (err) {
      return pointsRuleErrorResponse(res, err);
    }
  });
}
