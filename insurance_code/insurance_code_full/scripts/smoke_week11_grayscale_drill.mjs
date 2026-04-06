#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

process.env.STORAGE_BACKEND = process.env.STORAGE_BACKEND || 'file';

const HOST = '127.0.0.1';
const REPORT_DIR = path.resolve(process.cwd(), 'docs/reports');

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

function nowStamp() {
  const d = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return [
    d.getFullYear(),
    pad(d.getMonth() + 1),
    pad(d.getDate()),
    '-',
    pad(d.getHours()),
    pad(d.getMinutes()),
    pad(d.getSeconds()),
  ].join('');
}

function toMarkdown(report) {
  const lines = [
    '# Week11 灰度演练报告',
    '',
    `- 时间：${report.executedAt}`,
    `- 结果：${report.ok ? 'PASS' : 'FAIL'}`,
    `- gateway：${report.gatewayBase}`,
    `- user-service：${report.userServiceBase}`,
    `- points-service：${report.pointsServiceBase}`,
    '',
    '## 场景结果',
    '',
  ];

  for (const item of report.checks) {
    lines.push(`- ${item.name}: ${item.ok ? 'PASS' : 'FAIL'}${item.mode ? ` | mode=${item.mode}` : ''}${item.target ? ` | target=${item.target}` : ''}`);
  }

  lines.push(
    '',
    '## 灰度判定',
    '',
    ...report.goLiveCriteria.map((item) => `- ${item.name}: ${item.ok ? 'PASS' : 'FAIL'}`),
    '',
    '## gateway 指标快照',
    '',
    `- requestTotal: ${report.gatewayMetrics?.requestTotal ?? '-'}`,
    `- errorTotal: ${report.gatewayMetrics?.errorTotal ?? '-'}`,
    `- errorRate: ${report.gatewayMetrics?.errorRate ?? '-'}`,
    `- fallbackTotal: ${report.gatewayMetrics?.fallbackTotal ?? '-'}`,
  );

  return `${lines.join('\n')}\n`;
}

