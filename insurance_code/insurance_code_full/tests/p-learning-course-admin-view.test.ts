import { describe, expect, it } from 'vitest';
import { toPLearningCourseAdminView } from '../server/skeleton-c-v1/services/p-learning-course-admin-view.service.mjs';

describe('toPLearningCourseAdminView', () => {
  it('builds a displayable cover media item from coverUrl when media preview is missing', () => {
    const result = toPLearningCourseAdminView({
      row: {
        id: 88,
        title: '批量图片课程',
        category: '运营导入',
        contentType: 'article',
        rewardPoints: 12,
        content: '课程正文',
        coverUrl: 'http://127.0.0.1:4000/uploads/tenant_1/20260318/cover.png',
        media: [],
        createdAt: '2026-03-18T06:10:00.000Z',
        updatedAt: '2026-03-18T06:10:00.000Z',
      },
      status: 'published',
      isPlatformTemplate: false,
    });

    expect(result.coverUrl).toBe('http://127.0.0.1:4000/uploads/tenant_1/20260318/cover.png');
    expect(result.media).toEqual([
      {
        name: 'cover',
        type: 'image/*',
        preview: 'http://127.0.0.1:4000/uploads/tenant_1/20260318/cover.png',
        url: 'http://127.0.0.1:4000/uploads/tenant_1/20260318/cover.png',
        path: '',
      },
    ]);
  });
});
