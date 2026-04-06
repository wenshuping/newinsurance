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
import { ERROR_COPY } from './errorCopy';
import { buildApiUrl } from './apiUrl';

const API_BASE = import.meta.env.VITE_API_BASE || '';
const TOKEN_KEY = 'insurance_token';
const USER_KEY = 'insurance_user';
const TENANT_ID_KEY = 'insurance_tenant_id';

export type User = UserContract;
export type LearningCourse = {
  id: number;
  title: string;
  desc: string;
  category?: string;
  type: 'video' | 'comic' | 'article';
  typeLabel: string;
  progress: number;
  timeLeft: string;
  image: string;
  action: string;
  color: string;
  btnColor: string;
  points: number;
  content: string;
  videoUrl?: string;
  media?: Array<string | { url?: string; preview?: string; path?: string; name?: string; type?: string }>;
};
export type LearningCoursesResponse = {
  categories: string[];
  courses: LearningCourse[];
};
export type CompleteActivityResponse = {
  ok: boolean;
  reward: number;
  balance: number;
};
export type MallActivityItem = {
  id: number;
  title: string;
  subtitle?: string;
  badge?: string;
  rewardPoints?: number;
  status?: string;
  image?: string;
  media?: Array<any>;
};
export type MallActivitiesResponse = {
  list: MallActivityItem[];
};
export type JoinMallActivityResponse = {
  ok: boolean;
  duplicated?: boolean;
  reward: number;
  balance: number;
};
export type SharePreviewPayload = {
  title: string;
  subtitle?: string;
  cover?: string;
  tag?: string;
  pointsHint?: number;
  ctaText?: string;
};
export type ShareDetailResponse = {
  ok: boolean;
  valid: boolean;
  shareCode: string;
  shareType: string;
  targetId: number | null;
  tenantId: number;
  targetTitle: string;
  targetCPath: string;
  fallbackCPath: string;
  loginRequired: boolean;
  expiresAt: string;
  previewPayload: SharePreviewPayload;
};
export type ShareVisitorPayload = {
  id?: number;
  name?: string;
  mobile?: string;
};

function readTenantIdFromUrl() {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search || '');
  return String(params.get('tenantId') || params.get('tid') || '').trim();
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const tenantId = getTenantId();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (tenantId) headers['x-tenant-id'] = tenantId;
  if (typeof window !== 'undefined') {
    const clientPath = `${window.location.pathname || '/'}${window.location.search || ''}`.trim();
    if (clientPath) headers['x-client-path'] = clientPath;
  }

  const res = await fetch(buildApiUrl(API_BASE, path), {
    ...init,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data as any).message || ERROR_COPY.requestFailed);
    (err as any).code = (data as any).code;
    throw err;
  }
  return data as T;
}

export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
}

export function getTenantId() {
  if (typeof window === 'undefined') return '';
  const fromUrl = readTenantIdFromUrl();
  if (fromUrl) {
    localStorage.setItem(TENANT_ID_KEY, fromUrl);
    return fromUrl;
  }
  return String(localStorage.getItem(TENANT_ID_KEY) || '').trim();
}

export function setTenantId(tenantId: number | string | null | undefined) {
  if (typeof window === 'undefined') return;
  const nextValue = String(tenantId || '').trim();
  if (!nextValue) {
    localStorage.removeItem(TENANT_ID_KEY);
    return;
  }
  localStorage.setItem(TENANT_ID_KEY, nextValue);
}

export function getCachedUser() {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

export function setCachedUser(user: User | null) {
  if (typeof window === 'undefined') return;
  if (!user) {
    localStorage.removeItem(USER_KEY);
    return;
  }
  localStorage.setItem(USER_KEY, JSON.stringify(user));
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

  shareDetail: (shareCode: string) => request<ShareDetailResponse>(`/api/share/${encodeURIComponent(shareCode)}`),
  shareView: (shareCode: string) =>
    request<{ ok: boolean }>(`/api/share/${encodeURIComponent(shareCode)}/view`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  shareClick: (shareCode: string) =>
    request<{ ok: boolean }>(`/api/share/${encodeURIComponent(shareCode)}/click`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  shareIdentify: (shareCode: string, visitor?: ShareVisitorPayload) =>
    request<{ ok: boolean }>(`/api/share/${encodeURIComponent(shareCode)}/identify`, {
      method: 'POST',
      body: JSON.stringify({ visitor: visitor || undefined }),
    }),

  me: () => request<MeResponse>('/api/me'),

  activities: () => request<ActivitiesResponse>('/api/activities'),
  completeActivity: (activityId: number) =>
    request<CompleteActivityResponse>(`/api/activities/${activityId}/complete`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  signIn: () => request<SignInResponse>('/api/sign-in', { method: 'POST' }),

  pointsSummary: () => request<PointsSummaryResponse>('/api/points/summary'),

  pointsTransactions: () => request<PointsTransactionsResponse>('/api/points/transactions'),

  mallItems: () => request<MallItemsResponse>('/api/mall/items'),
  mallActivities: () => request<MallActivitiesResponse>('/api/mall/activities'),
  joinMallActivity: (activityId: number) =>
    request<JoinMallActivityResponse>(`/api/mall/activities/${activityId}/join`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),

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

  learningCourses: () => request<LearningCoursesResponse>('/api/learning/courses'),
};
