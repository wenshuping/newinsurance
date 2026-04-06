import crypto from 'node:crypto';
import express from 'express';
import { corsMiddleware } from '../../skeleton-c-v1/common/middleware.mjs';
import {
  describeGatewayRoutes,
  gatewayOwnershipSummary,
  gatewayServiceRegistry,
  listGatewayActiveServices,
  resolveGatewayConfig,
  resolveGatewayTarget,
  resolveServiceBaseUrl,
} from './route-map.mjs';

const HOP_BY_HOP_HEADERS = new Set([
  'access-control-allow-headers',
  'access-control-allow-methods',
  'access-control-allow-origin',
  'connection',
  'content-length',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'vary',
]);

const MAX_RECENT_REQUESTS = 80;

function resolveTraceContext(req) {
  const incomingTraceId = String(req.headers['x-trace-id'] || '').trim();
  const incomingRequestId = String(req.headers['x-request-id'] || '').trim();
  const requestId = incomingRequestId || incomingTraceId || crypto.randomUUID();
  return {
    traceId: incomingTraceId || requestId,
    requestId,
  };
}

function buildTargetUrl(baseUrl, req) {
  return new URL(req.originalUrl || req.url || '/', `${String(baseUrl || '').replace(/\/+$/, '')}/`).toString();
}

function toRequestBody(req) {
  const method = String(req.method || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD') return undefined;
  return Buffer.isBuffer(req.body) && req.body.length > 0 ? req.body : undefined;
}

function bucketStatus(status) {
  const code = Number(status || 0);
  if (code >= 200 && code < 300) return '2xx';
  if (code >= 300 && code < 400) return '3xx';
  if (code >= 400 && code < 500) return '4xx';
  if (code >= 500 && code < 600) return '5xx';
  return 'other';
}

function createGatewayObservabilityState() {
  return {
    startedAt: new Date().toISOString(),
    requestTotal: 0,
    errorTotal: 0,
    totalDurationMs: 0,
    maxDurationMs: 0,
    inFlight: 0,
    fallbackTotal: 0,
    statusBuckets: {
      '2xx': 0,
      '3xx': 0,
      '4xx': 0,
      '5xx': 0,
      other: 0,
    },
    recentRequests: [],
  };
}

function pushRecentRequest(state, entry) {
  state.recentRequests.push(entry);
  if (state.recentRequests.length > MAX_RECENT_REQUESTS) {
    state.recentRequests.splice(0, state.recentRequests.length - MAX_RECENT_REQUESTS);
  }
}

function logGatewayRequest(entry) {
  // eslint-disable-next-line no-console
  console.log(`[api-gateway] ${JSON.stringify(entry)}`);
}

function buildGatewayMetricsSnapshot(state) {
  const requestTotal = Number(state.requestTotal || 0);
  const errorTotal = Number(state.errorTotal || 0);
  return {
    startedAt: state.startedAt,
    metrics: {
      requestTotal,
      errorTotal,
      errorRate: requestTotal > 0 ? Number((errorTotal / requestTotal).toFixed(4)) : 0,
      avgLatencyMs: requestTotal > 0 ? Number((state.totalDurationMs / requestTotal).toFixed(2)) : 0,
      maxLatencyMs: Number(state.maxDurationMs || 0),
      inFlight: Math.max(0, Number(state.inFlight || 0) - 1),
      fallbackTotal: Number(state.fallbackTotal || 0),
      statusBuckets: { ...state.statusBuckets },
    },
    recentRequests: [...state.recentRequests],
  };
}

function createGatewayObservabilityMiddleware(state) {
  return (req, res, next) => {
    const startedAt = Date.now();
    const traceContext = resolveTraceContext(req);
    req.traceId = traceContext.traceId;
    req.requestId = traceContext.requestId;
    req.gatewayFallbackCount = 0;
    req.gatewayFallbackReasons = [];
    req.gatewayMode = 'internal';
    req.gatewayTargetService = 'api-gateway';

    state.inFlight += 1;

    res.setHeader('x-trace-id', String(req.traceId || ''));
    res.setHeader('x-request-id', String(req.requestId || req.traceId || ''));
    res.setHeader('x-service-name', 'api-gateway');

    res.on('finish', () => {
      const durationMs = Number(Date.now() - startedAt);
      const status = Number(res.statusCode || 0);
      state.inFlight = Math.max(0, Number(state.inFlight || 0) - 1);
      state.requestTotal += 1;
      state.totalDurationMs += durationMs;
      state.maxDurationMs = Math.max(Number(state.maxDurationMs || 0), durationMs);
      state.statusBuckets[bucketStatus(status)] += 1;
      if (status >= 400) state.errorTotal += 1;

      const entry = {
        ts: new Date().toISOString(),
        trace_id: String(req.traceId || ''),
        request_id: String(req.requestId || req.traceId || ''),
        method: String(req.method || 'GET').toUpperCase(),
        path: String(req.originalUrl || req.url || ''),
        status_code: status,
        duration_ms: durationMs,
        gateway_mode: String(req.gatewayMode || 'unknown'),
        target_service: String(req.gatewayTargetService || 'unknown'),
        fallback_count: Number(req.gatewayFallbackCount || 0),
        fallback_reasons: Array.isArray(req.gatewayFallbackReasons) ? [...req.gatewayFallbackReasons] : [],
      };

      pushRecentRequest(state, entry);
      logGatewayRequest(entry);
    });

    next();
  };
}

function recordFallback(state, req, reason, target) {
  state.fallbackTotal += 1;
  req.gatewayFallbackCount = Number(req.gatewayFallbackCount || 0) + 1;
  req.gatewayFallbackReasons = Array.isArray(req.gatewayFallbackReasons) ? req.gatewayFallbackReasons : [];
  req.gatewayFallbackReasons.push(String(reason || 'fallback'));
  req.gatewayMode = 'v1';
  req.gatewayTargetService = String(target?.service || 'v1-monolith');
}

function copyProxyHeaders(req, target) {
  const headers = new Headers();

  for (const [name, value] of Object.entries(req.headers || {})) {
    if (value == null) continue;
    const normalizedName = String(name || '').toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(normalizedName)) continue;
    if (Array.isArray(value)) {
      headers.set(normalizedName, value.join(', '));
      continue;
    }
    headers.set(normalizedName, String(value));
  }

  headers.set('x-trace-id', String(req.traceId || ''));
  headers.set('x-request-id', String(req.requestId || req.traceId || ''));
  headers.set('x-service-name', 'api-gateway');
  headers.set('x-forwarded-host', String(req.headers.host || ''));
  headers.set('x-forwarded-proto', String(req.protocol || 'http'));
  headers.set('x-gateway-mode', String(target.mode || 'v1'));
  headers.set('x-gateway-target-service', String(target.service || 'v1-monolith'));

  return headers;
}

