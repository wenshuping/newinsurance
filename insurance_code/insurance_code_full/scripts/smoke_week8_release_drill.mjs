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
    '# Week8 发布/回退演练记录',
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
    '## 指标快照',
    '',
    `- requestTotal: ${report.gatewayMetrics?.requestTotal ?? '-'}`,
    `- errorTotal: ${report.gatewayMetrics?.errorTotal ?? '-'}`,
    `- errorRate: ${report.gatewayMetrics?.errorRate ?? '-'}`,
    `- avgLatencyMs: ${report.gatewayMetrics?.avgLatencyMs ?? '-'}`,
    `- maxLatencyMs: ${report.gatewayMetrics?.maxLatencyMs ?? '-'}`,
    `- fallbackTotal: ${report.gatewayMetrics?.fallbackTotal ?? '-'}`,
    '',
    '## 上线判定',
    '',
    ...report.goLiveCriteria.map((item) => `- ${item.name}: ${item.ok ? 'PASS' : 'FAIL'}`),
  );

  return `${lines.join('\n')}\n`;
}

function writeReports(report) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const stamp = nowStamp();
  const jsonPath = path.join(REPORT_DIR, `week8-release-drill-${stamp}.json`);
  const mdPath = path.join(REPORT_DIR, `week8-release-drill-${stamp}.md`);
  const latestJsonPath = path.join(REPORT_DIR, 'week8-release-drill-latest.json');
  const latestMdPath = path.join(REPORT_DIR, 'week8-release-drill-latest.md');
  const markdown = toMarkdown(report);

  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(mdPath, markdown);
  fs.writeFileSync(latestJsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(latestMdPath, markdown);

  return {
    jsonPath,
    mdPath,
    latestJsonPath,
    latestMdPath,
  };
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
    const monolithReady = await waitForReady(monolith.base, '/api/health');
    assert(monolithReady?.status === 200, 'week8 release drill monolith health failed', monolithReady);
    const userReady = await waitForReady(userService.base, '/ready');
    assert(userReady?.status === 200, 'week8 release drill user-service ready failed', userReady);
    const pointsReady = await waitForReady(pointsService.base, '/ready');
    assert(pointsReady?.status === 200, 'week8 release drill points-service ready failed', pointsReady);
    const gatewayReady = await waitForReady(gateway.base, '/ready');
    assert(gatewayReady?.status === 200, 'week8 release drill gateway ready failed', gatewayReady);

    const executedAt = new Date().toISOString();
    const tenantId = 1;
    const checks = [];
    const mobile = generateMobile();

    const sendCodeV2 = await requestJson(gateway.base, '/api/auth/send-code', {
      method: 'POST',
      headers: {
        'x-tenant-id': String(tenantId),
        'x-trace-id': 'week8-release-v2-send-code',
      },
      body: { mobile },
    });
    checks.push(buildCheck('release.v2.send-code', sendCodeV2, sendCodeV2.status === 200 && sendCodeV2.headers['x-gateway-mode'] === 'v2' && sendCodeV2.headers['x-gateway-target-service'] === 'user-service'));
    assert(sendCodeV2.status === 200, 'week8 release drill send-code failed', sendCodeV2);

    const verifyBasicV2 = await requestJson(gateway.base, '/api/auth/verify-basic', {
      method: 'POST',
      headers: {
        'x-tenant-id': String(tenantId),
        'x-trace-id': 'week8-release-v2-verify-basic',
      },
      body: {
        name: '张三',
        mobile,
        code: String(sendCodeV2.body?.dev_code || '123456'),
        tenantId,
      },
    });
    const token = String(verifyBasicV2.body?.token || '');
    const csrfToken = String(verifyBasicV2.body?.csrfToken || '');
    checks.push(buildCheck('release.v2.verify-basic', verifyBasicV2, verifyBasicV2.status === 200 && Boolean(token) && verifyBasicV2.headers['x-gateway-mode'] === 'v2'));
    assert(verifyBasicV2.status === 200 && token && csrfToken, 'week8 release drill verify-basic failed', verifyBasicV2);

    const authHeaders = {
      authorization: `Bearer ${token}`,
      'x-csrf-token': csrfToken,
      'x-tenant-id': String(tenantId),
    };

    const mallItemsV2 = await requestJson(gateway.base, '/api/mall/items', {
      method: 'GET',
      headers: {
        ...authHeaders,
        'x-trace-id': 'week8-release-v2-mall-items',
      },
    });
    checks.push(buildCheck('release.v2.mall-items', mallItemsV2, mallItemsV2.status === 200 && mallItemsV2.headers['x-gateway-mode'] === 'v2' && mallItemsV2.headers['x-gateway-target-service'] === 'points-service'));
    assert(mallItemsV2.status === 200, 'week8 release drill mall items v2 failed', mallItemsV2);

    process.env.GATEWAY_FORCE_V1 = 'true';

    const sendCodeV1 = await requestJson(gateway.base, '/api/auth/send-code', {
      method: 'POST',
      headers: {
        'x-tenant-id': String(tenantId),
        'x-trace-id': 'week8-release-force-v1-send-code',
      },
      body: { mobile: generateMobile() },
    });
    checks.push(buildCheck('rollback.force-v1.send-code', sendCodeV1, sendCodeV1.status === 200 && sendCodeV1.headers['x-gateway-mode'] === 'v1' && sendCodeV1.headers['x-gateway-target-service'] === 'v1-monolith'));
    assert(sendCodeV1.status === 200, 'week8 force-v1 send-code failed', sendCodeV1);

    const mallItemsV1 = await requestJson(gateway.base, '/api/mall/items', {
      method: 'GET',
      headers: {
        ...authHeaders,
        'x-trace-id': 'week8-release-force-v1-mall-items',
      },
    });
    checks.push(buildCheck('rollback.force-v1.mall-items', mallItemsV1, mallItemsV1.status === 200 && mallItemsV1.headers['x-gateway-mode'] === 'v1' && mallItemsV1.headers['x-gateway-target-service'] === 'v1-monolith'));
    assert(mallItemsV1.status === 200, 'week8 force-v1 mall items failed', mallItemsV1);

    process.env.GATEWAY_FORCE_V1 = 'false';

    const meBackToV2 = await requestJson(gateway.base, '/api/me', {
      method: 'GET',
      headers: {
        ...authHeaders,
        'x-trace-id': 'week8-release-back-to-v2-me',
      },
    });
    checks.push(buildCheck('release.back-to-v2.me', meBackToV2, meBackToV2.status === 200 && meBackToV2.headers['x-gateway-mode'] === 'v2' && meBackToV2.headers['x-gateway-target-service'] === 'user-service'));
    assert(meBackToV2.status === 200, 'week8 back-to-v2 me failed', meBackToV2);

    const summaryBackToV2 = await requestJson(gateway.base, '/api/points/summary', {
      method: 'GET',
      headers: {
        ...authHeaders,
        'x-trace-id': 'week8-release-back-to-v2-points-summary',
      },
    });
    checks.push(buildCheck('release.back-to-v2.points-summary', summaryBackToV2, summaryBackToV2.status === 200 && summaryBackToV2.headers['x-gateway-mode'] === 'v2' && summaryBackToV2.headers['x-gateway-target-service'] === 'points-service'));
    assert(summaryBackToV2.status === 200, 'week8 back-to-v2 points summary failed', summaryBackToV2);

    process.env.GATEWAY_POINTS_SERVICE_URL = 'http://127.0.0.1:1';

    const fallbackMallItems = await requestJson(gateway.base, '/api/mall/items', {
      method: 'GET',
      headers: {
        ...authHeaders,
        'x-trace-id': 'week8-release-read-fallback',
      },
    });
    checks.push(buildCheck('fallback.read.mall-items', fallbackMallItems, fallbackMallItems.status === 200 && fallbackMallItems.headers['x-gateway-mode'] === 'v1' && fallbackMallItems.headers['x-gateway-target-service'] === 'v1-monolith'));
    assert(fallbackMallItems.status === 200, 'week8 read fallback mall items failed', fallbackMallItems);

    process.env.GATEWAY_POINTS_SERVICE_URL = pointsService.base;

    const gatewayMetrics = await requestJson(gateway.base, '/internal/gateway/metrics');
    assert(gatewayMetrics.status === 200, 'week8 gateway metrics failed', gatewayMetrics);
    const metrics = gatewayMetrics.body?.metrics || {};
    const recentRequests = Array.isArray(gatewayMetrics.body?.recentRequests) ? gatewayMetrics.body.recentRequests : [];
    const fallbackEntry = recentRequests.find((entry) => entry?.trace_id === 'week8-release-read-fallback');

    checks.push({
      name: 'fallback.metrics.visible',
      ok: Number(metrics.fallbackTotal || 0) >= 1 && Number(fallbackEntry?.fallback_count || 0) >= 1,
      status: 200,
      mode: null,
      target: null,
      traceId: 'week8-release-read-fallback',
    });

    const goLiveCriteria = [
      { name: 'v2-default-paths-healthy', ok: checks.some((item) => item.name === 'release.v2.verify-basic' && item.ok) && checks.some((item) => item.name === 'release.v2.mall-items' && item.ok) },
      { name: 'force-v1-rollback-works', ok: checks.some((item) => item.name === 'rollback.force-v1.send-code' && item.ok) && checks.some((item) => item.name === 'rollback.force-v1.mall-items' && item.ok) },
      { name: 'back-to-v2-recovers', ok: checks.some((item) => item.name === 'release.back-to-v2.me' && item.ok) && checks.some((item) => item.name === 'release.back-to-v2.points-summary' && item.ok) },
      { name: 'read-fallback-works-on-upstream-failure', ok: checks.some((item) => item.name === 'fallback.read.mall-items' && item.ok) && checks.some((item) => item.name === 'fallback.metrics.visible' && item.ok) },
      { name: 'gateway-error-rate-acceptable', ok: Number(metrics.errorRate || 0) <= 0.05 },
    ];

    const failed = [...checks.filter((item) => !item.ok), ...goLiveCriteria.filter((item) => !item.ok)];
    const report = {
      ok: failed.length === 0,
      executedAt,
      gatewayBase: gateway.base,
      userServiceBase: userService.base,
      pointsServiceBase: pointsService.base,
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
    process.env.GATEWAY_ENABLE_LEARNING_SERVICE = previousEnv.GATEWAY_ENABLE_LEARNING_SERVICE;

    await closeServer(gateway.server);
    await closeServer(pointsService.server);
    await closeServer(userService.server);
    await closeServer(monolith.server);
    const { closeState } = await import('../server/skeleton-c-v1/common/state.mjs');
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
