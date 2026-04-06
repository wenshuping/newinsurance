process.env.STORAGE_BACKEND = process.env.STORAGE_BACKEND || 'file';

const HOST = '127.0.0.1';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function requestJson(base, path, init = {}) {
  const res = await fetch(`${base}${path}`, init);
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return {
    status: res.status,
    body,
    headers: {
      traceId: String(res.headers.get('x-trace-id') || ''),
      requestId: String(res.headers.get('x-request-id') || ''),
      serviceName: String(res.headers.get('x-service-name') || ''),
    },
  };
}

async function createVerifiedCustomerSession(deps) {
  const { executeVerifyBasic, getState, nextId, createSession, formatUser, persistState, recordPoints } = deps;
  const state = getState();
  const ownerAgent = (Array.isArray(state.agents) ? state.agents : []).find((row) => Number(row?.tenantId || 0) > 0) || null;
  const tenant = Array.isArray(state.tenants)
    ? state.tenants.find((row) => Number(row?.id || 0) === Number(ownerAgent?.tenantId || 0)) || state.tenants[0]
    : null;
  assert(tenant?.id, 'tenant seed missing');

  const mobile = `138${String(Date.now()).slice(-8)}`;
  const session = await executeVerifyBasic({
    name: 'Week7 Points Smoke',
    mobile,
    code: process.env.DEV_SMS_CODE || '123456',
    tenant,
    userAgent: 'points-service-week7-smoke',
    getState,
    nextId,
    createSession,
    formatUser,
    persistState,
    recordPoints,
  });

  const user = (state.users || []).find((row) => String(row.mobile || '') === mobile);
  if (user && ownerAgent) {
    user.ownerUserId = Number(ownerAgent.id);
    user.tenantId = Number(ownerAgent.tenantId);
    user.orgId = Number(ownerAgent.orgId || user.orgId || 0);
    user.teamId = Number(ownerAgent.teamId || user.teamId || 0);
    persistState();
  }

  return {
    tenantId: Number(tenant.id),
    ownerAgentId: Number(ownerAgent?.id || 0),
    mobile,
    token: String(session.token || ''),
    csrfToken: String(session.csrfToken || ''),
  };
}

function ensureRedeemableProduct({ getState, nextId, persistState, maxPointsCost, tenantId, creatorId }) {
  const state = getState();
  const existing = (Array.isArray(state.pProducts) ? state.pProducts : []).find(
    (row) =>
      Number(row?.tenantId || 0) === Number(tenantId) &&
      Number(row?.stock || 0) > 0 &&
      Number(row?.pointsCost || row?.points || 0) > 0 &&
      Number(row?.pointsCost || row?.points || 0) <= maxPointsCost,
  );
  if (existing) return existing;

  const now = new Date().toISOString();
  const product = {
    id: nextId(state.pProducts || []),
    tenantId: Number(tenantId),
    name: 'Week7 Smoke 商品',
    title: 'Week7 Smoke 商品',
    pointsCost: Math.max(1, Math.min(20, maxPointsCost)),
    stock: 9,
    status: 'active',
    isActive: true,
    createdBy: Number(creatorId || 0),
    creatorRole: 'company_admin',
    templateScope: 'tenant',
    media: [],
    createdAt: now,
    updatedAt: now,
  };
  state.pProducts.push(product);
  persistState();
  return product;
}

function findTransition(metrics, transition) {
  return (Array.isArray(metrics?.orderTransitions) ? metrics.orderTransitions : []).find((row) => row.transition === transition);
}

function findErrorCount(metrics, code) {
  return (Array.isArray(metrics?.errorCounts) ? metrics.errorCounts : []).find((row) => row.code === code);
}

function findRouteLog(snapshot, routeIncludes) {
  return (Array.isArray(snapshot?.recentLogs) ? snapshot.recentLogs : []).find((row) => String(row?.route || '').includes(routeIncludes));
}

