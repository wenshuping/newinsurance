import { clearCache, getCache, setCache } from './cache';
import { buildSessionScopedStorageKey } from './session-cache';
import type { MeResponse, PointsSummaryResponse, SendCodeResponse, VerifyBasicResponse } from '../types/contracts';
import { resolveApiErrorMessage, shouldInvalidateSession } from '@contracts/error-ui';

function normalizeBase(base: string) {
  return String(base || '').replace(/\/+$/, '');
}

function isLoopbackHost(hostname: string) {
  const host = String(hostname || '').trim().toLowerCase();
  return host === '127.0.0.1' || host === 'localhost' || host === '0.0.0.0';
}

function resolveRuntimeBase(base: string) {
  const normalized = normalizeBase(base);
  if (typeof window === 'undefined') return normalized;
  try {
    const target = new URL(normalized);
    const current = new URL(window.location.href);
    if (!isLoopbackHost(target.hostname) || isLoopbackHost(current.hostname)) {
      return normalized;
    }
    target.hostname = current.hostname;
    if (current.protocol === 'https:' && target.protocol === 'http:') {
      target.protocol = 'https:';
    }
    return normalizeBase(target.toString());
  } catch {
    return normalized;
  }
}

const API_BASE = normalizeBase(import.meta.env.VITE_API_BASE || 'http://127.0.0.1:4100');
const USER_SERVICE_BASE = normalizeBase(import.meta.env.VITE_USER_SERVICE_BASE || API_BASE);
const POINTS_SERVICE_BASE = normalizeBase(import.meta.env.VITE_POINTS_SERVICE_BASE || API_BASE);
const TOKEN_KEY = 'insurance_token';
const CSRF_KEY = 'insurance_csrf_token';
const TENANT_ID_KEY = 'insurance_tenant_id';
const TENANT_CODE_KEY = 'insurance_tenant_code';
const DEFAULT_TENANT_ID = String(import.meta.env.VITE_C_DEFAULT_TENANT_ID ?? '').trim();
const DEFAULT_TENANT_CODE = String(import.meta.env.VITE_C_DEFAULT_TENANT_CODE || 'public-pool').trim();
const ME_CACHE_KEY = 'insurance_cache_me';
const POINTS_SUMMARY_CACHE_KEY = 'insurance_cache_points_summary';
const DEFAULT_CACHE_TTL_MS = 30 * 1000;
const C_AUTH_INVALID_EVENT = 'c:auth-invalid';

function clearSessionScopedUserCaches(sessionToken?: string | null) {
  clearCache(
    buildSessionScopedStorageKey(ME_CACHE_KEY, sessionToken),
    buildSessionScopedStorageKey(POINTS_SUMMARY_CACHE_KEY, sessionToken),
    ME_CACHE_KEY,
    POINTS_SUMMARY_CACHE_KEY
  );
}

function normalizeApiPath(path: string) {
  const normalized = String(path || '').trim();
  if (!normalized) return '';
  return normalized.split('?')[0];
}

function shouldClearUserCaches(path: string, method: string) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return false;
  const normalizedPath = normalizeApiPath(path);
  if (!normalizedPath) return true;
  if (normalizedPath === '/api/track/events') return false;
  if (/^\/api\/share\/[^/]+\/(view|click|identify)$/.test(normalizedPath)) return false;
  return true;
}

function shouldInvalidateCSession(path: string, input: { status?: number; code?: string }) {
  if (!shouldInvalidateSession(input)) return false;
  const normalizedPath = normalizeApiPath(path);
  if (!normalizedPath) return false;
  return normalizedPath === '/api/me' || normalizedPath.startsWith('/api/auth/');
}

export type User = {
  id: number;
  name: string;
  mobile: string;
  wechat_open_id?: string;
  wechat_union_id?: string;
  wechat_app_type?: string;
  wechat_bound_at?: string | null;
  is_verified_basic: boolean;
  verified_at?: string | null;
};

export type WechatIdentity = {
  openId?: string;
  unionId?: string;
  appType: 'h5' | 'mp' | 'mini_program';
};

