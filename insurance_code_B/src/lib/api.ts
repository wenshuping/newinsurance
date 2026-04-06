import type { BLoginSessionContract } from '@contracts/index';
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

const API_BASE = normalizeBase((import.meta as any).env?.VITE_API_BASE_URL || 'http://127.0.0.1:4000');
const B_SESSION_KEY = 'b_staff_session_v1';
const B_CSRF_KEY = 'b_staff_csrf_v1';
const B_AUTH_INVALID_EVENT = 'b:auth-invalid';
const DEFAULT_REQUEST_TIMEOUT_MS = 12_000;
const OCR_REQUEST_TIMEOUT_MS = 30_000;
const POLICY_ANALYSIS_REQUEST_TIMEOUT_MS = 120_000;

type ReqInit = RequestInit & { bodyJson?: unknown; timeoutMs?: number };

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const parentSignal = init.signal;
  const abortFromParent = () => controller.abort();
  if (parentSignal) {
    if (parentSignal.aborted) controller.abort();
    else parentSignal.addEventListener('abort', abortFromParent, { once: true });
  }
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      const timeoutError = new Error('请求超时，请重试');
      (timeoutError as any).code = 'REQUEST_TIMEOUT';
      throw timeoutError;
    }
    throw err;
  } finally {
    window.clearTimeout(timer);
    if (parentSignal) parentSignal.removeEventListener('abort', abortFromParent);
  }
}

export type BLoginSession = BLoginSessionContract;

function normalizeBSessionRoleActorType(session: BLoginSession | null): BLoginSession | null {
  if (!session) return null;
  const role = String((session as any).role || '').trim().toLowerCase();
  const normalizedActorType =
    role === 'company_admin' || role === 'team_lead'
      ? 'employee'
      : role === 'agent'
        ? 'agent'
        : String((session as any).actorType || 'employee');
  return {
    ...session,
    actorType: normalizedActorType,
  } as BLoginSession;
}

function deriveLocalCShareBaseUrl() {
  if (typeof window === 'undefined') return '';
  const { protocol, hostname, port } = window.location;
  if (port === '3002') return `${protocol}//${hostname}:3000`;
  if (port === '3004' || port === '3005') return `${protocol}//${hostname}:3003`;
  return '';
}

const C_SHARE_BASE_URL = (import.meta as any).env?.VITE_C_SHARE_BASE_URL || deriveLocalCShareBaseUrl();

function resolveShareOriginFromWindow() {
  if (typeof window === 'undefined') return '';
  return C_SHARE_BASE_URL || `${window.location.protocol}//${window.location.host}`;
}

export function normalizeShareUrl(rawUrl: string) {
  const text = String(rawUrl || '').trim();
  if (!text || typeof window === 'undefined') return text;
  try {
    if (text.startsWith('/')) {
      const origin = resolveShareOriginFromWindow();
      return origin ? `${normalizeBase(origin)}${text}` : text;
    }
    const parsed = new URL(text);
    if (!parsed.pathname.startsWith('/share/')) return parsed.toString();
    if (parsed.port === '3004' || parsed.port === '3005') {
      parsed.port = '3003';
      return parsed.toString();
    }
    return parsed.toString();
  } catch {
    return text;
  }
}

export function redirectLegacySharePath() {
  if (typeof window === 'undefined') return;
  const { pathname, search, hash, protocol, hostname, port } = window.location;
  if (!pathname.startsWith('/share/')) return;
  if (port !== '3004' && port !== '3005') return;
  const target = `${protocol}//${hostname}:3003${pathname}${search}${hash}`;
  window.location.replace(target);
}

function normalizeApiPath(path: string) {
  const normalized = String(path || '').trim();
  if (!normalized) return '';
  return normalized.split('?')[0];
}

function shouldInvalidateBSession(path: string, input: { status?: number; code?: string }) {
  if (!shouldInvalidateSession(input)) return false;
  const normalizedPath = normalizeApiPath(path);
  if (!normalizedPath) return false;
  return normalizedPath.startsWith('/api/b/auth/');
}

