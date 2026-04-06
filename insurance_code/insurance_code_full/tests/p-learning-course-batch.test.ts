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

import { executeCreatePLearningCourseBatch } from '../server/skeleton-c-v1/usecases/p-learning-course-write.usecase.mjs';

describe('executeCreatePLearningCourseBatch', () => {
  beforeEach(() => {
    idempotencyRecords.length = 0;
  });

  it('replays the first batch result when the same batch idempotency key is retried', async () => {
    const state = { learningCourses: [] as Array<Record<string, unknown>> };
    const command = {
      idempotencyKey: 'ops-learning-batch-001',
      items: [
        {
          title: '批量课程 1',
          category: '运营导入',
          rewardPoints: 10,
          contentType: 'article',
          level: '初级',
          content: '课程正文 1',
          status: 'published',
          media: [],
          uploadItems: [],
        },
        {
          title: '批量课程 2',
          category: '运营导入',
          rewardPoints: 20,
          contentType: 'article',
          level: '中级',
          content: '课程正文 2',
          status: 'published',
          media: [],
          uploadItems: [],
        },
      ],
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
      persistState: vi.fn(),
      canOperateTenantTemplates: () => ({
        isCompanyAdmin: false,
        isPlatformAdmin: true,
        isCompanyActor: false,
      }),
    };

    const first = await executeCreatePLearningCourseBatch(command);
    const second = await executeCreatePLearningCourseBatch(command);

    expect(first).toMatchObject({
      ok: true,
      total: 2,
      idempotent: false,
      items: [
        {
          index: 0,
          idempotent: false,
          course: { id: 1, title: '批量课程 1' },
        },
        {
          index: 1,
          idempotent: false,
          course: { id: 2, title: '批量课程 2' },
        },
      ],
    });
    expect(second).toMatchObject({
      ok: true,
      total: 2,
      idempotent: true,
      items: [
        {
          index: 0,
          idempotent: false,
          course: { id: 1, title: '批量课程 1' },
        },
        {
          index: 1,
          idempotent: false,
          course: { id: 2, title: '批量课程 2' },
        },
      ],
    });
    expect(state.learningCourses).toHaveLength(2);
  });
});
