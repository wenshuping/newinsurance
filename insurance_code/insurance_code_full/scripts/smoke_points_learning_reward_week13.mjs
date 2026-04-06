#!/usr/bin/env node

import fs from 'node:fs';

process.env.STORAGE_BACKEND = process.env.STORAGE_BACKEND || 'file';

const HOST = '127.0.0.1';

function assert(condition, message, context = null) {
  if (condition) return;
  const error = new Error(message);
  error.context = context;
  throw error;
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

async function listen(app) {
  const server = app.listen(0, HOST);
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  return {
    server,
    base: `http://${HOST}:${Number(address?.port || 0)}`,
  };
}

async function closeServer(server) {
  await new Promise((resolve) => server.close(resolve));
}

function generateMobile() {
  return `139${String(Date.now()).slice(-8)}`;
}

function findTransactionsByIdempotency(state, idempotencyKey) {
  return (Array.isArray(state.pointTransactions) ? state.pointTransactions : []).filter(
    (row) => String(row?.idempotencyKey || '') === String(idempotencyKey),
  );
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

function buildAuthHeaders({ token = '', csrfToken = '', traceId = '', tenantId = 0 }) {
  return {
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
    ...(traceId ? { 'x-trace-id': traceId, 'x-request-id': traceId } : {}),
    ...(tenantId > 0 ? { 'x-tenant-id': String(tenantId) } : {}),
  };
}

async function main() {
  const repoRoot = process.cwd();
  const learningUsecasePath = `${repoRoot}/server/skeleton-c-v1/usecases/learning-complete.usecase.mjs`;
  const cLearningRoutePath = `${repoRoot}/server/microservices/learning-service/c-learning.routes.mjs`;
  const usecaseSource = fs.readFileSync(learningUsecasePath, 'utf8');
  const routeSource = fs.readFileSync(cLearningRoutePath, 'utf8');

  assert(!usecaseSource.includes('appendPoints('), 'learning complete usecase still directly calls appendPoints');
  assert(usecaseSource.includes('function resolveSettleReward(deps)'), 'learning complete usecase missing resolveSettleReward helper');
  assert(usecaseSource.includes('deps?.settleReward'), 'learning complete usecase is not resolving deps.settleReward');
  assert(usecaseSource.includes('await settleReward('), 'learning complete usecase is not awaiting injected settleReward');
  assert(
    !usecaseSource.includes("../../microservices/points-service/learning-reward.contract.mjs"),
    'learning complete usecase still imports points-service contract file directly',
  );
  assert(routeSource.includes('settleLearningRewardOverHttp'), 'learning-service route is not using internal HTTP settlement client');

  const [
    stateModule,
    { createUserServiceApp },
    { createPointsServiceApp },
    { createLearningServiceApp },
  ] = await Promise.all([
    import('../server/skeleton-c-v1/common/state.mjs'),
    import('../server/microservices/user-service/app.mjs'),
    import('../server/microservices/points-service/app.mjs'),
    import('../server/microservices/learning-service/app.mjs'),
  ]);

  const {
    closeState,
    createActorSession,
    getBalance,
    getState,
    initializeState,
    persistState,
    resolveSessionFromBearer,
  } = stateModule;

  await initializeState();

  const previousPointsServiceUrl = process.env.LEARNING_POINTS_SERVICE_URL;
  let userRuntime;
  let pointsRuntime;
  let learningRuntime;

  try {
    userRuntime = await listen(createUserServiceApp());
    pointsRuntime = await listen(createPointsServiceApp());
    process.env.LEARNING_POINTS_SERVICE_URL = pointsRuntime.base;
    learningRuntime = await listen(createLearningServiceApp());

    const actor = pickLearningPilotActor(getState());
    assert(actor, 'missing learning pilot actor');
    const adminToken = createActorSession(actor);
    const adminSession = resolveSessionFromBearer(`Bearer ${adminToken}`);
    const adminCsrfToken = String(adminSession?.csrfToken || '');
    assert(adminToken && adminCsrfToken, 'failed to create learning admin session', { actor, adminSession });

    const mobile = generateMobile();
    const sendCode = await requestJson(userRuntime.base, '/api/auth/send-code', {
      method: 'POST',
      body: { mobile },
    });
    assert(sendCode.status === 200, 'send-code failed', { sendCode });

    const verifyBasic = await requestJson(userRuntime.base, '/api/auth/verify-basic', {
      method: 'POST',
      body: {
        name: '张三',
        mobile,
        code: String(sendCode.body?.dev_code || process.env.DEV_SMS_CODE || '123456'),
        tenantId: Number(actor.tenantId || 1),
      },
    });
    assert(verifyBasic.status === 200, 'verify-basic failed', { verifyBasic });

    const customerToken = String(verifyBasic.body?.token || '');
    const customerCsrfToken = String(verifyBasic.body?.csrfToken || '');
    const customerId = Number(verifyBasic.body?.user?.id || 0);
    assert(customerToken && customerCsrfToken && customerId > 0, 'verified customer session missing', { verifyBasic });

    const customer = (getState().users || []).find((row) => Number(row.id || 0) === customerId);
    assert(customer, 'verified customer row missing', { customerId });
    customer.ownerUserId = Number(actor.actorId || 0);
    customer.tenantId = Number(actor.tenantId || 0);
    customer.orgId = Number(actor.orgId || 0);
    customer.teamId = Number(actor.teamId || 0);
    persistState();

    const courseTitle = `Week13 学习奖励课程 ${Date.now()}`;
    const createCourse = await requestJson(learningRuntime.base, '/api/p/learning/courses', {
      method: 'POST',
      headers: buildAuthHeaders({
        token: adminToken,
        csrfToken: adminCsrfToken,
        traceId: 'week13-learning-http-create-course',
        tenantId: actor.tenantId,
      }),
      body: {
        title: courseTitle,
        category: 'week13-smoke',
        contentType: 'article',
        rewardPoints: 12,
        content: 'week13 learning reward smoke',
        status: 'published',
      },
    });
    assert(createCourse.status === 200, 'learning admin create course failed', { createCourse });
    const course = createCourse.body?.course || null;
    assert(Number(course?.id || 0) > 0, 'created course missing id', { createCourse });

    const beforeBalance = Number(getBalance(customerId) || 0);
    const completeTraceId = 'week13-learning-http-reward-success';
    const completeResponse = await requestJson(learningRuntime.base, `/api/learning/courses/${course.id}/complete`, {
      method: 'POST',
      headers: buildAuthHeaders({
        token: customerToken,
        csrfToken: customerCsrfToken,
        traceId: completeTraceId,
        tenantId: actor.tenantId,
      }),
    });

    assert(completeResponse.status === 200, 'learning complete over HTTP failed', { completeResponse });
    assert(completeResponse.body?.ok === true, 'learning complete response missing ok', { completeResponse });
    assert(completeResponse.body?.duplicated === false, 'first learning completion should not be duplicated', { completeResponse });
    assert(Number(completeResponse.body?.reward || 0) === Number(course.points || 0), 'unexpected reward amount', {
      completeResponse,
      course,
    });

    const pointsSummary = await requestJson(pointsRuntime.base, '/api/points/summary', {
      headers: buildAuthHeaders({
        token: customerToken,
        traceId: 'week13-learning-http-summary',
        tenantId: actor.tenantId,
      }),
    });
    assert(pointsSummary.status === 200, 'points summary failed after learning reward', { pointsSummary });
    assert(
      Number(pointsSummary.body?.balance || 0) === beforeBalance + Number(course.points || 0),
      'points summary did not increase after learning reward',
      { beforeBalance, pointsSummary, course },
    );

    const idempotencyKey = `learning-reward:${actor.tenantId}:${customerId}:${course.id}`;
    const transactionsAfterFirstComplete = findTransactionsByIdempotency(getState(), idempotencyKey);
    assert(transactionsAfterFirstComplete.length === 1, 'learning reward should create exactly one points transaction', {
      transactionsAfterFirstComplete,
      idempotencyKey,
    });

    const observability = await requestJson(pointsRuntime.base, '/internal/points-service/observability');
    assert(observability.status === 200, 'points observability failed', { observability });
    const recentLogs = Array.isArray(observability.body?.recentLogs) ? observability.body.recentLogs : [];
    const successLog = recentLogs.find(
      (row) => String(row?.route || '') === 'INTERNAL learning->points reward settlement'
        && String(row?.trace_id || '') === completeTraceId
        && String(row?.result || '') === 'success',
    );
    assert(successLog, 'learning reward success log missing from points observability', { recentLogs, completeTraceId });
    assert(Number(observability.body?.metrics?.learningReward?.success || 0) >= 1, 'learning reward success metric missing', {
      observability,
    });

    const duplicateResponse = await requestJson(learningRuntime.base, `/api/learning/courses/${course.id}/complete`, {
      method: 'POST',
      headers: buildAuthHeaders({
        token: customerToken,
        csrfToken: customerCsrfToken,
        traceId: 'week13-learning-http-reward-duplicate',
        tenantId: actor.tenantId,
      }),
    });
    assert(duplicateResponse.status === 200, 'duplicate learning complete failed', { duplicateResponse });
    assert(duplicateResponse.body?.duplicated === true, 'duplicate learning complete should stay idempotent', { duplicateResponse });
    assert(findTransactionsByIdempotency(getState(), idempotencyKey).length === 1, 'duplicate learning completion created extra transaction', {
      duplicateResponse,
      idempotencyKey,
    });

    console.log(
      JSON.stringify(
        {
          ok: true,
          checks: [
            'usecase-no-appendPoints',
            'usecase-has-resolveSettleReward-helper',
            'usecase-resolves-deps.settleReward',
            'usecase-awaits-settleReward',
            'usecase-no-points-direct-import',
            'learning-route-uses-http-client',
            'learning-complete-http-success',
            'points-summary-updated',
            'points-observability-log-visible',
            'duplicate-learning-complete-idempotent',
          ],
          learningServiceBase: learningRuntime.base,
          pointsServiceBase: pointsRuntime.base,
          userServiceBase: userRuntime.base,
          completeTraceId,
          idempotencyKey,
        },
        null,
        2,
      ),
    );
  } finally {
    if (learningRuntime?.server) await closeServer(learningRuntime.server);
    if (pointsRuntime?.server) await closeServer(pointsRuntime.server);
    if (userRuntime?.server) await closeServer(userRuntime.server);
    process.env.LEARNING_POINTS_SERVICE_URL = previousPointsServiceUrl;
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