async function fetchWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function canFallbackOnError(req, target) {
  const method = String(req.method || 'GET').toUpperCase();
  return target.mode === 'v2' && Boolean(target.fallbackBaseUrl) && (method === 'GET' || method === 'HEAD');
}

function applyGatewayResponseHeaders(res, req, target) {
  res.setHeader('x-trace-id', String(req.traceId || ''));
  res.setHeader('x-request-id', String(req.requestId || req.traceId || ''));
  res.setHeader('x-service-name', 'api-gateway');
  res.setHeader('x-gateway-mode', String(target.mode || 'v1'));
  res.setHeader('x-gateway-target-service', String(target.service || 'v1-monolith'));
}

async function proxyRequest(req, res, target, timeoutMs, observabilityState) {
  const requestInit = {
    method: req.method,
    headers: copyProxyHeaders(req, target),
    body: toRequestBody(req),
    redirect: 'manual',
  };

  let downstream;
  let effectiveTarget = target;

  req.gatewayMode = String(target.mode || 'v1');
  req.gatewayTargetService = String(target.service || 'v1-monolith');

  try {
    downstream = await fetchWithTimeout(buildTargetUrl(target.targetBaseUrl, req), requestInit, timeoutMs);
  } catch (err) {
    if (!canFallbackOnError(req, target)) {
      applyGatewayResponseHeaders(res, req, target);
      return res.status(502).json({
        code: 'GATEWAY_UPSTREAM_UNAVAILABLE',
        message: 'upstream unavailable',
        service: target.service,
        traceId: req.traceId,
      });
    }

    const fallbackTarget = {
      ...target,
      mode: 'v1',
      service: 'v1-monolith',
      targetBaseUrl: target.fallbackBaseUrl,
      fallbackBaseUrl: null,
      reason: 'fallback-after-network-error',
    };
    recordFallback(observabilityState, req, fallbackTarget.reason, fallbackTarget);
    effectiveTarget = fallbackTarget;

    try {
      downstream = await fetchWithTimeout(buildTargetUrl(fallbackTarget.targetBaseUrl, req), {
        ...requestInit,
        headers: copyProxyHeaders(req, fallbackTarget),
      }, timeoutMs);
    } catch (fallbackErr) {
      applyGatewayResponseHeaders(res, req, fallbackTarget);
      return res.status(502).json({
        code: 'GATEWAY_FALLBACK_UNAVAILABLE',
        message: 'fallback upstream unavailable',
        service: fallbackTarget.service,
        traceId: req.traceId,
        error: fallbackErr?.name === 'AbortError' ? 'timeout' : String(fallbackErr?.message || fallbackErr || 'unknown'),
      });
    }
  }

  if (downstream.status >= 500 && canFallbackOnError(req, target)) {
    const fallbackTarget = {
      ...target,
      mode: 'v1',
      service: 'v1-monolith',
      targetBaseUrl: target.fallbackBaseUrl,
      fallbackBaseUrl: null,
      reason: 'fallback-after-5xx',
    };
    recordFallback(observabilityState, req, fallbackTarget.reason, fallbackTarget);
    effectiveTarget = fallbackTarget;

    try {
      downstream = await fetchWithTimeout(buildTargetUrl(fallbackTarget.targetBaseUrl, req), {
        ...requestInit,
        headers: copyProxyHeaders(req, fallbackTarget),
      }, timeoutMs);
    } catch (fallbackErr) {
      applyGatewayResponseHeaders(res, req, fallbackTarget);
      return res.status(502).json({
        code: 'GATEWAY_FALLBACK_UNAVAILABLE',
        message: 'fallback upstream unavailable',
        service: fallbackTarget.service,
        traceId: req.traceId,
        error: fallbackErr?.name === 'AbortError' ? 'timeout' : String(fallbackErr?.message || fallbackErr || 'unknown'),
      });
    }
  }

  req.gatewayMode = String(effectiveTarget.mode || 'v1');
  req.gatewayTargetService = String(effectiveTarget.service || 'v1-monolith');

  res.status(downstream.status);
  downstream.headers.forEach((value, name) => {
    const normalizedName = String(name || '').toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(normalizedName)) return;
    res.setHeader(name, value);
  });
  applyGatewayResponseHeaders(res, req, effectiveTarget);

  const buffer = Buffer.from(await downstream.arrayBuffer());
  return res.send(buffer);
}

