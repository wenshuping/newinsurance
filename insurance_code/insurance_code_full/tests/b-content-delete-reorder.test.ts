import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../server/skeleton-c-v1/common/state.mjs', () => ({
  runInStateTransaction: vi.fn(async (executor: () => Promise<unknown> | unknown) => executor()),
}));

import {
  executeDeleteBContentItem,
  executeReorderBContentItems,
} from '../server/skeleton-c-v1/usecases/b-content-write.usecase.mjs';

describe('b content write usecases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes the learning course and its mirrored p learning materials together', async () => {
    const state = {
      learningCourses: [
        { id: 101, tenantId: 2, title: '课程 A', sortOrder: 1, creatorRole: 'company_admin' },
        { id: 102, tenantId: 2, title: '课程 B', sortOrder: 2, creatorRole: 'company_admin' },
      ],
      pLearningMaterials: [
        { id: 9001, sourceCourseId: 101, tenantId: 2, title: '课程 A', sortOrder: 1 },
        { id: 9002, sourceCourseId: 102, tenantId: 2, title: '课程 B', sortOrder: 2 },
      ],
    };
    const persistState = vi.fn();
    const command = {
      id: 101,
      actor: { actorType: 'employee', actorId: 8002, tenantId: 2 },
      tenantContext: { tenantId: 2 },
      getState: () => state,
      persistState,
      hasRole: () => false,
      canAccessTemplate: () => true,
    };

    const result = await executeDeleteBContentItem(command);

    expect(result).toEqual({ ok: true });
    expect(state.learningCourses.map((item) => Number(item.id))).toEqual([102]);
    expect(state.pLearningMaterials.map((item) => Number(item.sourceCourseId))).toEqual([102]);
    expect(persistState).toHaveBeenCalledTimes(1);
  });

  it('reorders both learning courses and mirrored p learning materials by sortOrder', async () => {
    const state = {
      learningCourses: [
        { id: 11, tenantId: 2, title: '课程 A', sortOrder: 1, creatorRole: 'company_admin' },
        { id: 12, tenantId: 2, title: '课程 B', sortOrder: 2, creatorRole: 'company_admin' },
        { id: 13, tenantId: 2, title: '课程 C', sortOrder: 3, creatorRole: 'company_admin' },
      ],
      pLearningMaterials: [
        { id: 201, sourceCourseId: 11, tenantId: 2, title: '课程 A', sortOrder: 1 },
        { id: 202, sourceCourseId: 12, tenantId: 2, title: '课程 B', sortOrder: 2 },
        { id: 203, sourceCourseId: 13, tenantId: 2, title: '课程 C', sortOrder: 3 },
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

    const result = await executeReorderBContentItems(command);

    expect(result).toEqual({ ok: true });
    expect(
      state.learningCourses
        .slice()
        .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
        .map((item) => Number(item.id))
    ).toEqual([13, 11, 12]);
    expect(
      state.pLearningMaterials
        .slice()
        .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
        .map((item) => Number(item.sourceCourseId))
    ).toEqual([13, 11, 12]);
    expect(persistState).toHaveBeenCalledTimes(1);
  });
});