async function main() {
  const [
    { createPointsServiceApp },
    { getPointsObservabilitySnapshot, resetPointsObservability },
    { closeState, createSession, formatUser, getState, initializeState, nextId, persistState },
    { executeVerifyBasic },
    { recordPoints },
  ] = await Promise.all([
    import('../server/microservices/points-service/app.mjs'),
    import('../server/microservices/points-service/observability.mjs'),
    import('../server/skeleton-c-v1/common/state.mjs'),
    import('../server/skeleton-c-v1/usecases/auth-write.usecase.mjs'),
    import('../server/skeleton-c-v1/services/points.service.mjs'),
  ]);

  const readiness = {
    ready: false,
    isReady() {
      return this.ready;
    },
  };

  await initializeState();
  const auth = await createVerifiedCustomerSession({
    executeVerifyBasic,
    getState,
    nextId,
    createSession,
    formatUser,
    persistState,
    recordPoints,
  });
  assert(auth.token, 'customer token missing');
  assert(auth.csrfToken, 'customer csrf token missing');

  const seededProduct = ensureRedeemableProduct({
    getState,
    nextId,
    persistState,
    maxPointsCost: 100,
    tenantId: auth.tenantId,
    creatorId: auth.ownerAgentId,
  });

  resetPointsObservability();
  readiness.ready = true;

  const app = createPointsServiceApp({ readiness });
  const server = app.listen(0, HOST);
  await new Promise((resolve) => server.once('listening', resolve));

  const addr = server.address();
  const port = Number(addr?.port || 0);
  const base = `http://${HOST}:${port}`;

  try {
    const checks = [];
    const authHeaders = {
      authorization: `Bearer ${auth.token}`,
      'x-csrf-token': auth.csrfToken,
      'x-tenant-id': String(auth.tenantId),
      'content-type': 'application/json',
    };

    const health = await requestJson(base, '/health', {
      headers: { 'x-trace-id': 'week7-health-trace' },
    });
    checks.push({
      name: 'points.health',
      status: health.status,
      ok: health.status === 200 && health.body?.service === 'points-service' && health.headers.traceId === 'week7-health-trace',
    });

    const ready = await requestJson(base, '/ready', {
      headers: { 'x-trace-id': 'week7-ready-trace' },
    });
    checks.push({
      name: 'points.ready',
      status: ready.status,
      ok: ready.status === 200 && ready.body?.ok === true && ready.headers.traceId === 'week7-ready-trace',
    });

    const summaryBefore = await requestJson(base, '/api/points/summary', {
      method: 'GET',
      headers: {
        ...authHeaders,
        'x-trace-id': 'week7-summary-before',
      },
    });
    assert(summaryBefore.status === 200, `points summary before sign-in failed: ${summaryBefore.status}`);
    const balanceBefore = Number(summaryBefore.body?.balance || 0);
    assert(balanceBefore >= 10, `unexpected starting balance: ${balanceBefore}`);

    const signIn = await requestJson(base, '/api/sign-in', {
      method: 'POST',
      headers: {
        ...authHeaders,
        'x-trace-id': 'week7-signin-success',
      },
    });
    checks.push({
      name: 'points.sign-in',
      status: signIn.status,
      ok: signIn.status === 200 && Number(signIn.body?.reward || 0) > 0 && signIn.headers.traceId === 'week7-signin-success',
    });
    const balanceAfterSignIn = Number(signIn.body?.balance || 0);
    assert(balanceAfterSignIn > balanceBefore, 'sign-in should increase balance');

    const signInAgain = await requestJson(base, '/api/sign-in', {
      method: 'POST',
      headers: {
        ...authHeaders,
        'x-trace-id': 'week7-signin-duplicate',
      },
    });
    checks.push({
      name: 'points.sign-in.idempotent',
      status: signInAgain.status,
      ok: signInAgain.status === 409 && signInAgain.body?.code === 'ALREADY_SIGNED',
    });

    const mallItems = await requestJson(base, '/api/mall/items', {
      method: 'GET',
      headers: {
        ...authHeaders,
        'x-trace-id': 'week7-mall-items',
      },
    });
    assert(mallItems.status === 200, `mall items failed: ${mallItems.status}`);
    const item = (Array.isArray(mallItems.body?.items) ? mallItems.body.items : []).find(
      (row) => Number(row?.stock || 0) > 0 && Number(row?.pointsCost || 0) > 0 && Number(row?.pointsCost || 0) <= balanceAfterSignIn,
    ) || seededProduct;
    assert(item?.id, 'no redeemable mall item found for smoke');

    const redeem = await requestJson(base, '/api/mall/redeem', {
      method: 'POST',
      headers: {
        ...authHeaders,
        'x-action-confirm': 'YES',
        'x-trace-id': 'week7-redeem-success',
      },
      body: JSON.stringify({ itemId: Number(item.id) }),
    });
    checks.push({
      name: 'points.redeem',
      status: redeem.status,
      ok: redeem.status === 200 && Number(redeem.body?.redemption?.id || 0) > 0 && redeem.headers.traceId === 'week7-redeem-success',
    });

    const redemptionId = Number(redeem.body?.redemption?.id || 0);
    const orderNo = String(redeem.body?.redemption?.orderNo || '');
    const writeoffToken = String(redeem.body?.token || '');
    assert(redemptionId > 0, 'redeem redemption id missing');
    assert(orderNo, 'redeem orderNo missing');
    assert(writeoffToken, 'redeem writeoff token missing');

    const orders = await requestJson(base, '/api/orders', {
      method: 'GET',
      headers: {
        ...authHeaders,
        'x-trace-id': 'week7-orders-list',
      },
    });
    assert(orders.status === 200, `orders list failed: ${orders.status}`);
    const order = (orders.body?.list || []).find((row) => String(row?.orderNo || '') === orderNo) || null;
    assert(Number(order?.id || 0) > 0, 'orders list returned order without id');

    const orderDetail = await requestJson(base, `/api/orders/${Number(order.id)}`, {
      method: 'GET',
      headers: {
        ...authHeaders,
        'x-trace-id': 'week7-order-detail',
      },
    });
    checks.push({
      name: 'points.orders.detail',
      status: orderDetail.status,
      ok: orderDetail.status === 200 && String(orderDetail.body?.order?.orderNo || '') === orderNo,
    });

    const writeoff = await requestJson(base, `/api/redemptions/${redemptionId}/writeoff`, {
      method: 'POST',
      headers: {
        ...authHeaders,
        'x-trace-id': 'week7-writeoff-success',
      },
      body: JSON.stringify({ token: writeoffToken }),
    });
    checks.push({
      name: 'points.writeoff',
      status: writeoff.status,
      ok: writeoff.status === 200 && writeoff.body?.ok === true && writeoff.headers.traceId === 'week7-writeoff-success',
    });

    const writeoffAgain = await requestJson(base, `/api/redemptions/${redemptionId}/writeoff`, {
      method: 'POST',
      headers: {
        ...authHeaders,
        'x-trace-id': 'week7-writeoff-duplicate',
      },
      body: JSON.stringify({ token: writeoffToken }),
    });
    checks.push({
      name: 'points.writeoff.idempotent',
      status: writeoffAgain.status,
      ok: writeoffAgain.status === 409 && writeoffAgain.body?.code === 'ALREADY_WRITTEN_OFF',
    });

    const observability = await requestJson(base, '/internal/points-service/observability', {
      method: 'GET',
      headers: {
        'x-trace-id': 'week7-observability',
      },
    });
    checks.push({
      name: 'points.observability',
      status: observability.status,
      ok: observability.status === 200 && observability.body?.service === 'points-service',
    });
    assert(observability.status === 200, `observability snapshot failed: ${observability.status}`);

    const metrics = observability.body?.metrics || {};
    assert(metrics.signIn?.success === 1, `expected signIn success=1, got ${metrics.signIn?.success}`);
    assert(metrics.signIn?.fail === 1, `expected signIn fail=1, got ${metrics.signIn?.fail}`);
    assert(metrics.redeem?.success === 1, `expected redeem success=1, got ${metrics.redeem?.success}`);
    assert(metrics.redeem?.fail === 0, `expected redeem fail=0, got ${metrics.redeem?.fail}`);
    assert(metrics.writeoff?.success === 1, `expected writeoff success=1, got ${metrics.writeoff?.success}`);
    assert(metrics.writeoff?.fail === 1, `expected writeoff fail=1, got ${metrics.writeoff?.fail}`);
    assert(Number(metrics.pointsMovements?.creditCount || 0) >= 1, 'creditCount should be >= 1');
    assert(Number(metrics.pointsMovements?.debitCount || 0) >= 1, 'debitCount should be >= 1');
    assert(Number(findTransition(metrics, 'none->created')?.count || 0) >= 1, 'missing none->created transition');
    assert(Number(findTransition(metrics, 'created->paid')?.count || 0) >= 1, 'missing created->paid transition');
    assert(Number(findTransition(metrics, 'paid->fulfilled')?.count || 0) >= 1, 'missing paid->fulfilled transition');
    assert(Number(findErrorCount(metrics, 'ALREADY_SIGNED')?.count || 0) >= 1, 'missing ALREADY_SIGNED error count');
    assert(Number(findErrorCount(metrics, 'ALREADY_WRITTEN_OFF')?.count || 0) >= 1, 'missing ALREADY_WRITTEN_OFF error count');

    const snapshot = observability.body;
    const signInLog = findRouteLog(snapshot, '/api/sign-in');
    const redeemLog = findRouteLog(snapshot, '/api/mall/redeem');
    const writeoffLog = findRouteLog(snapshot, '/api/redemptions/');
    assert(signInLog?.trace_id, 'missing sign-in trace log');
    assert(Object.prototype.hasOwnProperty.call(signInLog || {}, 'user_id'), 'sign-in log missing user_id');
    assert(Object.prototype.hasOwnProperty.call(redeemLog || {}, 'order_id'), 'redeem log missing order_id field');
    assert(Object.prototype.hasOwnProperty.call(writeoffLog || {}, 'redemption_id'), 'writeoff log missing redemption_id field');

    const report = {
      ok: checks.every((item) => item.ok),
      base,
      customerMobile: auth.mobile,
      tenantId: auth.tenantId,
      orderId: Number(order?.id || 0),
      redemptionId,
      observability: {
        signIn: metrics.signIn,
        redeem: metrics.redeem,
        writeoff: metrics.writeoff,
        pointsMovements: metrics.pointsMovements,
        orderTransitions: metrics.orderTransitions,
        errorCounts: metrics.errorCounts,
      },
      checks,
    };

    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) process.exitCode = 1;
  } finally {
    readiness.ready = false;
    await new Promise((resolve) => server.close(resolve));
    await closeState();
  }
}

main().catch((err) => {
  console.error(`[smoke:points-service-week7] ${err.message}`);
  process.exit(1);
});
