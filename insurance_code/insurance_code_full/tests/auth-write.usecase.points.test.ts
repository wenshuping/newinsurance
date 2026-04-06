import { beforeEach, describe, expect, it, vi } from 'vitest';

const { resolveTenantPointsRuleConfig, runInStateTransaction } = vi.hoisted(() => ({
  resolveTenantPointsRuleConfig: vi.fn(),
  runInStateTransaction: vi.fn(async (work: any) => work()),
}));

vi.mock('../server/skeleton-c-v1/common/state.mjs', () => ({
  resolveTenantPointsRuleConfig,
  runInStateTransaction,
}));

import { executeVerifyBasic } from '../server/skeleton-c-v1/usecases/auth-write.usecase.mjs';

describe('executeVerifyBasic points rewards', () => {
  let state: any;

  beforeEach(() => {
    state = {
      users: [
        {
          id: 916,
          tenantId: 2,
          orgId: 2,
          teamId: 2,
          ownerUserId: 0,
          referrerCustomerId: 9,
          referrerShareCode: 'share-code-916',
          referredAt: null,
          name: '会计',
          mobile: '19776689987',
          nickName: '会计',
          avatarUrl: '',
          memberLevel: 1,
          growthValue: 0,
          lastActiveAt: null,
          deviceInfo: '',
          isVerifiedBasic: false,
          verifiedAt: null,
          createdAt: '2026-03-30T12:15:40.000Z',
        },
      ],
      tenants: [{ id: 2, name: '租户A' }],
      orgUnits: [{ id: 2, tenantId: 2, name: '租户A机构' }],
      teams: [{ id: 2, tenantId: 2, orgId: 2, name: '租户A团队' }],
      smsCodes: [
        {
          id: 1,
          mobile: '19776689987',
          code: '123456',
          tenantId: 2,
          expiresAt: '2099-01-01T00:00:00.000Z',
          used: false,
          createdAt: '2026-03-30T12:15:40.000Z',
        },
      ],
      sessions: [],
    };
    resolveTenantPointsRuleConfig.mockReset();
    resolveTenantPointsRuleConfig.mockReturnValue({
      tenantId: 2,
      signInPoints: 10,
      newCustomerVerifyPoints: 200,
      customerShareIdentifyPoints: 10,
    });
    runInStateTransaction.mockClear();
  });

  it('awards onboarding points when an existing unverified customer completes the first verification', async () => {
    const recordPoints = vi.fn(() => ({
      duplicated: false,
      transaction: { id: 7001 },
      balance: 200,
    }));
    const persistCustomersByIds = vi.fn(async () => undefined);
    const persistSessionsByTokens = vi.fn(async () => undefined);
    const persistSmsCodesByIds = vi.fn(async () => undefined);
    const persistPointTransactionsByIds = vi.fn(async () => undefined);
    const persistState = vi.fn(async () => undefined);

    const result = await executeVerifyBasic({
      getState: () => state,
      name: '会计',
      mobile: '19776689987',
      code: '123456',
      tenant: { id: 2 },
      userAgent: 'vitest',
      createSession: (userId: number) => {
        const token = `token-${userId}`;
        state.sessions.push({
          token,
          csrfToken: `csrf-${userId}`,
          customerId: userId,
        });
        return token;
      },
      formatUser: (user: any) => ({
        id: user.id,
        name: user.name,
        mobile: user.mobile,
        tenantId: user.tenantId,
      }),
      nextId: (rows: any[]) => rows.length + 1,
      persistCustomersByIds,
      persistSessionsByTokens,
      persistSmsCodesByIds,
      persistPointTransactionsByIds,
      persistState,
      recordPoints,
    });

    expect(result.isNewlyVerified).toBe(true);
    expect(result.balance).toBe(200);
    expect(state.users[0].isVerifiedBasic).toBe(true);
    expect(recordPoints).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 2,
        userId: 916,
        direction: 'in',
        amount: 200,
        sourceType: 'onboard',
        sourceId: '916',
        idempotencyKey: 'onboard:916',
      }),
    );
    expect(persistCustomersByIds).toHaveBeenCalledWith([916]);
    expect(persistSessionsByTokens).toHaveBeenCalledWith(['token-916']);
    expect(persistPointTransactionsByIds).toHaveBeenCalledWith([7001]);
    expect(persistSmsCodesByIds).toHaveBeenCalledWith([1]);
    expect(persistState).not.toHaveBeenCalled();
  });
});
