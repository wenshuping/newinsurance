import { beforeEach, describe, expect, it, vi } from 'vitest';

const state: any = {
  roles: [
    { id: 1, key: 'company_admin' },
    { id: 2, key: 'team_lead' },
    { id: 3, key: 'agent' },
  ],
  userRoles: [
    { tenantId: 2, userType: 'agent', userId: 201, roleId: 3 },
  ],
  agents: [
    { id: 201, tenantId: 2, orgId: 20, teamId: 30, role: 'salesperson', name: '业务员A' },
  ],
  users: [],
  activities: [],
  learningCourses: [],
  pProducts: [],
  mallActivities: [],
  bCustomerActivities: [],
  trackEvents: [],
  pointsRuleConfigs: [],
  pointAccounts: [],
  pointTransactions: [],
};

vi.mock('../server/skeleton-c-v1/common/state.mjs', () => ({
  getState: () => state,
  resolveUserFromBearer: vi.fn((authorization?: string) => {
    const token = String(authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (token === 'new-customer-token') {
      return state.users.find((row: any) => Number(row.id) === 502) || null;
    }
    return null;
  }),
}));

import {
  assignSharedCustomerOwner,
  buildShareCreateTrackContext,
  createShareLink,
  getCustomerShareNetwork,
  resolveShareDetail,
  settleCustomerShareIdentifyReward,
} from '../server/skeleton-c-v1/services/share.service.mjs';

function createReq() {
  return {
    protocol: 'http',
    headers: {
      origin: 'http://127.0.0.1:3003',
    },
    get(name: string) {
      if (String(name).toLowerCase() === 'host') return '127.0.0.1:3003';
      return '';
    },
    path: '/api/c/shares',
  } as any;
}

describe('customer share owner binding', () => {
  beforeEach(() => {
    state.users = [
      {
        id: 501,
        tenantId: 2,
        orgId: 20,
        teamId: 30,
        ownerUserId: 201,
        name: '已归属客户',
        mobile: '18600000001',
      },
      {
        id: 502,
        tenantId: 2,
        orgId: 0,
        teamId: 0,
        ownerUserId: 0,
        name: '新客户',
        mobile: '18600000002',
      },
    ];
    state.activities = [
      {
        id: 11,
        tenantId: 2,
        createdBy: 201,
        creatorRole: 'agent',
        status: '进行中',
        title: '客户分享活动',
        content: '活动详情',
        rewardPoints: 12,
      },
    ];
    state.trackEvents = [];
    state.pointsRuleConfigs = [];
    state.pointAccounts = [];
    state.pointTransactions = [];
  });

  it('binds newly identified customer to the sharer business manager', () => {
    const req = createReq();
    const share = createShareLink({
      req,
      actor: {
        actorType: 'customer',
        actorId: 501,
        tenantId: 2,
        orgId: 20,
        teamId: 30,
      },
      body: {
        shareType: 'activity',
        targetId: 11,
        channel: 'customer_forward',
      },
    });

    const detail = resolveShareDetail({ req, shareCode: share.shareCode });
    expect(detail.salesId).toBe(201);

    state.trackEvents.push({
      id: 1,
      ...buildShareCreateTrackContext({
        req,
        actor: {
          actorType: 'customer',
          actorId: 501,
          tenantId: 2,
          orgId: 20,
          teamId: 30,
        },
        body: {
          shareType: 'activity',
          targetId: 11,
          channel: 'customer_forward',
        },
        share,
      }),
    });

    const updatedCustomer = assignSharedCustomerOwner({
      req: {
        ...req,
        path: `/api/share/${share.shareCode}/identify`,
        user: state.users.find((row: any) => Number(row.id) === 502),
        headers: {
          ...req.headers,
          authorization: 'Bearer new-customer-token',
        },
      },
      shareCode: share.shareCode,
    });

    expect(updatedCustomer).toBeTruthy();
    expect(updatedCustomer.ownerUserId).toBe(201);
    expect(updatedCustomer.orgId).toBe(20);
    expect(updatedCustomer.teamId).toBe(30);
    expect(updatedCustomer.referrerCustomerId).toBe(501);
    expect(updatedCustomer.referrerShareCode).toBe(share.shareCode);
    expect(state.users.find((row: any) => Number(row.id) === 502)?.ownerUserId).toBe(201);
  });

  it('prefers the sharer customer current owner over stale share salesId', () => {
    state.users[0].ownerUserId = 201;
    const req = createReq();
    const share = createShareLink({
      req,
      actor: {
        actorType: 'customer',
        actorId: 501,
        tenantId: 2,
        orgId: 20,
        teamId: 30,
        ownerUserId: 999,
      },
      body: {
        shareType: 'activity',
        targetId: 11,
        channel: 'customer_forward',
      },
    });

    state.trackEvents.push({
      id: 1,
      ...buildShareCreateTrackContext({
        req,
        actor: {
          actorType: 'customer',
          actorId: 501,
          tenantId: 2,
          orgId: 20,
          teamId: 30,
          ownerUserId: 999,
        },
        body: {
          shareType: 'activity',
          targetId: 11,
          channel: 'customer_forward',
        },
        share,
      }),
    });

    const updatedCustomer = assignSharedCustomerOwner({
      req: {
        ...req,
        path: `/api/share/${share.shareCode}/identify`,
        user: state.users.find((row: any) => Number(row.id) === 502),
        headers: {
          ...req.headers,
          authorization: 'Bearer new-customer-token',
        },
      },
      shareCode: share.shareCode,
    });

    expect(updatedCustomer).toBeTruthy();
    expect(updatedCustomer.ownerUserId).toBe(201);
    expect(updatedCustomer.referrerCustomerId).toBe(501);
  });

  it('builds upstream and invited friend network for a customer', () => {
    const req = createReq();
    const share = createShareLink({
      req,
      actor: {
        actorType: 'customer',
        actorId: 501,
        tenantId: 2,
        orgId: 20,
        teamId: 30,
      },
      body: {
        shareType: 'activity',
        targetId: 11,
        channel: 'customer_forward',
      },
    });

    state.users.push({
      id: 503,
      tenantId: 2,
      orgId: 20,
      teamId: 30,
      ownerUserId: 201,
      referrerCustomerId: 501,
      referrerShareCode: share.shareCode,
      referredAt: '2026-03-25T09:00:00.000Z',
      name: '朋友A',
      mobile: '18600000003',
      isVerifiedBasic: true,
      verifiedAt: '2026-03-25T09:00:00.000Z',
    });

    state.users[1].referrerCustomerId = 501;
    state.users[1].referrerShareCode = share.shareCode;
    state.users[1].referredAt = '2026-03-25T08:00:00.000Z';
    state.users[1].isVerifiedBasic = true;
    state.users[1].verifiedAt = '2026-03-25T08:00:00.000Z';

    const sharerNetwork = getCustomerShareNetwork({ customerId: 501, tenantId: 2 });
    expect(sharerNetwork.upstream).toBeNull();
    expect(sharerNetwork.invitedFriends.map((row: any) => Number(row.id))).toEqual([503, 502]);

    const referredNetwork = getCustomerShareNetwork({ customerId: 502, tenantId: 2 });
    expect(referredNetwork.upstream).toMatchObject({
      id: 501,
      label: '上游分享人',
      shareCode: share.shareCode,
    });
  });

  it('falls back to auth-verified events when identify event is missing', () => {
    const shareCode = 'sh1.test-fallback';
    state.users.push({
      id: 503,
      tenantId: 2,
      orgId: 20,
      teamId: 30,
      ownerUserId: 0,
      name: '朋友B',
      mobile: '18600000003',
      isVerifiedBasic: true,
      verifiedAt: '2026-03-25T10:00:00.000Z',
    });

    state.trackEvents.push(
      {
        id: 1,
        event: 'share_link_created',
        actorType: 'customer',
        actorId: 501,
        tenantId: 2,
        createdAt: '2026-03-25T09:59:00.000Z',
        properties: { shareCode },
      },
      {
        id: 2,
        event: 'c_auth_verified',
        actorType: 'customer',
        actorId: 503,
        tenantId: 2,
        createdAt: '2026-03-25T10:00:00.000Z',
        path: `/profile?tenantId=2&shareCode=${shareCode}&fromShare=1`,
        properties: {},
      }
    );

    const sharerNetwork = getCustomerShareNetwork({ customerId: 501, tenantId: 2 });
    expect(sharerNetwork.invitedFriends.map((row: any) => Number(row.id))).toEqual([503]);

    const referredNetwork = getCustomerShareNetwork({ customerId: 503, tenantId: 2 });
    expect(referredNetwork.upstream).toMatchObject({
      id: 501,
      label: '上游分享人',
      shareCode,
    });
  });

  it('creates home route shares with the customer owner as salesId', () => {
    const req = createReq();
    const share = createShareLink({
      req,
      actor: {
        actorType: 'customer',
        actorId: 501,
        tenantId: 2,
        orgId: 20,
        teamId: 30,
      },
      body: {
        shareType: 'home_route',
        channel: 'customer_forward',
        sharePath: '/advisor?tenantId=2',
      },
    });

    const detail = resolveShareDetail({ req, shareCode: share.shareCode });
    expect(detail.shareType).toBe('home_route');
    expect(detail.salesId).toBe(201);
    expect(detail.loginRequired).toBe(false);
    expect(detail.targetCPath).toContain('/?');
  });

  it('rewards the sharing customer when a new customer completes real-name via the share', () => {
    const req = createReq();
    const share = createShareLink({
      req,
      actor: {
        actorType: 'customer',
        actorId: 501,
        tenantId: 2,
        orgId: 20,
        teamId: 30,
      },
      body: {
        shareType: 'activity',
        targetId: 11,
        channel: 'customer_forward',
      },
    });

    state.trackEvents.push({
      id: 1,
      ...buildShareCreateTrackContext({
        req,
        actor: {
          actorType: 'customer',
          actorId: 501,
          tenantId: 2,
          orgId: 20,
          teamId: 30,
        },
        body: {
          shareType: 'activity',
          targetId: 11,
          channel: 'customer_forward',
        },
        share,
      }),
    });

    const recordPoints = vi.fn(() => ({ duplicated: false, balance: 88 }));
    const result = settleCustomerShareIdentifyReward({
      req,
      shareCode: share.shareCode,
      identifiedCustomerId: 502,
      rewardPoints: 88,
      recordPoints,
    });

    expect(result).toMatchObject({
      rewarded: true,
      sharerCustomerId: 501,
      amount: 88,
    });
    expect(recordPoints).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 2,
        userId: 501,
        direction: 'in',
        amount: 88,
        sourceType: 'customer_share_identify',
        sourceId: expect.stringMatching(/^share:[a-f0-9]{32}$/),
        idempotencyKey: expect.stringMatching(/^customer_share_identify:2:[a-f0-9]{32}$/),
      })
    );
  });

  it('falls back to the identified customer referrer when the share-create track is missing', () => {
    const req = createReq();
    const share = createShareLink({
      req,
      actor: {
        actorType: 'customer',
        actorId: 501,
        tenantId: 2,
        orgId: 20,
        teamId: 30,
      },
      body: {
        shareType: 'home_route',
        channel: 'customer_forward',
        sharePath: '/',
      },
    });

    state.users[1].referrerCustomerId = 501;
    state.users[1].referrerShareCode = share.shareCode;

    const recordPoints = vi.fn(() => ({ duplicated: false, balance: 10 }));
    const result = settleCustomerShareIdentifyReward({
      req,
      shareCode: share.shareCode,
      identifiedCustomerId: 502,
      rewardPoints: 10,
      recordPoints,
    });

    expect(result).toMatchObject({
      rewarded: true,
      sharerCustomerId: 501,
      amount: 10,
    });
    expect(recordPoints).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 2,
        userId: 501,
        direction: 'in',
        amount: 10,
        sourceType: 'customer_share_identify',
      }),
    );
  });

  it('does not reward when the sharer is the same customer', () => {
    const req = createReq();
    const share = createShareLink({
      req,
      actor: {
        actorType: 'customer',
        actorId: 501,
        tenantId: 2,
        orgId: 20,
        teamId: 30,
      },
      body: {
        shareType: 'activity',
        targetId: 11,
        channel: 'customer_forward',
      },
    });

    state.trackEvents.push({
      id: 1,
      ...buildShareCreateTrackContext({
        req,
        actor: {
          actorType: 'customer',
          actorId: 501,
          tenantId: 2,
          orgId: 20,
          teamId: 30,
        },
        body: {
          shareType: 'activity',
          targetId: 11,
          channel: 'customer_forward',
        },
        share,
      }),
    });

    const recordPoints = vi.fn();
    const result = settleCustomerShareIdentifyReward({
      req,
      shareCode: share.shareCode,
      identifiedCustomerId: 501,
      rewardPoints: 88,
      recordPoints,
    });

    expect(result).toMatchObject({
      rewarded: false,
      reason: 'self_identify',
    });
    expect(recordPoints).not.toHaveBeenCalled();
  });
});
