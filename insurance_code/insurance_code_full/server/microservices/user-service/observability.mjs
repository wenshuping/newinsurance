import crypto from 'node:crypto';
import { resolveSessionFromBearer, resolveUserFromBearer } from '../../skeleton-c-v1/common/state.mjs';

const MAX_RECENT_LOGS = 80;
const USER_SERVICE_LOG_FIELDS = ['trace_id', 'request_id', 'user_id', 'tenant_id', 'route', 'result'];
const TOKEN_ANOMALY_CODES = ['TOKEN_MISSING', 'TOKEN_INVALID', 'SESSION_NOT_FOUND', 'USER_NOT_FOUND'];

export const userServiceErrorCatalog = [
  {
    code: 'INVALID_PARAMS',
    category: 'input_validation',
    httpStatus: 400,
    routes: ['/api/auth/send-code', '/api/auth/verify-basic'],
  },
  {
    code: 'SMS_LIMIT_REACHED',
    category: 'rate_limit',
    httpStatus: 429,
    routes: ['/api/auth/send-code'],
  },
  {
    code: 'SEND_CODE_FAILED',
    category: 'runtime',
    httpStatus: 400,
    routes: ['/api/auth/send-code'],
  },
  {
    code: 'CODE_NOT_FOUND',
    category: 'verification',
    httpStatus: 400,
    routes: ['/api/auth/verify-basic'],
  },
  {
    code: 'CODE_EXPIRED',
    category: 'verification',
    httpStatus: 400,
    routes: ['/api/auth/verify-basic'],
  },
  {
    code: 'TENANT_REQUIRED',
    category: 'tenant_context',
    httpStatus: 400,
    routes: ['/api/auth/verify-basic'],
  },
  {
    code: 'VERIFY_BASIC_FAILED',
    category: 'runtime',
    httpStatus: 400,
    routes: ['/api/auth/verify-basic'],
  },
  {
    code: 'UNAUTHORIZED',
    category: 'token_auth',
    httpStatus: 401,
    routes: ['/api/me'],
  },
  {
    code: 'TOKEN_MISSING',
    category: 'token_anomaly',
    httpStatus: 401,
    routes: ['/api/me'],
    metricOnly: true,
  },
  {
    code: 'TOKEN_INVALID',
    category: 'token_anomaly',
    httpStatus: 401,
    routes: ['/api/me'],
    metricOnly: true,
  },
  {
    code: 'SESSION_NOT_FOUND',
    category: 'token_anomaly',
    httpStatus: 401,
    routes: ['/api/me'],
    metricOnly: true,
  },
  {
    code: 'USER_NOT_FOUND',
    category: 'token_anomaly',
    httpStatus: 401,
    routes: ['/api/me'],
    metricOnly: true,
  },
  {
    code: 'ME_TOUCH_FAILED',
    category: 'runtime',
    httpStatus: 200,
    routes: ['/api/me'],
    note: 'handled as degraded success',
  },
];

function createEmptyState() {
  return {
    metrics: {
      login: {
        attempts: 0,
        success: 0,
        failure: 0,
      },
      me: {
        requests: 0,
        clientError4xx: 0,
        serverError5xx: 0,
      },
      tokenAnomalies: {
        missingBearer: 0,
        invalidBearer: 0,
        sessionNotFound: 0,
        userNotFound: 0,
      },
    },
    errorStats: {},
    recentLogs: [],
  };
}

const observabilityState = createEmptyState();
const catalogByCode = new Map(userServiceErrorCatalog.map((item) => [item.code, item]));

function normalizeTenantId(req, res, responseBody) {
  const value =
    res.locals.userServiceTenantId ??
    req.user?.tenantId ??
    req.userContext?.user?.tenantId ??
    responseBody?.tenantId ??
    req.body?.tenantId ??
    req.headers['x-tenant-id'] ??
    null;
  const tenantId = Number(value);
  return Number.isFinite(tenantId) && tenantId > 0 ? tenantId : null;
}

function normalizeUserId(req, res, responseBody) {
  const value =
    res.locals.userServiceUserId ??
    req.user?.id ??
    req.userContext?.user?.id ??
    responseBody?.user?.id ??
    null;
  const userId = Number(value);
  return Number.isFinite(userId) && userId > 0 ? userId : null;
}

function normalizeRoute(req) {
  return String(req.route?.path || req.path || req.originalUrl || '').trim() || '/';
}

function buildTraceId(req) {
  const incomingTraceId = String(req.headers['x-trace-id'] || '').trim();
  const incomingRequestId = String(req.headers['x-request-id'] || '').trim();
  return incomingTraceId || incomingRequestId || crypto.randomUUID();
}

function buildResultLabel(route, status, res) {
  const explicit = String(res.locals.userServiceResult || '').trim();
  if (explicit) return explicit;
  if (route === '/api/auth/verify-basic') {
    if (status < 400) return 'login_success';
    if (status < 500) return 'login_failure';
    return 'login_server_error';
  }
  if (route === '/api/me') {
    if (status < 400) return 'me_success';
    if (status < 500) return 'me_client_error';
    return 'me_server_error';
  }
  if (route === '/api/auth/send-code') {
    if (status < 400) return 'send_code_success';
    if (status < 500) return 'send_code_failure';
    return 'send_code_server_error';
  }
  if (status >= 500) return 'server_error';
  if (status >= 400) return 'client_error';
  return 'success';
}

function classifyTokenAnomaly(req) {
  const auth = String(req.headers.authorization || '').trim();
  if (!auth) return 'TOKEN_MISSING';
  const session = req.userContext?.session || null;
  const user = req.userContext?.user || null;
  if (!session && !user) return 'TOKEN_INVALID';
  if (!session) return 'SESSION_NOT_FOUND';
  if (!user) return 'USER_NOT_FOUND';
  return '';
}

