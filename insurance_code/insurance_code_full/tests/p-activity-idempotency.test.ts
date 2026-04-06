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

import { executeCreatePActivity } from '../server/skeleton-c-v1/usecases/p-activity-write.usecase.mjs';

describe('executeCreatePActivity', () => {
  beforeEach(() => {
    idempotencyRecords.length = 0;
  });

  it('returns the first created activity when the same idempotency key is retried', async () => {
    const state = { activities: [] as Array<Record<string, unknown>> };
    let persistCount = 0;
    const command = {
      title: '运营活动',
      category: 'task',
      rewardPoints: 30,
      content: '活动文案',
      media: [],
      uploadItems: [],
      idempotencyKey: 'ops-activity-import-001',
      status: 'online',
      actor: {
        actorType: 'employee',
        actorId: 9001,
      },
      tenantContext: {
        tenantId: 1,
      },
      getState: () => state,
      nextId: (list: Array<{ id?: number }>) =>
        list.length ? Math.max(...list.map((item) => Number(item.id || 0))) + 1 : 1,
      persistState: () => {
        persistCount += 1;
      },
      canOperateTenantTemplates: () => ({
        isCompanyAdmin: false,
        isPlatformAdmin: true,
        isCompanyActor: false,
      }),
    };

    const first = await executeCreatePActivity(command);
    const second = await executeCreatePActivity(command);

    expect(first).toMatchObject({
      ok: true,
      idempotent: false,
      activity: {
        id: 1,
        title: '运营活动',
      },
    });
    expect(second).toMatchObject({
      ok: true,
      idempotent: true,
      activity: {
        id: 1,
        title: '运营活动',
      },
    });
    expect(state.activities).toHaveLength(1);
    expect(persistCount).toBe(1);
  });
});
