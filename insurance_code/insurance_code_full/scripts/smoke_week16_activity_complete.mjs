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
  return [d.getFullYear(), pad(d.getMonth() + 1), pad(d.getDate()), '-', pad(d.getHours()), pad(d.getMinutes()), pad(d.getSeconds())].join('');
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
        body: { error: String(error?.message || error) },
      };
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return lastResponse;
}

function pickActivityPilotActor(state) {
  const agent = (state.agents || []).find((row) => String(row.role || '').toLowerCase() !== 'manager');
  if (!agent) return null;
  return {
    actorType: 'agent',
    actorId: Number(agent.id || 0),
    tenantId: Number(agent.tenantId || 0),
    orgId: Number(agent.orgId || 0),
    teamId: Number(agent.teamId || 0),
  };
}

function buildGatewayHeaders({ tenantId, tenantCode, traceId, authHeaders = {} }) {
  return {
    ...authHeaders,
    'x-tenant-id': String(tenantId),
    'x-tenant-code': tenantCode,
    'x-trace-id': traceId,
    'x-request-id': traceId,
  };
}

function buildCheck(name, response, ok, extra = {}) {
  return {
    name,
    ok: Boolean(ok),
    status: Number(response?.status || 0),
    mode: response?.headers?.['x-gateway-mode'] || null,
    target: response?.headers?.['x-gateway-target-service'] || null,
    traceId: response?.headers?.['x-trace-id'] || null,
    ...extra,
  };
}

function toMarkdown(report) {
  const lines = [
    '# Week16 Activity Complete + Reward 联调报告',
    '',
    `- 时间：${report.executedAt}`,
    `- 结果：${report.ok ? 'PASS' : 'FAIL'}`,
    `- gateway：${report.gatewayBase}`,
    `- activity-service：${report.activityServiceBase}`,
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
    '## 结论',
    '',
    `- default activity traffic on v1: ${report.criteria.defaultActivityTrafficOnV1 ? 'PASS' : 'FAIL'}`,
    `- activity cutover to v2: ${report.criteria.activityCutoverToV2 ? 'PASS' : 'FAIL'}`,
    `- activity reward chain via points: ${report.criteria.activityRewardChainWorks ? 'PASS' : 'FAIL'}`,
    `- force-v1 rollback works: ${report.criteria.forceV1RollbackWorks ? 'PASS' : 'FAIL'}`,
    `- back-to-v2 works: ${report.criteria.backToV2Works ? 'PASS' : 'FAIL'}`,
    `- read fallback works: ${report.criteria.readFallbackWorks ? 'PASS' : 'FAIL'}`,
    `- write path requires manual rollback: ${report.criteria.writeNoAutoFallbackConfirmed ? 'PASS' : 'FAIL'}`,
    `- manual write rollback works: ${report.criteria.manualWriteRollbackWorks ? 'PASS' : 'FAIL'}`,
    `- gateway metrics cover complete: ${report.criteria.gatewayMetricsCoverComplete ? 'PASS' : 'FAIL'}`,
    `- points observability covers reward: ${report.criteria.pointsObservabilityCoverReward ? 'PASS' : 'FAIL'}`,
  );

  return `${lines.join('\n')}\n`;
}

function writeReports(report) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const stamp = nowStamp();
  const jsonPath = path.join(REPORT_DIR, `week16-activity-complete-${stamp}.json`);
  const mdPath = path.join(REPORT_DIR, `week16-activity-complete-${stamp}.md`);
  const latestJsonPath = path.join(REPORT_DIR, 'week16-activity-complete-latest.json');
  const latestMdPath = path.join(REPORT_DIR, 'week16-activity-complete-latest.md');
  const markdown = toMarkdown(report);

  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(mdPath, markdown);
  fs.writeFileSync(latestJsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(latestMdPath, markdown);

  return { jsonPath, mdPath, latestJsonPath, latestMdPath };
}

