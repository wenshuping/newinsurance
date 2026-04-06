import { beforeEach, describe, expect, it, vi } from 'vitest';

const state: any = {
  roles: [],
  userRoles: [],
  rolePermissions: [],
  permissions: [],
  agents: [],
  users: [],
  activities: [],
  learningCourses: [],
  pProducts: [],
  mallActivities: [],
  bCustomerActivities: [],
  trackEvents: [],
};

vi.mock('../server/skeleton-c-v1/common/state.mjs', () => ({
  getState: () => state,
}));

import { listShareRecords } from '../server/skeleton-c-v1/services/share.service.mjs';

describe('share overview channel filter', () => {
  beforeEach(() => {
    state.trackEvents = [
      {
        id: 1,
        event: 'share_link_created',
        actorType: 'employee',
        actorId: 201,
        tenantId: 2,
        teamId: 30,
        createdAt: '2026-04-02T09:00:00.000Z',
        properties: {
          shareCode: 'b-share-1',
          shareType: 'learning_course',
          targetId: 11,
          targetTitle: '课程A',
          channel: 'b-web',
          shareUrl: 'http://127.0.0.1:3003/share/b-share-1',
        },
      },
      {
        id: 2,
        event: 'share_link_created',
        actorType: 'customer',
        actorId: 501,
        tenantId: 2,
        teamId: 30,
        createdAt: '2026-04-02T09:10:00.000Z',
        properties: {
          shareCode: 'c-share-1',
          shareType: 'learning_course',
          targetId: 11,
          targetTitle: '课程A',
          channel: 'customer_forward',
          shareUrl: 'http://127.0.0.1:3003/share/c-share-1',
        },
      },
      {
        id: 3,
        event: 'share_link_created',
        actorType: 'employee',
        actorId: 201,
        tenantId: 2,
        teamId: 30,
        createdAt: '2026-04-02T09:20:00.000Z',
        properties: {
          shareCode: 'activity-share-1',
          shareType: 'activity',
          targetId: 21,
          targetTitle: '活动A',
          channel: 'b-web',
          shareUrl: 'http://127.0.0.1:3003/share/activity-share-1',
        },
      },
    ];
  });

  it('returns separated B and C share rows for the same course type', () => {
    const actor = { actorType: 'employee', actorId: 9001, tenantId: 2 };

    const allRows = listShareRecords({ actor, query: { shareType: 'learning_course' } });
    const bRows = listShareRecords({ actor, query: { shareType: 'learning_course', channel: 'b-web' } });
    const cRows = listShareRecords({ actor, query: { shareType: 'learning_course', channel: 'customer_forward' } });

    expect(allRows.list).toHaveLength(2);
    expect(bRows.list).toHaveLength(1);
    expect(cRows.list).toHaveLength(1);
    expect(bRows.list[0]?.channel).toBe('b-web');
    expect(cRows.list[0]?.channel).toBe('customer_forward');
    expect(bRows.summary.totalLinks).toBe(1);
    expect(cRows.summary.totalLinks).toBe(1);
  });
});
