#!/usr/bin/env node

process.env.STORAGE_BACKEND = process.env.STORAGE_BACKEND || 'file';

const HOST = '127.0.0.1';

function assert(condition, message, context = null) {
  if (condition) return;
  const error = new Error(message);
  error.context = context;
  throw error;
}

function generateMobile() {
  const suffix = String(Date.now()).slice(-8);
  return `139${suffix}`;
}

async function listen(app) {
  const server = app.listen(0, HOST);
  await new Promise((resolve) => server.once('listening', resolve));
  const addr = server.address();
  return {
    server,
    base: `http://${HOST}:${Number(addr?.port || 0)}`,
  };
}

async function closeServer(server) {
  await new Promise((resolve) => server.close(resolve));
}

async function requestJson(base, path, { method = 'GET', headers = {}, body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const raw = await response.text();
  let payload = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    payload = { raw };
  }
  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body: payload,
  };
}

async function main() {
  const previousEnv = {
    GATEWAY_V1_BASE_URL: process.env.GATEWAY_V1_BASE_URL,
    GATEWAY_USER_SERVICE_URL: process.env.GATEWAY_USER_SERVICE_URL,
    GATEWAY_POINTS_SERVICE_URL: process.env.GATEWAY_POINTS_SERVICE_URL,
    GATEWAY_LEARNING_SERVICE_URL: process.env.GATEWAY_LEARNING_SERVICE_URL,
    GATEWAY_ENABLE_V2: process.env.GATEWAY_ENABLE_V2,
    GATEWAY_ENABLE_V1_FALLBACK: process.env.GATEWAY_ENABLE_V1_FALLBACK,
    GATEWAY_FORCE_V1: process.env.GATEWAY_FORCE_V1,
    GATEWAY_ENABLE_LEARNING_SERVICE: process.env.GATEWAY_ENABLE_LEARNING_SERVICE,
  };

  const [
    { closeState, initializeState },
    { createSkeletonApp },
    { createGatewayApp },
    { createUserServiceApp },
    { createPointsServiceApp },
  ] = await Promise.all([
    import('../server/skeleton-c-v1/common/state.mjs'),
    import('../server/skeleton-c-v1/app.mjs'),
    import('../server/microservices/gateway/app.mjs'),
    import('../server/microservices/user-service/app.mjs'),
    import('../server/microservices/points-service/app.mjs'),
  ]);

  await initializeState();

  const monolith = await listen(createSkeletonApp());
  const userService = await listen(createUserServiceApp());
  const pointsService = await listen(
    createPointsServiceApp({
      readiness: {
        isReady() {
          return true;
        },
      },
    }),
  );

  process.env.GATEWAY_V1_BASE_URL = monolith.base;
  process.env.GATEWAY_USER_SERVICE_URL = userService.base;
  process.env.GATEWAY_POINTS_SERVICE_URL = pointsService.base;
  process.env.GATEWAY_ENABLE_LEARNING_SERVICE = 'false';
  process.env.GATEWAY_ENABLE_V2 = 'true';
  process.env.GATEWAY_ENABLE_V1_FALLBACK = 'true';
  process.env.GATEWAY_FORCE_V1 = 'false';

  const gateway = await listen(createGatewayApp());

  try {
    const checks = [];
    const tenantId = 1;
    const mobile = generateMobile();

    const sendCodeTraceId = 'week7-gateway-send-code';
    const loginTraceId = 'week7-gateway-login';
    const meTraceId = 'week7-gateway-me';
    const signInTraceId = 'week7-gateway-sign-in';
    const summaryTraceId = 'week7-gateway-points-summary';
    const fallbackTraceId = 'week7-gateway-fallback';

    const sendCode = await requestJson(gateway.base, '/api/auth/send-code', {
      method: 'POST',
      headers: {
        'x-trace-id': sendCodeTraceId,
        'x-tenant-id': String(tenantId),
      },
      body: { mobile },
    });
    assert(sendCode.status === 200, 'gateway send-code failed', { sendCode });
    assert(sendCode.headers['x-trace-id'] === sendCodeTraceId, 'gateway send-code trace mismatch', { sendCode });
    assert(String(sendCode.headers['x-request-id'] || '').length > 0, 'gateway send-code request id missing', { sendCode });
    assert(sendCode.headers['x-service-name'] === 'api-gateway', 'gateway send-code service header mismatch', { sendCode });
    assert(sendCode.headers['x-gateway-target-service'] === 'user-service', 'gateway send-code target mismatch', { sendCode });
    checks.push({ name: 'gateway.auth.send-code.headers', ok: true });

    const verifyBasic = await requestJson(gateway.base, '/api/auth/verify-basic', {
      method: 'POST',
      headers: {
        'x-trace-id': loginTraceId,
        'x-tenant-id': String(tenantId),
      },
      body: {
        name: '张三',
        mobile,
        code: String(sendCode.body?.dev_code || '123456'),
        tenantId,
      },
    });
    const token = String(verifyBasic.body?.token || '');
    const csrfToken = String(verifyBasic.body?.csrfToken || '');
    assert(verifyBasic.status === 200 && token && csrfToken, 'gateway verify-basic failed', { verifyBasic });
    assert(verifyBasic.headers['x-trace-id'] === loginTraceId, 'gateway verify-basic trace mismatch', { verifyBasic });
    assert(verifyBasic.headers['x-service-name'] === 'api-gateway', 'gateway verify-basic service header mismatch', { verifyBasic });
    checks.push({ name: 'gateway.auth.verify-basic.headers', ok: true });

    const me = await requestJson(gateway.base, '/api/me', {
      headers: {
        authorization: `Bearer ${token}`,
        'x-csrf-token': csrfToken,
        'x-tenant-id': String(tenantId),
        'x-trace-id': meTraceId,
      },
    });
    assert(me.status === 200, 'gateway me failed', { me });
    assert(me.headers['x-trace-id'] === meTraceId, 'gateway me trace mismatch', { me });
    assert(me.headers['x-service-name'] === 'api-gateway', 'gateway me service header mismatch', { me });
    checks.push({ name: 'gateway.me.headers', ok: true });

    const userMetrics = await requestJson(userService.base, '/metrics');
    assert(userMetrics.status === 200, 'user-service metrics endpoint failed', { userMetrics });
    const userLogs = Array.isArray(userMetrics.body?.recentLogs) ? userMetrics.body.recentLogs : [];
    assert(userLogs.some((entry) => entry?.trace_id === loginTraceId), 'user-service login trace missing', { userLogs });
    assert(userLogs.some((entry) => entry?.trace_id === meTraceId), 'user-service me trace missing', { userLogs });
    checks.push({ name: 'user-service.trace-propagation', ok: true });

    const signIn = await requestJson(gateway.base, '/api/sign-in', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'x-csrf-token': csrfToken,
        'x-tenant-id': String(tenantId),
        'x-trace-id': signInTraceId,
      },
    });
    assert(signIn.status === 200, 'gateway sign-in failed', { signIn });
    assert(signIn.headers['x-trace-id'] === signInTraceId, 'gateway sign-in trace mismatch', { signIn });
    assert(signIn.headers['x-gateway-target-service'] === 'points-service', 'gateway sign-in target mismatch', { signIn });
    checks.push({ name: 'gateway.sign-in.headers', ok: true });

    const pointsSummary = await requestJson(gateway.base, '/api/points/summary', {
      headers: {
        authorization: `Bearer ${token}`,
        'x-csrf-token': csrfToken,
        'x-tenant-id': String(tenantId),
        'x-trace-id': summaryTraceId,
      },
    });
    assert(pointsSummary.status === 200, 'gateway points summary failed', { pointsSummary });
    assert(pointsSummary.headers['x-trace-id'] === summaryTraceId, 'gateway points summary trace mismatch', { pointsSummary });
    checks.push({ name: 'gateway.points.summary.headers', ok: true });

    const pointsMetrics = await requestJson(pointsService.base, '/metrics');
    assert(pointsMetrics.status === 200, 'points-service metrics endpoint failed', { pointsMetrics });
    const pointLogs = Array.isArray(pointsMetrics.body?.recentLogs) ? pointsMetrics.body.recentLogs : [];
    assert(pointLogs.some((entry) => entry?.trace_id === signInTraceId), 'points-service sign-in trace missing', { pointLogs });
    assert(pointLogs.some((entry) => entry?.trace_id === summaryTraceId), 'points-service summary trace missing', { pointLogs });
    checks.push({ name: 'points-service.trace-propagation', ok: true });

    const opsOverview = await requestJson(gateway.base, '/internal/ops/overview');
    assert(opsOverview.status === 200, 'gateway ops overview failed', { opsOverview });
    const gatewayMetrics = opsOverview.body?.gateway?.metrics || {};
    const upstreamObservability = Array.isArray(opsOverview.body?.upstreams?.observability)
      ? opsOverview.body.upstreams.observability
      : [];
    assert(Number(gatewayMetrics.requestTotal || 0) >= 5, 'gateway request total too low', { gatewayMetrics });
    assert(upstreamObservability.some((entry) => entry?.service === 'user-service' && entry?.ok === true), 'user-service observability missing from ops overview', { upstreamObservability });
    assert(upstreamObservability.some((entry) => entry?.service === 'points-service' && entry?.ok === true), 'points-service observability missing from ops overview', { upstreamObservability });
    checks.push({ name: 'gateway.ops.overview', ok: true });

    process.env.GATEWAY_POINTS_SERVICE_URL = 'http://127.0.0.1:9';
    const fallbackMallItems = await requestJson(gateway.base, '/api/mall/items', {
      headers: {
        'x-trace-id': fallbackTraceId,
      },
    });
    assert(fallbackMallItems.status === 200, 'gateway fallback mall items failed', { fallbackMallItems });
    assert(fallbackMallItems.headers['x-gateway-mode'] === 'v1', 'gateway fallback mode mismatch', { fallbackMallItems });
    assert(fallbackMallItems.headers['x-gateway-target-service'] === 'v1-monolith', 'gateway fallback target mismatch', { fallbackMallItems });
    checks.push({ name: 'gateway.fallback.headers', ok: true });

    const gatewayMetricsAfterFallback = await requestJson(gateway.base, '/internal/gateway/metrics');
    assert(gatewayMetricsAfterFallback.status === 200, 'gateway metrics endpoint failed', { gatewayMetricsAfterFallback });
    const recentGatewayRequests = Array.isArray(gatewayMetricsAfterFallback.body?.recentRequests)
      ? gatewayMetricsAfterFallback.body.recentRequests
      : [];
    const fallbackEntry = recentGatewayRequests.find((entry) => entry?.trace_id === fallbackTraceId);
    assert(Number(gatewayMetricsAfterFallback.body?.metrics?.fallbackTotal || 0) >= 1, 'gateway fallback metric missing', {
      gatewayMetricsAfterFallback,
    });
    assert(fallbackEntry?.fallback_count >= 1, 'gateway fallback recent request missing', { recentGatewayRequests });
    checks.push({ name: 'gateway.fallback.metrics', ok: true });

    console.log(
      JSON.stringify(
        {
          ok: true,
          checks,
          gatewayMetrics: gatewayMetricsAfterFallback.body?.metrics || null,
        },
        null,
        2,
      ),
    );
  } finally {
    process.env.GATEWAY_V1_BASE_URL = previousEnv.GATEWAY_V1_BASE_URL;
    process.env.GATEWAY_USER_SERVICE_URL = previousEnv.GATEWAY_USER_SERVICE_URL;
    process.env.GATEWAY_POINTS_SERVICE_URL = previousEnv.GATEWAY_POINTS_SERVICE_URL;
    process.env.GATEWAY_LEARNING_SERVICE_URL = previousEnv.GATEWAY_LEARNING_SERVICE_URL;
    process.env.GATEWAY_ENABLE_V2 = previousEnv.GATEWAY_ENABLE_V2;
    process.env.GATEWAY_ENABLE_V1_FALLBACK = previousEnv.GATEWAY_ENABLE_V1_FALLBACK;
    process.env.GATEWAY_FORCE_V1 = previousEnv.GATEWAY_FORCE_V1;
    process.env.GATEWAY_ENABLE_LEARNING_SERVICE = previousEnv.GATEWAY_ENABLE_LEARNING_SERVICE;

    await closeServer(gateway.server);
    await closeServer(pointsService.server);
    await closeServer(userService.server);
    await closeServer(monolith.server);
    await closeState();
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: String(error?.message || error),
        context: error?.context || null,
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
