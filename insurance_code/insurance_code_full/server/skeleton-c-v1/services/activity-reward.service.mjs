import { settleActivityRewardOverHttp } from '../../microservices/activity-service/points-service.client.mjs';

export async function settleActivityRewardViaPointsService({
  tenantId = 1,
  tenantCode = null,
  userId,
  activityId,
  activityTitle,
  rewardPoints,
  completionDate,
  traceId = null,
  requestId = null,
}) {
  return settleActivityRewardOverHttp({
    tenantId,
    tenantCode,
    userId,
    activityId,
    activityTitle,
    rewardPoints,
    completionDate,
    traceId,
    requestId,
  });
}
