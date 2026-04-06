import { beforeEach, describe, expect, it, vi } from 'vitest';

let mockState: any = {
  learningCourses: [],
  courseCompletions: [],
};

let mockSharedCourse: any = null;

vi.mock('../server/skeleton-c-v1/common/state.mjs', () => ({
  getState: () => mockState,
}));

vi.mock('../server/skeleton-c-v1/common/template-visibility.mjs', () => ({
  canDeliverTemplateToActor: () => false,
}));

vi.mock('../server/skeleton-c-v1/services/share.service.mjs', () => ({
  resolveSharedLearningCourseByShare: ({ courseId }: { courseId: number }) =>
    Number(mockSharedCourse?.id || 0) === Number(courseId || 0) ? mockSharedCourse : null,
}));

import { getLearningCourseById, listLearningCourses } from '../server/skeleton-c-v1/usecases/learning-query.usecase.mjs';

function createReq() {
  return {
    protocol: 'http',
    get: () => '127.0.0.1:4100',
    query: {
      shareCode: 'share-demo',
      courseId: '124',
    },
  };
}

describe('learning share access', () => {
  beforeEach(() => {
    mockState = {
      learningCourses: [],
      courseCompletions: [],
    };
    mockSharedCourse = {
      id: 124,
      tenantId: 2,
      title: '2024年人寿保险最新理赔指南',
      category: '通用培训',
      type: 'video',
      contentType: 'video',
      content: '课程正文',
      desc: '面向客户分享的视频课程',
      status: 'published',
      points: 50,
      media: [
        {
          name: 'claim-guide.mp4',
          type: 'video/mp4',
          preview: '/uploads/tenant_2/claim-guide.mp4',
          url: '/uploads/tenant_2/claim-guide.mp4',
          path: '/uploads/tenant_2/claim-guide.mp4',
        },
      ],
    };
  });

  it('returns the shared course detail for anonymous viewers', () => {
    const payload = getLearningCourseById({
      courseId: 124,
      actor: { actorType: 'anonymous', actorId: 0, tenantId: 2 },
      req: createReq(),
    });

    expect(payload.course).toMatchObject({
      id: 124,
      title: '2024年人寿保险最新理赔指南',
      type: 'video',
    });
  });

  it('includes the shared course in the learning list for anonymous viewers', () => {
    const payload = listLearningCourses({
      actor: { actorType: 'anonymous', actorId: 0, tenantId: 2 },
      req: createReq(),
    });

    expect(payload.courses).toHaveLength(1);
    expect(payload.courses[0]).toMatchObject({
      id: 124,
      title: '2024年人寿保险最新理赔指南',
    });
  });
});