export type VideoChannelMeta = {
  finderUserName?: string;
  feedToken?: string;
  feedId?: string;
  nonceId?: string;
  miniProgramAppId?: string;
  miniProgramPath?: string;
  miniProgramEnvVersion?: 'release' | 'trial' | 'develop';
  coverUrl?: string;
} | null;

export type LearningCourse = {
  id: number;
  title: string;
  desc: string;
  type: 'video' | 'comic' | 'article';
  typeLabel: string;
  progress: number;
  timeLeft: string;
  image: string;
  action: string;
  color: string;
  btnColor: string;
  points: number;
  category: string;
  content: string;
  coverUrl?: string;
  media?: Array<any>;
  videoUrl?: string;
  sourceType?: string;
  videoChannelMeta?: VideoChannelMeta;
  status?: string;
};

export type LearningShareContext = {
  shareCode?: string | null;
  fromShare?: string | number | boolean | null;
  courseId?: number | string | null;
};

export type LearningGame = {
  id: number;
  title: string;
  desc: string;
  category: string;
  difficulty: number;
  bestScore: string;
  color: string;
  lightColor: string;
  textColor: string;
};

export type LearningTool = {
  id: number;
  title: string;
  desc: string;
  color: string;
  bg: string;
};

export type InsurancePolicy = {
  id: number;
  customerId?: number;
  company: string;
  name: string;
  type: string;
  icon: 'stethoscope' | 'heart-pulse' | 'shield';
  amount: number;
  nextPayment: string;
  status: string;
  applicant: string;
  applicantRelation?: string;
  insured: string;
  insuredRelation?: string;
  periodStart: string;
  periodEnd: string;
  annualPremium: number;
  paymentPeriod: string;
  coveragePeriod: string;
  responsibilities: Array<{ name: string; desc: string; limit: number }>;
  analysis?: InsurancePolicyAnalysis | null;
  paymentHistory: Array<{ date: string; amount: number; note: string; status: string }>;
  policyNo: string;
};

export type InsurancePolicyAnalysis = {
  productOverview: string;
  coreFeature: string;
  coverageTable: Array<{
    coverageType: string;
    scenario: string;
    payout: string;
    note: string;
  }>;
  exclusions: string[];
  purchaseAdvice: string;
  disclaimer: string;
  model: string;
  generatedAt: string;
  cached?: boolean;
};

export type InsurancePolicyAnalysisResponse = {
  ok: boolean;
  analysis: InsurancePolicyAnalysis;
  policy?: InsurancePolicy;
};

export type ShareFriendPerson = {
  id: number;
  name: string;
  mobile: string;
  ownerUserId: number;
  verifiedAt?: string | null;
  referredAt?: string | null;
  shareCode?: string | null;
  label?: string;
};

export type CustomerShareNetworkResponse = {
  ok: true;
  upstream: ShareFriendPerson | null;
  invitedFriends: ShareFriendPerson[];
  stats: {
    invitedCount: number;
    verifiedCount: number;
  };
};

export type FamilyPolicyReportResponse = {
  ok: boolean;
  reportId?: number;
  reportMarkdown: string;
  sanitizedInput: Record<string, any>;
  meta: {
    privacyMode: 'desensitized';
    policyDetailLevel: 'basic' | 'partial' | 'detailed';
    policyDetailReason: string;
    model: string;
    generatedAt: string;
  };
  cached?: boolean;
  stored?: boolean;
  reused?: boolean;
};

export type PointDetailItem = {
  id: number;
  title: string;
  detail?: string;
  amount: number;
  balance?: number;
  direction: 'in' | 'out';
  source: string;
  createdAt: string;
};

export type PointDetailGroup = {
  key: string;
  label: string;
  items: PointDetailItem[];
};

export type AdvisorProfile = {
  id: number;
  tenantId: number;
  orgId: number;
  teamId: number;
  name: string;
  mobile: string;
  title: string;
  bio: string;
  avatarUrl?: string;
  wechatId?: string;
  wechatQrUrl?: string;
};

export type Activity = {
  id: number;
  title: string;
  category: string;
  rewardPoints: number;
  sortOrder: number;
  participants?: number;
  completed?: boolean;
  canComplete?: boolean;
  image?: string;
  cover?: string;
  media?: Array<any>;
  description?: string;
  status?: string;
};

