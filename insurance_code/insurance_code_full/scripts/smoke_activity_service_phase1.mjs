#!/usr/bin/env node

import {
  activityServiceMainWriteTables,
  activityServiceOwnedRoutes,
  activityServiceStableContracts,
} from '../server/microservices/activity-service/boundary.mjs';

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

function shiftDateOnly(dateLike, deltaDays) {
  const date = new Date(`${String(dateLike)}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + Number(deltaDays || 0));
  return date.toISOString().slice(0, 10);
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

function createAdminAuth(createActorSession, resolveSessionFromBearer, actor) {
  const token = createActorSession(actor);
  const session = resolveSessionFromBearer(`Bearer ${token}`);
  return {
    token,
    csrfToken: String(session?.csrfToken || ''),
  };
}

async function main() {
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

    const ready = await requestJson(activityRuntime.base, '/ready');
    assert(ready.status === 200, 'activity-service ready failed', { ready });
    assert(Array.isArray(ready.body?.stableContracts), 'ready missing stableContracts', { ready });
    assert(Array.isArray(ready.body?.mainWriteTables), 'ready missing mainWriteTables', { ready });
    assert(ready.body?.stableContracts.includes('POST /api/activities/:id/complete'), 'ready missing complete contract', { ready });
    assert(
      JSON.stringify([...ready.body.mainWriteTables.map((item) => item.table)].sort()) === JSON.stringify(['c_activity_completions', 'p_activities']),
      'ready mainWriteTables drifted',
      { ready },
    );
    assert(
      JSON.stringify([...activityServiceOwnedRoutes].sort()) === JSON.stringify([
        '/api/activities',
        '/api/activities/:id/complete',
        '/api/b/activity-configs',
        '/api/b/activity-configs/:id',
        '/api/p/activities',
        '/api/p/activities/:id',
      ].sort()),
      'owned routes drifted',
      { activityServiceOwnedRoutes },
    );
    assert(
      JSON.stringify([...activityServiceStableContracts].sort()) === JSON.stringify([
        'DELETE /api/p/activities/:id',
        'GET /api/activities',
        'GET /api/b/activity-configs',
        'GET /api/p/activities',
        'POST /api/activities/:id/complete',
        'POST /api/b/activity-configs',
        'POST /api/p/activities',
        'PUT /api/b/activity-configs/:id',
        'PUT /api/p/activities/:id',
      ].sort()),
      'stable contracts drifted',
      { activityServiceStableContracts },
    );
    assert(
      JSON.stringify(activityServiceMainWriteTables.map((item) => item.table).sort()) === JSON.stringify(['c_activity_completions', 'p_activities']),
      'boundary export main tables drifted',
      { activityServiceMainWriteTables },
    );

    const actor = pickActivityActor(getState());
    assert(actor, 'missing activity actor');

    const mobile = generateMobile();
    const sendCode = await requestJson(userRuntime.base, '/api/auth/send-code', {
      method: 'POST',
      body: { mobile },
    });
    assert(sendCode.status === 200, 'send-code failed', { sendCode });

    const verifyBasic = await requestJson(userRuntime.base, '/api/auth/verify-basic', {
      method: 'POST',
      body: {
        name: '活动客户',
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

    const initialAdminAuth = createAdminAuth(createActorSession, resolveSessionFromBearer, actor);
    assert(initialAdminAuth.token && initialAdminAuth.csrfToken, 'failed to create activity admin session', { actor, initialAdminAuth });

    const createActivityAdminAuth = createAdminAuth(createActorSession, resolveSessionFromBearer, actor);
    const createActivity = await requestJson(activityRuntime.base, '/api/p/activities', {
      method: 'POST',
      headers: buildHeaders({
        token: createActivityAdminAuth.token,
        csrfToken: createActivityAdminAuth.csrfToken,
        traceId: 'activity-stable-p-create',
        tenantId: actor.tenantId,
        tenantCode: 'tenant-alpha',
      }),
      body: {
        title: `Activity stable P ${Date.now()}`,
        category: 'task',
        rewardPoints: 9,
        content: 'stable activity smoke',
        status: 'online',
      },
    });
    assert(createActivity.status === 200, 'p activity create failed', { createActivity });
    const createdActivity = createActivity.body?.activity || null;
    assert(Number(createdActivity?.id || 0) > 0, 'created activity missing id', { createActivity });
    assert(String(createdActivity?.sourceDomain || '') === 'activity', 'created activity missing sourceDomain=activity', { createActivity });

    const listPAdminAuth = createAdminAuth(createActorSession, resolveSessionFromBearer, actor);
    const listP = await requestJson(activityRuntime.base, '/api/p/activities', {
      headers: buildHeaders({
        token: listPAdminAuth.token,
        traceId: 'activity-stable-p-list',
        tenantId: actor.tenantId,
        tenantCode: 'tenant-alpha',
      }),
    });
    assert(listP.status === 200, 'p activity list failed', { listP });
    assert((listP.body?.activities || []).some((row) => Number(row?.id || 0) === Number(createdActivity.id)), 'created activity missing from p list', {
      listP,
      createdActivity,
    });

    const createConfigAdminAuth = createAdminAuth(createActorSession, resolveSessionFromBearer, actor);
    const createConfig = await requestJson(activityRuntime.base, '/api/b/activity-configs', {
      method: 'POST',
      headers: buildHeaders({
        token: createConfigAdminAuth.token,
        csrfToken: createConfigAdminAuth.csrfToken,
        traceId: 'activity-stable-b-create',
        tenantId: actor.tenantId,
        tenantCode: 'tenant-alpha',
      }),
      body: {
        title: `Activity stable B ${Date.now()}`,
        category: 'task',
        rewardPoints: 5,
        desc: 'b activity config smoke',
        status: 'online',
      },
    });
    assert(createConfig.status === 200, 'b activity config create failed', { createConfig });
    const configItem = createConfig.body?.item || null;
    assert(Number(configItem?.id || 0) > 0, 'created b config missing id', { createConfig });

    const listBAdminAuth = createAdminAuth(createActorSession, resolveSessionFromBearer, actor);
    const listB = await requestJson(activityRuntime.base, '/api/b/activity-configs', {
      headers: buildHeaders({
        token: listBAdminAuth.token,
        traceId: 'activity-stable-b-list',
        tenantId: actor.tenantId,
        tenantCode: 'tenant-alpha',
      }),
    });
    assert(listB.status === 200, 'b activity config list failed', { listB });
    assert((listB.body?.list || []).some((row) => Number(row?.id || 0) === Number(configItem.id)), 'created b config missing from b list', {
      listB,
      configItem,
    });

    const updateConfigAdminAuth = createAdminAuth(createActorSession, resolveSessionFromBearer, actor);
    const updateConfig = await requestJson(activityRuntime.base, `/api/b/activity-configs/${configItem.id}`, {
      method: 'PUT',
      headers: buildHeaders({
        token: updateConfigAdminAuth.token,
        csrfToken: updateConfigAdminAuth.csrfToken,
        traceId: 'activity-stable-b-update',
        tenantId: actor.tenantId,
        tenantCode: 'tenant-alpha',
      }),
      body: {
        title: `${configItem.title} updated`,
        rewardPoints: 7,
      },
    });
    assert(updateConfig.status === 200, 'b activity config update failed', { updateConfig });

    const listActivities = await requestJson(activityRuntime.base, '/api/activities', {
      headers: buildHeaders({
        token: customerToken,
        traceId: 'activity-stable-c-list',
        tenantId: actor.tenantId,
        tenantCode: 'tenant-alpha',
      }),
    });
    assert(listActivities.status === 200, 'activity c list failed', { listActivities });
    assert((listActivities.body?.activities || []).some((row) => Number(row?.id || 0) === Number(createdActivity.id)), 'created activity missing from c list', {
      listActivities,
      createdActivity,
    });

    const completeNoAuth = await requestJson(activityRuntime.base, `/api/activities/${createdActivity.id}/complete`, {
      method: 'POST',
      headers: buildHeaders({
        traceId: 'activity-complete-no-auth',
        tenantId: actor.tenantId,
      }),
    });
    assert(completeNoAuth.status === 401, 'activity complete should require auth', { completeNoAuth });

    const completeNoCsrf = await requestJson(activityRuntime.base, `/api/activities/${createdActivity.id}/complete`, {
      method: 'POST',
      headers: buildHeaders({
        token: customerToken,
        traceId: 'activity-complete-no-csrf',
        tenantId: actor.tenantId,
        tenantCode: 'tenant-alpha',
      }),
    });
    assert(completeNoCsrf.status === 403, 'activity complete should require csrf', { completeNoCsrf });

    const completeTraceId = 'activity-complete-success';
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
    assert(complete.body?.ok === true, 'activity complete missing ok', { complete });
    assert(Number(complete.body?.reward || 0) === Number(createdActivity.rewardPoints || 0), 'activity complete reward drifted', {
      complete,
      createdActivity,
    });

    const listActivitiesAfterComplete = await requestJson(activityRuntime.base, '/api/activities', {
      headers: buildHeaders({
        token: customerToken,
        traceId: 'activity-stable-c-list-after-complete',
        tenantId: actor.tenantId,
        tenantCode: 'tenant-alpha',
      }),
    });
    assert(listActivitiesAfterComplete.status === 200, 'activity c list after complete failed', { listActivitiesAfterComplete });
    const completedActivityAfterComplete = (listActivitiesAfterComplete.body?.activities || []).find(
      (row) => Number(row?.id || 0) === Number(createdActivity.id),
    );
    assert(completedActivityAfterComplete?.completed === true, 'completed activity should be marked completed immediately', {
      createdActivity,
      completedActivityAfterComplete,
      listActivitiesAfterComplete,
    });

    const completionRow = (getState().activityCompletions || []).find(
      (row) => Number(row?.userId || 0) === Number(customerId) && Number(row?.activityId || 0) === Number(createdActivity.id),
    );
    assert(completionRow, 'activity completion row missing after complete', { customerId, createdActivity });
    completionRow.completedDate = shiftDateOnly(String(completionRow.completedDate || new Date().toISOString().slice(0, 10)), -1);
    persistState();

    const listActivitiesAfterHistoryShift = await requestJson(activityRuntime.base, '/api/activities', {
      headers: buildHeaders({
        token: customerToken,
        traceId: 'activity-stable-c-list-history-shift',
        tenantId: actor.tenantId,
        tenantCode: 'tenant-alpha',
      }),
    });
    assert(listActivitiesAfterHistoryShift.status === 200, 'activity c list after history shift failed', { listActivitiesAfterHistoryShift });
    const completedActivityAfterHistoryShift = (listActivitiesAfterHistoryShift.body?.activities || []).find(
      (row) => Number(row?.id || 0) === Number(createdActivity.id),
    );
    assert(completedActivityAfterHistoryShift?.completed === true, 'historical completion should still mark activity completed', {
      createdActivity,
      completionRow,
      completedActivityAfterHistoryShift,
      listActivitiesAfterHistoryShift,
    });

    const duplicate = await requestJson(activityRuntime.base, `/api/activities/${createdActivity.id}/complete`, {
      method: 'POST',
      headers: buildHeaders({
        token: customerToken,
        csrfToken: customerCsrfToken,
        traceId: 'activity-complete-duplicate',
        tenantId: actor.tenantId,
        tenantCode: 'tenant-alpha',
      }),
    });
    assert(duplicate.status === 409, 'duplicate activity complete should be blocked', { duplicate });
    assert(String(duplicate.body?.code || '') === 'ALREADY_COMPLETED', 'duplicate activity complete code drifted', { duplicate });
    assert(String(duplicate.body?.message || '') === '该活动已参与', 'duplicate activity complete message drifted', { duplicate });

    const observability = await requestJson(activityRuntime.base, '/internal/activity-service/observability');
    assert(observability.status === 200, 'activity observability failed', { observability });
    const recentLogs = Array.isArray(observability.body?.recentLogs) ? observability.body.recentLogs : [];
    const successLog = recentLogs.find(
      (row) => String(row?.route || '') === 'POST /api/activities/:id/complete'
        && String(row?.trace_id || '') === completeTraceId
        && String(row?.result || '') === 'success',
    );
    assert(successLog, 'activity success log missing from observability', { recentLogs, completeTraceId });
    assert(Number(observability.body?.metrics?.activityComplete?.success || 0) >= 1, 'activity success metric missing', {
      observability,
    });

    console.log(
      JSON.stringify(
        {
          ok: true,
          checks: [
            'activity-ready-reports-stable-contracts',
            'p-activity-routes-available',
            'b-activity-routes-available',
            'activity-list-visible-to-owned-customer',
            'activity-complete-auth-required',
            'activity-complete-csrf-required',
            'activity-complete-success',
            'activity-complete-reflects-completed-in-list',
            'activity-history-complete-still-reflects-completed',
            'activity-complete-duplicate-blocked',
            'activity-observability-success-visible',
          ],
          activityServiceBase: activityRuntime.base,
          pointsServiceBase: pointsRuntime.base,
          userServiceBase: userRuntime.base,
          activityId: Number(createdActivity.id),
          configId: Number(configItem.id),
          customerId,
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
