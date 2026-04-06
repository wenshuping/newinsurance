import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api, clearCsrfToken, clearToken } from '../src/lib/api';

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

  clear() {
    this.map.clear();
  }
}

describe('api.activities share params', () => {
  beforeEach(() => {
    const localStorage = new MemoryStorage();
    const sessionStorage = new MemoryStorage();

    Object.defineProperty(global, 'window', {
      configurable: true,
      value: {
        location: {
          href: 'http://127.0.0.1:3003/activities?tenantId=2&shareCode=share-activity-demo&fromShare=1&activityId=70',
          pathname: '/activities',
          search: '?tenantId=2&shareCode=share-activity-demo&fromShare=1&activityId=70',
        },
        localStorage,
        sessionStorage,
      },
    });

    Object.defineProperty(global, 'localStorage', {
      configurable: true,
      value: localStorage,
    });

    Object.defineProperty(global, 'sessionStorage', {
      configurable: true,
      value: sessionStorage,
    });

    clearToken();
    clearCsrfToken();
    vi.restoreAllMocks();
  });

  it('forwards current share params when loading activities', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ activities: [], balance: 0, taskProgress: { total: 0, completed: 0 } }),
    });

    vi.stubGlobal('fetch', fetchMock);

    await api.activities();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0] || '')).toContain('/api/activities?shareCode=share-activity-demo&fromShare=1&activityId=70');
  });

  it('forwards current share params when completing a shared activity', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, reward: 9, balance: 109 }),
    });

    vi.stubGlobal('fetch', fetchMock);

    await api.completeActivity(70);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0] || '')).toContain('/api/activities/70/complete?shareCode=share-activity-demo&fromShare=1&activityId=70');
  });
});
