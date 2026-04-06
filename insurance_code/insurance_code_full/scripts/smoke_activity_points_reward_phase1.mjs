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

function pickActivityActor(state) {
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

function buildHeaders({ token = '', csrfToken = '', traceId = '', tenantId = 0, tenantCode = '' }) {
  return {
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
    ...(traceId ? { 'x-trace-id': traceId, 'x-request-id': traceId } : {}),
    ...(tenantId > 0 ? { 'x-tenant-id': String(tenantId) } : {}),
    ...(tenantCode ? { 'x-tenant-code': tenantCode } : {}),
  };
}

function findTransactionsByIdempotency(state, idempotencyKey) {
  return (Array.isArray(state.pointTransactions) ? state.pointTransactions : []).filter(
    (row) => String(row?.idempotencyKey || '') === String(idempotencyKey),
  );
}

async function main() {
  const repoRoot = process.cwd();
  const activityUsecasePath = `${repoRoot}/server/skeleton-c-v1/usecases/activity-complete.usecase.mjs`;
  const monolithRewardServicePath = `${repoRoot}/server/skeleton-c-v1/services/activity-reward.service.mjs`;
  const monolithActivityRoutePath = `${repoRoot}/server/skeleton-c-v1/routes/activities.routes.mjs`;
  const activityRoutePath = `${repoRoot}/server/microservices/activity-service/c-activity.routes.mjs`;
  const usecaseSource = fs.readFileSync(activityUsecasePath, 'utf8');
  const monolithRewardServiceSource = fs.readFileSync(monolithRewardServicePath, 'utf8');
  const monolithActivityRouteSource = fs.readFileSync(monolithActivityRoutePath, 'utf8');
  const routeSource = fs.readFileSync(activityRoutePath, 'utf8');

  assert(!usecaseSource.includes('recordPoints('), 'activity complete usecase still directly calls recordPoints');
  assert(!usecaseSource.includes('microservices/points-service/activity-reward.contract.mjs'), 'activity complete usecase still imports points-service contract directly');
  assert(routeSource.includes('settleActivityRewardOverHttp'), 'activity-service route is not using activity HTTP reward client');
  assert(monolithRewardServiceSource.includes('settleActivityRewardOverHttp'), 'monolith activity reward service is not delegating to points-service HTTP contract');
  assert(!monolithRewardServiceSource.includes('recordPoints('), 'monolith activity reward service still writes points locally');
  assert(monolithActivityRouteSource.includes('settleActivityRewardViaPointsService'), 'monolith activity route is not using points-service reward adapter');

  const [
    stateModule,
    { createUserServiceApp },
    { createPointsServiceApp },
    { createActivityServiceApp },
  ] = await Promise.all([
    import('../server/skeleton-c-v1/common/state.mjs'),
    import('../server/microservices/user-service/app.mjs'),
    import('../server/microservices/points-service/app.mjs'),
    import('../server/microservices/activity-service/app.mjs'),
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

  const previousPointsServiceUrl = process.env.ACTIVITY_POINTS_SERVICE_URL;
  let userRuntime;
  let pointsRuntime;
  let activityRuntime;

  try {
    userRuntime = await listen(createUserServiceApp());
    pointsRuntime = await listen(createPointsServiceApp());
    process.env.ACTIVITY_POINTS_SERVICE_URL = pointsRuntime.base;
    activityRuntime = await listen(createActivityServiceApp());

    const actor = pickActivityActor(getState());
    assert(actor, 'missing activity actor');
    const adminToken = createActorSession(actor);
    const adminSession = resolveSessionFromBearer(`Bearer ${adminToken}`);
    const adminCsrfToken = String(adminSession?.csrfToken || '');
    assert(adminToken && adminCsrfToken, 'failed to create activity admin session', { actor, adminSession });

    const mobile = generateMobile();
    const sendCode = await requestJson(userRuntime.base, '/api/auth/send-code', {
      method: 'POST',
      body: { mobile },
    });
    assert(sendCode.status === 200, 'send-code failed', { sendCode });

    const verifyBasic = await requestJson(userRuntime.base, '/api/auth/verify-basic', {
      method: 'POST',
      body: {
        name: '活动奖励客户',
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

    const createActivity = await requestJson(activityRuntime.base, '/api/p/activities', {
      method: 'POST',
      headers: buildHeaders({
        token: adminToken,
        csrfToken: adminCsrfToken,
        traceId: 'activity-reward-create',
        tenantId: actor.tenantId,
        tenantCode: 'tenant-alpha',
      }),
      body: {
        title: `Activity reward stable ${Date.now()}`,
        category: 'task',
        rewardPoints: 11,
        content: 'activity reward stable smoke',
        status: 'online',
      },
    });
    assert(createActivity.status === 200, 'p activity create failed', { createActivity });
    const createdActivity = createActivity.body?.activity || null;
    assert(Number(createdActivity?.id || 0) > 0, 'created activity missing id', { createActivity });

    const beforeBalance = Number(getBalance(customerId) || 0);
    const completeTraceId = 'activity-reward-complete';
    const complete = await requestJson(activityRuntime.base, `/api/activities/${createdActivity.id}/complete`, {
      method: 'POST',
      headers: buildHeaders({
        token: customerToken,
        csrfToken: customerCsrfToken,
        traceId: completeTraceId,
        tenantId: actor.tenantId,
        tenantCode: 'tenant-alpha',
      }),
    });
    assert(complete.status === 200, 'activity complete failed', { complete });

    const pointsSummary = await requestJson(pointsRuntime.base, '/api/points/summary', {
      headers: buildHeaders({
        token: customerToken,
        traceId: 'activity-reward-summary',
        tenantId: actor.tenantId,
      }),
    });
    assert(pointsSummary.status === 200, 'points summary failed after activity reward', { pointsSummary });
    assert(Number(pointsSummary.body?.balance || 0) === beforeBalance + Number(createdActivity.rewardPoints || 0), 'points summary did not increase after activity reward', {
      beforeBalance,
      pointsSummary,
      createdActivity,
    });

    const completionDate = new Date().toISOString().slice(0, 10);
    const idempotencyKey = `activity-reward:${actor.tenantId}:${customerId}:${createdActivity.id}:${completionDate}`;
    const transactionsAfterComplete = findTransactionsByIdempotency(getState(), idempotencyKey);
    assert(transactionsAfterComplete.length === 1, 'activity reward should create exactly one points transaction', {
      transactionsAfterComplete,
      idempotencyKey,
    });

    const observability = await requestJson(pointsRuntime.base, '/internal/points-service/observability');
    assert(observability.status === 200, 'points observability failed', { observability });
    const recentLogs = Array.isArray(observability.body?.recentLogs) ? observability.body.recentLogs : [];
    const successLog = recentLogs.find(
      (row) => String(row?.route || '') === 'INTERNAL activity->points reward settlement'
        && String(row?.trace_id || '') === completeTraceId
        && String(row?.result || '') === 'success',
    );
    assert(successLog, 'activity reward success log missing from points observability', { recentLogs, completeTraceId });
    assert(Number(observability.body?.metrics?.activityReward?.success || 0) >= 1, 'activity reward success metric missing', {
      observability,
    });

    const directDuplicate = await requestJson(pointsRuntime.base, '/internal/points-service/activity-rewards/settle', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-service': 'activity-service',
        'x-service-name': 'activity-service',
        'x-tenant-id': String(actor.tenantId),
        'x-trace-id': 'activity-reward-direct-duplicate',
        'x-request-id': 'activity-reward-direct-duplicate',
      },
      body: {
        tenantId: Number(actor.tenantId || 1),
        userId: customerId,
        activityId: Number(createdActivity.id),
        activityTitle: String(createdActivity.title || createdActivity.id),
        rewardPoints: Number(createdActivity.rewardPoints || 0),
        completionDate,
      },
    });
    assert(directDuplicate.status === 200, 'direct duplicate settlement failed', { directDuplicate });
    assert(directDuplicate.body?.duplicated === true, 'direct duplicate settlement should be idempotent', { directDuplicate });
    assert(findTransactionsByIdempotency(getState(), idempotencyKey).length === 1, 'duplicate settlement created extra transaction', {
      directDuplicate,
      idempotencyKey,
    });

    console.log(
      JSON.stringify(
        {
          ok: true,
          checks: [
            'activity-complete-no-local-points-write',
            'activity-service-route-uses-http-client',
            'legacy-activity-route-uses-http-client',
            'activity-complete-reward-success',
            'points-summary-updated',
            'points-observability-log-visible',
            'activity-reward-contract-idempotent',
          ],
          activityServiceBase: activityRuntime.base,
          pointsServiceBase: pointsRuntime.base,
          userServiceBase: userRuntime.base,
          activityId: Number(createdActivity.id),
          customerId,
          idempotencyKey,
          completionDate,
        },
        null,
        2,
      ),
    );
  } finally {
    if (activityRuntime?.server) await closeServer(activityRuntime.server);
    if (pointsRuntime?.server) await closeServer(pointsRuntime.server);
    if (userRuntime?.server) await closeServer(userRuntime.server);
    process.env.ACTIVITY_POINTS_SERVICE_URL = previousPointsServiceUrl;
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
