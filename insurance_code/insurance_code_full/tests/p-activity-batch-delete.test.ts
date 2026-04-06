import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../server/skeleton-c-v1/common/state.mjs', () => ({
  runInStateTransaction: vi.fn(async (executor: () => Promise<unknown> | unknown) => executor()),
  withIdempotency: vi.fn(),
}));

import { executeDeletePActivityBatch } from '../server/skeleton-c-v1/usecases/p-activity-write.usecase.mjs';

describe('executeDeletePActivityBatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('removes multiple activities from both read and write collections and persists once', async () => {
    const rows = [
      { id: 11, tenantId: 1, title: '活动 A', creatorRole: 'platform_admin' },
      { id: 12, tenantId: 1, title: '活动 B', creatorRole: 'platform_admin' },
      { id: 13, tenantId: 1, title: '活动 C', creatorRole: 'platform_admin' },
    ];
    const state = {
      activities: rows.map((item) => ({ ...item })),
      pActivities: rows.map((item) => ({ ...item })),
    };
    const persistState = vi.fn();
    const command = {
      ids: [11, 13, 13],
      actor: { actorId: 9001 },
      tenantContext: { tenantId: 1 },
      getState: () => state,
      persistState,
      hasRole: () => false,
      canAccessTemplate: () => true,
    };

    const result = await executeDeletePActivityBatch(command);

    expect(result).toEqual({
      ok: true,
      deletedCount: 2,
      ids: [11, 13],
      blockedIds: [],
    });
    expect(state.activities.map((item) => item.id)).toEqual([12]);
    expect(state.pActivities.map((item) => item.id)).toEqual([12]);
    expect(persistState).toHaveBeenCalledTimes(1);
  });

  it('skips active-like activities during batch delete and returns blocked ids', async () => {
    const rows = [
      { id: 21, tenantId: 1, title: '活动 A', status: 'draft', creatorRole: 'platform_admin' },
      { id: 22, tenantId: 1, title: '活动 B', status: 'published', creatorRole: 'platform_admin' },
      { id: 23, tenantId: 1, title: '活动 C', status: 'offline', creatorRole: 'platform_admin' },
    ];
    const state = {
      activities: rows.map((item) => ({ ...item })),
      pActivities: rows.map((item) => ({ ...item })),
    };
    const persistState = vi.fn();
    const command = {
      ids: [21, 22, 23],
      actor: { actorId: 9001 },
      tenantContext: { tenantId: 1 },
      getState: () => state,
      persistState,
      hasRole: () => false,
      canAccessTemplate: () => true,
    };

    const result = await executeDeletePActivityBatch(command);

    expect(result).toEqual({
      ok: true,
      deletedCount: 2,
      ids: [21, 23],
      blockedIds: [22],
    });
    expect(state.activities.map((item) => item.id)).toEqual([22]);
    expect(state.pActivities.map((item) => item.id)).toEqual([22]);
    expect(persistState).toHaveBeenCalledTimes(1);
  });
});
