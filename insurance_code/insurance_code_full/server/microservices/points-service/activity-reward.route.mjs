import { persistPointTransactionsByIds, reloadStateFromStorage } from '../../skeleton-c-v1/common/state.mjs';
import { settleActivityReward } from './activity-reward.contract.mjs';

function trimToNull(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function toPositiveInt(value, fallback = 0) {
  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized > 0 ? Math.floor(normalized) : fallback;
}

function errorResponse(res, code) {
  if (code === 'INTERNAL_CALLER_FORBIDDEN') return res.status(403).json({ code, message: '不允许的内部调用方' });
  if (code === 'TENANT_CONTEXT_REQUIRED') return res.status(400).json({ code, message: '缺少租户上下文' });
  if (code === 'TENANT_CONTEXT_MISMATCH') return res.status(409).json({ code, message: '租户上下文与请求体不一致' });
  if (code === 'INVALID_ACTIVITY_REWARD_USER') return res.status(401).json({ code, message: '活动奖励落账用户无效' });
  if (code === 'INVALID_ACTIVITY_REWARD_ACTIVITY_ID') return res.status(400).json({ code, message: '活动奖励落账活动ID无效' });
  if (code === 'INVALID_ACTIVITY_REWARD_POINTS') return res.status(409).json({ code, message: '活动奖励配置无效' });
  if (code === 'INVALID_ACTIVITY_REWARD_DATE') return res.status(400).json({ code, message: '活动奖励日期无效' });
  if (code === 'ACTIVITY_REWARD_SETTLEMENT_FAILED') return res.status(500).json({ code, message: '活动奖励落账失败' });
  return res.status(500).json({ code: 'ACTIVITY_REWARD_SETTLEMENT_FAILED', message: '活动奖励落账失败' });
}

function requireActivityInternalCaller(req, res, next) {
  const caller = trimToNull(req.headers['x-internal-service']);
  if (caller !== 'activity-service') {
    return errorResponse(res, 'INTERNAL_CALLER_FORBIDDEN');
  }
  return next();
}

export function registerActivityRewardContractRoute(router) {
  router.post('/internal/points-service/activity-rewards/settle', requireActivityInternalCaller, async (req, res) => {
    const tenantIdFromHeader = toPositiveInt(req.tenantContext?.tenantId, 0);
    const tenantIdFromBody = toPositiveInt(req.body?.tenantId, 0);
    const tenantId = tenantIdFromHeader || tenantIdFromBody;

    if (tenantId <= 0) return errorResponse(res, 'TENANT_CONTEXT_REQUIRED');
    if (tenantIdFromHeader > 0 && tenantIdFromBody > 0 && tenantIdFromHeader !== tenantIdFromBody) {
      return errorResponse(res, 'TENANT_CONTEXT_MISMATCH');
    }

    try {
      await reloadStateFromStorage();
      const payload = settleActivityReward({
        tenantId,
        userId: Number(req.body?.userId || 0),
        activityId: Number(req.body?.activityId || 0),
        activityTitle: String(req.body?.activityTitle || req.body?.activityId || ''),
        rewardPoints: Number(req.body?.rewardPoints || 0),
        completionDate: String(req.body?.completionDate || '').trim(),
        traceId: trimToNull(req.traceId) || trimToNull(req.headers['x-trace-id']),
      });
      if (Number(payload?.transactionId || 0) > 0) {
        await persistPointTransactionsByIds([Number(payload.transactionId)]);
      }

      return res.json({
        ok: true,
        caller: 'activity-service',
        tenantId,
        ...payload,
      });
    } catch (error) {
      return errorResponse(res, error?.message);
    }
  });
}
