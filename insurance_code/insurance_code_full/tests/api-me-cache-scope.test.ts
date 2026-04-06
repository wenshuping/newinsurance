import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api, clearCsrfToken, clearToken, setToken } from '../src/lib/api';

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

const makeMeResponse = (id: number, name: string, mobile: string) => ({
  ok: true,
  user: {
    id,
    name,
    mobile,
    is_verified_basic: true,
  },
  balance: id * 10,
  csrfToken: `csrf-${id}`,
});

describe('api.me cache scoping', () => {
  beforeEach(() => {
    const localStorage = new MemoryStorage();
    const sessionStorage = new MemoryStorage();

    Object.defineProperty(global, 'window', {
      configurable: true,
      value: {
        location: {
          href: 'http://127.0.0.1:3003/profile',
          pathname: '/profile',
          search: '',
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

  it('does not reuse another customer session me cache after token switch', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeMeResponse(101, '客户A', '13800000001'),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeMeResponse(202, '客户B', '13800000002'),
      });

    vi.stubGlobal('fetch', fetchMock);

    setToken('token-a');
    const first = await api.me();

    setToken('token-b');
    const second = await api.me();

    expect(first.user.id).toBe(101);
    expect(second.user.id).toBe(202);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
