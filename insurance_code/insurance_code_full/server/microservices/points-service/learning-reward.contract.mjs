import { recordPoints } from '../../skeleton-c-v1/services/points.service.mjs';
import { recordPointsOperationOutcome } from './observability.mjs';

export const LEARNING_REWARD_SETTLEMENT_ROUTE = 'INTERNAL learning->points reward settlement';

function normalizeErrorCode(err) {
  const code = String(err?.message || '').trim();
  return code || 'LEARNING_REWARD_SETTLEMENT_FAILED';
}

function buildLearningRewardIdempotencyKey({ tenantId, userId, courseId }) {
  return `learning-reward:${Number(tenantId || 1)}:${Number(userId)}:${Number(courseId)}`;
}

export function settleLearningCourseReward({ tenantId = 1, userId, courseId, courseTitle, rewardPoints, traceId = null }) {
  const normalizedUserId = Number(userId || 0);
  const normalizedCourseId = Number(courseId || 0);
  const normalizedRewardPoints = Number(rewardPoints);
  const patch = {
    trace_id: traceId,
    route: LEARNING_REWARD_SETTLEMENT_ROUTE,
    user_id: normalizedUserId,
  };

  if (!Number.isFinite(normalizedUserId) || normalizedUserId <= 0) {
    const error = new Error('INVALID_LEARNING_REWARD_USER');
    recordPointsOperationOutcome('learningReward', {
      result: 'fail',
      code: error.message,
      patch,
    });
    throw error;
  }

  if (!Number.isFinite(normalizedCourseId) || normalizedCourseId <= 0) {
    const error = new Error('INVALID_LEARNING_REWARD_COURSE_ID');
    recordPointsOperationOutcome('learningReward', {
      result: 'fail',
      code: error.message,
      patch,
    });
    throw error;
  }

  if (!Number.isFinite(normalizedRewardPoints) || normalizedRewardPoints < 0) {
    const error = new Error('INVALID_LEARNING_REWARD_POINTS');
    recordPointsOperationOutcome('learningReward', {
      result: 'fail',
      code: error.message,
      patch,
    });
    throw error;
  }

  const idempotencyKey = buildLearningRewardIdempotencyKey({
    tenantId,
    userId: normalizedUserId,
    courseId: normalizedCourseId,
  });

  try {
    const result = recordPoints({
      tenantId: Number(tenantId || 1),
      userId: normalizedUserId,
      direction: 'in',
      amount: normalizedRewardPoints,
      sourceType: 'course_complete',
      sourceId: String(normalizedCourseId),
      idempotencyKey,
      description: `完成课程 ${String(courseTitle || normalizedCourseId)}`,
    });

    recordPointsOperationOutcome('learningReward', {
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
    };
  } catch (err) {
    recordPointsOperationOutcome('learningReward', {
      result: 'fail',
      code: normalizeErrorCode(err),
      patch,
    });
    throw err;
  }
}