function writeReports(report) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const stamp = nowStamp();
  const jsonPath = path.join(REPORT_DIR, `week11-grayscale-drill-${stamp}.json`);
  const mdPath = path.join(REPORT_DIR, `week11-grayscale-drill-${stamp}.md`);
  const latestJsonPath = path.join(REPORT_DIR, 'week11-grayscale-drill-latest.json');
  const latestMdPath = path.join(REPORT_DIR, 'week11-grayscale-drill-latest.md');
  const markdown = toMarkdown(report);

  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(mdPath, markdown);
  fs.writeFileSync(latestJsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(latestMdPath, markdown);

  return { jsonPath, mdPath, latestJsonPath, latestMdPath };
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

async function requestJson(base, pathname, { method = 'GET', headers = {}, body } = {}) {
  const response = await fetch(`${base}${pathname}`, {
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

async function waitForReady(base, pathname = '/ready', { attempts = 30, delayMs = 100 } = {}) {
  let lastResponse = null;
  for (let index = 0; index < attempts; index += 1) {
    try {
      lastResponse = await requestJson(base, pathname);
      if (lastResponse.status === 200) return lastResponse;
    } catch (error) {
      lastResponse = {
        status: 0,
        body: {
          error: String(error?.message || error),
        },
      };
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return lastResponse;
}

function buildCheck(name, response, ok) {
  return {
    name,
    ok: Boolean(ok),
    status: Number(response?.status || 0),
    mode: response?.headers?.['x-gateway-mode'] || null,
    target: response?.headers?.['x-gateway-target-service'] || null,
    traceId: response?.headers?.['x-trace-id'] || null,
  };
}

function buildTenantHeaders({ tenantId, tenantCode, traceId, authHeaders = {} }) {
  return {
    ...authHeaders,
    'x-tenant-id': String(tenantId),
    'x-tenant-code': tenantCode,
    'x-trace-id': traceId,
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
    GATEWAY_FORCE_V1_PATHS: process.env.GATEWAY_FORCE_V1_PATHS,
    GATEWAY_FORCE_V2_PATHS: process.env.GATEWAY_FORCE_V2_PATHS,
    GATEWAY_V2_TENANTS: process.env.GATEWAY_V2_TENANTS,
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
  process.env.GATEWAY_FORCE_V1_PATHS = '';
  process.env.GATEWAY_FORCE_V2_PATHS = '';
  process.env.GATEWAY_V2_TENANTS = 'tenant-alpha';

  const gateway = await listen(createGatewayApp());

  try {
    const monolithReady = await waitForReady(monolith.base, '/api/health');
    assert(monolithReady?.status === 200, 'week11 grayscale drill monolith health failed', monolithReady);
    const userReady = await waitForReady(userService.base, '/ready');
    assert(userReady?.status === 200, 'week11 grayscale drill user-service ready failed', userReady);
    const pointsReady = await waitForReady(pointsService.base, '/ready');
    assert(pointsReady?.status === 200, 'week11 grayscale drill points-service ready failed', pointsReady);
    const gatewayReady = await waitForReady(gateway.base, '/ready');
    assert(gatewayReady?.status === 200, 'week11 grayscale drill gateway ready failed', gatewayReady);

    const executedAt = new Date().toISOString();
    const tenantId = 1;
    const checks = [];

    const allowedMobile = generateMobile();
    const allowedSendCode = await requestJson(gateway.base, '/api/auth/send-code', {
      method: 'POST',
      headers: buildTenantHeaders({ tenantId, tenantCode: 'tenant-alpha', traceId: 'week11-tenant-allow-send-code' }),
      body: { mobile: allowedMobile },
    });
    checks.push(buildCheck('tenant.allowlist.send-code.v2', allowedSendCode, allowedSendCode.status === 200 && allowedSendCode.headers['x-gateway-mode'] === 'v2' && allowedSendCode.headers['x-gateway-target-service'] === 'user-service'));
    assert(allowedSendCode.status === 200, 'week11 tenant allowlist send-code failed', allowedSendCode);

    const blockedMobile = generateMobile();
    const blockedSendCode = await requestJson(gateway.base, '/api/auth/send-code', {
      method: 'POST',
      headers: buildTenantHeaders({ tenantId, tenantCode: 'tenant-beta', traceId: 'week11-tenant-block-send-code' }),
      body: { mobile: blockedMobile },
    });
    checks.push(buildCheck('tenant.blocked.send-code.v1', blockedSendCode, blockedSendCode.status === 200 && blockedSendCode.headers['x-gateway-mode'] === 'v1' && blockedSendCode.headers['x-gateway-target-service'] === 'v1-monolith'));
    assert(blockedSendCode.status === 200, 'week11 tenant blocked send-code failed', blockedSendCode);

    const blockedVerifyBasic = await requestJson(gateway.base, '/api/auth/verify-basic', {
      method: 'POST',
      headers: buildTenantHeaders({ tenantId, tenantCode: 'tenant-beta', traceId: 'week11-tenant-block-verify-basic' }),
      body: {
        name: '张三',
        mobile: blockedMobile,
        code: String(blockedSendCode.body?.dev_code || '123456'),
        tenantId,
      },
    });
    const token = String(blockedVerifyBasic.body?.token || '');
    const csrfToken = String(blockedVerifyBasic.body?.csrfToken || '');
    checks.push(buildCheck('tenant.blocked.verify-basic.v1', blockedVerifyBasic, blockedVerifyBasic.status === 200 && Boolean(token) && blockedVerifyBasic.headers['x-gateway-mode'] === 'v1' && blockedVerifyBasic.headers['x-gateway-target-service'] === 'v1-monolith'));
    assert(blockedVerifyBasic.status === 200 && token && csrfToken, 'week11 tenant blocked verify-basic failed', blockedVerifyBasic);

    const authHeaders = {
      authorization: `Bearer ${token}`,
      'x-csrf-token': csrfToken,
    };

    process.env.GATEWAY_V2_TENANTS = 'tenant-alpha';
    process.env.GATEWAY_FORCE_V2_PATHS = '/api/me,/api/points/*';

    const forceV2Me = await requestJson(gateway.base, '/api/me', {
      method: 'GET',
      headers: buildTenantHeaders({ tenantId, tenantCode: 'tenant-beta', traceId: 'week11-force-v2-me', authHeaders }),
    });
    checks.push(buildCheck('path.force-v2.me', forceV2Me, forceV2Me.status === 200 && forceV2Me.headers['x-gateway-mode'] === 'v2' && forceV2Me.headers['x-gateway-target-service'] === 'user-service'));
    assert(forceV2Me.status === 200, 'week11 force-v2 me failed', forceV2Me);

    const forceV2PointsSummary = await requestJson(gateway.base, '/api/points/summary', {
      method: 'GET',
      headers: buildTenantHeaders({ tenantId, tenantCode: 'tenant-beta', traceId: 'week11-force-v2-points-summary', authHeaders }),
    });
    checks.push(buildCheck('path.force-v2.points-summary', forceV2PointsSummary, forceV2PointsSummary.status === 200 && forceV2PointsSummary.headers['x-gateway-mode'] === 'v2' && forceV2PointsSummary.headers['x-gateway-target-service'] === 'points-service'));
    assert(forceV2PointsSummary.status === 200, 'week11 force-v2 points-summary failed', forceV2PointsSummary);

    process.env.GATEWAY_V2_TENANTS = 'all';
    process.env.GATEWAY_FORCE_V2_PATHS = '';
    process.env.GATEWAY_FORCE_V1_PATHS = '/api/mall/*,/api/orders/*';

    const forceV1MallItems = await requestJson(gateway.base, '/api/mall/items', {
      method: 'GET',
      headers: buildTenantHeaders({ tenantId, tenantCode: 'tenant-alpha', traceId: 'week11-force-v1-mall-items', authHeaders }),
    });
    checks.push(buildCheck('path.force-v1.mall-items', forceV1MallItems, forceV1MallItems.status === 200 && forceV1MallItems.headers['x-gateway-mode'] === 'v1' && forceV1MallItems.headers['x-gateway-target-service'] === 'v1-monolith'));
    assert(forceV1MallItems.status === 200, 'week11 force-v1 mall-items failed', forceV1MallItems);

    process.env.GATEWAY_FORCE_V1_PATHS = '';
    process.env.GATEWAY_POINTS_SERVICE_URL = 'http://127.0.0.1:9';

    const fallbackMallItems = await requestJson(gateway.base, '/api/mall/items', {
      method: 'GET',
      headers: buildTenantHeaders({ tenantId, tenantCode: 'tenant-alpha', traceId: 'week11-read-fallback-mall-items', authHeaders }),
    });
    checks.push(buildCheck('fallback.read.mall-items', fallbackMallItems, fallbackMallItems.status === 200 && fallbackMallItems.headers['x-gateway-mode'] === 'v1' && fallbackMallItems.headers['x-gateway-target-service'] === 'v1-monolith'));
    assert(fallbackMallItems.status === 200, 'week11 read fallback mall-items failed', fallbackMallItems);

    process.env.GATEWAY_POINTS_SERVICE_URL = pointsService.base;

    const gatewayMetrics = await requestJson(gateway.base, '/internal/gateway/metrics');
    assert(gatewayMetrics.status === 200, 'week11 gateway metrics failed', gatewayMetrics);
    const metrics = gatewayMetrics.body?.metrics || {};
    const recentRequests = Array.isArray(gatewayMetrics.body?.recentRequests) ? gatewayMetrics.body.recentRequests : [];
    const fallbackEntry = recentRequests.find((entry) => entry?.trace_id === 'week11-read-fallback-mall-items');

    checks.push({
      name: 'fallback.metrics.visible',
      ok: Number(metrics.fallbackTotal || 0) >= 1 && Number(fallbackEntry?.fallback_count || 0) >= 1,
      status: 200,
      mode: null,
      target: null,
      traceId: 'week11-read-fallback-mall-items',
    });

    const opsOverview = await requestJson(gateway.base, '/internal/ops/overview');
    const upstreamObservability = Array.isArray(opsOverview.body?.upstreams?.observability) ? opsOverview.body.upstreams.observability : [];
    checks.push({
      name: 'ops.overview.available',
      ok: opsOverview.status === 200 && upstreamObservability.some((entry) => entry?.service === 'user-service' && entry?.ok === true) && upstreamObservability.some((entry) => entry?.service === 'points-service' && entry?.ok === true),
      status: opsOverview.status,
      mode: null,
      target: null,
      traceId: null,
    });
    assert(opsOverview.status === 200, 'week11 ops overview failed', opsOverview);

    const goLiveCriteria = [
      { name: 'tenant-level-gray-switch-works', ok: checks.some((item) => item.name === 'tenant.allowlist.send-code.v2' && item.ok) && checks.some((item) => item.name === 'tenant.blocked.send-code.v1' && item.ok) },
      { name: 'path-level-force-v2-works', ok: checks.some((item) => item.name === 'path.force-v2.me' && item.ok) && checks.some((item) => item.name === 'path.force-v2.points-summary' && item.ok) },
      { name: 'path-level-force-v1-works', ok: checks.some((item) => item.name === 'path.force-v1.mall-items' && item.ok) },
      { name: 'fallback-visible-for-read-paths', ok: checks.some((item) => item.name === 'fallback.read.mall-items' && item.ok) && checks.some((item) => item.name === 'fallback.metrics.visible' && item.ok) },
      { name: 'gateway-dashboard-signals-available', ok: checks.some((item) => item.name === 'ops.overview.available' && item.ok) && Number(metrics.errorRate || 0) <= 0.05 },
    ];

    const failed = [...checks.filter((item) => !item.ok), ...goLiveCriteria.filter((item) => !item.ok)];
    const report = {
      ok: failed.length === 0,
      executedAt,
      gatewayBase: gateway.base,
      userServiceBase: userService.base,
      pointsServiceBase: pointsService.base,
      grayConfig: {
        tenantAllowlistKey: 'GATEWAY_V2_TENANTS',
        forceV1PathsKey: 'GATEWAY_FORCE_V1_PATHS',
        forceV2PathsKey: 'GATEWAY_FORCE_V2_PATHS',
      },
      checks,
      gatewayMetrics: metrics,
      goLiveCriteria,
    };
    const reportPaths = writeReports(report);
    report.reportPaths = reportPaths;

    console.log(JSON.stringify(report, null, 2));
    if (failed.length > 0) process.exit(1);
  } finally {
    process.env.GATEWAY_V1_BASE_URL = previousEnv.GATEWAY_V1_BASE_URL;
    process.env.GATEWAY_USER_SERVICE_URL = previousEnv.GATEWAY_USER_SERVICE_URL;
    process.env.GATEWAY_POINTS_SERVICE_URL = previousEnv.GATEWAY_POINTS_SERVICE_URL;
    process.env.GATEWAY_LEARNING_SERVICE_URL = previousEnv.GATEWAY_LEARNING_SERVICE_URL;
    process.env.GATEWAY_ENABLE_V2 = previousEnv.GATEWAY_ENABLE_V2;
    process.env.GATEWAY_ENABLE_V1_FALLBACK = previousEnv.GATEWAY_ENABLE_V1_FALLBACK;
    process.env.GATEWAY_FORCE_V1 = previousEnv.GATEWAY_FORCE_V1;
    process.env.GATEWAY_FORCE_V1_PATHS = previousEnv.GATEWAY_FORCE_V1_PATHS;
    process.env.GATEWAY_FORCE_V2_PATHS = previousEnv.GATEWAY_FORCE_V2_PATHS;
    process.env.GATEWAY_V2_TENANTS = previousEnv.GATEWAY_V2_TENANTS;
    process.env.GATEWAY_ENABLE_LEARNING_SERVICE = previousEnv.GATEWAY_ENABLE_LEARNING_SERVICE;

    await closeServer(gateway.server);
    await closeServer(pointsService.server);
    await closeServer(userService.server);
    await closeServer(monolith.server);
    const { closeState: closeStateAgain } = await import('../server/skeleton-c-v1/common/state.mjs');
    await closeStateAgain();
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
