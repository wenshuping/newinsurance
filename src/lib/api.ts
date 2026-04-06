import type { PLoginSessionContract } from '@contracts/index';
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

const API_BASE = normalizeBase((import.meta as any).env?.VITE_API_BASE_URL || 'http://127.0.0.1:4100');
const P_SESSION_KEY = 'p_admin_session_v1';
const P_CSRF_KEY = 'p_admin_csrf_v1';
const P_AUTH_INVALID_EVENT = 'p:auth-invalid';

export type PLoginSession = PLoginSessionContract;

function normalizeApiPath(path: string) {
  const normalized = String(path || '').trim();
  if (!normalized) return '';
  return normalized.split('?')[0];
}

function shouldInvalidatePSession(path: string, input: { status?: number; code?: string }) {
  if (!shouldInvalidateSession(input)) return false;
  const normalizedPath = normalizeApiPath(path);
  if (!normalizedPath) return false;
  return normalizedPath.startsWith('/api/p/auth/');
}

function loadSession(): PLoginSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(P_SESSION_KEY) || window.localStorage.getItem(P_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PLoginSession;
  } catch {
    return null;
  }
}

function getCsrfToken() {
  if (typeof window === 'undefined') return '';
  return String(window.sessionStorage.getItem(P_CSRF_KEY) || '');
}

