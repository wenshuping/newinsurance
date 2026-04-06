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
  if (!server) return;
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

function pickLearningPilotActor(state) {
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
    '# Week18 Learning 正式拆出联调报告',
    '',
    `- 时间：${report.executedAt}`,
    `- 结果：${report.ok ? 'PASS' : 'FAIL'}`,
    `- gateway：${report.gatewayBase}`,
    `- learning-service：${report.learningServiceBase}`,
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
    `- default learning reads on v1: ${report.criteria.defaultLearningReadsOnV1 ? 'PASS' : 'FAIL'}`,
    `- formal split reads on v2: ${report.criteria.formalSplitReadsOnV2 ? 'PASS' : 'FAIL'}`,
    `- learning complete cutover to v2: ${report.criteria.completeCutoverToV2 ? 'PASS' : 'FAIL'}`,
    `- complete reward chain via points: ${report.criteria.completeRewardChainWorks ? 'PASS' : 'FAIL'}`,
    `- force-v1 rollback works: ${report.criteria.forceV1RollbackWorks ? 'PASS' : 'FAIL'}`,
    `- back-to-v2 works: ${report.criteria.backToV2Works ? 'PASS' : 'FAIL'}`,
    `- read fallback works: ${report.criteria.readFallbackWorks ? 'PASS' : 'FAIL'}`,
    `- write path requires manual rollback: ${report.criteria.writeNoAutoFallbackConfirmed ? 'PASS' : 'FAIL'}`,
    `- manual rollback for write works: ${report.criteria.manualWriteRollbackWorks ? 'PASS' : 'FAIL'}`,
    `- gateway metrics cover reads and complete: ${report.criteria.gatewayMetricsCoverLearning ? 'PASS' : 'FAIL'}`,
    `- points observability covers reward: ${report.criteria.pointsObservabilityCoverReward ? 'PASS' : 'FAIL'}`,
  );

  return `${lines.join('\n')}\n`;
}

function writeReports(report) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const stamp = nowStamp();
  const jsonPath = path.join(REPORT_DIR, `week18-learning-formal-split-${stamp}.json`);
  const mdPath = path.join(REPORT_DIR, `week18-learning-formal-split-${stamp}.md`);
  const latestJsonPath = path.join(REPORT_DIR, 'week18-learning-formal-split-latest.json');
  const latestMdPath = path.join(REPORT_DIR, 'week18-learning-formal-split-latest.md');
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

async function assertGatewayReadRoute(checks, gatewayBase, pathname, expectedTarget, name, headers) {
  const response = await requestJson(gatewayBase, pathname, { headers });
  checks.push(buildCheck(name, response, response.status === 200 && response.headers['x-gateway-target-service'] === expectedTarget));
  assert(response.status === 200, `${name} failed`, response);
  return response;
}