export type ActivityHistoryItem = {
  id: number;
  activityId: number;
  orderId?: number;
  title: string;
  description?: string;
  image?: string;
  cover?: string;
  rewardPoints: number;
  completedDate: string;
  completedAt?: string;
  createdAt: string;
  status?: string;
  writeoffToken?: string;
  writtenOffAt?: string | null;
  writeoffStatus?: 'pending' | 'written_off' | string;
};

export type SharePreviewPayload = {
  title: string;
  subtitle: string;
  cover: string;
  tag: string;
  pointsHint?: number;
  ctaText: string;
};

export type ShareDetailResponse = {
  ok: true;
  valid: true;
  shareCode: string;
  shareType: 'activity' | 'learning_course' | 'mall_item' | 'mall_activity' | 'mall_home' | 'home_route';
  targetId: number | null;
  tenantId: number;
  salesId?: number | null;
  targetTitle: string;
  targetCPath: string;
  fallbackCPath: string;
  loginRequired: boolean;
  expiresAt: string;
  previewPayload: SharePreviewPayload;
};

export type ShareCreateResponse = {
  ok: true;
  shareCode: string;
  shareType: 'activity' | 'learning_course' | 'mall_item' | 'mall_activity' | 'mall_home' | 'home_route';
  targetId: number | null;
  targetTitle: string;
  shareUrl: string;
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

export type TrackPayload = {
  event: string;
  properties?: Record<string, unknown>;
};

export type WechatOpenTagConfigResponse = {
  ok: true;
  enabled: boolean;
  appId?: string;
  timestamp?: number;
  nonceStr?: string;
  signature?: string;
  openTagList?: string[];
  reason?: string;
};

export type WechatH5OauthUrlResponse = {
  ok: true;
  enabled: boolean;
  appId?: string;
  scope?: string;
  authorizeUrl?: string;
  reason?: string;
};

export type WechatH5ResolveSessionResponse = {
  ok: true;
  matched: boolean;
  customerId: number | null;
  isVerifiedBasic: boolean;
  skipVerify: boolean;
  matchType: string;
  token?: string;
  csrfToken?: string;
  user?: User;
  identity: {
    openId?: string;
    unionId?: string;
    appType: 'h5';
  };
};

function resolveShareCodeFromCurrentPath() {
  if (typeof window === 'undefined') return '';
  const match = String(window.location.pathname || '').match(/^\/share\/([^/?#]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : '';
}

async function request<T>(path: string, init?: RequestInit, options?: { baseUrl?: string }): Promise<T> {
  const token = getToken();
  const csrfToken = getCsrfToken();
  const tenantId = getTenantId();
  const tenantCode = getTenantCode();
  const baseUrl = resolveRuntimeBase(options?.baseUrl || API_BASE);
  const method = String(init?.method || 'GET').toUpperCase();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string>),
  };
  if (typeof window !== 'undefined') {
    const clientPath = `${window.location.pathname || '/'}${window.location.search || ''}`.trim();
    if (clientPath) headers['x-client-path'] = clientPath;
  }
  if (token) headers.Authorization = `Bearer ${token}`;
  if (token && csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    headers['x-csrf-token'] = csrfToken;
  }
  if (tenantId) headers['x-tenant-id'] = tenantId;
  if (!tenantId && tenantCode) headers['x-tenant-code'] = tenantCode;
  let res: Response | null = null;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers,
    });
  } catch (err) {
    throw err instanceof Error ? err : new Error('网络连接失败');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = String((data as any).code || `HTTP_${res.status}`);
    if (token && shouldInvalidateCSession(path, { status: res.status, code })) {
      clearToken();
      clearCsrfToken();
      clearSessionScopedUserCaches(token);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(C_AUTH_INVALID_EVENT, { detail: { code, path } }));
      }
    }
    const err = new Error(
      resolveApiErrorMessage(
        { status: res.status, code, message: String((data as any).message || '') },
        '请求失败'
      )
    );
    (err as any).code = code;
    (err as any).status = res.status;
    throw err;
  }
  if (shouldClearUserCaches(path, method)) {
    clearSessionScopedUserCaches(token);
  }
  return data as T;
}

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  sessionStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(TOKEN_KEY, token);
  clearCache(ME_CACHE_KEY, POINTS_SUMMARY_CACHE_KEY);
}