function loadSession(): BLoginSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(B_SESSION_KEY) || window.localStorage.getItem(B_SESSION_KEY);
    if (!raw) return null;
    return normalizeBSessionRoleActorType(JSON.parse(raw) as BLoginSession);
  } catch {
    return null;
  }
}

function getCsrfToken() {
  if (typeof window === 'undefined') return '';
  return String(window.sessionStorage.getItem(B_CSRF_KEY) || window.localStorage.getItem(B_CSRF_KEY) || '');
}

function actorHeaders() {
  const session = loadSession();
  if (!session) return null;
  const headers: Record<string, string> = {
    'x-actor-type': String(session.actorType || 'employee'),
    'x-actor-id': String(session.actorId || 8001),
    'x-tenant-id': String(session.tenantId || 1),
    'x-org-id': String(session.orgId || 1),
    'x-team-id': String(session.teamId || 1),
    'x-csrf-token': String(session.csrfToken || getCsrfToken() || ''),
  };
  if (session.token) headers.Authorization = `Bearer ${session.token}`;
  return headers;
}

async function request<T>(path: string, init: ReqInit = {}): Promise<T> {
  const method = String(init.method || 'GET').toUpperCase();
  const headersFromSession = actorHeaders();
  const isLoginPath = path === '/api/b/auth/login';
  if (!isLoginPath && !headersFromSession) {
    const err = new Error('请先登录');
    (err as any).code = 'NO_SESSION';
    throw err;
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headersFromSession || {}),
    ...(init.headers as Record<string, string>),
  };
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    headers['x-action-confirm'] = 'YES';
  }
  const res = await fetchWithTimeout(`${resolveRuntimeBase(API_BASE)}${path}`, {
    ...init,
    headers,
    body: init.bodyJson === undefined ? init.body : JSON.stringify(init.bodyJson),
  }, init.timeoutMs);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = String((data as any)?.code || `HTTP_${res.status}`);
    if (shouldInvalidateBSession(path, { status: res.status, code })) {
      bApi.clearSession();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(B_AUTH_INVALID_EVENT, { detail: { code, path } }));
      }
    }
    const err = new Error(
      resolveApiErrorMessage(
        { status: res.status, code, message: String((data as any)?.message || '') },
        `HTTP_${res.status}`
      )
    );
    (err as any).code = code;
    (err as any).status = res.status;
    throw err;
  }
  return data as T;
}