function findRecentGatewayEntry(metricsBody, traceId) {
  const recentRequests = Array.isArray(metricsBody?.recentRequests) ? metricsBody.recentRequests : [];
  return recentRequests.find((entry) => String(entry?.trace_id || '') === String(traceId));
}

function findRecentPointsLog(body, traceId) {
  const recentLogs = Array.isArray(body?.recentLogs) ? body.recentLogs : [];
  return recentLogs.find(
    (row) => String(row?.route || '') === 'INTERNAL activity->points reward settlement'
      && String(row?.trace_id || '') === String(traceId)
      && String(row?.result || '') === 'success',
  );
}

async function main() {
  const previousEnv = {
    GATEWAY_V1_BASE_URL: process.env.GATEWAY_V1_BASE_URL,
    GATEWAY_USER_SERVICE_URL: process.env.GATEWAY_USER_SERVICE_URL,
    GATEWAY_POINTS_SERVICE_URL: process.env.GATEWAY_POINTS_SERVICE_URL,
    GATEWAY_ACTIVITY_SERVICE_URL: process.env.GATEWAY_ACTIVITY_SERVICE_URL,
    GATEWAY_ENABLE_V2: process.env.GATEWAY_ENABLE_V2,
    GATEWAY_ENABLE_V1_FALLBACK: process.env.GATEWAY_ENABLE_V1_FALLBACK,
    GATEWAY_READY_TIMEOUT_MS: process.env.GATEWAY_READY_TIMEOUT_MS,
    GATEWAY_FORCE_V1: process.env.GATEWAY_FORCE_V1,
    GATEWAY_FORCE_V1_PATHS: process.env.GATEWAY_FORCE_V1_PATHS,
    GATEWAY_FORCE_V2_PATHS: process.env.GATEWAY_FORCE_V2_PATHS,
    GATEWAY_V2_TENANTS: process.env.GATEWAY_V2_TENANTS,
    GATEWAY_ENABLE_ACTIVITY_SERVICE: process.env.GATEWAY_ENABLE_ACTIVITY_SERVICE,
    ACTIVITY_POINTS_SERVICE_URL: process.env.ACTIVITY_POINTS_SERVICE_URL,
  };

  const [
    { closeState, createActorSession, getState, initializeState, resolveSessionFromBearer },
    { createSkeletonApp },
    { createGatewayApp },
    { createUserServiceApp },
    { createPointsServiceApp },
    { createActivityServiceApp },
  ] = await Promise.all([
    import('../server/skeleton-c-v1/common/state.mjs'),
    import('../server/skeleton-c-v1/app.mjs'),
    import('../server/microservices/gateway/app.mjs'),
    import('../server/microservices/user-service/app.mjs'),
    import('../server/microservices/points-service/app.mjs'),
    import('../server/microservices/activity-service/app.mjs'),
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
  const activityService = await listen(createActivityServiceApp());

  process.env.GATEWAY_V1_BASE_URL = monolith.base;
  process.env.GATEWAY_USER_SERVICE_URL = userService.base;
  process.env.GATEWAY_POINTS_SERVICE_URL = pointsService.base;
  process.env.GATEWAY_ACTIVITY_SERVICE_URL = activityService.base;
  process.env.ACTIVITY_POINTS_SERVICE_URL = pointsService.base;
  process.env.GATEWAY_ENABLE_V2 = 'true';
  process.env.GATEWAY_ENABLE_V1_FALLBACK = 'true';
  process.env.GATEWAY_READY_TIMEOUT_MS = '7000';
  process.env.GATEWAY_FORCE_V1 = 'false';
  process.env.GATEWAY_FORCE_V1_PATHS = '';
  process.env.GATEWAY_FORCE_V2_PATHS = '';
  process.env.GATEWAY_V2_TENANTS = 'tenant-alpha';
  process.env.GATEWAY_ENABLE_ACTIVITY_SERVICE = 'false';

  const gateway = await listen(createGatewayApp());

  try {
    const monolithReady = await waitForReady(monolith.base, '/api/health');
    assert(monolithReady?.status === 200, 'week16 monolith health failed', monolithReady);
    const userReady = await waitForReady(userService.base, '/ready');
    assert(userReady?.status === 200, 'week16 user-service ready failed', userReady);
    const pointsReady = await waitForReady(pointsService.base, '/ready');
    assert(pointsReady?.status === 200, 'week16 points-service ready failed', pointsReady);
    const activityReady = await waitForReady(activityService.base, '/ready');
    assert(activityReady?.status === 200, 'week16 activity-service ready failed', activityReady);
    const gatewayReady = await waitForReady(gateway.base, '/ready');
    assert(gatewayReady?.status === 200, 'week16 gateway ready failed', gatewayReady);

    const checks = [];
    const pilotActor = pickActivityPilotActor(getState());
    assert(pilotActor, 'missing activity pilot actor');
    const tenantId = Number(pilotActor.tenantId || 1);
    const adminToken = createActorSession(pilotActor);
    const adminSession = resolveSessionFromBearer(`Bearer ${adminToken}`);
    const adminCsrfToken = String(adminSession?.csrfToken || '');
    assert(adminToken && adminCsrfToken, 'failed to create activity pilot admin session', { adminSession, pilotActor });

    const routes = await requestJson(gateway.base, '/internal/gateway/routes');
    const activityRouteOwner = Array.isArray(routes.body?.routeMap)
      ? routes.body.routeMap.find((item) => item?.service === 'activity-service')
      : null;
    const routeList = Array.isArray(activityRouteOwner?.routes) ? activityRouteOwner.routes : [];
    checks.push(buildCheck('activity.routes.registered.week16', routes, routes.status === 200 && routeList.includes('/api/activities/:id/complete'), {
      routeCount: routeList.length,
    }));
    assert(routes.status === 200, 'gateway route list failed', routes);
    assert(routeList.includes('/api/activities/:id/complete'), 'gateway did not register activity complete route', { routeList });

    const createViaGateway = async (title, traceId, expectedTarget) => {
      const response = await requestJson(gateway.base, '/api/p/activities', {
        method: 'POST',
        headers: buildGatewayHeaders({
          tenantId,
          tenantCode: 'tenant-alpha',
          traceId,
          authHeaders: {
            authorization: `Bearer ${adminToken}`,
            'x-csrf-token': adminCsrfToken,
          },
        }),
        body: {
          title,
          category: 'task',
          rewardPoints: 9,
          content: `week16 runtime split ${title}`,
          status: 'online',
        },
      });
      const activityId = Number(response.body?.activity?.id || 0);
      assert(response.status === 200, 'activity admin create failed', { response, traceId });
      assert(activityId > 0, 'created activity missing id', { response, traceId });
      if (expectedTarget) {
        assert(response.headers['x-gateway-target-service'] === expectedTarget, 'activity admin create target drifted', { response, expectedTarget });
      }
      return {
        response,
        activityId,
        rewardPoints: Number(response.body?.activity?.rewardPoints || 0),
      };
    };

    const mobile = generateMobile();
    const sendCode = await requestJson(gateway.base, '/api/auth/send-code', {
      method: 'POST',
      headers: buildGatewayHeaders({ tenantId, tenantCode: 'tenant-alpha', traceId: 'week16-activity-user-send-code' }),
      body: { mobile },
    });
    assert(sendCode.status === 200, 'week16 activity send-code failed', sendCode);

    const verifyBasic = await requestJson(gateway.base, '/api/auth/verify-basic', {
      method: 'POST',
      headers: buildGatewayHeaders({ tenantId, tenantCode: 'tenant-alpha', traceId: 'week16-activity-user-login' }),
      body: {
        name: '活动客户',
        mobile,
        code: String(sendCode.body?.dev_code || '123456'),
        tenantId,
      },
    });
    const customerToken = String(verifyBasic.body?.token || '');
    const customerCsrfToken = String(verifyBasic.body?.csrfToken || '');
    const customerId = Number(verifyBasic.body?.user?.id || 0);
    assert(verifyBasic.status === 200 && customerToken && customerCsrfToken && customerId > 0, 'week16 activity verify-basic failed', verifyBasic);
    const customerRow = (getState().users || []).find((row) => Number(row.id || 0) === customerId);
    assert(customerRow, 'week16 activity customer row missing after login', { customerId });
    customerRow.ownerUserId = Number(pilotActor.actorId || 0);
    customerRow.tenantId = tenantId;
    customerRow.orgId = Number(pilotActor.orgId || customerRow.orgId || 0);
    customerRow.teamId = Number(pilotActor.teamId || customerRow.teamId || 0);

    const { activityId: defaultActivityId } = await createViaGateway(`Week16-activity-v1-${Date.now()}`, 'week16-activity-admin-create-v1', 'v1-monolith');

    const defaultRead = await requestJson(gateway.base, '/api/activities', {
      headers: buildGatewayHeaders({
        tenantId,
        tenantCode: 'tenant-alpha',
        traceId: 'week16-activity-default-read-v1',
        authHeaders: { authorization: `Bearer ${customerToken}` },
      }),
    });
    checks.push(buildCheck('activity.default.read.v1', defaultRead, defaultRead.status === 200 && defaultRead.headers['x-gateway-target-service'] === 'v1-monolith'));
    assert(defaultRead.status === 200, 'activity default read failed', defaultRead);

    const pointsBeforeDefault = await requestJson(gateway.base, '/api/points/summary', {
      headers: buildGatewayHeaders({
        tenantId,
        tenantCode: 'tenant-alpha',
        traceId: 'week16-activity-points-before-default',
        authHeaders: { authorization: `Bearer ${customerToken}` },
      }),
    });
    assert(pointsBeforeDefault.status === 200, 'week16 points before default complete failed', pointsBeforeDefault);
    const balanceBeforeDefault = Number(pointsBeforeDefault.body?.balance || 0);

    const defaultComplete = await requestJson(gateway.base, `/api/activities/${defaultActivityId}/complete`, {
      method: 'POST',
      headers: buildGatewayHeaders({
        tenantId,
        tenantCode: 'tenant-alpha',
        traceId: 'week16-activity-complete-v1',
        authHeaders: {
          authorization: `Bearer ${customerToken}`,
          'x-csrf-token': customerCsrfToken,
        },
      }),
    });
    checks.push(buildCheck('activity.default.complete.v1', defaultComplete, defaultComplete.status === 200 && defaultComplete.headers['x-gateway-target-service'] === 'v1-monolith', { activityId: defaultActivityId }));
    assert(defaultComplete.status === 200, 'activity default complete failed', defaultComplete);

    const pointsAfterDefault = await requestJson(gateway.base, '/api/points/summary', {
      headers: buildGatewayHeaders({
        tenantId,
        tenantCode: 'tenant-alpha',
        traceId: 'week16-activity-points-after-default',
        authHeaders: { authorization: `Bearer ${customerToken}` },
      }),
    });
    assert(pointsAfterDefault.status === 200, 'week16 points after default complete failed', pointsAfterDefault);
    assert(Number(pointsAfterDefault.body?.balance || 0) > balanceBeforeDefault, 'default complete did not increase points', {
      pointsBeforeDefault,
      pointsAfterDefault,
    });

    process.env.GATEWAY_ENABLE_ACTIVITY_SERVICE = 'true';

    const { activityId: v2ActivityId, rewardPoints: v2RewardPoints, response: createV2 } = await createViaGateway(
      `Week16-activity-v2-${Date.now()}`,
      'week16-activity-admin-create-v2',
      'activity-service',
    );
    checks.push(buildCheck('activity.cutover.admin.create.v2', createV2, createV2.status === 200 && createV2.headers['x-gateway-target-service'] === 'activity-service', {
      activityId: v2ActivityId,
    }));

    const cutoverRead = await requestJson(gateway.base, '/api/activities', {
      headers: buildGatewayHeaders({
        tenantId,
        tenantCode: 'tenant-alpha',
        traceId: 'week16-activity-cutover-read-v2',
        authHeaders: { authorization: `Bearer ${customerToken}` },
      }),
    });
    const visibleActivities = Array.isArray(cutoverRead.body?.activities) ? cutoverRead.body.activities : [];
    checks.push(buildCheck('activity.cutover.read.v2', cutoverRead, cutoverRead.status === 200 && cutoverRead.headers['x-gateway-target-service'] === 'activity-service' && visibleActivities.some((row) => Number(row?.id || 0) === v2ActivityId), {
      activityId: v2ActivityId,
      visibleCount: visibleActivities.length,
    }));
    assert(cutoverRead.status === 200, 'activity cutover read failed', cutoverRead);

    const pointsBeforeV2 = await requestJson(gateway.base, '/api/points/summary', {
      headers: buildGatewayHeaders({
        tenantId,
        tenantCode: 'tenant-alpha',
        traceId: 'week16-activity-points-before-v2',
        authHeaders: { authorization: `Bearer ${customerToken}` },
      }),
    });
    assert(pointsBeforeV2.status === 200, 'week16 points before v2 complete failed', pointsBeforeV2);
    const balanceBeforeV2 = Number(pointsBeforeV2.body?.balance || 0);

    const completeV2 = await requestJson(gateway.base, `/api/activities/${v2ActivityId}/complete`, {
      method: 'POST',
      headers: buildGatewayHeaders({
        tenantId,
        tenantCode: 'tenant-alpha',
        traceId: 'week16-activity-complete-v2',
        authHeaders: {
          authorization: `Bearer ${customerToken}`,
          'x-csrf-token': customerCsrfToken,
        },
      }),
    });
    checks.push(buildCheck('activity.complete.v2', completeV2, completeV2.status === 200 && completeV2.headers['x-gateway-target-service'] === 'activity-service', {
      activityId: v2ActivityId,
    }));
    assert(completeV2.status === 200, 'activity complete v2 failed', completeV2);

    const pointsAfterV2 = await requestJson(gateway.base, '/api/points/summary', {
      headers: buildGatewayHeaders({
        tenantId,
        tenantCode: 'tenant-alpha',
        traceId: 'week16-activity-points-after-v2',
        authHeaders: { authorization: `Bearer ${customerToken}` },
      }),
    });
    const rewardDelta = Number(pointsAfterV2.body?.balance || 0) - balanceBeforeV2;
    checks.push(buildCheck('activity.reward.points-summary-updated', pointsAfterV2, pointsAfterV2.status === 200 && rewardDelta === v2RewardPoints, {
      rewardDelta,
      expectedReward: v2RewardPoints,
    }));
    assert(pointsAfterV2.status === 200 && rewardDelta === v2RewardPoints, 'week16 points summary did not reflect activity reward', {
      pointsBeforeV2,
      pointsAfterV2,
      rewardDelta,
      expectedReward: v2RewardPoints,
    });

    const pointsObservability = await requestJson(pointsService.base, '/internal/points-service/observability');
    const rewardLog = findRecentPointsLog(pointsObservability.body, 'week16-activity-complete-v2');
    checks.push(buildCheck('activity.reward.points-observability', pointsObservability, pointsObservability.status === 200 && Boolean(rewardLog), {
      activityRewardSuccess: Number(pointsObservability.body?.metrics?.activityReward?.success || 0),
    }));
    assert(rewardLog, 'week16 points observability missing activity reward trace', { pointsObservability });

    const gatewayMetricsAfterV2 = await requestJson(gateway.base, '/internal/gateway/metrics');
    const gatewayV2CompleteEntry = findRecentGatewayEntry(gatewayMetricsAfterV2.body, 'week16-activity-complete-v2');
    checks.push(buildCheck('activity.complete.gateway-metrics.v2', gatewayMetricsAfterV2, gatewayMetricsAfterV2.status === 200 && gatewayV2CompleteEntry?.target_service === 'activity-service', {
      fallbackCount: Number(gatewayV2CompleteEntry?.fallback_count || 0),
    }));
    assert(gatewayV2CompleteEntry, 'week16 gateway metrics missing v2 complete trace', { gatewayMetricsAfterV2 });

    process.env.GATEWAY_FORCE_V1_PATHS = '/api/activities,/api/p/activities,/api/b/activity-configs';
    const { activityId: forceV1ActivityId } = await createViaGateway(`Week16-activity-force-v1-${Date.now()}`, 'week16-activity-admin-create-force-v1', 'v1-monolith');
    const forceV1Complete = await requestJson(gateway.base, `/api/activities/${forceV1ActivityId}/complete`, {
      method: 'POST',
      headers: buildGatewayHeaders({
        tenantId,
        tenantCode: 'tenant-alpha',
        traceId: 'week16-activity-complete-force-v1',
        authHeaders: {
          authorization: `Bearer ${customerToken}`,
          'x-csrf-token': customerCsrfToken,
        },
      }),
    });
    checks.push(buildCheck('activity.complete.force-v1.rollback', forceV1Complete, forceV1Complete.status === 200 && forceV1Complete.headers['x-gateway-target-service'] === 'v1-monolith', { activityId: forceV1ActivityId }));
    assert(forceV1Complete.status === 200, 'week16 activity force-v1 failed', forceV1Complete);

    process.env.GATEWAY_FORCE_V1_PATHS = '';
    const { activityId: backV2ActivityId } = await createViaGateway(`Week16-activity-back-v2-${Date.now()}`, 'week16-activity-admin-create-back-v2', 'activity-service');
    const backToV2 = await requestJson(gateway.base, `/api/activities/${backV2ActivityId}/complete`, {
      method: 'POST',
      headers: buildGatewayHeaders({
        tenantId,
        tenantCode: 'tenant-alpha',
        traceId: 'week16-activity-complete-back-v2',
        authHeaders: {
          authorization: `Bearer ${customerToken}`,
          'x-csrf-token': customerCsrfToken,
        },
      }),
    });
    checks.push(buildCheck('activity.complete.back-to-v2', backToV2, backToV2.status === 200 && backToV2.headers['x-gateway-target-service'] === 'activity-service', { activityId: backV2ActivityId }));
    assert(backToV2.status === 200, 'week16 activity back-to-v2 failed', backToV2);

    const { activityId: rollbackActivityId } = await createViaGateway(`Week16-activity-manual-rollback-${Date.now()}`, 'week16-activity-admin-create-manual-rollback', 'activity-service');
    process.env.GATEWAY_ACTIVITY_SERVICE_URL = 'http://127.0.0.1:9';

    const readFallback = await requestJson(gateway.base, '/api/activities', {
      headers: buildGatewayHeaders({
        tenantId,
        tenantCode: 'tenant-alpha',
        traceId: 'week16-activity-read-fallback',
        authHeaders: { authorization: `Bearer ${customerToken}` },
      }),
    });
    checks.push(buildCheck('activity.read.fallback.v1', readFallback, readFallback.status === 200 && readFallback.headers['x-gateway-target-service'] === 'v1-monolith'));
    assert(readFallback.status === 200, 'week16 activity read fallback failed', readFallback);

    const writeNoAutoFallback = await requestJson(gateway.base, `/api/activities/${rollbackActivityId}/complete`, {
      method: 'POST',
      headers: buildGatewayHeaders({
        tenantId,
        tenantCode: 'tenant-alpha',
        traceId: 'week16-activity-complete-no-auto-fallback',
        authHeaders: {
          authorization: `Bearer ${customerToken}`,
          'x-csrf-token': customerCsrfToken,
        },
      }),
    });
    checks.push(buildCheck('activity.complete.no-auto-fallback', writeNoAutoFallback, writeNoAutoFallback.status === 502 && writeNoAutoFallback.body?.code === 'GATEWAY_UPSTREAM_UNAVAILABLE', { activityId: rollbackActivityId }));
    assert(writeNoAutoFallback.status === 502, 'week16 activity write path should not auto fallback', writeNoAutoFallback);

    process.env.GATEWAY_FORCE_V1_PATHS = '/api/activities,/api/p/activities,/api/b/activity-configs';
    const manualRollback = await requestJson(gateway.base, `/api/activities/${rollbackActivityId}/complete`, {
      method: 'POST',
      headers: buildGatewayHeaders({
        tenantId,
        tenantCode: 'tenant-alpha',
        traceId: 'week16-activity-complete-manual-rollback',
        authHeaders: {
          authorization: `Bearer ${customerToken}`,
          'x-csrf-token': customerCsrfToken,
        },
      }),
    });
    checks.push(buildCheck('activity.complete.manual-rollback.v1', manualRollback, manualRollback.status === 200 && manualRollback.headers['x-gateway-target-service'] === 'v1-monolith', { activityId: rollbackActivityId }));
    assert(manualRollback.status === 200, 'week16 activity manual rollback failed', manualRollback);

    const gatewayMetricsAfterManualRollback = await requestJson(gateway.base, '/internal/gateway/metrics');
    const gatewayFallbackEntry = findRecentGatewayEntry(gatewayMetricsAfterManualRollback.body, 'week16-activity-read-fallback');
    checks.push(buildCheck('activity.gateway-metrics.read-fallback', gatewayMetricsAfterManualRollback, gatewayMetricsAfterManualRollback.status === 200 && Number(gatewayFallbackEntry?.fallback_count || 0) >= 1, {
      fallbackCount: Number(gatewayFallbackEntry?.fallback_count || 0),
    }));

    const criteria = {
      defaultActivityTrafficOnV1: checks.some((item) => item.name === 'activity.default.read.v1' && item.ok) && checks.some((item) => item.name === 'activity.default.complete.v1' && item.ok),
      activityCutoverToV2: checks.some((item) => item.name === 'activity.cutover.read.v2' && item.ok) && checks.some((item) => item.name === 'activity.complete.v2' && item.ok),
      activityRewardChainWorks: checks.some((item) => item.name === 'activity.reward.points-summary-updated' && item.ok) && checks.some((item) => item.name === 'activity.reward.points-observability' && item.ok),
      forceV1RollbackWorks: checks.some((item) => item.name === 'activity.complete.force-v1.rollback' && item.ok),
      backToV2Works: checks.some((item) => item.name === 'activity.complete.back-to-v2' && item.ok),
      readFallbackWorks: checks.some((item) => item.name === 'activity.read.fallback.v1' && item.ok),
      writeNoAutoFallbackConfirmed: checks.some((item) => item.name === 'activity.complete.no-auto-fallback' && item.ok),
      manualWriteRollbackWorks: checks.some((item) => item.name === 'activity.complete.manual-rollback.v1' && item.ok),
      gatewayMetricsCoverComplete: checks.some((item) => item.name === 'activity.complete.gateway-metrics.v2' && item.ok),
      pointsObservabilityCoverReward: checks.some((item) => item.name === 'activity.reward.points-observability' && item.ok),
    };

    const report = {
      ok: checks.every((item) => item.ok) && Object.values(criteria).every(Boolean),
      executedAt: new Date().toISOString(),
      gatewayBase: gateway.base,
      activityServiceBase: activityService.base,
      userServiceBase: userService.base,
      pointsServiceBase: pointsService.base,
      checks,
      criteria,
    };
    const outputs = writeReports(report);
    report.reports = outputs;

    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) process.exit(1);
  } finally {
    if (gateway?.server) await closeServer(gateway.server);
    if (activityService?.server) await closeServer(activityService.server);
    if (pointsService?.server) await closeServer(pointsService.server);
    if (userService?.server) await closeServer(userService.server);
    if (monolith?.server) await closeServer(monolith.server);

    Object.entries(previousEnv).forEach(([key, value]) => {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    });

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
