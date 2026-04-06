import { beforeEach, describe, expect, it, vi } from 'vitest';

let mockState: any = {
  activities: [],
  activityCompletions: [],
};

vi.mock('../server/skeleton-c-v1/common/state.mjs', () => ({
  getState: () => mockState,
  getBalance: () => 0,
  dateOnly: () => '2026-04-03',
}));

vi.mock('../server/skeleton-c-v1/common/template-visibility.mjs', () => ({
  canDeliverTemplateToActor: () => false,
}));

vi.mock('../server/skeleton-c-v1/services/share.service.mjs', () => ({
  resolveSharedActivityByShare: () => null,
}));

import { listActivityHistoryResponse } from '../server/skeleton-c-v1/routes/activities.routes.mjs';

describe('activity history response', () => {
  beforeEach(() => {
    mockState = {
      activities: [
        {
          id: 70,
          title: '活动中心历史完成回归_agent_1773998251332',
          description: '历史完成回归验证-agent',
          rewardPoints: 9,
          sourceDomain: 'activity',
        },
      ],
      activityCompletions: [
        {
          id: 12,
          tenantId: 2,
          userId: 938,
          activityId: 70,
          pointsAwarded: 9,
          completedAt: '2026-04-03T10:43:15.000Z',
        },
      ],
    };
  });

  it('backfills completed date from completedAt for persisted activity records', () => {
    const payload = listActivityHistoryResponse({
      user: { id: 938 },
    });

    expect(payload.total).toBe(1);
    expect(payload.list[0]).toMatchObject({
      id: 12,
      activityId: 70,
      orderId: expect.any(Number),
      completedAt: '2026-04-03T10:43:15.000Z',
      completedDate: '2026-04-03',
      createdAt: '2026-04-03T10:43:15.000Z',
      writeoffStatus: 'pending',
      writtenOffAt: null,
      writeoffToken: expect.any(String),
    });
  });
});
