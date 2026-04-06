import { persistPointTransactionsByIds, reloadStateFromStorage } from '../../skeleton-c-v1/common/state.mjs';
import { settleLearningCourseReward } from './learning-reward.contract.mjs';

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
  if (code === 'INVALID_LEARNING_REWARD_USER') return res.status(401).json({ code, message: '学习奖励落账用户无效' });
  if (code === 'INVALID_LEARNING_REWARD_COURSE_ID') return res.status(400).json({ code, message: '学习奖励落账课程ID无效' });
  if (code === 'INVALID_LEARNING_REWARD_POINTS') return res.status(409).json({ code, message: '课程奖励配置无效' });
  if (code === 'LEARNING_REWARD_SETTLEMENT_FAILED') return res.status(500).json({ code, message: '学习奖励落账失败' });
  return res.status(500).json({ code: 'LEARNING_REWARD_SETTLEMENT_FAILED', message: '学习奖励落账失败' });
}

function requireLearningInternalCaller(req, res, next) {
  const caller = trimToNull(req.headers['x-internal-service']);
  if (caller !== 'learning-service') {
    return errorResponse(res, 'INTERNAL_CALLER_FORBIDDEN');
  }
  return next();
}

export function registerLearningRewardContractRoute(router) {
  router.post('/internal/points-service/learning-rewards/settle', requireLearningInternalCaller, async (req, res) => {
    const tenantIdFromHeader = toPositiveInt(req.tenantContext?.tenantId, 0);
    const tenantIdFromBody = toPositiveInt(req.body?.tenantId, 0);
    const tenantId = tenantIdFromHeader || tenantIdFromBody;

    if (tenantId <= 0) return errorResponse(res, 'TENANT_CONTEXT_REQUIRED');
    if (tenantIdFromHeader > 0 && tenantIdFromBody > 0 && tenantIdFromHeader !== tenantIdFromBody) {
      return errorResponse(res, 'TENANT_CONTEXT_MISMATCH');
    }

    try {
      await reloadStateFromStorage();
      const payload = settleLearningCourseReward({
        tenantId,
        userId: Number(req.body?.userId || 0),
        courseId: Number(req.body?.courseId || 0),
        courseTitle: String(req.body?.courseTitle || req.body?.courseId || ''),
        rewardPoints: Number(req.body?.rewardPoints || 0),
        traceId: trimToNull(req.traceId) || trimToNull(req.headers['x-trace-id']),
      });
      if (Number(payload?.transactionId || 0) > 0) {
        await persistPointTransactionsByIds([Number(payload.transactionId)]);
      }

      return res.json({
        ok: true,
        caller: 'learning-service',
        tenantId,
        ...payload,
      });
    } catch (error) {
      return errorResponse(res, error?.message);
    }
  });
}