async function checkUpstream(serviceKey, config) {
  const registryItem = gatewayServiceRegistry[serviceKey];
  const baseUrl = resolveServiceBaseUrl(serviceKey);
  const healthUrl = `${baseUrl}${registryItem.healthPath}`;

  try {
    const res = await fetchWithTimeout(healthUrl, { method: 'GET' }, config.readyTimeoutMs);
    const body = await res.json().catch(() => ({}));
    return {
      service: serviceKey,
      url: healthUrl,
      ok: res.ok && body?.ok === true,
      status: res.status,
      body,
    };
  } catch (err) {
    return {
      service: serviceKey,
      url: healthUrl,
      ok: false,
      status: 0,
      error: err?.name === 'AbortError' ? 'timeout' : String(err?.message || err || 'unknown'),
    };
  }
}

async function collectUpstreamObservability(serviceKey, config) {
  const registryItem = gatewayServiceRegistry[serviceKey];
  if (!registryItem?.observabilityPath) {
    return {
      service: serviceKey,
      ok: false,
      status: 0,
      body: null,
      skipped: true,
    };
  }

  const baseUrl = resolveServiceBaseUrl(serviceKey);
  const observabilityUrl = `${baseUrl}${registryItem.observabilityPath}`;

  try {
    const res = await fetchWithTimeout(observabilityUrl, { method: 'GET' }, config.readyTimeoutMs);
    const body = await res.json().catch(() => null);
    return {
      service: serviceKey,
      ok: res.ok,
      status: res.status,
      url: observabilityUrl,
      body,
    };
  } catch (err) {
    return {
      service: serviceKey,
      ok: false,
      status: 0,
      url: observabilityUrl,
      body: null,
      error: err?.name === 'AbortError' ? 'timeout' : String(err?.message || err || 'unknown'),
    };
  }
}

