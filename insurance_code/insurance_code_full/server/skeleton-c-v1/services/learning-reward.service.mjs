import { settleLearningRewardOverHttp } from '../../microservices/learning-service/points-service.client.mjs';

export async function settleLearningCourseRewardViaPointsService({
  tenantId = 1,
  tenantCode = null,
  userId,
  courseId,
  courseTitle,
  rewardPoints,
  traceId = null,
  requestId = null,
}) {
  return settleLearningRewardOverHttp({
    tenantId,
    tenantCode,
    userId,
    courseId,
    courseTitle,
    rewardPoints,
    traceId,
    requestId,
  });
}
