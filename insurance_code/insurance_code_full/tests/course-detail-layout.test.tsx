import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { PlayCircle } from 'lucide-react';

vi.mock('../src/lib/api', () => ({
  api: {
    learningCourseDetail: vi.fn(() => Promise.resolve({ course: {} })),
    completeCourse: vi.fn(),
  },
}));

vi.mock('../src/lib/track', () => ({
  trackCEvent: vi.fn(),
}));

vi.mock('../src/lib/ui-error', () => ({
  showApiError: vi.fn(),
}));

vi.mock('../src/lib/runtime-asset-url', () => ({
  resolveRuntimeAssetUrl: (value: string) => value,
}));

import CourseDetail from '../src/components/learning/CourseDetail';

describe('CourseDetail layout', () => {
  it('does not render the bottom reward button for video courses', () => {
    const html = renderToStaticMarkup(
      <CourseDetail
        course={{
          id: 88,
          title: '视频测试',
          desc: '视频测试',
          type: 'video',
          typeLabel: '视频',
          progress: 0,
          timeLeft: '约 1 分钟',
          image: '',
          action: '开始学习',
          color: 'bg-blue-500/90',
          btnColor: 'bg-blue-500 text-white',
          points: 50,
          category: '保险课堂',
          content: '机卡即可',
          videoUrl: '/uploads/video-test.mp4',
          icon: PlayCircle,
        }}
        onBack={() => undefined}
      />
    );

    expect(html).toContain('当前视频进度');
    expect(html).not.toContain('看完视频或浏览完成后可领积分');
  });
});