export const createGatewayApp = () => {
  const app = express();
  const observabilityState = createGatewayObservabilityState();
  app.locals.gatewayObservabilityState = observabilityState;

  app.use(createGatewayObservabilityMiddleware(observabilityState));
  app.use(express.raw({ type: '*/*', limit: '30mb' }));
  app.use(corsMiddleware);
  // Gateway must not validate auth/csrf against its own in-process state.
  // It only forwards headers; downstream services remain the source of truth.

  app.get(['/health', '/internal/gateway/health', '/api/health'], (_req, res) => {
    const config = resolveGatewayConfig();
    res.json({
      ok: true,
      service: 'api-gateway',
      mode: config.enableV2 && !config.forceV1 ? 'v2' : 'v1',
    });
  });

  app.get(['/ready', '/api/ready'], async (_req, res) => {
    const config = resolveGatewayConfig();
    const checks = await Promise.all(listGatewayActiveServices().map((service) => checkUpstream(service, config)));
    const ok = checks.every((item) => item.ok);
    res.status(ok ? 200 : 503).json({ ok, service: 'api-gateway', ready: ok, checks });
  });

  app.get('/internal/gateway/routes', (_req, res) => {
    const config = resolveGatewayConfig();
    res.json({
      ok: true,
      service: 'api-gateway',
      config: {
        enableV2: config.enableV2,
        forceV1: config.forceV1,
        enableV1Fallback: config.enableV1Fallback,
        forceV1Paths: config.forceV1Paths,
        forceV2Paths: config.forceV2Paths,
        v2Tenants: config.v2Tenants,
      },
      services: Object.values(gatewayServiceRegistry).map((item) => ({
        service: item.service,
        ownership: item.ownership,
        enabled: listGatewayActiveServices().includes(item.service),
        baseUrl: resolveServiceBaseUrl(item.service),
        healthPath: item.healthPath,
        observabilityPath: item.observabilityPath || null,
      })),
      routeMap: describeGatewayRoutes(),
      summary: gatewayOwnershipSummary,
    });
  });

  app.get(['/metrics', '/internal/gateway/metrics'], (_req, res) => {
    res.json({
      ok: true,
      service: 'api-gateway',
      ...buildGatewayMetricsSnapshot(observabilityState),
    });
  });

  app.get('/internal/ops/overview', async (_req, res) => {
    const config = resolveGatewayConfig();
    const activeServices = listGatewayActiveServices();
    const managedV2Services = activeServices.filter((service) => service !== 'v1-monolith');
    const [healthChecks, observability] = await Promise.all([
      Promise.all(activeServices.map((service) => checkUpstream(service, config))),
      Promise.all(managedV2Services.map((service) => collectUpstreamObservability(service, config))),
    ]);

    res.json({
      ok: true,
      service: 'api-gateway',
      gateway: {
        mode: config.enableV2 && !config.forceV1 ? 'v2' : 'v1',
        ...buildGatewayMetricsSnapshot(observabilityState),
      },
      upstreams: {
        health: healthChecks,
        observability,
      },
    });
  });

  app.use(async (req, res) => {
    const config = resolveGatewayConfig();
    const target = resolveGatewayTarget({
      pathname: String(req.path || ''),
      headers: req.headers,
    });
    return proxyRequest(req, res, target, config.proxyTimeoutMs, observabilityState);
  });

  return app;
};
