import { beforeEach, describe, expect, it, vi } from 'vitest';

const serviceMocks = vi.hoisted(() => ({
  recordPoints: vi.fn(),
}));

const observabilityMocks = vi.hoisted(() => ({
  recordPointsOperationOutcome: vi.fn(),
}));

vi.mock('../server/skeleton-c-v1/services/points.service.mjs', () => ({
  recordPoints: serviceMocks.recordPoints,
}));

vi.mock('../server/microservices/points-service/observability.mjs', () => ({
  recordPointsOperationOutcome: observabilityMocks.recordPointsOperationOutcome,
}));

import { settleLearningCourseReward } from '../server/microservices/points-service/learning-reward.contract.mjs';
import { settleActivityReward } from '../server/microservices/points-service/activity-reward.contract.mjs';

describe('points reward contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceMocks.recordPoints.mockReturnValue({
      duplicated: false,
      balance: 245,
      transaction: { id: 1704 },
    });
  });

  it('passes tenantId into learning reward point settlement', () => {
    settleLearningCourseReward({
      tenantId: 2,
      userId: 9,
      courseId: 124,
      courseTitle: '测试课程',
      rewardPoints: 50,
      traceId: 'trace-learning',
    });

    expect(serviceMocks.recordPoints).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 2,
        userId: 9,
        amount: 50,
        sourceType: 'course_complete',
      }),
    );
  });

  it('passes tenantId into activity reward point settlement', () => {
    settleActivityReward({
      tenantId: 2,
      userId: 9,
      activityId: 70,
      activityTitle: '测试活动',
      rewardPoints: 10,
      completionDate: '2026-03-30',
      traceId: 'trace-activity',
    });

    expect(serviceMocks.recordPoints).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 2,
        userId: 9,
        amount: 10,
        sourceType: 'activity_task',
      }),
    );
  });
});
