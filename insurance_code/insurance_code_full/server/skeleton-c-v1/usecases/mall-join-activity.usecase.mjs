import { runInStateTransaction } from '../common/state.mjs';
import { joinMallActivity } from '../services/commerce.service.mjs';
import { getMallActivityForJoin } from './mall-query.usecase.mjs';

export const executeMallActivityJoin = async (command) => {
  const activityId = Number(command?.activityId || 0);
  if (!Number.isFinite(activityId) || activityId <= 0) throw new Error('INVALID_ACTIVITY_ID');

  const activity = getMallActivityForJoin({ activityId, actor: command.actor });

  return runInStateTransaction(async () => {
    const joinResult = joinMallActivity({
      tenantId: command.tenantId,
      customerId: command.customerId,
      activityId,
      rewardPoints: Number(activity.rewardPoints || 0),
      activityTitle: String(activity.title || activity.displayTitle || activityId),
      actor: command.actor,
    });
    return {
      joinResult,
      activity: {
        id: activityId,
        title: String(activity.title || activity.displayTitle || ''),
      },
    };
  });
};
