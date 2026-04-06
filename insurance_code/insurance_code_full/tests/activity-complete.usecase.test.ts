import { beforeEach, describe, expect, it, vi } from 'vitest';

const stateMocks = vi.hoisted(() => {
  const txState = { inTransaction: false };
  return {
    txState,
    runInStateTransaction: vi.fn(async (executor: () => Promise<unknown> | unknown) => {
      txState.inTransaction = true;
      try {
        return await executor();
      } finally {
        txState.inTransaction = false;
      }
    }),
    getBalance: vi.fn(() => 88),
    dateOnly: vi.fn(() => '2026-04-01'),
    persistActivityCompletionsByIds: vi.fn(async () => undefined),
    reloadStateFromStorage: vi.fn(async () => undefined),
  };
});

vi.mock('../server/skeleton-c-v1/common/state.mjs', () => ({
  runInStateTransaction: stateMocks.runInStateTransaction,
  getBalance: stateMocks.getBalance,
  dateOnly: stateMocks.dateOnly,
  persistActivityCompletionsByIds: stateMocks.persistActivityCompletionsByIds,
  reloadStateFromStorage: stateMocks.reloadStateFromStorage,
}));

const repositoryMocks = vi.hoisted(() => ({
  findCompletableActivityById: vi.fn(),
  findAnyActivityCompletion: vi.fn(),
  createActivityCompletion: vi.fn(),
}));

vi.mock('../server/skeleton-c-v1/repositories/activity-write.repository.mjs', () => ({
  findCompletableActivityById: repositoryMocks.findCompletableActivityById,
  findAnyActivityCompletion: repositoryMocks.findAnyActivityCompletion,
  createActivityCompletion: repositoryMocks.createActivityCompletion,
}));

vi.mock('../server/skeleton-c-v1/common/template-visibility.mjs', () => ({
  canDeliverTemplateToActor: vi.fn(() => true),
}));

import { executeActivityComplete } from '../server/skeleton-c-v1/usecases/activity-complete.usecase.mjs';
import { canDeliverTemplateToActor } from '../server/skeleton-c-v1/common/template-visibility.mjs';

beforeEach(() => {
  vi.clearAllMocks();
  stateMocks.txState.inTransaction = false;
  repositoryMocks.findAnyActivityCompletion.mockReturnValue(undefined);
  repositoryMocks.createActivityCompletion.mockReturnValue({
    id: 1,
    tenantId: 2,
    userId: 900,
    activityId: 70,
    pointsAwarded: 9,
  });
});

function createCommand(overrides: Record<string, unknown> = {}) {
  return {
    activityId: 70,
    shareCode: null,
    userId: 900,
    isVerifiedBasic: true,
    actor: { tenantId: 2, actorId: 900, role: 'customer' },
    tenantCode: 'tenant-alpha',
    traceId: 'trace-1',
    requestId: 'req-1',
    ...overrides,
  };
}

describe('executeActivityComplete', () => {
  it('allows completing a shared activity even when the customer does not directly own the template', async () => {
    stateMocks.reloadStateFromStorage.mockImplementationOnce(() => new Promise(() => undefined));
    const settleReward = vi.fn(async () => {
      expect(stateMocks.txState.inTransaction).toBe(false);
      return { balance: 119 };
    });
    vi.mocked(canDeliverTemplateToActor).mockReturnValueOnce(false);
    repositoryMocks.findCompletableActivityById.mockReturnValue({
      state: { pointTransactions: [] },
      activity: { id: 70, title: '分享活动', rewardPoints: 9, category: 'task' },
    });

    const result = await Promise.race([
      executeActivityComplete(
        createCommand({
          shareCode: 'share-activity-demo',
        }),
        {
          settleReward,
          resolveSharedActivityByShare: vi.fn(() => ({ id: 70 })),
        }
      ),
      new Promise((resolve) => setTimeout(() => resolve('timeout'), 0)),
    ]);

    expect(repositoryMocks.createActivityCompletion).toHaveBeenCalledWith({
      tenantId: 2,
      userId: 900,
      activityId: 70,
      today: '2026-04-01',
      pointsAwarded: 9,
    });
    expect(settleReward).toHaveBeenCalledTimes(1);
    expect(stateMocks.persistActivityCompletionsByIds).toHaveBeenCalledWith([1]);
    expect(result).not.toBe('timeout');
    expect(result).toMatchObject({
      ok: true,
      reward: 9,
      balance: 119,
    });
  });

  it('retries reward settlement when completion exists but reward transaction is still missing', async () => {
    repositoryMocks.findAnyActivityCompletion.mockReturnValue({
      id: 88,
      tenantId: 2,
      userId: 900,
      activityId: 70,
      pointsAwarded: 9,
    });
    repositoryMocks.findCompletableActivityById.mockReturnValue({
      state: { pointTransactions: [] },
      activity: { id: 70, title: '分享活动', rewardPoints: 9, category: 'task' },
    });
    const settleReward = vi.fn(async () => ({ balance: 97 }));

    const result = await executeActivityComplete(createCommand(), { settleReward });

    expect(repositoryMocks.createActivityCompletion).not.toHaveBeenCalled();
    expect(settleReward).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      ok: true,
      reward: 9,
      balance: 97,
    });
  });

  it('rejects duplicate completion once both completion and reward transaction already exist', async () => {
    repositoryMocks.findAnyActivityCompletion.mockReturnValue({
      id: 88,
      tenantId: 2,
      userId: 900,
      activityId: 70,
      pointsAwarded: 9,
    });
    repositoryMocks.findCompletableActivityById.mockReturnValue({
      state: {
        pointTransactions: [
          {
            id: 1704,
            idempotencyKey: 'activity-reward:2:900:70:2026-04-01',
          },
        ],
      },
      activity: { id: 70, title: '分享活动', rewardPoints: 9, category: 'task' },
    });

    await expect(
      executeActivityComplete(createCommand(), {
        settleReward: vi.fn(async () => ({ balance: 97 })),
      })
    ).rejects.toThrow('ALREADY_COMPLETED');
  });
});