export function clearToken() {
  const token = getToken();
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
  clearSessionScopedUserCaches(token);
}

export function getCsrfToken() {
  return sessionStorage.getItem(CSRF_KEY) || localStorage.getItem(CSRF_KEY) || '';
}

export function setCsrfToken(token: string) {
  if (!token) return;
  sessionStorage.setItem(CSRF_KEY, token);
  localStorage.setItem(CSRF_KEY, token);
}

export function clearCsrfToken() {
  sessionStorage.removeItem(CSRF_KEY);
  localStorage.removeItem(CSRF_KEY);
}

export function onAuthInvalid(handler: (detail: { code: string; path: string }) => void) {
  if (typeof window === 'undefined') return () => {};
  const listener = (event: Event) => {
    const custom = event as CustomEvent<{ code: string; path: string }>;
    handler(custom.detail || { code: 'UNKNOWN', path: '' });
  };
  window.addEventListener(C_AUTH_INVALID_EVENT, listener);
  return () => window.removeEventListener(C_AUTH_INVALID_EVENT, listener);
}

function readTenantFromUrl() {
  if (typeof window === 'undefined') return { tenantId: '', tenantCode: '' };
  const params = new URLSearchParams(window.location.search || '');
  const tenantId = String(params.get('tenantId') || params.get('tid') || '').trim();
  const tenantCode = String(params.get('tenantCode') || params.get('tenantKey') || '').trim();
  return { tenantId, tenantCode };
}

function readStoredTenantContext() {
  if (typeof window === 'undefined') return { tenantId: '', tenantCode: '' };
  return {
    tenantId: String(localStorage.getItem(TENANT_ID_KEY) || '').trim(),
    tenantCode: String(localStorage.getItem(TENANT_CODE_KEY) || '').trim(),
  };
}

function readEffectiveTenantContext() {
  if (typeof window === 'undefined') return { tenantId: '', tenantCode: '' };
  const fromUrl = readTenantFromUrl();
  if (fromUrl.tenantId) {
    setTenantContext({ tenantId: fromUrl.tenantId });
    return { tenantId: fromUrl.tenantId, tenantCode: '' };
  }
  if (fromUrl.tenantCode) {
    setTenantContext({ tenantCode: fromUrl.tenantCode });
    return { tenantId: '', tenantCode: fromUrl.tenantCode };
  }
  if (resolveShareCodeFromCurrentPath()) {
    return readStoredTenantContext();
  }
  return { tenantId: DEFAULT_TENANT_ID, tenantCode: DEFAULT_TENANT_CODE };
}

export function getTenantId() {
  return readEffectiveTenantContext().tenantId;
}

export function getTenantCode() {
  return readEffectiveTenantContext().tenantCode;
}

export function setTenantContext(input: { tenantId?: number | string | null; tenantCode?: string | null }) {
  if (typeof window === 'undefined') return;
  const tenantId = String(input?.tenantId || '').trim();
  const tenantCode = String(input?.tenantCode || '').trim();
  if (tenantId) localStorage.setItem(TENANT_ID_KEY, tenantId);
  else localStorage.removeItem(TENANT_ID_KEY);
  if (tenantCode) localStorage.setItem(TENANT_CODE_KEY, tenantCode);
  else localStorage.removeItem(TENANT_CODE_KEY);
}

async function resolveTenantIdFromActiveShare() {
  const shareCode = resolveShareCodeFromCurrentPath();
  if (!shareCode) return null;
  try {
    const detail = await request<ShareDetailResponse>(`/api/share/${encodeURIComponent(shareCode)}`);
    if (!detail?.tenantId) return null;
    setTenantContext({ tenantId: detail.tenantId });
    return Number(detail.tenantId);
  } catch {
    return null;
  }
}

function appendCurrentShareParams(path: string, keys: string[] = []) {
  if (typeof window === 'undefined') return path;
  const rawPath = String(path || '').trim();
  if (!rawPath) return rawPath;
  const current = new URLSearchParams(window.location.search || '');
  const next = new URLSearchParams();
  for (const key of keys) {
    const value = String(current.get(key) || '').trim();
    if (value) next.set(key, value);
  }
  const query = next.toString();
  if (!query) return rawPath;
  return `${rawPath}${rawPath.includes('?') ? '&' : '?'}${query}`;
}

