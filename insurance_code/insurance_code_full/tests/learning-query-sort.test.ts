import { beforeEach, describe, expect, it, vi } from 'vitest';

let mockState = { learningCourses: [] };

vi.mock('../server/skeleton-c-v1/common/state.mjs', () => ({
  getState: () => mockState,
}));

vi.mock('../server/skeleton-c-v1/common/template-visibility.mjs', () => ({
  canDeliverTemplateToActor: () => true,
}));

import { listLearningCourses } from '../server/skeleton-c-v1/usecases/learning-query.usecase.mjs';

describe('listLearningCourses sort', () => {
  beforeEach(() => {
    mockState = {
      learningCourses: [
        {
          id: 11,
          title: '旧课程',
          category: '分类A',
          updatedAt: '2026-03-19T08:00:00.000Z',
          createdAt: '2026-03-18T08:00:00.000Z',
          status: 'published',
        },
        {
          id: 12,
          title: '新课程',
          category: '分类A',
          updatedAt: '2026-03-20T08:00:00.000Z',
          createdAt: '2026-03-18T08:00:00.000Z',
          status: 'published',
        },
      ],
    };
  });

  it('returns visible courses sorted by effective time descending', () => {
    const payload = listLearningCourses({
      actor: { actorType: 'customer', actorId: 501, tenantId: 2 },
      req: {
        protocol: 'http',
        get: () => '127.0.0.1:4100',
      },
    });

    expect(payload.courses.map((course) => course.id)).toEqual([12, 11]);
  });
});