function actorHeaders() {
  const session = loadSession();
  if (!session) return null;
  const headers: Record<string, string> = {
    'x-actor-type': String(session.actorType || 'employee'),
    'x-actor-id': String(session.actorId || ''),
    'x-tenant-id': String(session.tenantId || 1),
    'x-org-id': String(session.orgId || 1),
    'x-team-id': String(session.teamId || 1),
    'x-csrf-token': String(session.csrfToken || getCsrfToken() || ''),
  };
  if (session.token) headers.Authorization = `Bearer ${session.token}`;
  return headers;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = String(init.method || 'GET').toUpperCase();
  const headersFromSession = actorHeaders();
  const isLoginPath = path === '/api/p/auth/login';
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

  const res = await fetch(`${resolveRuntimeBase(API_BASE)}${path}`, {
    ...init,
    headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = String((data as any)?.code || `HTTP_${res.status}`);
    if (shouldInvalidatePSession(path, { status: res.status, code })) {
      pApi.clearSession();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(P_AUTH_INVALID_EVENT, { detail: { code, path } }));
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

export type PTenant = { id: number; name: string; type: string; status: string; adminEmail?: string };
export type PEmployee = {
  id: number;
  tenantId: number;
  tenantName?: string;
  orgId: number;
  teamId: number;
  name: string;
  email?: string;
  mobile?: string;
  role?: string;
  status?: string;
  lastActiveAt?: string | null;
  createdAt?: string;
  account?: string;
  initialPassword?: string;
  teamName?: string;
};
export type PTeam = {
  id: number;
  tenantId: number;
  orgId: number;
  name: string;
  createdAt?: string;
  updatedAt?: string;
};
export type PCustomer = {
  id: number;
  name: string;
  mobile: string;
  tenantId: number;
  tenantName?: string;
  ownerUserId: number;
  ownerName: string;
  orgId: number;
  teamId: number;
  referrerCustomerId: number;
  referrerShareCode: string;
  referredAt?: string | null;
  acquisitionSource: 'direct' | 'shared' | string;
  poolStatus: 'unassigned' | 'assigned' | string;
};
export type PMallProduct = {
  id: number;
  title: string;
  points: number;
  stock: number;
  sortOrder: number;
  category?: string;
  description?: string;
  limitPerUser?: boolean;
  vipOnly?: boolean;
  enableCountdown?: boolean;
  status: string;
  updatedAt: string;
  isPlatformTemplate?: boolean;
  templateTag?: string;
  media?: Array<{ name?: string; type?: string; preview?: string; url?: string; path?: string }>;
};
export type PMallActivity = {
  id: number;
  title: string;
  displayTitle?: string;
  type: string;
  rewardPoints: number;
  sortOrder: number;
  description?: string;
  status: string;
  updatedAt: string;
  isPlatformTemplate?: boolean;
  templateTag?: string;
  media?: Array<{ name?: string; type?: string; preview?: string; url?: string; path?: string }>;
};
export type PActivity = {
  id: number;
  title: string;
  category: string;
  rewardPoints: number;
  sortOrder: number;
  status?: string;
  content?: string;
  createdAt?: string;
  updatedAt?: string;
  participants?: number;
  completed?: boolean;
  canComplete?: boolean;
  isPlatformTemplate?: boolean;
  templateTag?: string;
  media?: Array<{ name?: string; type?: string; preview?: string; url?: string; path?: string }>;
};
export type PLearningCourse = {
  id: number;
  title: string;
  category: string;
  points: number;
  sortOrder?: number;
  rewardPoints?: number;
  contentType?: string;
  sourceType?: string;
  videoChannelMeta?: {
    finderUserName?: string;
    feedToken?: string;
    feedId?: string;
    nonceId?: string;
    miniProgramAppId?: string;
    miniProgramPath?: string;
    miniProgramEnvVersion?: 'release' | 'trial' | 'develop';
    coverUrl?: string;
  } | null;
  status?: string;
  level?: string;
  content?: string;
  coverUrl?: string;
  image?: string;
  createdAt?: string;
  updatedAt?: string;
  isPlatformTemplate?: boolean;
  templateTag?: string;
  media?: Array<{ name?: string; type?: string; preview?: string; url?: string; path?: string }>;
};
export type PStatsOverview = {
  latest: { day: string; metrics: Record<string, number> } | null;
  history: Array<{ day: string; metrics: Record<string, number> }>;
};

export type PActivityEffectOverview = {
  ok: true;
  scope: {
    scopeType: 'self' | 'team' | 'company' | 'platform';
    label: string;
    tenantId: number | null;
    teamId: number | null;
  };
  activityEffect: {
    totalActivities: number;
    totalShares: number;
    totalViews: number;
    totalParticipants: number;
  };
  summary: {
    totalLinks: number;
    totalViews: number;
    totalClicks: number;
    totalDeliveries: number;
    clickThroughRate: number;
  };
  list: Array<{
    shareCode: string;
    targetTitle: string;
    createdAt: string;
    metrics: {
      views: number;
      clicks: number;
      deliveries: number;
      clickThroughRate: number;
    };
  }>;
};
export type PReconciliationReport = {
  id: number;
  day: string;
  status: 'ok' | 'mismatch';
  mismatches: Array<{ userId: number; expected: number; actual: number }>;
  checkedAt: string;
};
export type PPermissionMatrix = {
  roles: Array<{ id: number; key: string; name: string }>;
  permissions: Array<{ id: number; key: string; name: string }>;
  rolePermissions: Array<{ id: number; roleId: number; permissionId: number }>;
};
export type PCompanyAdminPagePermission = {
  pageId: string;
  pageName: string;
  enabled: boolean;
};
export type PCompanyAdminPagePermissionModule = {
  group: string;
  pages: PCompanyAdminPagePermission[];
};
export type PCompanyAdminPagePermissionResponse = {
  tenantId: number;
  roleKey: 'company_admin' | string;
  modules: PCompanyAdminPagePermissionModule[];
  grants: PCompanyAdminPagePermission[];
};
export type PEmployeeRolePagePermission = {
  pageId: string;
  pageName: string;
  enabled: boolean;
};
export type PEmployeeRolePagePermissionModule = {
  group: string;
  pages: PEmployeeRolePagePermission[];
};
export type PEmployeeRolePagePermissionResponse = {
  tenantId: number;
  roleKey: 'company_admin' | 'agent' | 'team_lead' | string;
  editable: boolean;
  modules: PEmployeeRolePagePermissionModule[];
  grants: Array<{ pageId: string; enabled: boolean }>;
  dataPermission: { supported: boolean; status: string };
};
export type PStrategy = {
  id: string;
  name: string;
  status: 'active' | 'draft' | 'inactive' | string;
  lastExecutedAt: string | null;
  priority?: string;
  frequency?: string;
  matchedCustomers?: number;
  successRate?: number;
};

export type PMetricEnd = 'c' | 'b' | 'p' | 'system';

export type PMetricCard = {
  key: string;
  name: string;
  value: string;
  trend?: string;
  trendType?: 'up' | 'down' | 'flat' | string;
  hint?: string;
};

export type PMetricRule = {
  id: number;
  tenantId: number;
  end: PMetricEnd;
  name: string;
  formula: string;
  period: string;
  source: string;
  status: 'enabled' | 'disabled' | string;
  threshold?: string;
  remark?: string;
  remarkMode?: 'sync' | 'manual' | string;
  updatedAt?: string;
};

export type PMetricsConfig = {
  cardsByEnd: Record<PMetricEnd, PMetricCard[]>;
  rules: PMetricRule[];
};

export type PPointsRuleConfig = {
  tenantId: number;
  signInPoints: number;
  newCustomerVerifyPoints: number;
  customerShareIdentifyPoints: number;
  updatedAt?: string | null;
};

export type PEventDefinition = {
  id: number;
  eventId: number;
  eventName: string;
  eventType: 'system' | 'custom' | string;
  description?: string;
  collectMethod: 'frontend' | 'backend' | 'both' | string;
  status: 'enabled' | 'disabled' | 'draft' | string;
  statusCode?: 0 | 1 | 2 | number;
  schema?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
};

export type PTag = {
  id: number;
  tenantId: number;
  tagCode: string;
  tagName: string;
  tagType: 'enum' | 'boolean' | 'number' | 'date' | string;
  source?: string;
  description?: string;
  status: 'draft' | 'active' | 'disabled' | string;
  valueSchema?: Record<string, unknown>;
  hitCount?: number;
  createdBy?: number | null;
  createdAt?: string;
  updatedAt?: string;
};

export type PTagRule = {
  id: number;
  tenantId: number;
  ruleCode: string;
  ruleName: string;
  targetTagId: number;
  targetTagIds?: number[];
  targetTagName?: string;
  targetTagNames?: string[];
  priority: number;
  status: 'draft' | 'active' | 'disabled' | string;
  conditionDsl?: Record<string, unknown>;
  outputExpr?: Record<string, unknown>;
  effectiveStartAt?: string | null;
  effectiveEndAt?: string | null;
  createdBy?: number | null;
  createdAt?: string;
  updatedAt?: string;
};

export type PTagRuleJob = {
  id: number;
  tenantId: number;
  jobType: 'full' | 'delta' | 'replay' | string;
  triggerType: 'manual' | 'schedule' | 'publish' | string;
  status: 'queued' | 'running' | 'success' | 'partial_success' | 'failed' | 'cancelled' | string;
  targetRuleIds: number[];
  scope?: Record<string, unknown>;
  startedAt?: string | null;
  endedAt?: string | null;
  totalCustomers: number;
  successCustomers: number;
  failedCustomers: number;
  errorSummary?: string;
  createdAt?: string;
};

export type PTagRuleJobLog = {
  id: number;
  jobId: number;
  tenantId: number;
  customerId: number;
  ruleId: number;
  result: 'hit' | 'miss' | 'error' | string;
  outputValue?: string | null;
  reason?: string | null;
  createdAt?: string;
};

type TrackPayload = {
  event: string;
  properties?: Record<string, unknown>;
};

export const pApi = {
  login: (payload: { account: string; password: string }) =>
    request<{ ok: boolean; session: PLoginSession }>('/api/p/auth/login', {
      method: 'POST',
      headers: {},
      body: JSON.stringify(payload),
    }),
  getSession: () => loadSession(),
  setSession: (session: PLoginSession) => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(P_SESSION_KEY, JSON.stringify(session));
    window.localStorage.removeItem(P_SESSION_KEY);
    if (session.csrfToken) window.sessionStorage.setItem(P_CSRF_KEY, session.csrfToken);
  },
  clearSession: () => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.removeItem(P_SESSION_KEY);
    window.sessionStorage.removeItem(P_CSRF_KEY);
    window.localStorage.removeItem(P_SESSION_KEY);
  },
  tenants: () => request<{ list: PTenant[] }>('/api/p/tenants'),
  createTenant: (payload: {
    name: string;
    type: 'company' | 'individual';
    status?: 'active' | 'inactive';
    adminEmail?: string;
    initialPassword?: string;
  }) =>
    request<{ ok: boolean; tenant: PTenant }>('/api/p/tenants', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateTenant: (id: number, payload: { name?: string; type?: 'company' | 'individual'; status?: string }) =>
    request<{ ok: boolean; tenant: PTenant }>(`/api/p/tenants/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteTenant: (id: number) =>
    request<{ ok: boolean }>(`/api/p/tenants/${id}`, {
      method: 'DELETE',
    }),
  stats: () => request<PStatsOverview>('/api/p/stats/overview?limit=7'),
  activityEffectOverview: (limit = 20) => request<PActivityEffectOverview>(`/api/p/metrics/activity-effect?limit=${Number(limit || 20)}`),
  rebuildStats: () => request<{ ok: boolean; snapshot: any }>('/api/p/stats/rebuild', { method: 'POST', body: JSON.stringify({}) }),
  runReconciliation: (day?: string) =>
    request<{ ok: boolean; report: PReconciliationReport }>('/api/p/reconciliation/run', {
      method: 'POST',
      body: JSON.stringify(day ? { day } : {}),
    }),
  permissions: () => request<PPermissionMatrix>('/api/p/permissions/matrix'),
  companyAdminPagePermissions: (tenantId: number) =>
    request<PCompanyAdminPagePermissionResponse>(`/api/p/permissions/company-admin-pages?tenantId=${Number(tenantId || 1)}`),
  saveCompanyAdminPagePermissions: (payload: { tenantId: number; grants: Array<{ pageId: string; enabled: boolean }> }) =>
    request<{ ok: boolean; tenantId: number; roleKey: string; grants: Array<{ pageId: string; enabled: boolean }> }>(
      '/api/p/permissions/company-admin-pages',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),
  employeeRolePagePermissions: (payload: { tenantId: number; roleKey: string }) =>
    request<PEmployeeRolePagePermissionResponse>(
      `/api/p/permissions/employee-role-pages?tenantId=${Number(payload.tenantId || 1)}&roleKey=${encodeURIComponent(String(payload.roleKey || 'company_admin'))}`
    ),
  saveEmployeeRolePagePermissions: (payload: { tenantId: number; roleKey: string; grants: Array<{ pageId: string; enabled: boolean }> }) =>
    request<{
      ok: boolean;
      tenantId: number;
      roleKey: string;
      grants: Array<{ pageId: string; enabled: boolean }>;
      dataPermission: { supported: boolean; status: string };
    }>('/api/p/permissions/employee-role-pages', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  employees: (options?: { scope?: 'manage' | 'assignable' }) =>
    request<{ list: PEmployee[] }>(
      `/api/p/employees${String(options?.scope || '') === 'assignable' ? '?scope=assignable' : ''}`,
    ),
  customers: () => request<{ list: PCustomer[] }>('/api/p/customers'),
  systemAssignCustomers: (payload: { agentId: number; customerIds: number[] }) =>
    request<{
      ok: boolean;
      assignedCount: number;
      agent: { id: number; name: string; email: string };
      customers: Array<{ id: number; ownerUserId: number; teamId?: number; orgId?: number }>;
    }>('/api/p/customers/system-assign', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  assignCustomerByMobile: (payload: { mobile: string; agentId: number }) =>
    request<{
      ok: boolean;
      customer: { id: number; mobile: string; tenantId: number; ownerUserId: number };
      agent: { id: number; tenantId: number };
    }>('/api/p/customers/assign-by-mobile', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  teams: () => request<{ list: PTeam[] }>('/api/p/teams'),
  createTeam: (payload: { name: string }) =>
    request<{ ok: boolean; team: PTeam }>('/api/p/teams', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateTeam: (id: number, payload: { name: string }) =>
    request<{ ok: boolean; team: PTeam }>(`/api/p/teams/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteTeam: (id: number) =>
    request<{ ok: boolean }>(`/api/p/teams/${id}`, {
      method: 'DELETE',
    }),
  createEmployee: (payload: { name: string; email: string; mobile: string; role: string; teamId?: number; orgId?: number; initialPassword?: string }) =>
    request<{ ok: boolean; employee: PEmployee; initialPassword: string }>('/api/p/employees', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateEmployee: (id: number, payload: { name?: string; email?: string; mobile?: string; role?: string; teamId?: number; orgId?: number; status?: string }) =>
    request<{ ok: boolean; employee: PEmployee }>(`/api/p/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteEmployee: (id: number) =>
    request<{ ok: boolean }>(`/api/p/employees/${id}`, {
      method: 'DELETE',
    }),
  mallProducts: () => request<{ list: PMallProduct[] }>('/api/p/mall/products'),
  createMallProduct: (payload: {
    title: string;
    points: number;
    stock: number;
    sortOrder: number;
    category?: string;
    description?: string;
    limitPerUser?: boolean;
    vipOnly?: boolean;
    enableCountdown?: boolean;
    status?: string;
    media?: Array<{ name: string; type: string; preview?: string; url?: string; path?: string }>;
  }) =>
    request<{ ok: boolean; product: PMallProduct }>('/api/p/mall/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateMallProduct: (
    id: number,
    payload: Partial<{
      title: string;
      points: number;
      stock: number;
      sortOrder: number;
      category: string;
      description: string;
      limitPerUser: boolean;
      vipOnly: boolean;
      enableCountdown: boolean;
      status: string;
      media: Array<{ name: string; type: string; preview?: string; url?: string; path?: string }>;
    }>
  ) =>
    request<{ ok: boolean; product: PMallProduct }>(`/api/p/mall/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  reorderMallProducts: (ids: number[]) =>
    request<{ ok: boolean; ids: number[] }>('/api/p/mall/products/reorder', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),
  deleteMallProduct: (id: number) =>
    request<{ ok: boolean }>(`/api/p/mall/products/${id}`, {
      method: 'DELETE',
    }),
  mallActivities: () => request<{ list: PMallActivity[] }>('/api/p/mall/activities'),
  createMallActivity: (payload: {
    title: string;
    displayTitle?: string;
    type: string;
    rewardPoints: number;
    sortOrder: number;
    description?: string;
    status?: string;
    media?: Array<{ name: string; type: string; preview?: string; url?: string; path?: string }>;
  }) =>
    request<{ ok: boolean; activity: PMallActivity }>('/api/p/mall/activities', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateMallActivity: (
    id: number,
    payload: Partial<{
      title: string;
      displayTitle: string;
      type: string;
      rewardPoints: number;
      sortOrder: number;
      description: string;
      status: string;
      media: Array<{ name: string; type: string; preview?: string; url?: string; path?: string }>;
    }>
  ) =>
    request<{ ok: boolean; activity: PMallActivity }>(`/api/p/mall/activities/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  reorderMallActivities: (ids: number[]) =>
    request<{ ok: boolean; ids: number[] }>('/api/p/mall/activities/reorder', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),
  deleteMallActivity: (id: number) =>
    request<{ ok: boolean }>(`/api/p/mall/activities/${id}`, {
      method: 'DELETE',
    }),
  strategies: () => request<{ list: PStrategy[] }>('/api/p/strategies'),
  metricsConfig: () => request<PMetricsConfig>('/api/p/metrics/config'),
  pointsRuleConfig: (tenantId?: number) =>
    request<{ ok: boolean; config: PPointsRuleConfig }>('/api/p/points-rules/config', {
      headers: tenantId ? { 'x-tenant-id': String(Number(tenantId || 1)) } : undefined,
    }),
  savePointsRuleConfig: (payload: { signInPoints: number; newCustomerVerifyPoints: number; customerShareIdentifyPoints: number; tenantId?: number }) =>
    request<{ ok: boolean; config: PPointsRuleConfig }>('/api/p/points-rules/config', {
      method: 'POST',
      headers: payload?.tenantId ? { 'x-tenant-id': String(Number(payload.tenantId || 1)) } : undefined,
      body: JSON.stringify({
        signInPoints: payload.signInPoints,
        newCustomerVerifyPoints: payload.newCustomerVerifyPoints,
        customerShareIdentifyPoints: payload.customerShareIdentifyPoints,
      }),
    }),
  createMetricRule: (payload: {
    end: PMetricEnd;
    name: string;
    formula: string;
    period: string;
    source: string;
    status?: 'enabled' | 'disabled';
    threshold?: string;
    remark?: string;
    remarkMode?: 'sync' | 'manual';
  }) =>
    request<{ ok: boolean; rule: PMetricRule }>('/api/p/metrics/rules', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateMetricRule: (
    id: number,
    payload: {
      end: PMetricEnd;
      name: string;
      formula: string;
      period: string;
      source: string;
      status?: 'enabled' | 'disabled';
      threshold?: string;
      remark?: string;
      remarkMode?: 'sync' | 'manual';
    }
  ) =>
    request<{ ok: boolean; rule: PMetricRule }>(`/api/p/metrics/rules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteMetricRule: (id: number) =>
    request<{ ok: boolean }>(`/api/p/metrics/rules/${id}`, {
      method: 'DELETE',
    }),
  eventDefinitions: (params?: { query?: string; status?: string; type?: string; page?: number; pageSize?: number }) => {
    const search = new URLSearchParams();
    if (params?.query) search.set('query', params.query);
    if (params?.status) search.set('status', params.status);
    if (params?.type) search.set('type', params.type);
    if (params?.page) search.set('page', String(params.page));
    if (params?.pageSize) search.set('pageSize', String(params.pageSize));
    const query = search.toString();
    return request<{ list: PEventDefinition[]; total: number; page: number; pageSize: number }>(
      `/api/p/events/definitions${query ? `?${query}` : ''}`
    );
  },
  saveEventDefinition: (payload: {
    id?: number;
    eventId: number;
    eventName: string;
    eventType: 'system' | 'custom';
    description?: string;
    collectMethod: 'frontend' | 'backend' | 'both';
    status: 'enabled' | 'disabled' | 'draft';
    schema?: Record<string, unknown>;
    syncSchemaWithEvent?: boolean;
  }) =>
    request<{ ok: boolean; item: PEventDefinition }>('/api/p/events/definitions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  setEventDefinitionStatus: (id: number, status: 'enabled' | 'disabled' | 'draft') =>
    request<{ ok: boolean }>(`/api/p/events/definitions/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),
  deleteEventDefinition: (id: number) =>
    request<{ ok: boolean }>(`/api/p/events/definitions/${id}`, {
      method: 'DELETE',
    }),
  tags: (params?: { query?: string; status?: string; page?: number; pageSize?: number }) => {
    const search = new URLSearchParams();
    if (params?.query) search.set('query', params.query);
    if (params?.status) search.set('status', params.status);
    if (params?.page) search.set('page', String(params.page));
    if (params?.pageSize) search.set('pageSize', String(params.pageSize));
    const query = search.toString();
    return request<{ list: PTag[]; total: number; page: number; pageSize: number }>(`/api/p/tags${query ? `?${query}` : ''}`);
  },
  saveTag: (payload: {
    id?: number;
    tagCode: string;
    tagName: string;
    tagType: 'enum' | 'boolean' | 'number' | 'date';
    source?: string;
    description?: string;
    status?: 'draft' | 'active' | 'disabled';
    valueSchema?: Record<string, unknown>;
  }) =>
    request<{ ok: boolean; item: PTag }>('/api/p/tags', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  setTagStatus: (id: number, status: 'draft' | 'active' | 'disabled') =>
    request<{ ok: boolean }>(`/api/p/tags/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),
  deleteTag: (id: number) =>
    request<{ ok: boolean }>(`/api/p/tags/${id}`, {
      method: 'DELETE',
    }),
  tagRules: (params?: { query?: string; status?: string; tagId?: number; page?: number; pageSize?: number }) => {
    const search = new URLSearchParams();
    if (params?.query) search.set('query', params.query);
    if (params?.status) search.set('status', params.status);
    if (params?.tagId) search.set('tagId', String(params.tagId));
    if (params?.page) search.set('page', String(params.page));
    if (params?.pageSize) search.set('pageSize', String(params.pageSize));
    const query = search.toString();
    return request<{ list: PTagRule[]; total: number; page: number; pageSize: number }>(`/api/p/tag-rules${query ? `?${query}` : ''}`);
  },
  saveTagRule: (payload: {
    id?: number;
    ruleCode: string;
    ruleName: string;
    targetTagId?: number;
    targetTagIds?: number[];
    priority?: number;
    status?: 'draft' | 'active' | 'disabled';
    conditionDsl?: Record<string, unknown>;
    outputExpr?: Record<string, unknown>;
    effectiveStartAt?: string | null;
    effectiveEndAt?: string | null;
  }) =>
    request<{ ok: boolean; item: PTagRule }>('/api/p/tag-rules', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  setTagRuleStatus: (id: number, status: 'draft' | 'active' | 'disabled') =>
    request<{ ok: boolean }>(`/api/p/tag-rules/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),
  deleteTagRule: (id: number) =>
    request<{ ok: boolean }>(`/api/p/tag-rules/${id}`, {
      method: 'DELETE',
    }),
  createTagRuleJob: (payload: { jobType?: 'full' | 'delta' | 'replay'; triggerType?: 'manual' | 'schedule' | 'publish'; targetRuleIds?: number[]; scope?: Record<string, unknown> }) =>
    request<{ ok: boolean; item: PTagRuleJob }>('/api/p/tag-rule-jobs', {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    }),
  tagRuleJobs: (params?: { status?: string; page?: number; pageSize?: number }) => {
    const search = new URLSearchParams();
    if (params?.status) search.set('status', params.status);
    if (params?.page) search.set('page', String(params.page));
    if (params?.pageSize) search.set('pageSize', String(params.pageSize));
    const query = search.toString();
    return request<{ list: PTagRuleJob[]; total: number; page: number; pageSize: number }>(`/api/p/tag-rule-jobs${query ? `?${query}` : ''}`);
  },
  tagRuleJobDetail: (id: number) => request<{ item: PTagRuleJob }>(`/api/p/tag-rule-jobs/${id}`),
  tagRuleJobLogs: (id: number, params?: { result?: string; page?: number; pageSize?: number }) => {
    const search = new URLSearchParams();
    if (params?.result) search.set('result', params.result);
    if (params?.page) search.set('page', String(params.page));
    if (params?.pageSize) search.set('pageSize', String(params.pageSize));
    const query = search.toString();
    return request<{ list: PTagRuleJobLog[]; total: number; page: number; pageSize: number }>(
      `/api/p/tag-rule-jobs/${id}/logs${query ? `?${query}` : ''}`
    );
  },
  activities: () => request<{ activities: PActivity[] }>('/api/p/activities'),
  createActivity: (payload: {
    title: string;
    category: string;
    rewardPoints: number;
    content: string;
    idempotencyKey?: string;
    status?: string;
    media?: Array<{ name: string; type: string; preview?: string; url?: string; path?: string }>;
    uploadItems?: Array<{ name: string; type: string; dataUrl: string }>;
  }) =>
    request<{ ok: boolean; activity: PActivity; idempotent?: boolean }>('/api/p/activities', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateActivity: (
    id: number,
    payload: Partial<{
      title: string;
      category: string;
      rewardPoints: number;
      sortOrder: number;
      content: string;
      status: string;
      media: Array<{ name: string; type: string; preview?: string; url?: string; path?: string }>;
    }>
  ) =>
    request<{ ok: boolean; activity: PActivity }>(`/api/p/activities/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteActivity: (id: number) =>
    request<{ ok: boolean }>(`/api/p/activities/${id}`, {
      method: 'DELETE',
    }),
  deleteActivitiesBatch: (ids: number[]) =>
    request<{ ok: boolean; deletedCount: number; ids: number[]; blockedIds?: number[] }>('/api/p/activities/batch-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),
  reorderActivities: (ids: number[]) =>
    request<{ ok: boolean }>('/api/p/activities/reorder', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),
  learningCourses: () => request<{ list?: PLearningCourse[]; categories?: string[]; courses: PLearningCourse[] }>('/api/p/learning/courses'),
  createLearningCourse: (payload: {
    title: string;
    category: string;
    points: number;
    rewardPoints?: number;
    idempotencyKey?: string;
    contentType: string;
    sourceType?: string;
    videoChannelMeta?: {
      finderUserName?: string;
      feedToken?: string;
      feedId?: string;
      nonceId?: string;
      miniProgramAppId?: string;
      miniProgramPath?: string;
      miniProgramEnvVersion?: 'release' | 'trial' | 'develop';
      coverUrl?: string;
    } | null;
    level: string;
    content: string;
    status?: string;
    coverUrl?: string;
    media?: Array<{ name: string; type: string; preview?: string; url?: string; path?: string }>;
    uploadItems?: Array<{ name: string; type: string; dataUrl: string }>;
  }) =>
    request<{ ok: boolean; course: PLearningCourse; idempotent?: boolean }>('/api/p/learning/courses', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createLearningCourseBatch: (payload: {
    idempotencyKey?: string;
    items: Array<{
      title: string;
      category: string;
      points: number;
      rewardPoints?: number;
      idempotencyKey?: string;
      contentType: string;
      sourceType?: string;
      videoChannelMeta?: {
        finderUserName?: string;
        feedToken?: string;
        feedId?: string;
        nonceId?: string;
        miniProgramAppId?: string;
        miniProgramPath?: string;
        miniProgramEnvVersion?: 'release' | 'trial' | 'develop';
        coverUrl?: string;
      } | null;
      level: string;
      content: string;
      status?: string;
      coverUrl?: string;
      media?: Array<{ name: string; type: string; preview?: string; url?: string; path?: string }>;
      uploadItems?: Array<{ name: string; type: string; dataUrl: string }>;
    }>;
  }) =>
    request<{
      ok: boolean;
      total: number;
      createdCount: number;
      idempotent?: boolean;
      items: Array<{ index: number; idempotent?: boolean; course: PLearningCourse }>;
      courses: PLearningCourse[];
    }>('/api/p/learning/courses/batch', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateLearningCourse: (
    id: number,
    payload: Partial<{
      title: string;
      category: string;
      points: number;
      rewardPoints: number;
      contentType: string;
      sourceType: string;
      videoChannelMeta: {
        finderUserName?: string;
        feedToken?: string;
        feedId?: string;
        nonceId?: string;
        miniProgramAppId?: string;
        miniProgramPath?: string;
        miniProgramEnvVersion?: 'release' | 'trial' | 'develop';
        coverUrl?: string;
      } | null;
      level: string;
      content: string;
      status: string;
      coverUrl: string;
      media: Array<{ name: string; type: string; preview?: string; url?: string; path?: string }>;
    }>
  ) =>
    request<{ ok: boolean; course: PLearningCourse }>(`/api/p/learning/courses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteLearningCourse: async (id: number) => {
    try {
      return await request<{ ok: boolean }>(`/api/p/learning/courses/${id}`, {
        method: 'DELETE',
      });
    } catch (error: any) {
      if (String(error?.code || '') === 'COURSE_NOT_FOUND' || Number(error?.status || 0) === 404) {
        return { ok: true };
      }
      throw error;
    }
  },
  deleteLearningCoursesBatch: (ids: number[]) =>
    request<{ ok: boolean; deletedCount: number; ids: number[] }>('/api/p/learning/courses/batch-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),
  reorderLearningCourses: (ids: number[]) =>
    request<{ ok: boolean }>('/api/p/learning/courses/reorder', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),
  uploadMediaBase64: (payload: { name: string; type: string; dataUrl: string }) =>
    request<{ ok: boolean; file: { name: string; type: string; size: number; path: string; url: string } }>('/api/uploads/base64', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export function trackEvent(payload: TrackPayload): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/api/track/events', {
    method: 'POST',
    headers: {
      'x-client-source': 'p-web',
      'x-client-path': typeof window === 'undefined' ? '' : window.location.pathname,
    },
    body: JSON.stringify(payload),
  });
}

export function onAuthInvalid(handler: (detail: { code: string; path: string }) => void) {
  if (typeof window === 'undefined') return () => {};
  const listener = (event: Event) => {
    const custom = event as CustomEvent<{ code: string; path: string }>;
    handler(custom.detail || { code: 'UNKNOWN', path: '' });
  };
  window.addEventListener(P_AUTH_INVALID_EVENT, listener);
  return () => window.removeEventListener(P_AUTH_INVALID_EVENT, listener);
}
