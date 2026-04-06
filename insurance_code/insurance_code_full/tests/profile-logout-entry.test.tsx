import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

class MemoryStorage {
  private map = new Map<string, string>();

  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key)! : null;
  }

  setItem(key: string, value: string) {
    this.map.set(key, value);
  }

  removeItem(key: string) {
    this.map.delete(key);
  }
}

vi.mock('../src/components/profile/MyExchanges', () => ({ default: () => null }));
vi.mock('../src/components/profile/MyActivities', () => ({ default: () => null }));
vi.mock('../src/components/profile/StudyRecords', () => ({ default: () => null }));
vi.mock('../src/components/profile/MyFavorites', () => ({ default: () => null }));
vi.mock('../src/components/profile/FamilyMembers', () => ({ default: () => null }));
vi.mock('../src/components/profile/MyFriends', () => ({ default: () => null }));
vi.mock('../src/components/learning/CourseDetail', () => ({ default: () => null }));
vi.mock('../src/components/mall/PointsDetailPage', () => ({ default: () => null }));
vi.mock('../src/lib/track', () => ({ trackCEvent: vi.fn() }));

import Profile from '../src/pages/Profile';

describe('Profile logout entry', () => {
  beforeEach(() => {
    Object.defineProperty(global, 'localStorage', {
      configurable: true,
      value: new MemoryStorage(),
    });
  });

  it('shows logout entry instead of settings entry', () => {
    const html = renderToStaticMarkup(
      <Profile
        requireAuth={(action) => action()}
        isAuthenticated
        user={{
          id: 101,
          name: '温哈哈',
          mobile: '13800000000',
          is_verified_basic: true,
        }}
        pointsBalance={300}
        onOpenMall={() => undefined}
        onGoInsurance={() => undefined}
        onLogout={() => undefined}
      />
    );

    expect(html).toContain('退出登录');
    expect(html).not.toContain('设置');
  });
});
