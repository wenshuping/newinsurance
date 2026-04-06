import { getBalance, reloadStateFromStorage, runInStateTransaction } from '../common/state.mjs';
import { resolveLearningCourseContentType } from '../common/learning-course-content-type.mjs';
import { canDeliverTemplateToActor } from '../common/template-visibility.mjs';
import { createCourseCompletion, findCourseCompletion, findLearningCourseById } from '../repositories/learning-write.repository.mjs';

export const LEARNING_ARTICLE_MIN_DWELL_SECONDS = 30;
export const LEARNING_VIDEO_COMPLETE_PROGRESS = 95;

function resolveSettleReward(deps) {
  if (typeof deps?.settleReward === 'function') return deps.settleReward;
  throw new Error('LEARNING_REWARD_SETTLEMENT_HANDLER_REQUIRED');
}

function buildLearningRewardIdempotencyKey({ tenantId, userId, courseId }) {
  return `learning-reward:${Number(tenantId || 1)}:${Number(userId || 0)}:${Number(courseId || 0)}`;
}

function hasLearningRewardTransaction(state, { tenantId, userId, courseId }) {
  const expectedKey = buildLearningRewardIdempotencyKey({ tenantId, userId, courseId });
  return Array.isArray(state?.pointTransactions)
    && state.pointTransactions.some((row) => String(row?.idempotencyKey || '') === expectedKey);
}

function normalizeLearningCourseMode(course) {
  const contentType = resolveLearningCourseContentType(course);
  const sourceType = String(course?.sourceType || '').toLowerCase();
  const isVideo = contentType === 'video';
  const isVideoChannel = isVideo && sourceType === 'video_channel';
  return {
    contentType,
    isVideo,
    isVideoChannel,
  };
}

function hasArticleCompletionAttempt(command) {
  return (
    String(command?.completionSource || '').trim().toLowerCase() === 'article'
    || Boolean(command?.articleReachedEnd)
    || Number(command?.articleDwellSeconds || 0) > 0
  );
}

function assertArticleCompletionEvidence(command) {
  if (!command?.articleReachedEnd) throw new Error('COURSE_ARTICLE_NOT_FINISHED');
  if (Number(command?.articleDwellSeconds || 0) < LEARNING_ARTICLE_MIN_DWELL_SECONDS) {
    throw new Error('COURSE_ARTICLE_DWELL_TOO_SHORT');
  }
}

function assertLearningCompletionEvidence(command, course) {
  const { isVideo, isVideoChannel } = normalizeLearningCourseMode(course);

  if (hasArticleCompletionAttempt(command)) {
    assertArticleCompletionEvidence(command);
    return;
  }

  if (isVideoChannel) {
    if (!command?.videoChannelOpened) throw new Error('COURSE_VIDEO_NOT_COMPLETED');
    return;
  }

  if (isVideo) {
    const progress = Number(command?.videoProgressPercent || 0);
    const ended = Boolean(command?.videoEnded);
    if (!ended && progress < LEARNING_VIDEO_COMPLETE_PROGRESS) throw new Error('COURSE_VIDEO_NOT_COMPLETED');
    return;
  }

  assertArticleCompletionEvidence(command);
}

function canAccessSharedCourse(command, deps = {}) {
  if (typeof deps?.resolveSharedCourseByShare !== 'function') return false;
  const shareCode = String(command?.shareCode || '').trim();
  const courseId = Number(command?.courseId || 0);
  if (!shareCode || !courseId) return false;
  try {
    const sharedCourse = deps.resolveSharedCourseByShare({ shareCode, courseId });
    return Boolean(sharedCourse && Number(sharedCourse.id || 0) === courseId);
  } catch {
    return false;
  }
}

export const executeLearningComplete = async (command, deps = {}) => {
  const courseId = Number(command?.courseId || 0);
  if (!Number.isFinite(courseId) || courseId <= 0) throw new Error('INVALID_COURSE_ID');
  const settleReward = resolveSettleReward(deps);

  const rewardPlan = await runInStateTransaction(async () => {
    const { state, course } = findLearningCourseById({ courseId });
    if (!course) throw new Error('COURSE_NOT_FOUND');
    const directlyVisible = canDeliverTemplateToActor(state, command.actor, course);
    const visibleViaShare = !directlyVisible && canAccessSharedCourse(command, deps);
    if (!directlyVisible && !visibleViaShare) throw new Error('COURSE_NOT_AVAILABLE');
    assertLearningCompletionEvidence(command, course);

    const tenantId = Number(command?.actor?.tenantId || 1);
    const rewardAlreadySettled = hasLearningRewardTransaction(state, {
      tenantId,
      userId: command.userId,
      courseId,
    });
    const exists = findCourseCompletion({ userId: command.userId, courseId });
    if (exists && rewardAlreadySettled) {
      return {
        shouldSettleReward: false,
        duplicated: true,
        reward: 0,
        balance: getBalance(command.userId),
      };
    }

    if (!exists) {
      createCourseCompletion({
        userId: command.userId,
        courseId,
        pointsAwarded: Number(course.points || 0),
      });
    }

    return {
      shouldSettleReward: true,
      duplicated: false,
      tenantId,
      tenantCode: command?.tenantCode || command?.actor?.tenantCode || null,
      userId: Number(command.userId),
      courseId,
      courseTitle: String(course.title || courseId),
      rewardPoints: Number(course.points || 0),
      traceId: command?.traceId || null,
      requestId: command?.requestId || command?.traceId || null,
    };
  });

  if (!rewardPlan?.shouldSettleReward) {
    return rewardPlan;
  }

  const rewardResult = await settleReward({
    tenantId: rewardPlan.tenantId,
    tenantCode: rewardPlan.tenantCode,
    userId: rewardPlan.userId,
    courseId: rewardPlan.courseId,
    courseTitle: rewardPlan.courseTitle,
    rewardPoints: rewardPlan.rewardPoints,
    traceId: rewardPlan.traceId,
    requestId: rewardPlan.requestId,
  });
  await reloadStateFromStorage();

  return {
    duplicated: false,
    reward: Number(rewardPlan.rewardPoints || 0),
    balance: Number(rewardResult.balance || getBalance(command.userId)),
  };
};