async function main() {
    const previousEnv = {
    GATEWAY_V1_BASE_URL: process.env.GATEWAY_V1_BASE_URL,
    GATEWAY_USER_SERVICE_URL: process.env.GATEWAY_USER_SERVICE_URL,
    GATEWAY_POINTS_SERVICE_URL: process.env.GATEWAY_POINTS_SERVICE_URL,
    GATEWAY_LEARNING_SERVICE_URL: process.env.GATEWAY_LEARNING_SERVICE_URL,
    GATEWAY_ENABLE_V2: process.env.GATEWAY_ENABLE_V2,
    GATEWAY_ENABLE_V1_FALLBACK: process.env.GATEWAY_ENABLE_V1_FALLBACK,
    GATEWAY_READY_TIMEOUT_MS: process.env.GATEWAY_READY_TIMEOUT_MS,
    GATEWAY_FORCE_V1: process.env.GATEWAY_FORCE_V1,
    GATEWAY_FORCE_V1_PATHS: process.env.GATEWAY_FORCE_V1_PATHS,
    GATEWAY_FORCE_V2_PATHS: process.env.GATEWAY_FORCE_V2_PATHS,
      GATEWAY_V2_TENANTS: process.env.GATEWAY_V2_TENANTS,
      GATEWAY_ENABLE_LEARNING_SERVICE: process.env.GATEWAY_ENABLE_LEARNING_SERVICE,
      LEARNING_POINTS_SERVICE_URL: process.env.LEARNING_POINTS_SERVICE_URL,
      LEARNING_SERVICE_BASE_URL: process.env.LEARNING_SERVICE_BASE_URL,
    };

  const [
    { closeState, createActorSession, getState, initializeState, resolveSessionFromBearer },
    { createSkeletonApp },
    { createGatewayApp },
    { createUserServiceApp },
    { createPointsServiceApp },
    { createLearningServiceApp },
  ] = await Promise.all([
    import('../server/skeleton-c-v1/common/state.mjs'),
    import('../server/skeleton-c-v1/app.mjs'),
    import('../server/microservices/gateway/app.mjs'),
    import('../server/microservices/user-service/app.mjs'),
    import('../server/microservices/points-service/app.mjs'),
    import('../server/microservices/learning-service/app.mjs'),
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
  const learningService = await listen(createLearningServiceApp());

  process.env.GATEWAY_V1_BASE_URL = monolith.base;
  process.env.GATEWAY_USER_SERVICE_URL = userService.base;
  process.env.GATEWAY_POINTS_SERVICE_URL = pointsService.base;
  process.env.GATEWAY_LEARNING_SERVICE_URL = learningService.base;
  process.env.LEARNING_POINTS_SERVICE_URL = pointsService.base;
  process.env.GATEWAY_ENABLE_V2 = 'true';
  process.env.GATEWAY_ENABLE_V1_FALLBACK = 'true';
  process.env.GATEWAY_READY_TIMEOUT_MS = '7000';
  process.env.GATEWAY_FORCE_V1 = 'false';
  process.env.GATEWAY_FORCE_V1_PATHS = '';
  process.env.GATEWAY_FORCE_V2_PATHS = '';
  process.env.GATEWAY_V2_TENANTS = 'tenant-alpha';
  process.env.GATEWAY_ENABLE_LEARNING_SERVICE = 'false';
  process.env.LEARNING_SERVICE_BASE_URL = learningService.base;

  const gateway = await listen(createGatewayApp());
  const createdCourseIds = [];

  try {
    const monolithReady = await waitForReady(monolith.base, '/api/health');
    assert(monolithReady?.status === 200, 'week18 monolith health failed', monolithReady);
    const userReady = await waitForReady(userService.base, '/ready');
    assert(userReady?.status === 200, 'week18 user-service ready failed', userReady);
    const pointsReady = await waitForReady(pointsService.base, '/ready');
    assert(pointsReady?.status === 200, 'week18 points-service ready failed', pointsReady);
    const learningReady = await waitForReady(learningService.base, '/ready');
    assert(learningReady?.status === 200, 'week18 learning-service ready failed', learningReady);
    const gatewayReady = await waitForReady(gateway.base, '/ready');
    assert(gatewayReady?.status === 200, 'week18 gateway ready failed', gatewayReady);

    const checks = [];
    const pilotActor = pickLearningPilotActor(getState());
    assert(pilotActor, 'missing learning pilot actor');
    const tenantId = Number(pilotActor.tenantId || 1);
    const adminToken = createActorSession(pilotActor);
    const adminSession = resolveSessionFromBearer(`Bearer ${adminToken}`);
    const adminCsrfToken = String(adminSession?.csrfToken || '');
    assert(adminToken && adminCsrfToken, 'failed to create learning pilot admin session', { adminSession, pilotActor });

    const routes = await requestJson(gateway.base, '/internal/gateway/routes');
    const learningRouteOwner = Array.isArray(routes.body?.routeMap)
      ? routes.body.routeMap.find((item) => item?.service === 'learning-service')
      : null;
    const routeList = Array.isArray(learningRouteOwner?.routes) ? learningRouteOwner.routes : [];
    checks.push(
      buildCheck(
        'learning.routes.registered.week18',
        routes,
        routes.status === 200
          && routeList.includes('/api/learning/courses')
          && routeList.includes('/api/learning/games')
          && routeList.includes('/api/learning/tools')
          && routeList.includes('/api/learning/courses/:id')
          && routeList.includes('/api/learning/courses/:id/complete'),
        { routeCount: routeList.length },
      ),
    );
    assert(routes.status === 200, 'gateway route list failed', routes);

    await assertGatewayReadRoute(
      checks,
      gateway.base,
      '/api/learning/courses',
      'v1-monolith',
      'learning.default.courses.v1',
      buildGatewayHeaders({ tenantId, tenantCode: 'tenant-alpha', traceId: 'week18-learning-default-courses-v1' }),
    );
    await assertGatewayReadRoute(
      checks,
      gateway.base,
      '/api/learning/games',
      'v1-monolith',
      'learning.default.games.v1',
      buildGatewayHeaders({ tenantId, tenantCode: 'tenant-alpha', traceId: 'week18-learning-default-games-v1' }),
    );
    await assertGatewayReadRoute(
      checks,
      gateway.base,
      '/api/learning/tools',
      'v1-monolith',
      'learning.default.tools.v1',
      buildGatewayHeaders({ tenantId, tenantCode: 'tenant-alpha', traceId: 'week18-learning-default-tools-v1' }),
    );

    process.env.GATEWAY_ENABLE_LEARNING_SERVICE = 'true';

    await assertGatewayReadRoute(
      checks,
      gateway.base,
      '/api/learning/courses',
      'learning-service',
      'learning.cutover.courses.v2',
      buildGatewayHeaders({ tenantId, tenantCode: 'tenant-alpha', traceId: 'week18-learning-cutover-courses-v2' }),
    );
    const cutoverGames = await assertGatewayReadRoute(
      checks,
      gateway.base,
      '/api/learning/games',
      'learning-service',
      'learning.cutover.games.v2',
      buildGatewayHeaders({ tenantId, tenantCode: 'tenant-alpha', traceId: 'week18-learning-cutover-games-v2' }),
    );
    assert(Array.isArray(cutoverGames.body?.games), 'learning cutover games payload drifted', { cutoverGames });
    const cutoverTools = await assertGatewayReadRoute(
      checks,
      gateway.base,
      '/api/learning/tools',
      'learning-service',
      'learning.cutover.tools.v2',
      buildGatewayHeaders({ tenantId, tenantCode: 'tenant-alpha', traceId: 'week18-learning-cutover-tools-v2' }),
    );
    assert(Array.isArray(cutoverTools.body?.tools), 'learning cutover tools payload drifted', { cutoverTools });

    const createCourse = async (title, traceId) => {
      const response = await requestJson(gateway.base, '/api/p/learning/courses', {
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
          category: 'Week18联调',
          contentType: 'article',
          rewardPoints: 16,
          content: `week18 runtime split ${title}`,
          status: 'published',
        },
      });
      assert(response.status === 200, 'learning admin create failed', { response, traceId });
      const id = Number(response.body?.course?.id || 0);
      assert(id > 0, 'created learning course missing id', { response, traceId });
      createdCourseIds.push(id);
      return { response, id };
    };

    const mobile = generateMobile();
    const sendCode = await requestJson(gateway.base, '/api/auth/send-code', {
      method: 'POST',
      headers: buildGatewayHeaders({ tenantId, tenantCode: 'tenant-alpha', traceId: 'week18-learning-user-send-code' }),
      body: { mobile },
    });
    assert(sendCode.status === 200, 'week18 learning send-code failed', sendCode);

    const verifyBasic = await requestJson(gateway.base, '/api/auth/verify-basic', {
      method: 'POST',
      headers: buildGatewayHeaders({ tenantId, tenantCode: 'tenant-alpha', traceId: 'week18-learning-user-login' }),
      body: {
        name: '张三',
        mobile,
        code: String(sendCode.body?.dev_code || '123456'),
        tenantId,
      },
    });
    const customerToken = String(verifyBasic.body?.token || '');
    const customerCsrfToken = String(verifyBasic.body?.csrfToken || '');
    const customerId = Number(verifyBasic.body?.user?.id || 0);
    assert(verifyBasic.status === 200 && customerToken && customerCsrfToken && customerId > 0, 'week18 learning verify-basic failed', verifyBasic);
    const customerRow = (getState().users || []).find((row) => Number(row.id || 0) === customerId);
    assert(customerRow, 'week18 learning customer row missing after login', { customerId });
    customerRow.ownerUserId = Number(pilotActor.actorId || 0);
    customerRow.tenantId = tenantId;
    customerRow.orgId = Number(pilotActor.orgId || customerRow.orgId || 0);
    customerRow.teamId = Number(pilotActor.teamId || customerRow.teamId || 0);

    const { id: courseV2Id } = await createCourse(`Week18-learning-v2-${Date.now()}`, 'week18-learning-admin-create-v2');

    const customerCourses = await requestJson(gateway.base, '/api/learning/courses', {
      headers: buildGatewayHeaders({
        tenantId,
        tenantCode: 'tenant-alpha',
        traceId: 'week18-learning-user-list',
        authHeaders: {
          authorization: `Bearer ${customerToken}`,
          'x-csrf-token': customerCsrfToken,
        },
      }),
    });
    const visibleCourses = Array.isArray(customerCourses.body?.courses) ? customerCourses.body.courses : [];
    const visibleV2Course = visibleCourses.find((course) => Number(course?.id || 0) === courseV2Id);
    checks.push(buildCheck('learning.customer.list.v2', customerCourses, customerCourses.status === 200 && Boolean(visibleV2Course) && customerCourses.headers['x-gateway-target-service'] === 'learning-service', {
      visibleCourseCount: visibleCourses.length,
      courseId: courseV2Id,
    }));
    assert(visibleV2Course, 'week18 created course is not visible to assigned customer', { courseV2Id, visibleCourses });

    const courseDetail = await requestJson(gateway.base, `/api/learning/courses/${courseV2Id}`, {
      headers: buildGatewayHeaders({
        tenantId,
        tenantCode: 'tenant-alpha',
        traceId: 'week18-learning-user-detail',
        authHeaders: { authorization: `Bearer ${customerToken}` },
      }),
    });
    checks.push(buildCheck('learning.customer.detail.v2', courseDetail, courseDetail.status === 200 && Number(courseDetail.body?.course?.id || 0) === courseV2Id && courseDetail.headers['x-gateway-target-service'] === 'learning-service', { courseId: courseV2Id }));
    assert(courseDetail.status === 200, 'week18 customer detail failed', courseDetail);

    const pointsBefore = await requestJson(gateway.base, '/api/points/summary', {
      headers: buildGatewayHeaders({
        tenantId,
        tenantCode: 'tenant-alpha',
        traceId: 'week18-learning-points-before',
        authHeaders: { authorization: `Bearer ${customerToken}` },
      }),
    });
    assert(pointsBefore.status === 200, 'week18 points summary before complete failed', pointsBefore);
    const balanceBefore = Number(pointsBefore.body?.balance || 0);

    const completeV2 = await requestJson(gateway.base, `/api/learning/courses/${courseV2Id}/complete`, {
      method: 'POST',
      headers: buildGatewayHeaders({
        tenantId,
        tenantCode: 'tenant-alpha',
        traceId: 'week18-learning-complete-v2',
        authHeaders: {
          authorization: `Bearer ${customerToken}`,
          'x-csrf-token': customerCsrfToken,
        },
      }),
    });
    checks.push(buildCheck('learning.complete.v2', completeV2, completeV2.status === 200 && completeV2.headers['x-gateway-target-service'] === 'learning-service' && completeV2.body?.duplicated === false, { courseId: courseV2Id }));
    assert(completeV2.status === 200, 'week18 learning complete v2 failed', completeV2);

    const pointsAfter = await requestJson(gateway.base, '/api/points/summary', {
      headers: buildGatewayHeaders({
        tenantId,
        tenantCode: 'tenant-alpha',
        traceId: 'week18-learning-points-after',
        authHeaders: { authorization: `Bearer ${customerToken}` },
      }),
    });
    const rewardDelta = Number(pointsAfter.body?.balance || 0) - balanceBefore;
    checks.push(buildCheck('learning.reward.points-summary-updated', pointsAfter, pointsAfter.status === 200 && rewardDelta === 16, { rewardDelta }));
    assert(pointsAfter.status === 200 && rewardDelta === 16, 'week18 points summary did not reflect learning reward', { pointsBefore, pointsAfter, rewardDelta });

    const pointsObservability = await requestJson(pointsService.base, '/internal/points-service/observability');
    const pointsLogs = Array.isArray(pointsObservability.body?.recentLogs) ? pointsObservability.body.recentLogs : [];
    const rewardLog = pointsLogs.find((row) => String(row?.route || '') === 'INTERNAL learning->points reward settlement' && String(row?.trace_id || '') === 'week18-learning-complete-v2' && String(row?.result || '') === 'success');
    checks.push(buildCheck('learning.reward.points-observability', pointsObservability, pointsObservability.status === 200 && Boolean(rewardLog), {
      learningRewardSuccess: Number(pointsObservability.body?.metrics?.learningReward?.success || 0),
    }));
    assert(rewardLog, 'week18 points observability missing learning reward trace', { pointsObservability });

    const gatewayMetricsAfterV2 = await requestJson(gateway.base, '/internal/gateway/metrics');
    const gatewayV2CompleteEntry = findRecentGatewayEntry(gatewayMetricsAfterV2.body, 'week18-learning-complete-v2');
    const gatewayV2GamesEntry = findRecentGatewayEntry(gatewayMetricsAfterV2.body, 'week18-learning-cutover-games-v2');
    checks.push(buildCheck('learning.gateway-metrics.v2', gatewayMetricsAfterV2, gatewayMetricsAfterV2.status === 200 && gatewayV2CompleteEntry?.target_service === 'learning-service' && gatewayV2GamesEntry?.target_service === 'learning-service', {
      completeFallbackCount: Number(gatewayV2CompleteEntry?.fallback_count || 0),
      gamesFallbackCount: Number(gatewayV2GamesEntry?.fallback_count || 0),
    }));
    assert(gatewayV2CompleteEntry, 'week18 gateway metrics missing v2 complete trace', { gatewayMetricsAfterV2 });
    assert(gatewayV2GamesEntry, 'week18 gateway metrics missing v2 games trace', { gatewayMetricsAfterV2 });

    process.env.GATEWAY_FORCE_V1_PATHS = '/api/learning/courses';
    const { id: courseForceV1Id } = await createCourse(`Week18-learning-force-v1-${Date.now()}`, 'week18-learning-admin-create-force-v1');
    const completeForceV1 = await requestJson(gateway.base, `/api/learning/courses/${courseForceV1Id}/complete`, {
      method: 'POST',
      headers: buildGatewayHeaders({
        tenantId,
        tenantCode: 'tenant-alpha',
        traceId: 'week18-learning-complete-force-v1',
        authHeaders: {
          authorization: `Bearer ${customerToken}`,
          'x-csrf-token': customerCsrfToken,
        },
      }),
    });
    checks.push(buildCheck('learning.complete.force-v1.rollback', completeForceV1, completeForceV1.status === 200 && completeForceV1.headers['x-gateway-target-service'] === 'v1-monolith', { courseId: courseForceV1Id }));
    assert(completeForceV1.status === 200, 'week18 learning complete force-v1 failed', completeForceV1);

    const pointsObservabilityAfterForceV1 = await requestJson(pointsService.base, '/internal/points-service/observability');
    const pointsLogsAfterForceV1 = Array.isArray(pointsObservabilityAfterForceV1.body?.recentLogs)
      ? pointsObservabilityAfterForceV1.body.recentLogs
      : [];
    const forceV1RewardLog = pointsLogsAfterForceV1.find(
      (row) => String(row?.route || '') === 'INTERNAL learning->points reward settlement'
        && String(row?.trace_id || '') === 'week18-learning-complete-force-v1'
        && String(row?.result || '') === 'success',
    );
    checks.push(
      buildCheck(
        'learning.reward.points-observability.force-v1',
        pointsObservabilityAfterForceV1,
        pointsObservabilityAfterForceV1.status === 200 && Boolean(forceV1RewardLog),
      ),
    );
    assert(forceV1RewardLog, 'week18 force-v1 complete did not use points-service reward contract', {
      pointsObservabilityAfterForceV1,
    });

    process.env.GATEWAY_FORCE_V1_PATHS = '';
    const { id: courseBackV2Id } = await createCourse(`Week18-learning-back-v2-${Date.now()}`, 'week18-learning-admin-create-back-v2');
    const completeBackV2 = await requestJson(gateway.base, `/api/learning/courses/${courseBackV2Id}/complete`, {
      method: 'POST',
      headers: buildGatewayHeaders({
        tenantId,
        tenantCode: 'tenant-alpha',
        traceId: 'week18-learning-complete-back-v2',
        authHeaders: {
          authorization: `Bearer ${customerToken}`,
          'x-csrf-token': customerCsrfToken,
        },
      }),
    });
    checks.push(buildCheck('learning.complete.back-to-v2', completeBackV2, completeBackV2.status === 200 && completeBackV2.headers['x-gateway-target-service'] === 'learning-service', { courseId: courseBackV2Id }));
    assert(completeBackV2.status === 200, 'week18 learning complete back-to-v2 failed', completeBackV2);

    const { id: courseManualRollbackId } = await createCourse(`Week18-learning-write-rollback-${Date.now()}`, 'week18-learning-admin-create-manual-rollback');
    process.env.GATEWAY_LEARNING_SERVICE_URL = 'http://127.0.0.1:9';

    const readFallback = await requestJson(gateway.base, '/api/learning/games', {
      headers: buildGatewayHeaders({ tenantId, tenantCode: 'tenant-alpha', traceId: 'week18-learning-games-read-fallback' }),
    });
    checks.push(buildCheck('learning.read.games.fallback.v1', readFallback, readFallback.status === 200 && readFallback.headers['x-gateway-target-service'] === 'v1-monolith'));
    assert(readFallback.status === 200, 'week18 learning games read fallback failed', readFallback);

    const writeNoAutoFallback = await requestJson(gateway.base, `/api/learning/courses/${courseManualRollbackId}/complete`, {
      method: 'POST',
      headers: buildGatewayHeaders({
        tenantId,
        tenantCode: 'tenant-alpha',
        traceId: 'week18-learning-complete-no-auto-fallback',
        authHeaders: {
          authorization: `Bearer ${customerToken}`,
          'x-csrf-token': customerCsrfToken,
        },
      }),
    });
    checks.push(buildCheck('learning.complete.no-auto-fallback', writeNoAutoFallback, writeNoAutoFallback.status === 502 && writeNoAutoFallback.body?.code === 'GATEWAY_UPSTREAM_UNAVAILABLE', { courseId: courseManualRollbackId }));
    assert(writeNoAutoFallback.status === 502, 'week18 learning write path should not auto fallback', writeNoAutoFallback);

    const gatewayMetricsAfterFallback = await requestJson(gateway.base, '/internal/gateway/metrics');
    const readFallbackEntry = findRecentGatewayEntry(gatewayMetricsAfterFallback.body, 'week18-learning-games-read-fallback');
    const forceV1Entry = findRecentGatewayEntry(gatewayMetricsAfterFallback.body, 'week18-learning-complete-force-v1');
    checks.push(buildCheck('learning.gateway-metrics.rollback', gatewayMetricsAfterFallback, gatewayMetricsAfterFallback.status === 200 && forceV1Entry?.target_service === 'v1-monolith' && readFallbackEntry?.fallback_count === 1, {
      readFallbackCount: Number(readFallbackEntry?.fallback_count || 0),
      forceV1Target: forceV1Entry?.target_service || null,
    }));
    assert(readFallbackEntry, 'week18 gateway metrics missing read fallback trace', { gatewayMetricsAfterFallback });
    assert(forceV1Entry, 'week18 gateway metrics missing force-v1 trace', { gatewayMetricsAfterFallback });

    process.env.GATEWAY_LEARNING_SERVICE_URL = learningService.base;
    process.env.GATEWAY_FORCE_V1_PATHS = '';

    const report = {
      ok: checks.every((item) => item.ok),
      executedAt: new Date().toISOString(),
      gatewayBase: gateway.base,
      learningServiceBase: learningService.base,
      userServiceBase: userService.base,
      pointsServiceBase: pointsService.base,
      checks,
      criteria: {
        defaultLearningReadsOnV1:
          checks.some((item) => item.name === 'learning.default.courses.v1' && item.ok)
          && checks.some((item) => item.name === 'learning.default.games.v1' && item.ok)
          && checks.some((item) => item.name === 'learning.default.tools.v1' && item.ok),
        formalSplitReadsOnV2:
          checks.some((item) => item.name === 'learning.cutover.courses.v2' && item.ok)
          && checks.some((item) => item.name === 'learning.cutover.games.v2' && item.ok)
          && checks.some((item) => item.name === 'learning.cutover.tools.v2' && item.ok),
        completeCutoverToV2: checks.some((item) => item.name === 'learning.complete.v2' && item.ok),
        completeRewardChainWorks:
          checks.some((item) => item.name === 'learning.reward.points-summary-updated' && item.ok)
          && checks.some((item) => item.name === 'learning.reward.points-observability' && item.ok),
        forceV1RollbackWorks: checks.some((item) => item.name === 'learning.complete.force-v1.rollback' && item.ok),
        backToV2Works: checks.some((item) => item.name === 'learning.complete.back-to-v2' && item.ok),
        readFallbackWorks: checks.some((item) => item.name === 'learning.read.games.fallback.v1' && item.ok),
        writeNoAutoFallbackConfirmed: checks.some((item) => item.name === 'learning.complete.no-auto-fallback' && item.ok),
        manualWriteRollbackWorks: checks.some((item) => item.name === 'learning.complete.force-v1.rollback' && item.ok),
        gatewayMetricsCoverLearning:
          checks.some((item) => item.name === 'learning.gateway-metrics.v2' && item.ok)
          && checks.some((item) => item.name === 'learning.gateway-metrics.rollback' && item.ok),
        pointsObservabilityCoverReward:
          checks.some((item) => item.name === 'learning.reward.points-observability' && item.ok)
          && checks.some((item) => item.name === 'learning.reward.points-observability.force-v1' && item.ok),
      },
    };
    report.reportPaths = writeReports(report);

    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) process.exit(1);
  } finally {
    await closeServer(gateway.server);
    await closeServer(learningService.server);
    await closeServer(pointsService.server);
    await closeServer(userService.server);
    await closeServer(monolith.server);
    await closeState();

    process.env.GATEWAY_V1_BASE_URL = previousEnv.GATEWAY_V1_BASE_URL;
    process.env.GATEWAY_USER_SERVICE_URL = previousEnv.GATEWAY_USER_SERVICE_URL;
    process.env.GATEWAY_POINTS_SERVICE_URL = previousEnv.GATEWAY_POINTS_SERVICE_URL;
    process.env.GATEWAY_LEARNING_SERVICE_URL = previousEnv.GATEWAY_LEARNING_SERVICE_URL;
    process.env.GATEWAY_ENABLE_V2 = previousEnv.GATEWAY_ENABLE_V2;
    process.env.GATEWAY_ENABLE_V1_FALLBACK = previousEnv.GATEWAY_ENABLE_V1_FALLBACK;
    process.env.GATEWAY_READY_TIMEOUT_MS = previousEnv.GATEWAY_READY_TIMEOUT_MS;
    process.env.GATEWAY_FORCE_V1 = previousEnv.GATEWAY_FORCE_V1;
    process.env.GATEWAY_FORCE_V1_PATHS = previousEnv.GATEWAY_FORCE_V1_PATHS;
    process.env.GATEWAY_FORCE_V2_PATHS = previousEnv.GATEWAY_FORCE_V2_PATHS;
    process.env.GATEWAY_V2_TENANTS = previousEnv.GATEWAY_V2_TENANTS;
    process.env.GATEWAY_ENABLE_LEARNING_SERVICE = previousEnv.GATEWAY_ENABLE_LEARNING_SERVICE;
    process.env.LEARNING_POINTS_SERVICE_URL = previousEnv.LEARNING_POINTS_SERVICE_URL;
    process.env.LEARNING_SERVICE_BASE_URL = previousEnv.LEARNING_SERVICE_BASE_URL;
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
