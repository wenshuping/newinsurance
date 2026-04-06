#!/usr/bin/env node

const defaults = {
  gateway: process.env.RUNTIME_GATEWAY_BASE || 'http://127.0.0.1:4100',
  userService: process.env.RUNTIME_USER_SERVICE_BASE || 'http://127.0.0.1:4101',
  pointsService: process.env.RUNTIME_POINTS_SERVICE_BASE || 'http://127.0.0.1:4102',
  monolith: process.env.RUNTIME_V1_BASE || 'http://127.0.0.1:4000',
};

function assert(condition, message, context = null) {
  if (condition) return;
  const error = new Error(message);
  error.context = context;
  throw error;
}

async function requestJson(base, pathname) {
  const response = await fetch(`${base}${pathname}`);
  const raw = await response.text();
  let body = null;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    body = { raw };
  }
  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body,
  };
}

async function main() {
  const checks = [];

  const gatewayHealth = await requestJson(defaults.gateway, '/health');
  checks.push({
    name: 'gateway.health',
    ok: gatewayHealth.status === 200 && gatewayHealth.body?.ok === true,
    status: gatewayHealth.status,
  });
  assert(checks.at(-1).ok, 'gateway health failed', gatewayHealth);

  const gatewayReady = await requestJson(defaults.gateway, '/ready');
  checks.push({
    name: 'gateway.ready',
    ok: gatewayReady.status === 200 && gatewayReady.body?.ready === true,
    status: gatewayReady.status,
  });
  assert(checks.at(-1).ok, 'gateway ready failed', gatewayReady);

  const gatewayMetrics = await requestJson(defaults.gateway, '/internal/gateway/metrics');
  checks.push({
    name: 'gateway.metrics',
    ok: gatewayMetrics.status === 200 && gatewayMetrics.body?.metrics,
    status: gatewayMetrics.status,
  });
  assert(checks.at(-1).ok, 'gateway metrics failed', gatewayMetrics);

  const opsOverview = await requestJson(defaults.gateway, '/internal/ops/overview');
  checks.push({
    name: 'gateway.ops.overview',
    ok: opsOverview.status === 200 && Array.isArray(opsOverview.body?.upstreams?.health),
    status: opsOverview.status,
  });
  assert(checks.at(-1).ok, 'gateway ops overview failed', opsOverview);

  const userReady = await requestJson(defaults.userService, '/ready');
  checks.push({
    name: 'user-service.ready',
    ok: userReady.status === 200 && userReady.body?.ok === true,
    status: userReady.status,
  });
  assert(checks.at(-1).ok, 'user-service ready failed', userReady);

  const userMetrics = await requestJson(defaults.userService, '/metrics');
  checks.push({
    name: 'user-service.metrics',
    ok: userMetrics.status === 200 && userMetrics.body?.metrics,
    status: userMetrics.status,
  });
  assert(checks.at(-1).ok, 'user-service metrics failed', userMetrics);

  const pointsReady = await requestJson(defaults.pointsService, '/ready');
  checks.push({
    name: 'points-service.ready',
    ok: pointsReady.status === 200 && pointsReady.body?.ok === true,
    status: pointsReady.status,
  });
  assert(checks.at(-1).ok, 'points-service ready failed', pointsReady);

  const pointsMetrics = await requestJson(defaults.pointsService, '/metrics');
  checks.push({
    name: 'points-service.metrics',
    ok: pointsMetrics.status === 200 && pointsMetrics.body?.metrics,
    status: pointsMetrics.status,
  });
  assert(checks.at(-1).ok, 'points-service metrics failed', pointsMetrics);

  const v1Health = await requestJson(defaults.monolith, '/api/health');
  checks.push({
    name: 'v1-monolith.health',
    ok: v1Health.status === 200 && v1Health.body?.ok === true,
    status: v1Health.status,
  });
  assert(checks.at(-1).ok, 'v1 monolith health failed', v1Health);

  console.log(
    JSON.stringify(
      {
        ok: true,
        bases: defaults,
        checks,
      },
      null,
      2,
    ),
  );
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
