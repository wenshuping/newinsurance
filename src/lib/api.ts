const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:4000';
const TOKEN_KEY = 'insurance_token';

export type User = {
  id: number;
  name: string;
  mobile: string;
  is_verified_basic: boolean;
  verified_at?: string | null;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data as any).message || '请求失败');
    (err as any).code = (data as any).code;
    throw err;
  }
  return data as T;
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export const api = {
  health: () => request<{ ok: boolean; service: string }>('/api/health'),

  sendCode: (mobile: string) =>
    request<{ ok: boolean; message: string; dev_code?: string }>('/api/auth/send-code', {
      method: 'POST',
      body: JSON.stringify({ mobile }),
    }),

  verifyBasic: (name: string, mobile: string, code: string) =>
    request<{ token: string; user: User }>('/api/auth/verify-basic', {
      method: 'POST',
      body: JSON.stringify({ name, mobile, code }),
    }),

  me: () => request<{ user: User; balance: number }>('/api/me'),

  activities: () => request<{ activities: any[]; balance: number }>('/api/activities'),

  signIn: () => request<{ ok: boolean; reward: number; balance: number }>('/api/sign-in', { method: 'POST' }),

  pointsSummary: () => request<{ balance: number }>('/api/points/summary'),

  pointsTransactions: () => request<{ list: any[] }>('/api/points/transactions'),

  mallItems: () => request<{ items: any[] }>('/api/mall/items'),

  redeem: (itemId: number) =>
    request<{ ok: boolean; token: string; balance: number }>('/api/mall/redeem', {
      method: 'POST',
      body: JSON.stringify({ itemId }),
    }),

  redemptions: () => request<{ list: any[] }>('/api/redemptions'),

  writeoff: (id: number, token?: string) =>
    request<{ ok: boolean }>(`/api/redemptions/${id}/writeoff`, {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),
};
