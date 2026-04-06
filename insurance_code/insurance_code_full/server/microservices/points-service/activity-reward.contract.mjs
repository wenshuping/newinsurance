import { recordPoints } from '../../skeleton-c-v1/services/points.service.mjs';
import { recordPointsOperationOutcome } from './observability.mjs';

export const ACTIVITY_REWARD_SETTLEMENT_ROUTE = 'INTERNAL activity->points reward settlement';

function normalizeErrorCode(err) {
  const code = String(err?.message || '').trim();
  return code || 'ACTIVITY_REWARD_SETTLEMENT_FAILED';
}

function normalizeDate(value) {
  const normalized = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : '';
}

function buildActivityRewardIdempotencyKey({ tenantId, userId, activityId, completionDate }) {
  return `activity-reward:${Number(tenantId || 1)}:${Number(userId)}:${Number(activityId)}:${completionDate}`;
}

export function settleActivityReward({
  tenantId = 1,
  userId,
  activityId,
  activityTitle,
  rewardPoints,
  completionDate,
  traceId = null,
}) {
  const normalizedUserId = Number(userId || 0);
  const normalizedActivityId = Number(activityId || 0);
  const normalizedRewardPoints = Number(rewardPoints);
  const normalizedCompletionDate = normalizeDate(completionDate);
  const patch = {
    trace_id: traceId,
    route: ACTIVITY_REWARD_SETTLEMENT_ROUTE,
    user_id: normalizedUserId,
    activity_id: normalizedActivityId,
  };

  if (!Number.isFinite(normalizedUserId) || normalizedUserId <= 0) {
    const error = new Error('INVALID_ACTIVITY_REWARD_USER');
    recordPointsOperationOutcome('activity-reward', {
      result: 'fail',
      code: error.message,
      patch,
    });
    throw error;
  }

  if (!Number.isFinite(normalizedActivityId) || normalizedActivityId <= 0) {
    const error = new Error('INVALID_ACTIVITY_REWARD_ACTIVITY_ID');
    recordPointsOperationOutcome('activity-reward', {
      result: 'fail',
      code: error.message,
      patch,
    });
    throw error;
  }

  if (!normalizedCompletionDate) {
    const error = new Error('INVALID_ACTIVITY_REWARD_DATE');
    recordPointsOperationOutcome('activity-reward', {
      result: 'fail',
      code: error.message,
      patch,
    });
    throw error;
  }

  if (!Number.isFinite(normalizedRewardPoints) || normalizedRewardPoints < 0) {
    const error = new Error('INVALID_ACTIVITY_REWARD_POINTS');
    recordPointsOperationOutcome('activity-reward', {
      result: 'fail',
      code: error.message,
      patch,
    });
    throw error;
  }

  const idempotencyKey = buildActivityRewardIdempotencyKey({
    tenantId,
    userId: normalizedUserId,
    activityId: normalizedActivityId,
    completionDate: normalizedCompletionDate,
  });

  try {
    const result = recordPoints({
      tenantId: Number(tenantId || 1),
      userId: normalizedUserId,
      direction: 'in',
      amount: normalizedRewardPoints,
      sourceType: 'activity_task',
      sourceId: String(normalizedActivityId),
      idempotencyKey,
      description: `完成活动 ${String(activityTitle || normalizedActivityId)}`,
    });

    recordPointsOperationOutcome('activity-reward', {
      result: 'success',
      patch,
    });

    return {
      ok: true,
      duplicated: Boolean(result.duplicated),
      reward: normalizedRewardPoints,
      balance: Number(result.balance || 0),
      transactionId: Number(result.transaction?.id || 0) || null,
      idempotencyKey,
      completionDate: normalizedCompletionDate,
    };
  } catch (err) {
    recordPointsOperationOutcome('activity-reward', {
      result: 'fail',
      code: normalizeErrorCode(err),
      patch,
    });
    throw err;
  }
}