function appendShareParams(path: string, context: LearningShareContext | null | undefined, keys: string[] = []) {
  const rawPath = String(path || '').trim();
  if (!rawPath) return rawPath;
  const next = new URLSearchParams();
  const current = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search || '');
  for (const key of keys) {
    const explicit = context && context[key as keyof LearningShareContext] != null
      ? String(context[key as keyof LearningShareContext] || '').trim()
      : '';
    if (explicit) {
      next.set(key, explicit);
      continue;
    }
    const fallback = String(current?.get(key) || '').trim();
    if (fallback) next.set(key, fallback);
  }
  const query = next.toString();
  if (!query) return rawPath;
  return `${rawPath}${rawPath.includes('?') ? '&' : '?'}${query}`;
}

export function resolveCurrentLearningShareContext(courseId?: number | null): LearningShareContext {
  if (typeof window === 'undefined') return {};
  const current = new URLSearchParams(window.location.search || '');
  const shareCode = String(current.get('shareCode') || '').trim();
  const fromShare = String(current.get('fromShare') || '').trim();
  const currentCourseId = String(current.get('courseId') || '').trim();
  const resolvedCourseId = Number(courseId || currentCourseId || 0);
  return {
    shareCode: shareCode || null,
    fromShare: fromShare || null,
    courseId: Number.isFinite(resolvedCourseId) && resolvedCourseId > 0 ? resolvedCourseId : null,
  };
}

async function postVerifyBasic(
  name: string | undefined,
  mobile: string,
  code: string,
  tenantIdOverride?: number | null,
  tenantCodeOverride?: string | null,
  identity?: WechatIdentity | null
) {
  const tenantId = tenantIdOverride ?? (getTenantId() ? Number(getTenantId()) : undefined);
  const tenantCode = tenantCodeOverride ?? (!tenantId && getTenantCode() ? getTenantCode() : undefined);
  const shareCode = resolveShareCodeFromCurrentPath();
  return request<VerifyBasicResponse>(
    '/api/auth/verify-basic',
    {
      method: 'POST',
      body: JSON.stringify({
        name: name || undefined,
        mobile,
        code,
        tenantId: tenantId || undefined,
        tenantCode: !tenantId && tenantCode ? tenantCode : undefined,
        shareCode: shareCode || undefined,
        openId: identity?.openId || undefined,
        unionId: identity?.unionId || undefined,
        appType: identity?.appType || undefined,
      }),
    },
    {
      baseUrl: USER_SERVICE_BASE,
    }
  );
}

