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

import { executeCreatePLearningCourse } from '../server/skeleton-c-v1/usecases/p-learning-course-write.usecase.mjs';

describe('executeCreatePLearningCourse', () => {
  beforeEach(() => {
    idempotencyRecords.length = 0;
  });

  it('returns the first created course when the same idempotency key is retried', async () => {
    const state = { learningCourses: [] as Array<Record<string, unknown>> };
    let persistCount = 0;
    const command = {
      title: '运营幂等课程',
      category: '运营导入',
      rewardPoints: 20,
      contentType: 'article',
      status: 'published',
      level: '中级',
      content: '课程正文',
      media: [],
      uploadItems: [],
      idempotencyKey: 'ops-course-import-001',
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

    const first = await executeCreatePLearningCourse(command);
    const second = await executeCreatePLearningCourse(command);

    expect(first).toMatchObject({
      ok: true,
      idempotent: false,
      course: {
        id: 1,
        title: '运营幂等课程',
      },
    });
    expect(second).toMatchObject({
      ok: true,
      idempotent: true,
      course: {
        id: 1,
        title: '运营幂等课程',
      },
    });
    expect(state.learningCourses).toHaveLength(1);
    expect(persistCount).toBe(1);
  });
});
