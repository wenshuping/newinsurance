import { describe, expect, it } from 'vitest';
import { resolvePLearningCourseMedia } from '../server/skeleton-c-v1/services/p-learning-course-media.service.mjs';

describe('resolvePLearningCourseMedia', () => {
  it('uploads inline learning course files and maps them into course media items', async () => {
    const uploaded: Array<{ name: string; type: string; dataUrl: string }> = [];
    const result = await resolvePLearningCourseMedia({
      media: [{ name: 'existing.pdf', type: 'application/pdf', url: 'https://cdn.example.com/existing.pdf', path: '/uploads/existing.pdf' }],
      uploadItems: [
        { name: 'cover.png', type: 'image/png', dataUrl: 'data:image/png;base64,ZmFrZQ==' },
        { name: 'lesson.mp4', type: 'video/mp4', dataUrl: 'data:video/mp4;base64,QUJDRA==' },
      ],
      uploadFile: async (item) => {
        uploaded.push(item);
        return {
          name: item.name,
          type: item.type,
          url: `https://cdn.example.com/${item.name}`,
          path: `/uploads/${item.name}`,
        };
      },
    });

    expect(uploaded).toHaveLength(2);
    expect(uploaded.map((item) => item.name)).toEqual(['cover.png', 'lesson.mp4']);
    expect(result).toEqual([
      {
        name: 'existing.pdf',
        type: 'application/pdf',
        url: 'https://cdn.example.com/existing.pdf',
        path: '/uploads/existing.pdf',
      },
      {
        name: 'cover.png',
        type: 'image/png',
        preview: 'https://cdn.example.com/cover.png',
        url: 'https://cdn.example.com/cover.png',
        path: '/uploads/cover.png',
      },
      {
        name: 'lesson.mp4',
        type: 'video/mp4',
        preview: 'https://cdn.example.com/lesson.mp4',
        url: 'https://cdn.example.com/lesson.mp4',
        path: '/uploads/lesson.mp4',
      },
    ]);
  });
});
