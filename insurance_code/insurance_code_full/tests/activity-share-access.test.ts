import { beforeEach, describe, expect, it, vi } from 'vitest';

let mockState: any = {
  activities: [],
  activityCompletions: [],
  signIns: [],
};

let mockSharedActivity: any = null;

vi.mock('../server/skeleton-c-v1/common/state.mjs', () => ({
  getState: () => mockState,
  getBalance: () => 0,
  dateOnly: () => '2026-04-01',
}));

vi.mock('../server/skeleton-c-v1/common/template-visibility.mjs', () => ({
  canDeliverTemplateToActor: () => false,
}));

vi.mock('../server/skeleton-c-v1/services/share.service.mjs', () => ({
  resolveSharedActivityByShare: ({ activityId }: { activityId: number }) =>
    Number(mockSharedActivity?.id || 0) === Number(activityId || 0) ? mockSharedActivity : null,
}));

import { listActivitiesResponse } from '../server/skeleton-c-v1/routes/activities.routes.mjs';

function createReq() {
  return {
    query: {
      shareCode: 'share-activity-demo',
      fromShare: '1',
      activityId: '70',
    },
  };
}

describe('activity share access', () => {
  beforeEach(() => {
    mockState = {
      activities: [],
      activityCompletions: [],
      signIns: [],
    };
    mockSharedActivity = {
      id: 70,
      tenantId: 2,
      title: '活动中心历史完成回归_agent_1773998251332',
      category: 'task',
      content: '分享活动详情',
      description: '分享活动详情',
      status: 'published',
      rewardPoints: 9,
      participants: 3,
      sourceDomain: 'activity',
      media: [],
    };
  });

  it('includes the shared activity in the activities list for anonymous viewers', () => {
    const payload = listActivitiesResponse({
      actor: { actorType: 'anonymous', actorId: 0, tenantId: 2 },
      user: null,
      req: createReq(),
    });

    expect(payload.activities).toHaveLength(1);
    expect(payload.activities[0]).toMatchObject({
      id: 70,
      title: '活动中心历史完成回归_agent_1773998251332',
    });
  });

  it('does not inject a shared activity when share context is absent', () => {
    const payload = listActivitiesResponse({
      actor: { actorType: 'anonymous', actorId: 0, tenantId: 2 },
      user: null,
      req: { query: {} },
    });

    expect(payload.activities).toHaveLength(0);
  });

  it('does not mark an activity completed before reward settlement is recorded', () => {
    mockState = {
      activities: [mockSharedActivity],
      activityCompletions: [
        {
          id: 12,
          tenantId: 2,
          userId: 938,
          activityId: 70,
          completedDate: '2026-04-01',
        },
      ],
      pointTransactions: [],
      signIns: [],
    };

    const payload = listActivitiesResponse({
      actor: { actorType: 'customer', actorId: 938, tenantId: 2 },
      user: { id: 938 },
      req: createReq(),
    });

    expect(payload.activities[0]?.completed).toBe(false);
  });

  it('marks an activity completed when reward settlement exists', () => {
    mockState = {
      activities: [mockSharedActivity],
      activityCompletions: [
        {
          id: 12,
          tenantId: 2,
          userId: 938,
          activityId: 70,
          completedDate: '2026-04-01',
        },
      ],
      pointTransactions: [
        {
          id: 99,
          idempotencyKey: 'activity-reward:2:938:70:2026-04-01',
        },
      ],
      signIns: [],
    };

    const payload = listActivitiesResponse({
      actor: { actorType: 'customer', actorId: 938, tenantId: 2 },
      user: { id: 938 },
      req: createReq(),
    });

    expect(payload.activities[0]?.completed).toBe(true);
  });
});
