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

import { getLearningCourseById } from '../server/skeleton-c-v1/usecases/learning-query.usecase.mjs';

describe('learning query video inference', () => {
  beforeEach(() => {
    mockState = {
      learningCourses: [
        {
          id: 124,
          tenantId: 2,
          title: '2024年人寿保险最新理赔指南',
          contentType: 'article',
          sourceType: 'native',
          coverUrl: '/uploads/tenant_2/claim-guide-cover.jpg',
          media: [
            {
              name: 'claim-guide.mp4',
              type: 'video/mp4',
              preview: 'http://127.0.0.1:4000/uploads/tenant_2/claim-guide.mp4',
              url: 'http://127.0.0.1:4000/uploads/tenant_2/claim-guide.mp4',
              path: '/uploads/tenant_2/claim-guide.mp4',
            },
          ],
          content: '课程正文',
          status: 'published',
          points: 50,
        },
      ],
      courseCompletions: [],
    };
  });

  it('treats article rows with uploaded video media as video courses', () => {
    const payload = getLearningCourseById({
      courseId: 124,
      actor: { actorType: 'customer', actorId: 501, tenantId: 2 },
      req: {
        protocol: 'http',
        get: () => '127.0.0.1:4100',
      },
    });

    expect(payload.course).toMatchObject({
      id: 124,
      type: 'video',
      typeLabel: '视频',
      coverUrl: 'http://127.0.0.1:4100/uploads/tenant_2/claim-guide-cover.jpg',
      image: 'http://127.0.0.1:4100/uploads/tenant_2/claim-guide-cover.jpg',
      videoUrl: 'http://127.0.0.1:4000/uploads/tenant_2/claim-guide.mp4',
    });
  });

  it('does not expose mp4 cover fields as broken image urls', () => {
    mockState = {
      learningCourses: [
        {
          id: 125,
          tenantId: 2,
          title: '视频测试',
          contentType: 'article',
          sourceType: 'native',
          coverUrl: 'http://127.0.0.1:4100/uploads/tenant_2/video-test.mp4',
          media: [
            {
              name: 'cover',
              type: 'image/*',
              preview: 'http://127.0.0.1:4100/uploads/tenant_2/video-test.mp4',
              url: 'http://127.0.0.1:4100/uploads/tenant_2/video-test.mp4',
              path: '',
            },
          ],
          content: '课程正文',
          status: 'published',
          points: 50,
        },
      ],
      courseCompletions: [],
    };

    const payload = getLearningCourseById({
      courseId: 125,
      actor: { actorType: 'customer', actorId: 501, tenantId: 2 },
      req: {
        protocol: 'http',
        get: () => '127.0.0.1:4100',
      },
    });

    expect(payload.course).toMatchObject({
      id: 125,
      type: 'video',
      typeLabel: '视频',
      image: '',
      coverUrl: '',
      videoUrl: 'http://127.0.0.1:4100/uploads/tenant_2/video-test.mp4',
    });
  });
});