export type BCustomer = {
  id: number;
  name: string;
  mobile: string;
  ownerUserId: number;
  tenantId: number;
  orgId: number;
  teamId: number;
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

export type BOrder = {
  id: number;
  customerId: number;
  productId?: number;
  productName: string;
  orderType?: 'product' | 'activity' | string;
  sourceRecordId?: number;
  writeoffToken?: string;
  status: string;
  fulfillmentStatus: string;
  paymentStatus: string;
  refundStatus?: string;
  pointsAmount: number;
  quantity?: number;
  orderNo: string;
  createdAt?: string;
  updatedAt?: string;
};

export type BTag = {
  id: number;
  tenantId: number;
  name: string;
  createdBy: number;
  createdAt: string;
};

export type BTemplateSource = 'platform' | 'company' | 'personal';

export type BContentItem = {
  id: number;
  title: string;
  status: string;
  contentType: string;
  rewardPoints: number;
  sortOrder: number;
  media?: Array<{ name?: string; type?: string; preview?: string; url?: string; path?: string } | string>;
  content?: string;
  updatedAt?: string;
  templateSource?: BTemplateSource;
  templateTag?: string;
};

export type BActivityConfig = {
  id: number;
  title: string;
  status: string;
  rewardPoints: number;
  sortOrder: number;
  media?: Array<{ name?: string; type?: string; preview?: string; url?: string; path?: string } | string>;
  content?: string;
  updatedAt?: string;
  templateSource?: BTemplateSource;
  templateTag?: string;
};

export type BMallProduct = {
  id: number;
  title: string;
  points: number;
  stock: number;
  sortOrder: number;
  status: string;
  media?: Array<{ name?: string; type?: string; preview?: string; url?: string; path?: string } | string>;
  description?: string;
  updatedAt?: string;
  templateSource?: BTemplateSource;
  templateTag?: string;
};

export type BMallActivity = {
  id: number;
  title: string;
  status: string;
  rewardPoints: number;
  sortOrder: number;
  media?: Array<{ name?: string; type?: string; preview?: string; url?: string; path?: string } | string>;
  description?: string;
  updatedAt?: string;
  templateSource?: BTemplateSource;
  templateTag?: string;
};

export type BShareType = 'activity' | 'learning_course' | 'mall_item' | 'mall_activity' | 'mall_home';

export type BCreateShareResponse = {
  ok: true;
  shareCode: string;
  shareType: BShareType;
  targetId: number | null;
  targetTitle: string;
  shareUrl: string;
  targetCPath: string;
  fallbackCPath: string;
  loginRequired: boolean;
  expiresAt: string;
  previewPayload: {
    title: string;
    subtitle: string;
    cover: string;
    tag: string;
    pointsHint?: number;
    ctaText: string;
  };
};

export type BShareRecord = {
  shareCode: string;
  shareType: BShareType;
  sharePath: string;
  channel: string;
  targetId: number | null;
  targetTitle: string;
  shareUrl: string;
  targetCPath: string;
  fallbackCPath: string;
  loginRequired: boolean;
  expiresAt: string;
  createdAt: string;
  previewPayload: {
    title?: string;
    subtitle?: string;
    cover?: string;
    tag?: string;
    pointsHint?: number;
    ctaText?: string;
  };
  metrics: {
    views: number;
    clicks: number;
    deliveries: number;
    clickThroughRate: number;
  };
};

export type BShareTargetStats = {
  shareType: BShareType;
  targetId: number | null;
  targetTitle: string;
  totalLinks: number;
  totalViews: number;
  totalClicks: number;
  totalParticipants: number;
  totalAttendees: number;
  clickThroughRate: number;
};

export type BShareAnalyticsScope = {
  scopeType: 'self' | 'team' | 'company' | 'platform';
  label: string;
  tenantId: number | null;
  teamId: number | null;
};

export type BActivityEffectSummary = {
  totalActivities: number;
  totalShares: number;
  totalViews: number;
  totalParticipants: number;
  totalAttendees: number;
};

export type BLearningEffectSummary = {
  totalCourses: number;
  totalShares: number;
  totalViews: number;
  totalParticipants: number;
};

export type BShareOverviewResponse = {
  ok: true;
  scope: BShareAnalyticsScope;
  filter: null | {
    shareType: BShareType;
    targetId: number | null;
    targetTitle: string;
  };
  activityEffect: BActivityEffectSummary;
  learningEffect: BLearningEffectSummary;
  summary: {
    totalLinks: number;
    totalViews: number;
    totalClicks: number;
    totalDeliveries: number;
    clickThroughRate: number;
  };
  byType: Array<{
    shareType: BShareType;
    totalLinks: number;
    totalViews: number;
    totalClicks: number;
    totalDeliveries: number;
    clickThroughRate: number;
  }>;
  targetStats: BShareTargetStats[];
  list: BShareRecord[];
};

export type BShareRecordEvent = {
  id: number;
  event: string;
  actionLabel: string;
  actorType: string;
  actorId: number | null;
  actorName: string;
  actorLabel: string;
  actorMobile?: string;
  occurredAt: string;
  source: string;
  sourceLabel: string;
  path: string;
  userAgent: string;
  properties: Record<string, unknown>;
};

export type BShareRecordDetailResponse = {
  ok: true;
  record: BShareRecord;
  events: BShareRecordEvent[];
};

export type BShareEffectParticipantRow = {
  userId: number;
  name: string;
  mobile: string;
  shareType: BShareType;
  targetId: number;
  targetTitle: string;
  occurredAt: string;
};

export type BShareEffectParticipantsResponse = {
  ok: true;
  scope: BShareAnalyticsScope;
  metric?: string;
  filter: null | {
    shareType?: BShareType;
    targetId: number;
    targetTitle: string;
  };
  total: number;
  list: BShareEffectParticipantRow[];
};

export type BShareParticipantMetricKind = 'signup' | 'attended';

export type BDashboardDailyActiveRow = {
  key: string;
  label: string;
  count: number;
};

export type BDashboardMetricsResponse = {
  ok: true;
  scope: BShareAnalyticsScope;
  customerTotal: number;
  dailyActive7dTotal: number;
  dailyActive7dPrevTotal: number;
  dailyActiveSeries: BDashboardDailyActiveRow[];
  activityParticipants7d: number;
  activityParticipants7dPrev: number;
  newCustomersToday: number;
  newCustomersPrev: number;
  signInCustomersToday: number;
  signInCustomersPrev: number;
};

export type BDashboardActivityParticipantRow = {
  userId: number | null;
  name: string;
  mobile: string;
  activityId: number | null;
  activityTitle: string;
  occurredAt: string;
};

export type BDashboardActivityParticipantsResponse = {
  ok: true;
  scope: BShareAnalyticsScope;
  total: number;
  rangeLabel: string;
  list: BDashboardActivityParticipantRow[];
};

export type BDashboardCustomerListMetricKey =
  | 'customer_total'
  | 'activity_participants_7d'
  | 'new_customers_today'
  | 'signin_customers_today';

export type BDashboardCustomerListRow = {
  userId: number | null;
  name: string;
  mobile: string;
  subtitle: string;
  occurredAt: string;
};

export type BDashboardCustomerListResponse = {
  ok: true;
  metric: BDashboardCustomerListMetricKey | string;
  title: string;
  scope: BShareAnalyticsScope;
  total: number;
  rangeLabel: string;
  list: BDashboardCustomerListRow[];
};

export type BDashboardCustomerActivityFeedRow = {
  id: string;
  userId: number | null;
  name: string;
  mobile: string;
  category: string;
  event: string;
  detail?: string;
  occurredAt: string;
};

export type BDashboardCustomerActivityFeedResponse = {
  ok: true;
  scope: BShareAnalyticsScope;
  total: number;
  rangeLabel: string;
  list: BDashboardCustomerActivityFeedRow[];
};

export type BCustomerInteraction = {
  type: string;
  title: string;
  detail?: string;
  occurredAt: string;
};

export type BCustomerBehavior = {
  event: string;
  detail?: string;
  occurredAt: string;
};

export type BShareFriendPerson = {
  id: number;
  name: string;
  mobile: string;
  ownerUserId: number;
  verifiedAt?: string | null;
  referredAt?: string | null;
  shareCode?: string | null;
  label?: string;
};

export type BCustomerPointTxn = {
  id: number;
  title: string;
  detail?: string;
  amount: number;
  balance: number;
  occurredAt: string;
};

export type BCustomerProfile = {
  customer: { id: number; name: string; mobile: string };
  points: { currentBalance: number; transactions: BCustomerPointTxn[] };
  interactionTimeline: BCustomerInteraction[];
  behaviorTimeline: BCustomerBehavior[];
  policies: InsurancePolicy[];
  shareReferral: {
    upstream: BShareFriendPerson | null;
    invitedFriends: BShareFriendPerson[];
    stats: { invitedCount: number; verifiedCount: number };
  };
};

export type BPagePermissionResponse = {
  tenantId: number;
  roleKey: string;
  allowedViews: string[];
  modules: Array<{ group: string; pages: Array<{ pageId: string; pageName: string; enabled: boolean }> }>;
  grants: Array<{ pageId: string; enabled: boolean }>;
  dataPermission?: { supported: boolean; status: string };
};

export type BAdvisorProfile = {
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

type TrackPayload = {
  event: string;
  properties?: Record<string, unknown>;
};

export const bApi = {
  login: async (payload: { account: string; password: string }) => {
    const res = await fetchWithTimeout(`${resolveRuntimeBase(API_BASE)}/api/b/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const code = String((data as any)?.code || `HTTP_${res.status}`);
      const err = new Error(
        resolveApiErrorMessage(
          { status: res.status, code, message: String((data as any)?.message || '') },
          `HTTP_${res.status}`
        )
      );
      (err as any).code = code;
      (err as any).status = res.status;
      throw err;
    }
    return data as { ok: true; session: BLoginSession };
  },
  getSession: () => loadSession(),
  setSession: (session: BLoginSession) => {
    if (typeof window === 'undefined') return;
    const normalized = normalizeBSessionRoleActorType(session);
    if (!normalized) return;
    window.sessionStorage.setItem(B_SESSION_KEY, JSON.stringify(normalized));
    window.localStorage.setItem(B_SESSION_KEY, JSON.stringify(normalized));
    if (normalized.csrfToken) {
      window.sessionStorage.setItem(B_CSRF_KEY, normalized.csrfToken);
      window.localStorage.setItem(B_CSRF_KEY, normalized.csrfToken);
    }
  },
  clearSession: () => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.removeItem(B_SESSION_KEY);
    window.sessionStorage.removeItem(B_CSRF_KEY);
    window.localStorage.removeItem(B_SESSION_KEY);
    window.localStorage.removeItem(B_CSRF_KEY);
  },
  customers: () => request<{ list: BCustomer[] }>('/api/b/customers'),
  customerProfile: (customerId: number) => request<BCustomerProfile>(`/api/b/customers/${customerId}/profile`),
  myAdvisorProfile: () => request<{ ok: true; advisor: BAdvisorProfile | null }>('/api/b/me/advisor-profile'),
  updateMyAdvisorProfile: (payload: { bio: string; avatarUrl?: string; wechatId?: string; wechatQrUrl?: string }) =>
    request<{ ok: true; advisor: BAdvisorProfile | null }>('/api/b/me/advisor-profile', {
      method: 'PUT',
      bodyJson: payload,
    }),
  analyzeCustomerPolicy: (customerId: number, policyId: number) =>
    request<InsurancePolicyAnalysisResponse>(`/api/b/customers/${customerId}/policies/${policyId}/analyze`, {
      method: 'POST',
      bodyJson: {},
      timeoutMs: POLICY_ANALYSIS_REQUEST_TIMEOUT_MS,
    }),
  resolveCustomerFamilyPolicyReport: (customerId: number, payload: Record<string, any>) =>
    request<FamilyPolicyReportResponse>(`/api/b/customers/${customerId}/family-policy-report/resolve`, {
      method: 'POST',
      bodyJson: payload,
      timeoutMs: POLICY_ANALYSIS_REQUEST_TIMEOUT_MS,
    }),
  generateCustomerFamilyPolicyReport: (customerId: number, payload: Record<string, any>) =>
    request<FamilyPolicyReportResponse>(`/api/b/customers/${customerId}/family-policy-report`, {
      method: 'POST',
      bodyJson: payload,
      timeoutMs: POLICY_ANALYSIS_REQUEST_TIMEOUT_MS,
    }),
  pagePermissions: () => request<BPagePermissionResponse>('/api/b/permissions/page-views'),
  orders: () => request<{ list: BOrder[] }>('/api/b/orders'),
  contentItems: () => request<{ list: BContentItem[] }>('/api/b/content/items'),
  activityConfigs: () => request<{ list: BActivityConfig[] }>('/api/b/activity-configs'),
  mallProducts: () => request<{ list: BMallProduct[] }>('/api/b/mall/products'),
  mallActivities: () => request<{ list: BMallActivity[] }>('/api/b/mall/activities'),
  shareOverview: (limit = 20, options: { shareType?: BShareType; targetId?: number | null; channel?: string } = {}) => {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (options.shareType) params.set('shareType', String(options.shareType));
    if (Number(options.targetId || 0) > 0) params.set('targetId', String(options.targetId));
    if (String(options.channel || '').trim()) params.set('channel', String(options.channel).trim());
    return request<BShareOverviewResponse>(`/api/b/shares?${params.toString()}`);
  },
  effectParticipants: (options: { shareType: BShareType; targetId?: number | null; metric?: BShareParticipantMetricKind } ) => {
    const params = new URLSearchParams();
    if (options.shareType) params.set('shareType', String(options.shareType));
    if (Number(options.targetId || 0) > 0) params.set('targetId', String(options.targetId));
    if (options.metric) params.set('metric', String(options.metric));
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return request<BShareEffectParticipantsResponse>(`/api/b/share-effect/participants${suffix}`);
  },
  activityParticipants: (options: { targetId?: number | null; metric?: BShareParticipantMetricKind } = {}) => {
    return bApi.effectParticipants({ shareType: 'activity', targetId: options.targetId, metric: options.metric });
  },
  dashboardMetrics: (days = 7) => request<BDashboardMetricsResponse>(`/api/b/dashboard/metrics?days=${Math.max(1, Number(days || 7))}`),
  dashboardActivityParticipants: (days = 7) =>
    request<BDashboardActivityParticipantsResponse>(`/api/b/dashboard/activity-participants?days=${Math.max(1, Number(days || 7))}`),
  dashboardCustomerList: (metric: BDashboardCustomerListMetricKey, days = 7) =>
    request<BDashboardCustomerListResponse>(
      `/api/b/dashboard/customer-list?metric=${encodeURIComponent(String(metric || 'activity_participants_7d'))}&days=${Math.max(1, Number(days || 7))}`
    ),
  dashboardCustomerActivityFeed: (limit: number | 'all' = 30) =>
    request<BDashboardCustomerActivityFeedResponse>(
      `/api/b/dashboard/customer-activity-feed?limit=${
        String(limit).trim().toLowerCase() === 'all' ? 'all' : Math.max(1, Math.min(100, Number(limit || 30)))
      }`
    ),
  shareRecordDetail: (shareCode: string) => request<BShareRecordDetailResponse>(`/api/b/shares/${encodeURIComponent(shareCode)}`),
  createShare: (payload: { shareType: BShareType; targetId?: number | null; channel?: string; sharePath?: string }) =>
    request<BCreateShareResponse>('/api/b/shares', {
      method: 'POST',
      bodyJson: {
        ...payload,
        shareBaseUrl: C_SHARE_BASE_URL || undefined,
      },
    }),
  writeoff: (payload: { id: number; token?: string; orderType?: string; sourceRecordId?: number }) =>
    request<{ ok: boolean }>(`/api/b/orders/${payload.id}/writeoff`, {
      method: 'POST',
      bodyJson: {
        token: payload.token || '',
        orderType: payload.orderType || '',
        sourceRecordId: Number(payload.sourceRecordId || 0),
      },
    }),
  tagsLibrary: () =>
    request<{
      list: BTag[];
      recommended: string[];
      groups: Array<{ key: string; name: string; items: string[] }>;
    }>('/api/b/tags/library'),
  createCustomTag: (name: string) => request<{ ok: boolean; tag: BTag }>('/api/b/tags/custom', { method: 'POST', bodyJson: { name } }),
  bindCustomerTag: (customerId: number, tag: string) =>
    request<{ ok: boolean; tag: BTag }>(`/api/b/customers/${customerId}/tags`, { method: 'POST', bodyJson: { tag } }),
  createContentItem: (payload: { title: string; body?: string; rewardPoints?: number; sortOrder?: number; coverUrl?: string; media?: Array<any> }) =>
    request<{ ok: boolean; item: any }>('/api/b/content/items', { method: 'POST', bodyJson: payload }),
  updateContentItem: (id: number, payload: { title: string; body?: string; rewardPoints?: number; sortOrder?: number; status?: string; coverUrl?: string; media?: Array<any> }) =>
    request<{ ok: boolean; item: any }>(`/api/b/content/items/${id}`, { method: 'PUT', bodyJson: payload }),
  reorderContentItems: (ids: number[]) =>
    request<{ ok: boolean; list: any[] }>('/api/b/content/items/reorder', {
      method: 'POST',
      bodyJson: { ids },
    }),
  deleteContentItem: (id: number) =>
    request<{ ok: boolean }>(`/api/b/content/items/${id}`, {
      method: 'DELETE',
    }),
  createActivityConfig: (payload: { title: string; desc?: string; rewardPoints?: number; sortOrder?: number; media?: Array<any>; idempotencyKey?: string }) =>
    request<{ ok: boolean; item: any }>('/api/b/activity-configs', { method: 'POST', bodyJson: payload }),
  updateActivityConfig: (id: number, payload: { title: string; desc?: string; rewardPoints?: number; sortOrder?: number; status?: string; media?: Array<any> }) =>
    request<{ ok: boolean; item: any }>(`/api/b/activity-configs/${id}`, { method: 'PUT', bodyJson: payload }),
  reorderActivityConfigs: (ids: number[]) =>
    request<{ ok: boolean; list: any[] }>('/api/b/activity-configs/reorder', {
      method: 'POST',
      bodyJson: { ids },
    }),
  createMallProduct: (payload: { name: string; desc?: string; points?: number; pointsCost?: number; stock?: number; sortOrder?: number; media?: Array<any> }) =>
    request<{ ok: boolean; product: any }>('/api/b/mall/products', { method: 'POST', bodyJson: payload }),
  updateMallProduct: (id: number, payload: { name: string; desc?: string; points?: number; pointsCost?: number; stock?: number; sortOrder?: number; status?: string; media?: Array<any> }) =>
    request<{ ok: boolean; product: any }>(`/api/b/mall/products/${id}`, { method: 'PUT', bodyJson: payload }),
  reorderMallProducts: (ids: number[]) =>
    request<{ ok: boolean; list: any[] }>('/api/b/mall/products/reorder', {
      method: 'POST',
      bodyJson: { ids },
    }),
  createMallActivity: (payload: { title: string; desc?: string; rewardPoints?: number; sortOrder?: number; media?: Array<any> }) =>
    request<{ ok: boolean; activity: any }>('/api/b/mall/activities', { method: 'POST', bodyJson: payload }),
  updateMallActivity: (id: number, payload: { title: string; desc?: string; rewardPoints?: number; sortOrder?: number; status?: string; media?: Array<any> }) =>
    request<{ ok: boolean; activity: any }>(`/api/b/mall/activities/${id}`, { method: 'PUT', bodyJson: payload }),
  reorderMallActivities: (ids: number[]) =>
    request<{ ok: boolean; list: any[] }>('/api/b/mall/activities/reorder', {
      method: 'POST',
      bodyJson: { ids },
    }),
  uploadMediaBase64: (payload: { name: string; type: string; dataUrl: string }) =>
    request<{ ok: boolean; file: { name: string; type: string; path: string; url: string; size: number } }>('/api/uploads/base64', {
      method: 'POST',
      bodyJson: payload,
    }),
  scanPolicy: (payload: { uploadItem?: { name: string; type: string; dataUrl: string }; ocrText?: string }) =>
    request<{
      ok: boolean;
      data: {
        company: string;
        name: string;
        applicant: string;
        insured: string;
        date: string;
        paymentPeriod: string;
        coveragePeriod: string;
        amount: string;
        firstPremium: string;
      };
      ocrText?: string;
    }>('/api/insurance/policies/scan', {
      method: 'POST',
      bodyJson: payload,
      timeoutMs: OCR_REQUEST_TIMEOUT_MS,
    }),
  analyzePolicy: (payload: {
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
      bodyJson: payload,
      timeoutMs: POLICY_ANALYSIS_REQUEST_TIMEOUT_MS,
    }),
  createPolicy: (payload: {
    customerId?: number;
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
    request<{ ok: boolean; policy: any }>('/api/insurance/policies', {
      method: 'POST',
      bodyJson: payload,
    }),
  updatePolicy: (
    id: number,
    payload: {
      customerId?: number;
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
    },
  ) =>
    request<{ ok: boolean; policy: any }>(`/api/insurance/policies/${id}`, {
      method: 'PUT',
      bodyJson: payload,
    }),
  deletePolicy: (id: number) =>
    request<{ ok: boolean }>(`/api/insurance/policies/${id}`, {
      method: 'DELETE',
    }),
};

export function onAuthInvalid(handler: (detail: { code: string; path: string }) => void) {
  if (typeof window === 'undefined') return () => {};
  const listener = (event: Event) => {
    const custom = event as CustomEvent<{ code: string; path: string }>;
    handler(custom.detail || { code: 'UNKNOWN', path: '' });
  };
  window.addEventListener(B_AUTH_INVALID_EVENT, listener);
  return () => window.removeEventListener(B_AUTH_INVALID_EVENT, listener);
}

export function trackEvent(payload: TrackPayload): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/api/track/events', {
    method: 'POST',
    headers: {
      'x-client-source': 'b-web',
      'x-client-path': typeof window === 'undefined' ? '' : window.location.pathname,
    },
    bodyJson: payload,
  });
}