function incrementErrorStat(code, route, status) {
  if (!code) return;
  const existing = observabilityState.errorStats[code] || {
    code,
    count: 0,
    category: catalogByCode.get(code)?.category || 'uncategorized',
    httpStatus: catalogByCode.get(code)?.httpStatus || status || 0,
    routes: [],
  };
  existing.count += 1;
  existing.httpStatus = existing.httpStatus || status || 0;
  if (!existing.routes.includes(route)) existing.routes.push(route);
  observabilityState.errorStats[code] = existing;
}

function updateRouteMetrics({ route, status, code }) {
  if (route === '/api/auth/verify-basic') {
    observabilityState.metrics.login.attempts += 1;
    if (status < 400) observabilityState.metrics.login.success += 1;
    else observabilityState.metrics.login.failure += 1;
  }

  if (route === '/api/me') {
    observabilityState.metrics.me.requests += 1;
    if (status >= 400 && status < 500) observabilityState.metrics.me.clientError4xx += 1;
    if (status >= 500) observabilityState.metrics.me.serverError5xx += 1;
  }

  if (TOKEN_ANOMALY_CODES.includes(code)) {
    if (code === 'TOKEN_MISSING') observabilityState.metrics.tokenAnomalies.missingBearer += 1;
    if (code === 'TOKEN_INVALID') observabilityState.metrics.tokenAnomalies.invalidBearer += 1;
    if (code === 'SESSION_NOT_FOUND') observabilityState.metrics.tokenAnomalies.sessionNotFound += 1;
    if (code === 'USER_NOT_FOUND') observabilityState.metrics.tokenAnomalies.userNotFound += 1;
  }
}

function pushLog(entry) {
  observabilityState.recentLogs.push(entry);
  if (observabilityState.recentLogs.length > MAX_RECENT_LOGS) {
    observabilityState.recentLogs.splice(0, observabilityState.recentLogs.length - MAX_RECENT_LOGS);
  }
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(entry));
}

function toRate(numerator, denominator) {
  if (!denominator) return 0;
  return Number((numerator / denominator).toFixed(4));
}

function recordRequest(req, res, durationMs) {
  const route = normalizeRoute(req);
  const status = Number(res.statusCode || 0);
  const responseBody = res.locals.responseBody || null;
  const responseCode = String(res.locals.userServiceErrorCode || responseBody?.code || '').trim();
  const tokenAnomalyCode = route === '/api/me' && status === 401 ? classifyTokenAnomaly(req) : '';
  const code = tokenAnomalyCode || responseCode;

  updateRouteMetrics({ route, status, code });
  incrementErrorStat(responseCode, route, status);
  if (tokenAnomalyCode && tokenAnomalyCode !== responseCode) {
    incrementErrorStat(tokenAnomalyCode, route, status);
  }

  pushLog({
    timestamp: new Date().toISOString(),
    service: 'user-service',
    trace_id: String(req.traceId || ''),
    request_id: String(req.requestId || req.traceId || ''),
    user_id: normalizeUserId(req, res, responseBody),
    tenant_id: normalizeTenantId(req, res, responseBody),
    route,
    result: buildResultLabel(route, status, res),
    status,
    code: code || null,
    duration_ms: durationMs,
    method: String(req.method || 'GET').toUpperCase(),
  });
}

export function resetUserServiceObservability() {
  const nextState = createEmptyState();
  observabilityState.metrics = nextState.metrics;
  observabilityState.errorStats = nextState.errorStats;
  observabilityState.recentLogs = nextState.recentLogs;
}

export function buildUserServiceObservabilitySnapshot() {
  const login = observabilityState.metrics.login;
  const me = observabilityState.metrics.me;
  const tokenAnomalies = observabilityState.metrics.tokenAnomalies;
  return {
    logFields: USER_SERVICE_LOG_FIELDS,
    metrics: {
      login: {
        attempts: login.attempts,
        success: login.success,
        failure: login.failure,
        successRate: toRate(login.success, login.attempts),
        failureRate: toRate(login.failure, login.attempts),
      },
      me: {
        requests: me.requests,
        clientError4xx: me.clientError4xx,
        serverError5xx: me.serverError5xx,
      },
      tokenAnomalies: {
        missingBearer: tokenAnomalies.missingBearer,
        invalidBearer: tokenAnomalies.invalidBearer,
        sessionNotFound: tokenAnomalies.sessionNotFound,
        userNotFound: tokenAnomalies.userNotFound,
      },
    },
    errors: {
      catalog: userServiceErrorCatalog,
      stats: Object.values(observabilityState.errorStats).sort((a, b) => String(a.code).localeCompare(String(b.code))),
    },
    recentLogs: [...observabilityState.recentLogs],
  };
}

export function createUserServiceObservabilityMiddleware() {
  return (req, res, next) => {
    const startedAt = Date.now();
    req.traceId = buildTraceId(req);
    req.requestId = String(req.headers['x-request-id'] || '').trim() || String(req.traceId || '');
    res.setHeader('x-trace-id', String(req.traceId || ''));
    res.setHeader('x-request-id', String(req.requestId || req.traceId || ''));
    res.setHeader('x-service-name', 'user-service');

    const auth = String(req.headers.authorization || '').trim();
    req.userContext = {
      user: resolveUserFromBearer(auth) || null,
      session: resolveSessionFromBearer(auth) || null,
    };

    const originalJson = res.json.bind(res);
    res.json = (payload) => {
      res.locals.responseBody = payload;
      return originalJson(payload);
    };

    res.on('finish', () => {
      recordRequest(req, res, Date.now() - startedAt);
    });

    next();
  };
}
