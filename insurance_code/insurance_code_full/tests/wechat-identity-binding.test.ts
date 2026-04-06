import { beforeEach, describe, expect, it, vi } from 'vitest';

const state: any = {
  tenants: [{ id: 2, name: '新华保险' }],
  orgUnits: [{ id: 21, tenantId: 2, name: '默认组织' }],
  teams: [{ id: 31, tenantId: 2, name: '默认团队' }],
  users: [],
  smsCodes: [],
  sessions: [],
};

vi.mock('../server/skeleton-c-v1/common/state.mjs', () => ({
  resolveTenantPointsRuleConfig: vi.fn(() => ({
    signInPoints: 10,
    newCustomerVerifyPoints: 0,
    customerShareIdentifyPoints: 0,
  })),
  runInStateTransaction: vi.fn(async (executor: any) => executor()),
}));

import {
  executeSendAuthCode,
  executeBindWechatIdentity,
  executeResolveWechatH5Session,
  executeResolveWechatIdentity,
  executeVerifyBasic,
} from '../server/skeleton-c-v1/usecases/auth-write.usecase.mjs';

const nextId = (list: any[]) =>
  Array.isArray(list) && list.length ? Math.max(...list.map((row) => Number(row.id) || 0)) + 1 : 1;

describe('wechat identity binding', () => {
  beforeEach(() => {
    state.users = [];
    state.smsCodes = [];
    state.sessions = [];
  });

  it('resolves verified customer by unionid and skips verify', async () => {
    state.users = [
      {
        id: 101,
        tenantId: 2,
        name: '已实名客户',
        mobile: '18600000001',
        unionId: 'union-existing',
        openId: 'openid-existing',
        wechatAppType: 'mini_program',
        isVerifiedBasic: true,
      },
    ];

    const payload = await executeResolveWechatIdentity({
      unionId: 'union-existing',
      openId: '',
      appType: '',
      getState: () => state,
    });

    expect(payload).toEqual({
      matched: true,
      customerId: 101,
      isVerifiedBasic: true,
      skipVerify: true,
      matchType: 'unionid',
    });
  });

  it('rejects binding when identity is already owned by another customer', async () => {
    state.users = [
      {
        id: 101,
        tenantId: 2,
        name: '客户A',
        mobile: '18600000001',
        unionId: 'union-conflict',
        openId: '',
        wechatAppType: '',
        isVerifiedBasic: true,
      },
      {
        id: 102,
        tenantId: 2,
        name: '客户B',
        mobile: '18600000002',
        unionId: '',
        openId: '',
        wechatAppType: '',
        isVerifiedBasic: true,
      },
    ];

    await expect(
      executeBindWechatIdentity({
        customerId: 102,
        actorCustomerId: 102,
        unionId: 'union-conflict',
        openId: '',
        appType: '',
        getState: () => state,
        persistState: vi.fn(),
      })
    ).rejects.toThrow('WECHAT_IDENTITY_CONFLICT');
  });

  it('auto binds wechat identity after verify-basic succeeds', async () => {
    state.smsCodes = [
      {
        id: 1,
        mobile: '18600000003',
        code: '123456',
        tenantId: 2,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        used: false,
        createdAt: new Date().toISOString(),
      },
    ];

    const payload = await executeVerifyBasic({
      name: '张三',
      mobile: '18600000003',
      code: '123456',
      unionId: 'union-new',
      openId: 'openid-new',
      appType: 'mini_program',
      tenant: { id: 2 },
      userAgent: 'Mozilla/5.0 test agent',
      getState: () => state,
      nextId,
      createSession: (userId: number) => {
        const token = `token-${userId}`;
        state.sessions.push({ token, csrfToken: 'csrf-token' });
        return token;
      },
      formatUser: (user: any) => ({
        id: user.id,
        wechat_union_id: user.unionId || '',
        wechat_open_id: user.openId || '',
        wechat_app_type: user.wechatAppType || '',
        wechat_bound_at: user.wechatBoundAt || null,
      }),
      persistState: vi.fn(),
      recordPoints: vi.fn(),
    });

    expect(payload.user.wechat_union_id).toBe('union-new');
    expect(payload.user.wechat_open_id).toBe('openid-new');
    expect(payload.user.wechat_app_type).toBe('mini_program');
    expect(payload.user.wechat_bound_at).toBeTruthy();
    expect(payload.isNewlyVerified).toBe(true);
    expect(state.users[0].unionId).toBe('union-new');
    expect(state.users[0].openId).toBe('openid-new');
    expect(state.users[0].wechatAppType).toBe('mini_program');
    expect(state.users[0].wechatBoundAt).toBeTruthy();
  });

  it('restores session by h5 openid for verified customer', async () => {
    state.users = [
      {
        id: 201,
        tenantId: 2,
        name: '温哈哈',
        mobile: '18616135811',
        unionId: '',
        openId: 'openid-h5-existing',
        wechatAppType: 'h5',
        wechatBoundAt: '2026-03-20T08:00:00.000Z',
        isVerifiedBasic: true,
      },
    ];

    const payload = await executeResolveWechatH5Session({
      code: 'wechat-code',
      getState: () => state,
      createSession: (userId: number) => {
        const token = `token-${userId}`;
        state.sessions.push({ token, csrfToken: `csrf-${userId}` });
        return token;
      },
      formatUser: (user: any) => ({
        id: user.id,
        name: user.name,
        mobile: user.mobile,
        is_verified_basic: Boolean(user.isVerifiedBasic),
      }),
      persistState: vi.fn(),
      resolveWechatH5IdentityByCode: vi.fn(async () => ({
        openId: 'openid-h5-existing',
        unionId: '',
        appType: 'h5',
      })),
    });

    expect(payload).toMatchObject({
      ok: true,
      matched: true,
      customerId: 201,
      isVerifiedBasic: true,
      skipVerify: true,
      matchType: 'openid',
      token: 'token-201',
      csrfToken: 'csrf-201',
      identity: {
        openId: 'openid-h5-existing',
        unionId: '',
        appType: 'h5',
      },
    });
  });

  it('returns verified mobile hint when sending code to an already verified customer', async () => {
    state.users = [
      {
        id: 886,
        tenantId: 2,
        name: '温哈哈',
        nickName: '温哈哈',
        mobile: '18616135811',
        openId: '',
        unionId: '',
        wechatAppType: '',
        wechatBoundAt: null,
        isVerifiedBasic: true,
      },
    ];

    const payload = await executeSendAuthCode({
      mobile: '18616135811',
      tenant: { id: 2 },
      getState: () => state,
      nextId,
      persistState: vi.fn(),
      dateOnly: (date: Date) => date.toISOString().slice(0, 10),
    });

    expect(payload).toMatchObject({
      ok: true,
      isVerifiedBasic: true,
      verifiedName: '温哈哈',
    });
  });

  it('returns verified mobile hint for a public-pool request when customer was verified in another tenant', async () => {
    state.tenants = [
      { id: 2, name: '新华保险', tenantCode: 'xinhua' },
      { id: 6, name: '公共池租户', tenantCode: 'public-pool' },
    ];
    state.users = [
      {
        id: 906,
        tenantId: 2,
        orgId: 21,
        teamId: 31,
        ownerUserId: 8003,
        name: '哈哈',
        nickName: '哈哈',
        mobile: '13800000719',
        openId: '',
        unionId: '',
        wechatAppType: '',
        wechatBoundAt: null,
        isVerifiedBasic: true,
      },
    ];

    const payload = await executeSendAuthCode({
      mobile: '13800000719',
      tenant: { id: 6, tenantCode: 'public-pool', name: '公共池租户' },
      getState: () => state,
      nextId,
      persistState: vi.fn(),
      dateOnly: (date: Date) => date.toISOString().slice(0, 10),
    });

    expect(payload).toMatchObject({
      ok: true,
      isVerifiedBasic: true,
      verifiedName: '哈哈',
    });
  });

  it('creates a new tenant-scoped customer when the same mobile exists in another tenant', async () => {
    state.tenants = [
      { id: 1, name: '旧租户' },
      { id: 2, name: '新华保险' },
    ];
    state.orgUnits = [
      { id: 11, tenantId: 1, name: '旧组织' },
      { id: 21, tenantId: 2, name: '默认组织' },
    ];
    state.teams = [
      { id: 12, tenantId: 1, name: '旧团队' },
      { id: 31, tenantId: 2, name: '默认团队' },
    ];
    state.users = [
      {
        id: 501,
        tenantId: 1,
        orgId: 11,
        teamId: 12,
        ownerUserId: 8001,
        name: '温哈哈',
        nickName: '温哈哈',
        mobile: '18616135811',
        openId: '',
        unionId: '',
        wechatAppType: '',
        wechatBoundAt: null,
        isVerifiedBasic: true,
      },
    ];
    state.smsCodes = [
      {
        id: 2,
        mobile: '18616135811',
        code: '123456',
        tenantId: 2,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        used: false,
        createdAt: new Date().toISOString(),
      },
    ];

    const payload = await executeVerifyBasic({
      name: '温哈哈',
      mobile: '18616135811',
      code: '123456',
      tenant: { id: 2 },
      userAgent: 'Mozilla/5.0 test agent',
      getState: () => state,
      nextId,
      createSession: (userId: number) => {
        const token = `token-${userId}`;
        state.sessions.push({ token, csrfToken: 'csrf-token' });
        return token;
      },
      formatUser: (user: any) => ({
        id: user.id,
        tenantId: user.tenantId,
        mobile: user.mobile,
        name: user.name,
      }),
      persistState: vi.fn(),
      recordPoints: vi.fn(),
    });

    expect(payload.user.id).not.toBe(501);
    expect(payload.user.tenantId).toBe(2);
    expect(payload.isNewlyVerified).toBe(true);
    expect(state.users).toHaveLength(2);
    expect(state.users[0].tenantId).toBe(1);
    expect(state.users[1].tenantId).toBe(2);
    expect(state.users[1].mobile).toBe('18616135811');
    expect(state.users[1].name).toBe('温哈哈');
  });

  it('rejects silent overwrite when verified customer re-verifies with a different name', async () => {
    state.users = [
      {
        id: 886,
        tenantId: 2,
        orgId: 21,
        teamId: 31,
        ownerUserId: 0,
        name: '温哈哈',
        nickName: '温哈哈',
        mobile: '18616135811',
        openId: '',
        unionId: '',
        wechatAppType: '',
        wechatBoundAt: null,
        isVerifiedBasic: true,
        verifiedAt: '2026-03-20T07:58:21.919Z',
        createdAt: '2026-03-20T07:58:21.919Z',
      },
    ];
    state.smsCodes = [
      {
        id: 3,
        mobile: '18616135811',
        code: '123456',
        tenantId: 2,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        used: false,
        createdAt: new Date().toISOString(),
      },
    ];

    await expect(
      executeVerifyBasic({
        name: '王哈哈',
        mobile: '18616135811',
        code: '123456',
        tenant: { id: 2 },
        userAgent: 'Mozilla/5.0 test agent',
        getState: () => state,
        nextId,
        createSession: vi.fn(),
        formatUser: vi.fn(),
        persistState: vi.fn(),
        recordPoints: vi.fn(),
      })
    ).rejects.toThrow('CUSTOMER_REALNAME_MISMATCH');

    expect(state.users[0].name).toBe('温哈哈');
  });

  it('allows verified customer to pass verify-basic without resubmitting name', async () => {
    state.users = [
      {
        id: 886,
        tenantId: 2,
        orgId: 21,
        teamId: 31,
        ownerUserId: 0,
        name: '温哈哈',
        nickName: '温哈哈',
        mobile: '18616135811',
        openId: '',
        unionId: '',
        wechatAppType: '',
        wechatBoundAt: null,
        isVerifiedBasic: true,
        verifiedAt: '2026-03-20T07:58:21.919Z',
        createdAt: '2026-03-20T07:58:21.919Z',
      },
    ];
    state.smsCodes = [
      {
        id: 4,
        mobile: '18616135811',
        code: '123456',
        tenantId: 2,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        used: false,
        createdAt: new Date().toISOString(),
      },
    ];

    const payload = await executeVerifyBasic({
      name: '',
      mobile: '18616135811',
      code: '123456',
      tenant: { id: 2 },
      userAgent: 'Mozilla/5.0 test agent',
      getState: () => state,
      nextId,
      createSession: (userId: number) => `token-${userId}`,
      formatUser: (user: any) => ({
        id: user.id,
        name: user.name,
        mobile: user.mobile,
      }),
      persistState: vi.fn(),
      recordPoints: vi.fn(),
    });

    expect(payload.user).toMatchObject({
      id: 886,
      name: '温哈哈',
      mobile: '18616135811',
    });
    expect(payload.isNewlyVerified).toBe(false);
  });

  it('logs into the existing verified customer for a public-pool verify-basic request', async () => {
    state.tenants = [
      { id: 2, name: '新华保险', tenantCode: 'xinhua' },
      { id: 6, name: '公共池租户', tenantCode: 'public-pool' },
    ];
    state.users = [
      {
        id: 906,
        tenantId: 2,
        orgId: 21,
        teamId: 31,
        ownerUserId: 8003,
        name: '哈哈',
        nickName: '自动分配客户',
        mobile: '13800000719',
        openId: '',
        unionId: '',
        wechatAppType: '',
        wechatBoundAt: null,
        isVerifiedBasic: true,
        verifiedAt: '2026-03-29T11:59:37.455Z',
        createdAt: '2026-03-01T11:55:21.756Z',
      },
    ];
    state.smsCodes = [
      {
        id: 99,
        mobile: '13800000719',
        code: '123456',
        tenantId: 6,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        used: false,
        createdAt: new Date().toISOString(),
      },
    ];

    const payload = await executeVerifyBasic({
      name: '',
      mobile: '13800000719',
      code: '123456',
      tenant: { id: 6, tenantCode: 'public-pool', name: '公共池租户' },
      userAgent: 'Mozilla/5.0 test agent',
      getState: () => state,
      nextId,
      createSession: (userId: number) => `token-${userId}`,
      formatUser: (user: any) => ({
        id: user.id,
        tenantId: user.tenantId,
        name: user.name,
        mobile: user.mobile,
      }),
      persistState: vi.fn(),
      recordPoints: vi.fn(),
    });

    expect(payload.user).toMatchObject({
      id: 906,
      tenantId: 2,
      name: '哈哈',
      mobile: '13800000719',
    });
    expect(payload.isNewlyVerified).toBe(false);
    expect(state.users).toHaveLength(1);
  });
});
