import { beforeEach, describe, expect, it, vi } from 'vitest';

const idempotencyRecords: Array<{ tenantId: number; bizType: string; bizKey: string; response: unknown }> = [];

vi.mock('../server/skeleton-c-v1/common/state.mjs', () => ({
  runInStateTransaction: vi.fn(async (executor: () => Promise<unknown> | unknown) => executor()),
  withIdempotency: vi.fn(async ({ tenantId = 1, bizType, bizKey, execute }) => {
    const existed = idempotencyRecords.find(
      (row) => Number(row.tenantId) === Number(tenantId) && row.bizType === bizType && row.bizKey === bizKey
    );
    if (existed) {
      return { hit: true, value: existed.response };
    }
    const value = await execute();
    idempotencyRecords.push({
      tenantId: Number(tenantId),
      bizType,
      bizKey,
      response: value,
    });
    return { hit: false, value };
  }),
}));

import { executeCreateBActivityConfig } from '../server/skeleton-c-v1/usecases/b-activity-config-write.usecase.mjs';

describe('executeCreateBActivityConfig', () => {
  beforeEach(() => {
    idempotencyRecords.length = 0;
  });

  it('returns the first created activity config when the same idempotency key is retried', async () => {
    const state = { activities: [] as Array<Record<string, unknown>>, pActivities: [] as Array<Record<string, unknown>> };
    let persistCount = 0;
    const command = {
      tenantId: 2,
      title: '2026测试',
      category: 'task',
      desc: '活动文案',
      rewardPoints: 9,
      sortOrder: 1,
      status: 'online',
      media: [],
      idempotencyKey: 'b-activity-create-2026-test-001',
      actor: {
        actorType: 'employee',
        actorId: 8003,
      },
      getState: () => state,
      hasRole: () => false,
      nextId: (list: Array<{ id?: number }>) =>
        list.length ? Math.max(...list.map((item) => Number(item.id || 0))) + 1 : 1,
      persistState: () => {
        persistCount += 1;
      },
    };

    const first = await executeCreateBActivityConfig(command);
    const second = await executeCreateBActivityConfig(command);

    expect(first).toMatchObject({
      ok: true,
      idempotent: false,
      item: {
        id: 1,
        title: '2026测试',
      },
    });
    expect(second).toMatchObject({
      ok: true,
      idempotent: true,
      item: {
        id: 1,
        title: '2026测试',
      },
    });
    expect(state.activities).toHaveLength(1);
    expect(state.pActivities).toHaveLength(1);
    expect(persistCount).toBe(1);
  });

  it('does not double-insert when activities and pActivities share the same runtime array', async () => {
    const sharedActivities: Array<Record<string, unknown>> = [];
    const state = { activities: sharedActivities, pActivities: sharedActivities };
    let persistCount = 0;

    const result = await executeCreateBActivityConfig({
      tenantId: 2,
      title: '2027年测试',
      category: 'task',
      desc: '活动文案',
      rewardPoints: 9,
      sortOrder: 1,
      status: 'draft',
      media: [],
      idempotencyKey: 'b-activity-create-2027-test-001',
      actor: {
        actorType: 'employee',
        actorId: 8003,
      },
      getState: () => state,
      hasRole: () => false,
      nextId: (list: Array<{ id?: number }>) =>
        list.length ? Math.max(...list.map((item) => Number(item.id || 0))) + 1 : 1,
      persistState: () => {
        persistCount += 1;
      },
    });

    expect(result).toMatchObject({
      ok: true,
      idempotent: false,
      item: {
        id: 1,
        title: '2027年测试',
      },
    });
    expect(sharedActivities).toHaveLength(1);
    expect(sharedActivities[0]).toMatchObject({
      id: 1,
      title: '2027年测试',
    });
    expect(persistCount).toBe(1);
  });
});