export const api = {
  health: () => request<{ ok: boolean; service: string }>('/api/health'),

  sendCode: async (mobile: string, options?: { lookupOnly?: boolean }) => {
    const tenantId = getTenantId() ? Number(getTenantId()) : undefined;
    const tenantCode = !tenantId && getTenantCode() ? getTenantCode() : undefined;
    const lookupOnly = Boolean(options?.lookupOnly);
    try {
      return await request<SendCodeResponse>('/api/auth/send-code', {
        method: 'POST',
        body: JSON.stringify({
          mobile,
          tenantId: tenantId || undefined,
          tenantCode: !tenantId && tenantCode ? tenantCode : undefined,
          lookupOnly: lookupOnly || undefined,
        }),
      }, { baseUrl: USER_SERVICE_BASE });
    } catch (err: any) {
      if (String(err?.code || '') === 'TENANT_REQUIRED') {
        const activeTenantId = await resolveTenantIdFromActiveShare();
        if (activeTenantId) {
          return request<SendCodeResponse>('/api/auth/send-code', {
            method: 'POST',
            body: JSON.stringify({
              mobile,
              tenantId: activeTenantId,
              lookupOnly: lookupOnly || undefined,
            }),
          }, { baseUrl: USER_SERVICE_BASE });
        }
      }
      throw err;
    }
  },

  verifyBasic: async (name: string | undefined, mobile: string, code: string, identity?: WechatIdentity | null) => {
    try {
      const resp = await postVerifyBasic(name, mobile, code, undefined, undefined, identity);
      setCsrfToken(resp.csrfToken || '');
      return resp;
    } catch (err: any) {
      if (String(err?.code || '') === 'TENANT_REQUIRED') {
        const tenantId = await resolveTenantIdFromActiveShare();
        if (tenantId) {
          const retry = await postVerifyBasic(name, mobile, code, tenantId, undefined, identity);
          setCsrfToken(retry.csrfToken || '');
          return retry;
        }
      }
      throw err;
    }
  },

  me: async () => {
    const token = getToken();
    const cacheKey = buildSessionScopedStorageKey(ME_CACHE_KEY, token);
    const cached = getCache<MeResponse>(cacheKey);
    if (cached) return cached;
    const resp = await request<MeResponse>('/api/me', undefined, { baseUrl: USER_SERVICE_BASE });
    if (resp.csrfToken) setCsrfToken(resp.csrfToken);
    setCache(cacheKey, resp, DEFAULT_CACHE_TTL_MS);
    clearCache(ME_CACHE_KEY);
    return resp;
  },

  advisorProfile: () => request<{ ok: true; advisor: AdvisorProfile | null }>('/api/advisor/me'),

  activities: () =>
    request<{ activities: Activity[]; balance: number; taskProgress: { total: number; completed: number } }>(
      appendCurrentShareParams('/api/activities', ['shareCode', 'fromShare', 'activityId'])
    ),

  activityHistory: () =>
    request<{ list: ActivityHistoryItem[]; total: number }>('/api/activities/history'),

  completeActivity: (id: number) =>
    request<{ ok: boolean; reward: number; balance: number }>(
      appendCurrentShareParams(`/api/activities/${id}/complete`, ['shareCode', 'fromShare', 'activityId']),
      {
        method: 'POST',
      }
    ),

  signIn: () =>
    request<{ ok: boolean; reward: number; balance: number }>('/api/sign-in', { method: 'POST' }, { baseUrl: POINTS_SERVICE_BASE }),

  pointsSummary: async () => {
    const token = getToken();
    const cacheKey = buildSessionScopedStorageKey(POINTS_SUMMARY_CACHE_KEY, token);
    const cached = getCache<PointsSummaryResponse>(cacheKey);
    if (cached) return cached;
    const resp = await request<PointsSummaryResponse>('/api/points/summary', undefined, { baseUrl: POINTS_SERVICE_BASE });
    setCache(cacheKey, resp, DEFAULT_CACHE_TTL_MS);
    clearCache(POINTS_SUMMARY_CACHE_KEY);
    return resp;
  },

  pointsTransactions: () => request<{ list: any[] }>('/api/points/transactions', undefined, { baseUrl: POINTS_SERVICE_BASE }),
  pointsDetail: () => request<{ balance: number; groups: PointDetailGroup[] }>('/api/points/detail', undefined, { baseUrl: POINTS_SERVICE_BASE }),

  mallItems: () => request<{ items: any[] }>('/api/mall/items', undefined, { baseUrl: POINTS_SERVICE_BASE }),
  mallActivities: () => request<{ list: Array<any & { joined?: boolean }> }>('/api/mall/activities', undefined, { baseUrl: POINTS_SERVICE_BASE }),

  redeem: (itemId: number) =>
    request<{
      ok: boolean;
      token: string;
      balance: number;
      redemption: {
        id: number;
        orderNo: string;
        itemName: string;
        pointsCost: number;
        status: string;
        expiresAt: string;
        writeoffToken: string;
      };
    }>('/api/mall/redeem', {
      method: 'POST',
      headers: { 'x-action-confirm': 'YES' },
      body: JSON.stringify({
        itemId,
        idempotencyKey:
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `redeem-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      }),
    }, { baseUrl: POINTS_SERVICE_BASE }),

  joinMallActivity: (id: number) =>
    request<{ ok: boolean; duplicated: boolean; reward: number; balance: number; activity?: { id: number; title: string } }>(
      `/api/mall/activities/${id}/join`,
      {
        method: 'POST',
      },
      { baseUrl: POINTS_SERVICE_BASE }
    ),

  redemptions: () => request<{ list: any[] }>('/api/redemptions', undefined, { baseUrl: POINTS_SERVICE_BASE }),

  writeoff: (id: number, token?: string) =>
    request<{ ok: boolean }>(`/api/redemptions/${id}/writeoff`, {
      method: 'POST',
      body: JSON.stringify({ token }),
    }, { baseUrl: POINTS_SERVICE_BASE }),

  orders: () => request<{ list: any[] }>('/api/orders', undefined, { baseUrl: POINTS_SERVICE_BASE }),

  orderDetail: (id: number) =>
    request<{ order: any; redemption: any | null }>(`/api/orders/${id}`, undefined, { baseUrl: POINTS_SERVICE_BASE }),

  createOrder: (payload: { productId: number; quantity?: number }) =>
    request<{ ok: boolean; order: any }>('/api/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, { baseUrl: POINTS_SERVICE_BASE }),

  payOrder: (id: number, payload?: Record<string, unknown>) =>
    request<{ ok: boolean; order: any; redemption: any | null }>(`/api/orders/${id}/pay`, {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    }, { baseUrl: POINTS_SERVICE_BASE }),

  cancelOrder: (id: number, payload?: { reason?: string }) =>
    request<{ ok: boolean; order: any }>(`/api/orders/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    }, { baseUrl: POINTS_SERVICE_BASE }),

  refundOrder: (id: number, payload?: { reason?: string; operatorId?: number }) =>
    request<{ ok: boolean; order: any }>(`/api/orders/${id}/refund`, {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    }, { baseUrl: POINTS_SERVICE_BASE }),

  learningCourses: () =>
    request<{ categories: string[]; courses: LearningCourse[] }>(
      appendCurrentShareParams('/api/learning/courses', ['shareCode', 'fromShare', 'courseId'])
    ),

  learningCourseDetail: (id: number) =>
    request<{ course: LearningCourse }>(
      appendCurrentShareParams(`/api/learning/courses/${id}`, ['shareCode', 'fromShare', 'courseId'])
    ),

  completeCourse: (
    id: number,
    payload?: {
      completionSource?: 'video' | 'article' | 'video_channel';
      videoProgressPercent?: number;
      videoWatchedSeconds?: number;
      videoDurationSeconds?: number;
      videoEnded?: boolean;
      videoChannelOpened?: boolean;
      articleDwellSeconds?: number;
      articleReachedEnd?: boolean;
    },
    shareContext?: LearningShareContext | null,
  ) =>
    request<{ ok: boolean; duplicated: boolean; reward: number; balance: number; message?: string }>(
      appendShareParams(`/api/learning/courses/${id}/complete`, shareContext, ['shareCode', 'fromShare', 'courseId']),
      {
        method: 'POST',
        body: JSON.stringify(payload || {}),
      }
    ),

  wechatH5OpenTagConfig: (url: string) =>
    request<WechatOpenTagConfigResponse>(`/api/wechat/h5/open-tag-config?url=${encodeURIComponent(String(url || ''))}`),

  wechatH5OauthUrl: (redirectUrl: string) =>
    request<WechatH5OauthUrlResponse>(`/api/wechat/h5/oauth-url?redirectUrl=${encodeURIComponent(String(redirectUrl || ''))}`),

  wechatH5ResolveSession: (payload: { code?: string; identity?: WechatIdentity | null }) =>
    request<WechatH5ResolveSessionResponse>('/api/auth/wechat/h5/resolve-session', {
      method: 'POST',
      body: JSON.stringify({
        code: payload.code || undefined,
        openId: payload.identity?.openId || undefined,
        unionId: payload.identity?.unionId || undefined,
        appType: payload.identity?.appType || undefined,
      }),
    }, { baseUrl: USER_SERVICE_BASE }),

  bindWechatIdentity: (identity: WechatIdentity) =>
    request<{ ok: boolean; customerId: number; binding: { openId: string; unionId: string; appType: string; boundAt: string } }>(
      '/api/auth/wechat/bind',
      {
        method: 'POST',
        body: JSON.stringify({
          openId: identity.openId || undefined,
          unionId: identity.unionId || undefined,
          appType: identity.appType,
        }),
      },
      { baseUrl: USER_SERVICE_BASE }
    ),

  createCustomerShare: (payload: {
    shareType: 'activity' | 'learning_course' | 'mall_item' | 'mall_activity' | 'mall_home' | 'home_route';
    targetId?: number | null;
    channel?: string;
    sharePath?: string;
  }) =>
    request<ShareCreateResponse>('/api/c/shares', {
      method: 'POST',
      headers: {
        'x-client-source': 'c-web',
      },
      body: JSON.stringify(payload),
    }),

  shareDetail: (shareCode: string) => request<ShareDetailResponse>(`/api/share/${encodeURIComponent(shareCode)}`),

  shareView: (shareCode: string, visitor?: ShareVisitorPayload) =>
    request<{ ok: boolean }>(`/api/share/${encodeURIComponent(shareCode)}/view`, {
      method: 'POST',
      body: JSON.stringify(visitor ? { visitor } : {}),
    }),

  shareClick: (shareCode: string, visitor?: ShareVisitorPayload) =>
    request<{ ok: boolean }>(`/api/share/${encodeURIComponent(shareCode)}/click`, {
      method: 'POST',
      body: JSON.stringify(visitor ? { visitor } : {}),
    }),

  shareIdentify: (shareCode: string, visitor?: ShareVisitorPayload) =>
    request<{ ok: boolean }>(`/api/share/${encodeURIComponent(shareCode)}/identify`, {
      method: 'POST',
      body: JSON.stringify(visitor ? { visitor } : {}),
    }),

  myShareFriends: () => request<CustomerShareNetworkResponse>('/api/c/share-friends'),

  learningGames: () => request<{ games: LearningGame[] }>('/api/learning/games'),

  learningTools: () => request<{ tools: LearningTool[] }>('/api/learning/tools'),

  insuranceOverview: () =>
    request<{
      summary: { totalCoverage: number; healthScore: number; activePolicies: number; annualPremium: number };
      familyMembers: Array<{ id: number; name: string; avatar: string; score: number; coveredTypes: string[] }>;
      reminders: Array<{ id: number; title: string; desc: string; tag: string; actionText: string; kind: string }>;
    }>('/api/insurance/overview'),

  insurancePolicies: () => request<{ policies: InsurancePolicy[] }>('/api/insurance/policies'),

  insurancePolicyDetail: (id: number) => request<{ policy: InsurancePolicy }>(`/api/insurance/policies/${id}`),

  analyzeInsurancePolicy: (payload: {
    policyId?: number;
    policy?: {
      company: string;
      name: string;
      date?: string;
      amount?: number;
      firstPremium?: number;
    };
  }) =>
    request<InsurancePolicyAnalysisResponse>('/api/insurance/policies/analyze', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  resolveFamilyPolicyReport: (payload: Record<string, any>) =>
    request<FamilyPolicyReportResponse>('/api/insurance/family-reports/resolve', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  generateFamilyPolicyReport: (payload: Record<string, any>) =>
    request<FamilyPolicyReportResponse>('/api/insurance/family-reports/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  scanPolicy: (payload: { uploadItem?: { name: string; type: string; dataUrl: string }; ocrText?: string }) =>
    request<{
      ok: boolean;
      ocrText: string;
      data: {
        company?: string;
        name?: string;
        applicant?: string;
        insured?: string;
        date?: string;
        paymentPeriod?: string;
        coveragePeriod?: string;
        amount?: string | number;
        firstPremium?: string | number;
      };
    }>('/api/insurance/policies/scan', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  createPolicy: (payload: {
    company: string;
    name: string;
    applicant: string;
    applicantRelation: string;
    insured: string;
    insuredRelation: string;
    date: string;
    paymentPeriod: string;
    coveragePeriod: string;
    amount: number;
    firstPremium: number;
    type?: string;
    analysis?: InsurancePolicyAnalysis | null;
  }) =>
    request<{ ok: boolean; policy: InsurancePolicy }>('/api/insurance/policies', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  trackEvent: (payload: TrackPayload) =>
    request<{ ok: boolean }>('/api/track/events', {
      method: 'POST',
      headers: {
        'x-client-source': 'c-web',
        'x-client-path': typeof window === 'undefined' ? '' : window.location.pathname,
      },
      body: JSON.stringify(payload),
    }),
};
