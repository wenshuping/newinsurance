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
    '# Week13 Learning Service 最小试点演练报告',
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
    `- learning pilot enabled by default: ${report.criteria.enabledByDefault ? 'true' : 'false'}`,
    `- pilot cutover works: ${report.criteria.cutoverWorks ? 'PASS' : 'FAIL'}`,
    `- force-v1 rollback works: ${report.criteria.forceV1Works ? 'PASS' : 'FAIL'}`,
    `- read fallback works: ${report.criteria.readFallbackWorks ? 'PASS' : 'FAIL'}`,
    `- complete stays on v1: ${report.criteria.completeStaysOnV1 ? 'PASS' : 'FAIL'}`,
  );

  return `${lines.join('\n')}\n`;
}

function writeReports(report) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const stamp = nowStamp();
  const jsonPath = path.join(REPORT_DIR, `week13-learning-pilot-${stamp}.json`);
  const mdPath = path.join(REPORT_DIR, `week13-learning-pilot-${stamp}.md`);
  const latestJsonPath = path.join(REPORT_DIR, 'week13-learning-pilot-latest.json');
  const latestMdPath = path.join(REPORT_DIR, 'week13-learning-pilot-latest.md');
  const markdown = toMarkdown(report);

  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(mdPath, markdown);
  fs.writeFileSync(latestJsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(latestMdPath, markdown);

  return { jsonPath, mdPath, latestJsonPath, latestMdPath };
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
    LEARNING_POINTS_SERVICE_URL: process.env.LEARNING_POINTS_SERVICE_URL,
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
  process.env.GATEWAY_FORCE_V1 = 'false';
  process.env.GATEWAY_FORCE_V1_PATHS = '';
  process.env.GATEWAY_FORCE_V2_PATHS = '';
  process.env.GATEWAY_V2_TENANTS = 'tenant-alpha';
  process.env.GATEWAY_ENABLE_LEARNING_SERVICE = 'false';

  const gateway = await listen(createGatewayApp());

  try {
    const monolithReady = await waitForReady(monolith.base, '/api/health');
    assert(monolithReady?.status === 200, 'week13 pilot monolith health failed', monolithReady);
    const userReady = await waitForReady(userService.base, '/ready');
    assert(userReady?.status === 200, 'week13 pilot user-service ready failed', userReady);
    const pointsReady = await waitForReady(pointsService.base, '/ready');
    assert(pointsReady?.status === 200, 'week13 pilot points-service ready failed', pointsReady);
    const learningReady = await waitForReady(learningService.base, '/ready');
    assert(learningReady?.status === 200, 'week13 pilot learning-service ready failed', learningReady);
    const gatewayReady = await waitForReady(gateway.base, '/ready');
    assert(gatewayReady?.status === 200, 'week13 pilot gateway ready failed', gatewayReady);

    const checks = [];
    const pilotActor = pickLearningPilotActor(getState());
    assert(pilotActor, 'missing learning pilot actor');
    const tenantId = Number(pilotActor.tenantId || 1);
    const adminToken = createActorSession(pilotActor);
    const adminSession = resolveSessionFromBearer(`Bearer ${adminToken}`);
    const adminCsrfToken = String(adminSession?.csrfToken || '');
    assert(adminToken && adminCsrfToken, 'failed to create learning pilot admin session', { adminSession, pilotActor });

    const routesDisabled = await requestJson(gateway.base, '/internal/gateway/routes');
    const disabledLearning = Array.isArray(routesDisabled.body?.routeMap)
      ? routesDisabled.body.routeMap.find((item) => item?.service === 'learning-service')
      : null;
    checks.push(buildCheck('learning.routes.registered', routesDisabled, routesDisabled.status === 200 && Array.isArray(disabledLearning?.routes) && disabledLearning.routes.length === 4));
    assert(routesDisabled.status === 200, 'gateway route list failed', routesDisabled);

    const anonymousV1 = await requestJson(gateway.base, '/api/learning/courses', {
      headers: buildGatewayHeaders({ tenantId, tenantCode: 'tenant-alpha', traceId: 'week13-learning-disabled' }),
    });
    checks.push(buildCheck('learning.disabled.default-v1', anonymousV1, anonymousV1.status === 200 && anonymousV1.headers['x-gateway-target-service'] === 'v1-monolith'));
    assert(anonymousV1.status === 200, 'learning disabled request failed', anonymousV1);

    process.env.GATEWAY_ENABLE_LEARNING_SERVICE = 'true';

    const anonymousV2 = await requestJson(gateway.base, '/api/learning/courses', {
      headers: buildGatewayHeaders({ tenantId, tenantCode: 'tenant-alpha', traceId: 'week13-learning-enabled' }),
    });
    checks.push(buildCheck('learning.enabled.cutover-v2', anonymousV2, anonymousV2.status === 200 && anonymousV2.headers['x-gateway-mode'] === 'v2' && anonymousV2.headers['x-gateway-target-service'] === 'learning-service'));
    assert(anonymousV2.status === 200, 'learning enabled request failed', anonymousV2);

    const blockedTenant = await requestJson(gateway.base, '/api/learning/courses', {
      headers: buildGatewayHeaders({ tenantId, tenantCode: 'tenant-beta', traceId: 'week13-learning-blocked' }),
    });
    checks.push(buildCheck('learning.tenant-blocked.v1', blockedTenant, blockedTenant.status === 200 && blockedTenant.headers['x-gateway-target-service'] === 'v1-monolith'));
    assert(blockedTenant.status === 200, 'learning tenant blocked request failed', blockedTenant);

    process.env.GATEWAY_FORCE_V1_PATHS = '/api/learning/*,/api/p/learning/*';
    const forcedV1 = await requestJson(gateway.base, '/api/learning/courses', {
      headers: buildGatewayHeaders({ tenantId, tenantCode: 'tenant-alpha', traceId: 'week13-learning-force-v1' }),
    });
    checks.push(buildCheck('learning.force-v1.rollback', forcedV1, forcedV1.status === 200 && forcedV1.headers['x-gateway-target-service'] === 'v1-monolith'));
    assert(forcedV1.status === 200, 'learning force-v1 failed', forcedV1);

    process.env.GATEWAY_FORCE_V1_PATHS = '';
    const backToV2 = await requestJson(gateway.base, '/api/learning/courses', {
      headers: buildGatewayHeaders({ tenantId, tenantCode: 'tenant-alpha', traceId: 'week13-learning-back-v2' }),
    });
    checks.push(buildCheck('learning.back-to-v2', backToV2, backToV2.status === 200 && backToV2.headers['x-gateway-target-service'] === 'learning-service'));
    assert(backToV2.status === 200, 'learning back-to-v2 failed', backToV2);

    const pList = await requestJson(gateway.base, '/api/p/learning/courses', {
      headers: buildGatewayHeaders({
        tenantId,
        tenantCode: 'tenant-alpha',
        traceId: 'week13-learning-admin-list',
        authHeaders: { authorization: `Bearer ${adminToken}` },
      }),
    });
    checks.push(buildCheck('learning.admin.list.v2', pList, pList.status === 200 && Array.isArray(pList.body?.list) && pList.headers['x-gateway-target-service'] === 'learning-service'));
    assert(pList.status === 200, 'learning admin list failed', pList);

    const createdTitle = `Week13-learning-gateway-${Date.now()}`;
    const pCreate = await requestJson(gateway.base, '/api/p/learning/courses', {
      method: 'POST',
      headers: buildGatewayHeaders({
        tenantId,
        tenantCode: 'tenant-alpha',
        traceId: 'week13-learning-admin-create',
        authHeaders: {
          authorization: `Bearer ${adminToken}`,
          'x-csrf-token': adminCsrfToken,
        },
      }),
      body: {
        title: createdTitle,
        category: 'Week13试点',
        contentType: 'article',
        rewardPoints: 12,
        content: 'week13 learning gateway pilot',
        status: 'published',
      },
    });
    const createdId = Number(pCreate.body?.course?.id || 0);
    checks.push(buildCheck('learning.admin.create.v2', pCreate, pCreate.status === 200 && createdId > 0 && pCreate.headers['x-gateway-target-service'] === 'learning-service', { createdId }));
    assert(pCreate.status === 200 && createdId > 0, 'learning admin create failed', pCreate);

    const mobile = generateMobile();
    const sendCode = await requestJson(gateway.base, '/api/auth/send-code', {
      method: 'POST',
      headers: buildGatewayHeaders({ tenantId, tenantCode: 'tenant-alpha', traceId: 'week13-learning-user-send-code' }),
      body: { mobile },
    });
    assert(sendCode.status === 200, 'week13 learning pilot send-code failed', sendCode);

    const verifyBasic = await requestJson(gateway.base, '/api/auth/verify-basic', {
      method: 'POST',
      headers: buildGatewayHeaders({ tenantId, tenantCode: 'tenant-alpha', traceId: 'week13-learning-user-login' }),
      body: {
        name: '张三',
        mobile,
        code: String(sendCode.body?.dev_code || '123456'),
        tenantId,
      },
    });
    const customerToken = String(verifyBasic.body?.token || '');
    const customerCsrfToken = String(verifyBasic.body?.csrfToken || '');
    assert(verifyBasic.status === 200 && customerToken && customerCsrfToken, 'week13 learning pilot verify-basic failed', verifyBasic);
    const customerId = Number(verifyBasic.body?.user?.id || 0);
    const stateAfterLogin = getState();
    const customerRow = (stateAfterLogin.users || []).find((row) => Number(row.id || 0) === customerId);
    assert(customerRow, 'week13 learning pilot customer row missing after login', {
      customerId,
      verifyBasicBody: verifyBasic.body,
    });
    customerRow.ownerUserId = Number(pilotActor.actorId || 0);
    customerRow.tenantId = tenantId;
    customerRow.orgId = Number(pilotActor.orgId || customerRow.orgId || 0);
    customerRow.teamId = Number(pilotActor.teamId || customerRow.teamId || 0);

    const customerCourses = await requestJson(gateway.base, '/api/learning/courses', {
      headers: buildGatewayHeaders({
        tenantId,
        tenantCode: 'tenant-alpha',
        traceId: 'week13-learning-user-list',
        authHeaders: {
          authorization: `Bearer ${customerToken}`,
          'x-csrf-token': customerCsrfToken,
        },
      }),
    });
    const visibleCourses = Array.isArray(customerCourses.body?.courses) ? customerCourses.body.courses : [];
    const visibleCreatedCourse = visibleCourses.find((course) => Number(course?.id || 0) === createdId);
    checks.push(
      buildCheck(
        'learning.customer.list.v2',
        customerCourses,
        customerCourses.status === 200
          && customerCourses.headers['x-gateway-target-service'] === 'learning-service'
          && Boolean(visibleCreatedCourse),
        { visibleCourseCount: visibleCourses.length, createdId },
      ),
    );
    assert(customerCourses.status === 200, 'learning customer list failed', customerCourses);
    assert(visibleCreatedCourse, 'learning customer created course not visible', {
      createdId,
      visibleCourseIds: visibleCourses.map((course) => Number(course?.id || 0)),
    });

    const visibleCourseId = Number(visibleCreatedCourse.id || createdId);
    const courseDetail = await requestJson(gateway.base, `/api/learning/courses/${visibleCourseId}`, {
      headers: buildGatewayHeaders({
        tenantId,
        tenantCode: 'tenant-alpha',
        traceId: 'week13-learning-user-detail',
        authHeaders: { authorization: `Bearer ${customerToken}` },
      }),
    });
    checks.push(
      buildCheck(
        'learning.customer.detail.v2',
        courseDetail,
        courseDetail.status === 200
          && Number(courseDetail.body?.course?.id || 0) === visibleCourseId
          && courseDetail.headers['x-gateway-target-service'] === 'learning-service',
        { visibleCourseId, createdId },
      ),
    );
    assert(courseDetail.status === 200, 'learning customer detail failed', courseDetail);

    const completeViaGateway = await requestJson(gateway.base, `/api/learning/courses/${createdId}/complete`, {
      method: 'POST',
      headers: buildGatewayHeaders({
        tenantId,
        tenantCode: 'tenant-alpha',
        traceId: 'week13-learning-complete-v1',
        authHeaders: {
          authorization: `Bearer ${customerToken}`,
          'x-csrf-token': customerCsrfToken,
        },
      }),
    });
    checks.push(buildCheck('learning.complete.stays-on-v1', completeViaGateway, completeViaGateway.status === 200 && completeViaGateway.headers['x-gateway-target-service'] === 'v1-monolith'));
    assert(completeViaGateway.status === 200, 'learning complete should still succeed via v1-monolith', completeViaGateway);

    const pUpdate = await requestJson(gateway.base, `/api/p/learning/courses/${createdId}`, {
      method: 'PUT',
      headers: buildGatewayHeaders({
        tenantId,
        tenantCode: 'tenant-alpha',
        traceId: 'week13-learning-admin-update',
        authHeaders: {
          authorization: `Bearer ${adminToken}`,
          'x-csrf-token': adminCsrfToken,
        },
      }),
      body: { title: `${createdTitle}-updated` },
    });
    checks.push(buildCheck('learning.admin.update.v2', pUpdate, pUpdate.status === 200 && pUpdate.headers['x-gateway-target-service'] === 'learning-service'));
    assert(pUpdate.status === 200, 'learning admin update failed', pUpdate);

    const opsOverview = await requestJson(gateway.base, '/internal/ops/overview');
    const upstreamHealth = Array.isArray(opsOverview.body?.upstreams?.health) ? opsOverview.body.upstreams.health : [];
    const upstreamObservability = Array.isArray(opsOverview.body?.upstreams?.observability) ? opsOverview.body.upstreams.observability : [];
    checks.push(buildCheck('learning.ops.overview', opsOverview, opsOverview.status === 200 && upstreamHealth.some((entry) => entry?.service === 'learning-service' && entry?.ok === true), {
      learningObservabilitySkipped: upstreamObservability.some((entry) => entry?.service === 'learning-service' && entry?.skipped === true),
    }));
    assert(opsOverview.status === 200, 'learning ops overview failed', opsOverview);

    process.env.GATEWAY_LEARNING_SERVICE_URL = 'http://127.0.0.1:9';
    const fallbackRead = await requestJson(gateway.base, '/api/learning/courses', {
      headers: buildGatewayHeaders({ tenantId, tenantCode: 'tenant-alpha', traceId: 'week13-learning-fallback-read' }),
    });
    checks.push(buildCheck('learning.read-fallback.v1', fallbackRead, fallbackRead.status === 200 && fallbackRead.headers['x-gateway-target-service'] === 'v1-monolith'));
    assert(fallbackRead.status === 200, 'learning read fallback failed', fallbackRead);

    process.env.GATEWAY_LEARNING_SERVICE_URL = learningService.base;

    const pDelete = await requestJson(gateway.base, `/api/p/learning/courses/${createdId}`, {
      method: 'DELETE',
      headers: buildGatewayHeaders({
        tenantId,
        tenantCode: 'tenant-alpha',
        traceId: 'week13-learning-admin-delete',
        authHeaders: {
          authorization: `Bearer ${adminToken}`,
          'x-csrf-token': adminCsrfToken,
        },
      }),
    });
    checks.push(buildCheck('learning.admin.delete.v2', pDelete, pDelete.status === 200 && pDelete.headers['x-gateway-target-service'] === 'learning-service'));
    assert(pDelete.status === 200, 'learning admin delete failed', pDelete);

    const report = {
      ok: checks.every((item) => item.ok),
      executedAt: new Date().toISOString(),
      gatewayBase: gateway.base,
      learningServiceBase: learningService.base,
      userServiceBase: userService.base,
      pointsServiceBase: pointsService.base,
      checks,
      criteria: {
        enabledByDefault: false,
        cutoverWorks: checks.some((item) => item.name === 'learning.enabled.cutover-v2' && item.ok),
        forceV1Works: checks.some((item) => item.name === 'learning.force-v1.rollback' && item.ok),
        readFallbackWorks: checks.some((item) => item.name === 'learning.read-fallback.v1' && item.ok),
        completeStaysOnV1: checks.some((item) => item.name === 'learning.complete.stays-on-v1' && item.ok),
      },
    };
    const reportPaths = writeReports(report);
    report.reportPaths = reportPaths;

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
    process.env.GATEWAY_FORCE_V1 = previousEnv.GATEWAY_FORCE_V1;
    process.env.GATEWAY_FORCE_V1_PATHS = previousEnv.GATEWAY_FORCE_V1_PATHS;
    process.env.GATEWAY_FORCE_V2_PATHS = previousEnv.GATEWAY_FORCE_V2_PATHS;
    process.env.GATEWAY_V2_TENANTS = previousEnv.GATEWAY_V2_TENANTS;
    process.env.GATEWAY_ENABLE_LEARNING_SERVICE = previousEnv.GATEWAY_ENABLE_LEARNING_SERVICE;
    process.env.LEARNING_POINTS_SERVICE_URL = previousEnv.LEARNING_POINTS_SERVICE_URL;
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
