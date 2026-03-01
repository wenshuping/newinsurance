import type {
  ActivitiesResponse,
  HealthResponse,
  MallItemsResponse,
  MeResponse,
  PointsSummaryResponse,
  PointsTransactionsResponse,
  RedeemResponse,
  RedemptionsResponse,
  SendCodeResponse,
  SignInResponse,
  UserContract,
  VerifyBasicResponse,
  WriteoffResponse,
} from '../types/contracts';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:4000';
const TOKEN_KEY = 'insurance_token';

export type User = UserContract;

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
  health: () => request<HealthResponse>('/api/health'),

  sendCode: (mobile: string) =>
    request<SendCodeResponse>('/api/auth/send-code', {
      method: 'POST',
      body: JSON.stringify({ mobile }),
    }),

  verifyBasic: (name: string, mobile: string, code: string) =>
    request<VerifyBasicResponse>('/api/auth/verify-basic', {
      method: 'POST',
      body: JSON.stringify({ name, mobile, code }),
    }),

  me: () => request<MeResponse>('/api/me'),

  activities: () => request<ActivitiesResponse>('/api/activities'),

  signIn: () => request<SignInResponse>('/api/sign-in', { method: 'POST' }),

  pointsSummary: () => request<PointsSummaryResponse>('/api/points/summary'),

  pointsTransactions: () => request<PointsTransactionsResponse>('/api/points/transactions'),

  mallItems: () => request<MallItemsResponse>('/api/mall/items'),

  redeem: (itemId: number) =>
    request<RedeemResponse>('/api/mall/redeem', {
      method: 'POST',
      body: JSON.stringify({ itemId }),
    }),

  redemptions: () => request<RedemptionsResponse>('/api/redemptions'),

  writeoff: (id: number, token?: string) =>
    request<WriteoffResponse>(`/api/redemptions/${id}/writeoff`, {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),
};
