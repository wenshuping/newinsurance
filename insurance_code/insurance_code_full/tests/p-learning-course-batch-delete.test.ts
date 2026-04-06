import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../server/skeleton-c-v1/common/state.mjs', () => ({
  runInStateTransaction: vi.fn(async (executor: () => Promise<unknown> | unknown) => executor()),
  withIdempotency: vi.fn(),
}));

import { executeDeletePLearningCourseBatch } from '../server/skeleton-c-v1/usecases/p-learning-course-write.usecase.mjs';

describe('executeDeletePLearningCourseBatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('removes multiple learning courses and persists state once', async () => {
    const state = {
      learningCourses: [
        { id: 1, tenantId: 1, title: '课程 A', creatorRole: 'platform_admin' },
        { id: 2, tenantId: 1, title: '课程 B', creatorRole: 'platform_admin' },
        { id: 3, tenantId: 1, title: '课程 C', creatorRole: 'platform_admin' },
      ],
    };
    const persistState = vi.fn();
    const command = {
      ids: [1, 1, 3],
      actor: { actorId: 9001 },
      tenantContext: { tenantId: 1 },
      getState: () => state,
      persistState,
      hasRole: () => false,
      canAccessTemplate: () => true,
    };

    const result = await executeDeletePLearningCourseBatch(command);

    expect(result).toEqual({
      ok: true,
      deletedCount: 2,
      ids: [1, 3],
    });
    expect(state.learningCourses.map((item) => item.id)).toEqual([2]);
    expect(persistState).toHaveBeenCalledTimes(1);
  });
});
