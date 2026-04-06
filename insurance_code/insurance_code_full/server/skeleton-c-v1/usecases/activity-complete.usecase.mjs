import { dateOnly, getBalance, persistActivityCompletionsByIds, reloadStateFromStorage, runInStateTransaction } from '../common/state.mjs';
import { hasActivityRewardTransaction } from '../common/activity-reward-state.mjs';
import { canDeliverTemplateToActor } from '../common/template-visibility.mjs';
import {
  createActivityCompletion,
  findAnyActivityCompletion,
  findCompletableActivityById,
} from '../repositories/activity-write.repository.mjs';

function resolveSettleReward(deps) {
  if (typeof deps?.settleReward === 'function') return deps.settleReward;
  throw new Error('ACTIVITY_REWARD_SETTLEMENT_HANDLER_REQUIRED');
}

function canAccessSharedActivity(command, deps = {}) {
  if (typeof deps?.resolveSharedActivityByShare !== 'function') return false;
  const shareCode = String(command?.shareCode || '').trim();
  const activityId = Number(command?.activityId || 0);
  if (!shareCode || !activityId) return false;
  try {
    const sharedActivity = deps.resolveSharedActivityByShare({ shareCode, activityId });
    return Boolean(sharedActivity && Number(sharedActivity.id || 0) === activityId);
  } catch {
    return false;
  }
}

export const executeActivityComplete = async (command, deps = {}) => {
  const activityId = Number(command?.activityId || 0);
  if (!Number.isFinite(activityId) || activityId <= 0) throw new Error('INVALID_ACTIVITY_ID');
  if (!Number.isFinite(Number(command?.userId)) || Number(command.userId) <= 0) throw new Error('UNAUTHORIZED');
  if (!command?.isVerifiedBasic) throw new Error('NEED_BASIC_VERIFY');
  const settleReward = resolveSettleReward(deps);

  const rewardPlan = await runInStateTransaction(async () => {
    const { state, activity } = findCompletableActivityById({ activityId });
    if (!activity) throw new Error('ACTIVITY_NOT_FOUND');
    if (activity.category === 'sign') throw new Error('USE_SIGN_IN');
    if (activity.category === 'competition') throw new Error('MANUAL_FLOW_REQUIRED');
    const directlyVisible = canDeliverTemplateToActor(state, command.actor, activity);
    const visibleViaShare = !directlyVisible && canAccessSharedActivity(command, deps);
    if (!directlyVisible && !visibleViaShare) throw new Error('ACTIVITY_NOT_AVAILABLE');

    const today = dateOnly(new Date());
    const tenantId = Number(command?.actor?.tenantId || 1);
    const rewardAlreadySettled = hasActivityRewardTransaction(state, {
      tenantId,
      userId: command.userId,
      activityId,
      completionDate: today,
    });
    const exists = findAnyActivityCompletion({ userId: command.userId, activityId });
    if (exists && rewardAlreadySettled) throw new Error('ALREADY_COMPLETED');

    let completionId = null;
    if (!exists) {
      const completion = createActivityCompletion({
        tenantId,
        userId: command.userId,
        activityId,
        today,
        pointsAwarded: Number(activity.rewardPoints || 0),
      });
      completionId = Number(completion?.id || 0) || null;
    }

    return {
      ok: true,
      completionId,
      tenantId,
      tenantCode: command?.tenantCode || command?.actor?.tenantCode || null,
      userId: Number(command.userId),
      activityId,
      activityTitle: String(activity.title || activityId),
      rewardPoints: Number(activity.rewardPoints || 0),
      completionDate: today,
      traceId: command?.traceId || null,
      requestId: command?.requestId || command?.traceId || null,
    };
  }, { persistMode: 'manual', snapshotMode: 'activity_write' });

  if (Number.isFinite(Number(rewardPlan.completionId)) && Number(rewardPlan.completionId) > 0) {
    await persistActivityCompletionsByIds([Number(rewardPlan.completionId)]);
  }

  const rewardResult = await settleReward({
    tenantId: rewardPlan.tenantId,
    tenantCode: rewardPlan.tenantCode,
    userId: rewardPlan.userId,
    activityId: rewardPlan.activityId,
    activityTitle: rewardPlan.activityTitle,
    rewardPoints: rewardPlan.rewardPoints,
    completionDate: rewardPlan.completionDate,
    traceId: rewardPlan.traceId,
    requestId: rewardPlan.requestId,
  });

  Promise.resolve()
    .then(() => reloadStateFromStorage())
    .catch(() => undefined);

  return {
    ok: true,
    reward: Number(rewardPlan.rewardPoints || 0),
    duplicated: Boolean(rewardResult?.duplicated),
    balance: Number(rewardResult?.balance || getBalance(command.userId)),
  };
};
