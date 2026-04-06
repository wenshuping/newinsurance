import { beforeEach, describe, expect, it, vi } from 'vitest';

let mockState: any = {
  learningCourses: [],
  courseCompletions: [],
};

vi.mock('../server/skeleton-c-v1/common/state.mjs', () => ({
  getState: () => mockState,
}));

vi.mock('../server/skeleton-c-v1/common/template-visibility.mjs', () => ({
  canDeliverTemplateToActor: () => true,
}));

import { getLearningCourseById, listLearningCourses } from '../server/skeleton-c-v1/usecases/learning-query.usecase.mjs';

function createReq() {
  return {
    protocol: 'http',
    get: () => '127.0.0.1:4100',
  };
}

describe('learning query progress', () => {
  beforeEach(() => {
    mockState = {
      learningCourses: [
        {
          id: 21,
          title: '已完成视频课',
          category: '分类A',
          type: 'video',
          contentType: 'video',
          points: 50,
          status: 'published',
        },
        {
          id: 22,
          title: '未完成图文课',
          category: '分类A',
          type: 'article',
          contentType: 'article',
          points: 20,
          status: 'published',
        },
      ],
      courseCompletions: [
        {
          id: 1,
          userId: 501,
          courseId: 21,
          pointsAwarded: 50,
          createdAt: '2026-03-30T10:00:00.000Z',
        },
      ],
    };
  });

  it('marks completed courses as 100 percent for the current customer', () => {
    const payload = listLearningCourses({
      actor: { actorType: 'customer', actorId: 501, tenantId: 2 },
      req: createReq(),
    });

    const completedCourse = payload.courses.find((course) => course.id === 21);
    const pendingCourse = payload.courses.find((course) => course.id === 22);

    expect(completedCourse).toMatchObject({
      id: 21,
      progress: 100,
      action: '积分已领取',
    });
    expect(pendingCourse).toMatchObject({
      id: 22,
      progress: 0,
    });
  });

  it('marks completed course detail as already rewarded for the current customer', () => {
    const payload = getLearningCourseById({
      courseId: 21,
      actor: { actorType: 'customer', actorId: 501, tenantId: 2 },
      req: createReq(),
    });

    expect(payload.course).toMatchObject({
      id: 21,
      progress: 100,
      action: '积分已领取',
    });
  });
});
