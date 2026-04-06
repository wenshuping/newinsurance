import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/track', () => ({
  trackCEvent: vi.fn(),
}));

vi.mock('../src/lib/ui-error', () => ({
  showApiError: vi.fn(),
}));

vi.mock('../src/lib/api', () => ({
  api: {
    completeActivity: vi.fn(),
  },
}));

vi.mock('../src/lib/templateStatus', () => ({
  runningStatusLabel: () => '进行中',
  runningStatusPillClass: () => 'bg-emerald-500 text-white',
}));

import ActivityDetail from '../src/components/activities/ActivityDetail';

describe('ActivityDetail description rendering', () => {
  it('uses configured activity description and does not render the hard-coded rules blocks', () => {
    const html = renderToStaticMarkup(
      <ActivityDetail
        activity={{
          id: 70,
          title: '2026测试活动',
          description: '这是 B 端和 P 端配置的活动描述内容。',
          rewardPoints: 12,
          participants: 0,
          status: 'active',
          completed: false,
          image: '',
        }}
        onClose={() => undefined}
        requireAuth={(action) => action()}
      />
    );

    expect(html).toContain('活动简介');
    expect(html).toContain('这是 B 端和 P 端配置的活动描述内容。');
    expect(html).not.toContain('趣味答题');
    expect(html).not.toContain('丰厚奖励');
    expect(html).not.toContain('活动规则');
  });
});
