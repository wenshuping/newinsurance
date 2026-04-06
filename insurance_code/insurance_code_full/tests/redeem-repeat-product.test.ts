import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const state: any = {
    pProducts: [],
    mallItems: [],
    orders: [],
    orderPayments: [],
    orderFulfillments: [],
    orderRefunds: [],
    redemptions: [],
    bWriteOffRecords: [],
    activityCompletions: [],
    pointAccounts: [],
    pointTransactions: [],
    idempotencyRecords: [],
  };

  let writeoffSeq = 1;

  const nextId = (rows: Array<{ id?: number }> = []) =>
    rows.reduce((max, row) => Math.max(max, Number(row?.id || 0)), 0) + 1;

  const getBalance = (userId: number) =>
    Number(state.pointAccounts.find((row: any) => Number(row.userId) === Number(userId))?.balance || 0);

  return {
    state,
    nextId,
    getBalance,
    getWriteoffSeq: () => writeoffSeq,
    resetWriteoffSeq: () => {
      writeoffSeq = 1;
    },
    nextWriteoffToken: () => `EX${writeoffSeq++}`,
  };
});

vi.mock('../server/skeleton-c-v1/common/state.mjs', () => ({
  getState: () => mocks.state,
  getBalance: mocks.getBalance,
  nextId: mocks.nextId,
  persistState: vi.fn(),
  runInStateTransaction: vi.fn(async (executor: () => Promise<unknown> | unknown) => executor()),
  withIdempotency: vi.fn(async ({ tenantId = 1, bizType, bizKey, execute }) => {
    const existed = mocks.state.idempotencyRecords.find(
      (row: any) =>
        Number(row.tenantId || 1) === Number(tenantId || 1) &&
        String(row.bizType || '') === String(bizType || '') &&
        String(row.bizKey || '') === String(bizKey || ''),
    );
    if (existed) return { hit: true, value: existed.response };
    const value = await execute();
    mocks.state.idempotencyRecords.push({
      id: mocks.nextId(mocks.state.idempotencyRecords),
      tenantId: Number(tenantId || 1),
      bizType,
      bizKey,
      response: value,
    });
    return { hit: false, value };
  }),
  generateWriteoffToken: vi.fn(() => mocks.nextWriteoffToken()),
  dateOnly: vi.fn((input?: string) => String(input || '').slice(0, 10)),
}));

vi.mock('../server/microservices/points-service/observability.mjs', () => ({
  appendPointsAuditLog: vi.fn(),
  appendPointsDomainEvent: vi.fn(),
  recordOrderStatusTransition: vi.fn(),
  recordPointsMovement: vi.fn(),
  setPointsRequestContext: vi.fn(),
}));

import { executeRedeem } from '../server/skeleton-c-v1/usecases/redeem.usecase.mjs';

describe('executeRedeem repeat same product', () => {
  beforeEach(() => {
    mocks.resetWriteoffSeq();
    mocks.state.pProducts = [
      {
        id: 410,
        tenantId: 2,
        name: 'other_1773486699514_product',
        pointsCost: 9,
        stock: 8,
        shelfStatus: 'on',
      },
    ];
    mocks.state.mallItems = [];
    mocks.state.orders = [];
    mocks.state.orderPayments = [];
    mocks.state.orderFulfillments = [];
    mocks.state.orderRefunds = [];
    mocks.state.redemptions = [];
    mocks.state.bWriteOffRecords = [];
    mocks.state.activityCompletions = [];
    mocks.state.pointAccounts = [{ userId: 9, balance: 100, updatedAt: new Date().toISOString() }];
    mocks.state.pointTransactions = [];
    mocks.state.idempotencyRecords = [];
  });

  it('creates a new order and redemption each time when no idempotency key is provided', async () => {
    const command = {
      tenantId: 2,
      customerId: 9,
      isVerifiedBasic: true,
      itemId: 410,
      idempotencyKey: null,
      actor: { actorType: 'customer', actorId: 9, tenantId: 2 },
    };

    const first = await executeRedeem(command);
    const second = await executeRedeem(command);

    expect(first.order.id).not.toBe(second.order.id);
    expect(first.redemption.id).not.toBe(second.redemption.id);
    expect(mocks.state.orders).toHaveLength(2);
    expect(mocks.state.redemptions).toHaveLength(2);
    expect(mocks.getBalance(9)).toBe(82);
  });

  it('reuses the existing redemption when the same idempotency key is retried', async () => {
    const command = {
      tenantId: 2,
      customerId: 9,
      isVerifiedBasic: true,
      itemId: 410,
      idempotencyKey: 'same-click',
      actor: { actorType: 'customer', actorId: 9, tenantId: 2 },
    };

    const first = await executeRedeem(command);
    const second = await executeRedeem(command);

    expect(second.order.id).toBe(first.order.id);
    expect(second.redemption.id).toBe(first.redemption.id);
    expect(mocks.state.orders).toHaveLength(1);
    expect(mocks.state.redemptions).toHaveLength(1);
    expect(mocks.getBalance(9)).toBe(91);
  });
});
