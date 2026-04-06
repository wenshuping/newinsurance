import { describe, expect, it } from 'vitest';
import { resolvePActivityMedia } from '../server/skeleton-c-v1/services/p-activity-media.service.mjs';

describe('resolvePActivityMedia', () => {
  it('uploads inline activity files and maps them into activity media items', async () => {
    const uploaded: Array<{ name: string; type: string; dataUrl: string }> = [];
    const result = await resolvePActivityMedia({
      media: [{ name: 'existing.pdf', type: 'application/pdf', url: 'https://cdn.example.com/existing.pdf', path: '/uploads/existing.pdf' }],
      uploadItems: [
        { name: 'poster.png', type: 'image/png', dataUrl: 'data:image/png;base64,ZmFrZQ==' },
        { name: 'trailer.mp4', type: 'video/mp4', dataUrl: 'data:video/mp4;base64,QUJDRA==' },
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
    expect(uploaded.map((item) => item.name)).toEqual(['poster.png', 'trailer.mp4']);
    expect(result).toEqual([
      {
        name: 'existing.pdf',
        type: 'application/pdf',
        url: 'https://cdn.example.com/existing.pdf',
        path: '/uploads/existing.pdf',
      },
      {
        name: 'poster.png',
        type: 'image/png',
        preview: 'https://cdn.example.com/poster.png',
        url: 'https://cdn.example.com/poster.png',
        path: '/uploads/poster.png',
      },
      {
        name: 'trailer.mp4',
        type: 'video/mp4',
        preview: 'https://cdn.example.com/trailer.mp4',
        url: 'https://cdn.example.com/trailer.mp4',
        path: '/uploads/trailer.mp4',
      },
    ]);
  });
});
