import { beforeEach, describe, expect, it, vi } from 'vitest';

const state: any = {
  roles: [
    { id: 1, key: 'agent' },
  ],
  userRoles: [
    { tenantId: 2, userType: 'agent', userId: 201, roleId: 1 },
  ],
  permissions: [],
  rolePermissions: [],
  agents: [
    { id: 201, tenantId: 2, orgId: 20, teamId: 30, role: 'salesperson', name: '业务员A' },
  ],
  users: [],
  sessions: [],
  signIns: [],
  courseCompletions: [],
  activityCompletions: [],
  redemptions: [],
  learningCourses: [],
  mallItems: [],
  orders: [],
  activities: [],
  mallActivities: [],
  bCustomerActivities: [],
  trackEvents: [],
};

vi.mock('../server/skeleton-c-v1/common/state.mjs', () => ({
  getState: () => state,
  resolveUserFromBearer: vi.fn(() => null),
}));

import { getDashboardCustomerActivityFeed } from '../server/skeleton-c-v1/services/share.service.mjs';

function isoAt(offsetDays: number, hour: number, minute = 0) {
  const dt = new Date();
  dt.setHours(hour, minute, 0, 0);
  dt.setDate(dt.getDate() + offsetDays);
  return dt.toISOString();
}

describe('getDashboardCustomerActivityFeed', () => {
  beforeEach(() => {
    state.users = [
      {
        id: 501,
        tenantId: 2,
        orgId: 20,
        teamId: 30,
        ownerUserId: 201,
        name: '今天有动态的客户',
        mobile: '18800000001',
        verifiedAt: isoAt(0, 9, 30),
      },
      {
        id: 502,
        tenantId: 2,
        orgId: 20,
        teamId: 31,
        ownerUserId: 999,
        name: '不归当前业务员',
        mobile: '18800000002',
      },
    ];
    state.sessions = [
      { id: 1, userId: 501, createdAt: isoAt(0, 8, 0) },
      { id: 2, userId: 501, createdAt: isoAt(-1, 23, 0) },
    ];
    state.learningCourses = [{ id: 301, title: '养老规划入门' }];
    state.activities = [{ id: 401, title: '客户答谢会', rewardPoints: 12 }];
    state.mallItems = [{ id: 701, sourceProductId: 701, name: '体检礼包' }];
    state.orders = [{ id: 801, customerId: 501, productId: 701, productName: '体检礼包', orderType: 'product' }];
    state.trackEvents = [
      {
        id: 11,
        tenantId: 2,
        actorType: 'customer',
        actorId: 501,
        event: 'c_page_view',
        createdAt: isoAt(0, 8, 10),
        path: '/learning',
        source: 'c-web',
        properties: { tab: 'learning' },
      },
      {
        id: 12,
        tenantId: 2,
        actorType: 'customer',
        actorId: 501,
        event: 'c_auth_verified',
        createdAt: isoAt(0, 9, 30),
        path: '/profile',
        source: 'c-web',
        properties: {},
      },
      {
        id: 13,
        tenantId: 2,
        actorType: 'customer',
        actorId: 501,
        event: 'c_share_success',
        createdAt: isoAt(0, 10, 0),
        path: '/activities',
        source: 'c-web',
        properties: { tab: 'activities' },
      },
      {
        id: 14,
        tenantId: 2,
        actorType: 'customer',
        actorId: 502,
        event: 'c_page_view',
        createdAt: isoAt(0, 11, 0),
        path: '/mall',
        source: 'c-web',
        properties: { tab: 'mall' },
      },
      {
        id: 15,
        tenantId: 2,
        actorType: 'customer',
        actorId: 501,
        event: 'c_page_view',
        createdAt: isoAt(-1, 18, 0),
        path: '/home',
        source: 'c-web',
        properties: { tab: 'home' },
      },
    ];
    state.signIns = [
      { id: 21, tenantId: 2, userId: 501, signDate: isoAt(0, 0, 0).slice(0, 10), createdAt: isoAt(0, 10, 20), pointsAwarded: 10 },
    ];
    state.courseCompletions = [
      { id: 31, tenantId: 2, userId: 501, courseId: 301, courseTitle: '养老规划入门', completedAt: isoAt(0, 11, 10), pointsAwarded: 6 },
    ];
    state.activityCompletions = [
      { id: 41, tenantId: 2, userId: 501, activityId: 401, completedAt: isoAt(0, 12, 0), pointsAwarded: 12 },
    ];
    state.redemptions = [
      { id: 51, tenantId: 2, userId: 501, itemId: 701, orderId: 801, createdAt: isoAt(0, 13, 0) },
    ];
  });

  it('returns only today activity rows for customers visible to the current agent', () => {
    const result = getDashboardCustomerActivityFeed({
      actor: {
        actorId: 201,
        actorType: 'agent',
        tenantId: 2,
        teamId: 30,
      },
      query: { limit: 20 },
    });

    expect(result.ok).toBe(true);
    expect(result.rangeLabel).toBe('今日');
    expect(result.list.length).toBe(8);
    expect(result.list.every((row) => Number(row.userId || 0) === 501)).toBe(true);
    expect(result.list.map((row) => row.category)).toEqual(
      expect.arrayContaining(['login', 'page_view', 'verify', 'share', 'sign_in', 'learning', 'activity', 'redeem']),
    );
    expect(result.list.some((row) => row.event === '登录 C 端')).toBe(true);
    expect(result.list.some((row) => row.event === '完成实名认证')).toBe(true);
    expect(result.list.some((row) => row.event === '分享成功')).toBe(true);
    expect(result.list.some((row) => row.event.includes('完成学习：养老规划入门'))).toBe(true);
    expect(result.list.some((row) => row.event.includes('参与活动：客户答谢会'))).toBe(true);
    expect(result.list.some((row) => row.event.includes('积分兑换商品：体检礼包'))).toBe(true);
    expect(result.list.some((row) => String(row.occurredAt || '').startsWith(isoAt(-1, 18, 0).slice(0, 10)))).toBe(false);
  });

  it('returns the full same-day feed when limit is all', () => {
    state.sessions = Array.from({ length: 36 }, (_, index) => ({
      id: index + 1,
      userId: 501,
      createdAt: isoAt(0, 6 + Math.floor(index / 6), index % 60),
    }));
    state.trackEvents = [];
    state.signIns = [];
    state.courseCompletions = [];
    state.activityCompletions = [];
    state.redemptions = [];

    const limited = getDashboardCustomerActivityFeed({
      actor: {
        actorId: 201,
        actorType: 'agent',
        tenantId: 2,
        teamId: 30,
      },
      query: { limit: 10 },
    });

    const full = getDashboardCustomerActivityFeed({
      actor: {
        actorId: 201,
        actorType: 'agent',
        tenantId: 2,
        teamId: 30,
      },
      query: { limit: 'all' },
    });

    expect(limited.total).toBe(full.total);
    expect(limited.list).toHaveLength(10);
    expect(full.total).toBeGreaterThan(10);
    expect(full.list).toHaveLength(full.total);
  });
});
