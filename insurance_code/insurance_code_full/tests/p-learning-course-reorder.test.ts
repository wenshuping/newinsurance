import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../server/skeleton-c-v1/common/state.mjs', () => ({
  runInStateTransaction: vi.fn(async (executor: () => Promise<unknown> | unknown) => executor()),
  withIdempotency: vi.fn(),
}));

import { executeReorderPLearningCourses } from '../server/skeleton-c-v1/usecases/p-learning-course-write.usecase.mjs';

describe('executeReorderPLearningCourses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reassigns learning course sortOrder based on requested ids and persists once', async () => {
    const nowBefore = Date.now();
    const state = {
      learningCourses: [
        { id: 11, tenantId: 2, title: '课程 A', sortOrder: 1, creatorRole: 'company_admin' },
        { id: 12, tenantId: 2, title: '课程 B', sortOrder: 2, creatorRole: 'company_admin' },
        { id: 13, tenantId: 2, title: '课程 C', sortOrder: 3, creatorRole: 'company_admin' },
      ],
    };
    const persistState = vi.fn();
    const command = {
      ids: [13, 11, 12],
      actor: { actorType: 'employee', actorId: 8002, tenantId: 2 },
      tenantContext: { tenantId: 2 },
      getState: () => state,
      persistState,
      hasRole: () => false,
      canAccessTemplate: () => true,
    };

    const result = await executeReorderPLearningCourses(command);

    expect(result).toEqual({ ok: true });
    expect(
      state.learningCourses
        .slice()
        .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
        .map((item) => item.id)
    ).toEqual([13, 11, 12]);
    expect(persistState).toHaveBeenCalledTimes(1);
    expect(new Date(String(state.learningCourses[0].updatedAt || '')).getTime()).toBeGreaterThanOrEqual(nowBefore);
  });

  it('rejects empty reorder payloads', async () => {
    const state = { learningCourses: [] };
    const command = {
      ids: [],
      actor: { actorType: 'employee', actorId: 8002, tenantId: 2 },
      tenantContext: { tenantId: 2 },
      getState: () => state,
      persistState: vi.fn(),
      hasRole: () => false,
      canAccessTemplate: () => true,
    };

    await expect(executeReorderPLearningCourses(command)).rejects.toThrow('COURSE_REORDER_IDS_REQUIRED');
  });
});
