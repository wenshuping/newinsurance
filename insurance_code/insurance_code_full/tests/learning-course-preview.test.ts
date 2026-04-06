import { describe, expect, it } from 'vitest';

import { resolveLearningCoursePreview } from '../src/lib/learning-course-preview';

describe('resolveLearningCoursePreview', () => {
  it('does not treat mp4 cover fields as image preview', () => {
    const preview = resolveLearningCoursePreview({
      type: 'video',
      image: 'http://127.0.0.1:4100/uploads/tenant_1/video-test.mp4',
      coverUrl: 'http://127.0.0.1:4100/uploads/tenant_1/video-test.mp4',
      videoUrl: '',
      media: [],
    });

    expect(preview).toEqual({
      kind: 'video',
      imageUrl: '',
      videoUrl: 'http://127.0.0.1:4100/uploads/tenant_1/video-test.mp4',
    });
  });

  it('prefers real image previews when image and video both exist', () => {
    const preview = resolveLearningCoursePreview({
      type: 'video',
      image: 'http://127.0.0.1:4100/uploads/tenant_1/cover.jpg',
      coverUrl: '',
      videoUrl: 'http://127.0.0.1:4100/uploads/tenant_1/video-test.mp4',
      media: [],
    });

    expect(preview).toEqual({
      kind: 'image',
      imageUrl: 'http://127.0.0.1:4100/uploads/tenant_1/cover.jpg',
      videoUrl: 'http://127.0.0.1:4100/uploads/tenant_1/video-test.mp4',
    });
  });
});
