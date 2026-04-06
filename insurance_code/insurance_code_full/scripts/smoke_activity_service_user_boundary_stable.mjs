#!/usr/bin/env node

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

function nextRowId(rows) {
  return (Array.isArray(rows) ? rows : []).reduce((max, row) => Math.max(max, Number(row?.id || 0)), 0) + 1;
}

function buildCustomerHeaders({ token = '', csrfToken = '', tenantId = 0 }) {
  return {
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
    ...(tenantId > 0 ? { 'x-tenant-id': String(tenantId) } : {}),
  };
}

function createActivityRow({ id, tenantId, createdBy, title }) {
  const now = new Date().toISOString();
  return {
    id,
    tenantId,
    title,
    sourceDomain: 'activity',
    category: 'task',
    rewardPoints: 5,
    sortOrder: id,
    participants: 0,
    content: title,
    media: [],
    status: 'online',
    createdBy,
    creatorRole: 'agent',
    templateScope: 'tenant',
    createdAt: now,
    updatedAt: now,
  };
}

async function main() {
  const [
    stateModule,
    { createUserServiceApp },
    { createActivityServiceApp },
  ] = await Promise.all([
    import('../server/skeleton-c-v1/common/state.mjs'),
    import('../server/microservices/user-service/app.mjs'),
    import('../server/microservices/activity-service/app.mjs'),
  ]);

  const { closeState, getState, initializeState, persistState } = stateModule;

  await initializeState();

  let userRuntime;
  let activityRuntime;

  try {
    userRuntime = await listen(createUserServiceApp());
    activityRuntime = await listen(createActivityServiceApp());

    const ready = await requestJson(activityRuntime.base, '/ready');
    assert(ready.status === 200, 'activity-service ready failed', { ready });
    const stableContracts = new Set(ready.body?.stableContracts || []);
    assert(stableContracts.has('POST /api/activities/:id/complete'), 'stable complete contract missing from ready', { ready });
    const mainWriteTables = (ready.body?.mainWriteTables || []).map((row) => String(row?.table || ''));
    assert(mainWriteTables.includes('p_activities'), 'ready missing p_activities ownership', { ready });
    assert(mainWriteTables.includes('c_activity_completions'), 'ready missing c_activity_completions ownership', { ready });
    assert(!mainWriteTables.includes('app_users') && !mainWriteTables.includes('c_customers') && !mainWriteTables.includes('p_sessions'), 'ready incorrectly claims user write tables', { ready });

    const meRoute = await requestJson(activityRuntime.base, '/api/me');
    assert(meRoute.status === 404, 'activity-service should not expose /api/me', { meRoute });

    const state = getState();
    const ownerAgent = (state.agents || []).find(
      (row) => Number(row.tenantId || 0) > 0 && String(row.role || '').toLowerCase() !== 'manager'
    );
    assert(ownerAgent, 'missing owner agent seed');

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
        code: String(sendCode.body?.dev_code || '123456'),
        tenantId: Number(ownerAgent.tenantId || 1),
      },
    });
    assert(verifyBasic.status === 200, 'verify-basic failed', { verifyBasic });

    const customerId = Number(verifyBasic.body?.user?.id || 0);
    const customerToken = String(verifyBasic.body?.token || '');
    const customerCsrfToken = String(verifyBasic.body?.csrfToken || '');
    assert(customerId > 0 && customerToken && customerCsrfToken, 'customer auth payload missing', { verifyBasic });

    const customer = (state.users || []).find((row) => Number(row.id || 0) === customerId);
    assert(customer, 'customer row missing after verify-basic', { customerId });

    customer.tenantId = Number(ownerAgent.tenantId || 1);
    customer.orgId = Number(ownerAgent.orgId || 0);
    customer.teamId = Number(ownerAgent.teamId || 0);
    customer.ownerUserId = 0;

    const visibleActivityId = nextRowId(state.activities);
    const hiddenActivityId = visibleActivityId + 1;

    state.activities.push(
      createActivityRow({
        id: visibleActivityId,
        tenantId: Number(ownerAgent.tenantId || 1),
        createdBy: Number(ownerAgent.id || 0),
        title: `Week16 activity visible ${Date.now()}`,
      }),
    );
    state.activities.push(
      createActivityRow({
        id: hiddenActivityId,
        tenantId: Number(ownerAgent.tenantId || 1) === 1 ? 2 : 1,
        createdBy: Number(ownerAgent.id || 0),
        title: `Week16 activity hidden ${Date.now()}`,
      }),
    );
    persistState();

    const withoutOwner = await requestJson(activityRuntime.base, '/api/activities', {
      headers: buildCustomerHeaders({
        token: customerToken,
        tenantId: Number(ownerAgent.tenantId || 1),
      }),
    });
    assert(withoutOwner.status === 200, 'activities list without owner failed', { withoutOwner });
    const withoutOwnerIds = new Set((withoutOwner.body?.activities || []).map((row) => Number(row?.id || 0)));
    assert(!withoutOwnerIds.has(visibleActivityId), 'owner-less customer should not see same-tenant activity', {
      withoutOwner,
      visibleActivityId,
    });

    customer.ownerUserId = Number(ownerAgent.id || 0);
    persistState();

    const withOwner = await requestJson(activityRuntime.base, '/api/activities', {
      headers: buildCustomerHeaders({
        token: customerToken,
        tenantId: Number(ownerAgent.tenantId || 1),
      }),
    });
    assert(withOwner.status === 200, 'activities list with owner failed', { withOwner });
    const withOwnerIds = new Set((withOwner.body?.activities || []).map((row) => Number(row?.id || 0)));
    assert(withOwnerIds.has(visibleActivityId), 'owned same-tenant activity should be visible', {
      withOwner,
      visibleActivityId,
    });
    assert(!withOwnerIds.has(hiddenActivityId), 'cross-tenant activity leaked to customer list', {
      withOwner,
      hiddenActivityId,
    });

    const completeNoAuth = await requestJson(activityRuntime.base, `/api/activities/${visibleActivityId}/complete`, {
      method: 'POST',
    });
    assert(completeNoAuth.status === 401, 'activity complete should still require bearer token', { completeNoAuth });

    const completeNoCsrf = await requestJson(activityRuntime.base, `/api/activities/${visibleActivityId}/complete`, {
      method: 'POST',
      headers: buildCustomerHeaders({
        token: customerToken,
        tenantId: Number(ownerAgent.tenantId || 1),
      }),
    });
    assert(completeNoCsrf.status === 403, 'activity complete should still require shared csrf protocol', { completeNoCsrf });

    console.log(
      JSON.stringify(
        {
          ok: true,
          checks: [
            'activity-ready-exports-stable-boundary',
            'activity-no-me-route',
            'activities-hidden-without-owner',
            'activities-visible-with-owner',
            'cross-tenant-activity-hidden',
            'activity-complete-bearer-required',
            'activity-complete-csrf-required',
          ],
          visibleActivityId,
          hiddenActivityId,
          customerId,
          tenantId: Number(ownerAgent.tenantId || 1),
        },
        null,
        2,
      ),
    );
  } finally {
    if (activityRuntime?.server) await closeServer(activityRuntime.server);
    if (userRuntime?.server) await closeServer(userRuntime.server);
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
