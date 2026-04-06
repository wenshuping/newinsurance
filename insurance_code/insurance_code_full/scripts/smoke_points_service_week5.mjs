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
  return { status: res.status, body };
}

async function createVerifiedCustomerSession(deps) {
  const { executeVerifyBasic, getState, nextId, createSession, formatUser, persistState, recordPoints } = deps;
  const state = getState();
  const ownerAgent = (Array.isArray(state.agents) ? state.agents : []).find((row) => Number(row?.tenantId || 0) > 0) || null;
  const tenant = Array.isArray(state.tenants)
    ? state.tenants.find((row) => Number(row?.id || 0) === Number(ownerAgent?.tenantId || 0)) || state.tenants[0]
    : null;
  assert(tenant?.id, 'tenant seed missing');

  const mobile = `139${String(Date.now()).slice(-8)}`;
  const session = await executeVerifyBasic({
    name: 'Week5 Points Smoke',
    mobile,
    code: process.env.DEV_SMS_CODE || '123456',
    tenant,
    userAgent: 'points-service-smoke',
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
    name: 'Week5 Smoke 商品',
    title: 'Week5 Smoke 商品',
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

async function main() {
  const [
    { createPointsServiceApp },
    { closeState, createSession, formatUser, getState, initializeState, nextId, persistState },
    { executeVerifyBasic },
    { recordPoints },
  ] = await Promise.all([
    import('../server/microservices/points-service/app.mjs'),
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
  readiness.ready = true;

  const app = createPointsServiceApp({ readiness });
  const server = app.listen(0, HOST);
  await new Promise((resolve) => server.once('listening', resolve));

  const addr = server.address();
  const port = Number(addr?.port || 0);
  const base = `http://${HOST}:${port}`;

  try {
    const checks = [];

    const health = await requestJson(base, '/health');
    checks.push({
      name: 'points.health',
      status: health.status,
      ok: health.status === 200 && health.body?.service === 'points-service',
    });

    const ready = await requestJson(base, '/ready');
    checks.push({
      name: 'points.ready',
      status: ready.status,
      ok: ready.status === 200 && ready.body?.ok === true,
    });

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

    const authHeaders = {
      authorization: `Bearer ${auth.token}`,
      'x-csrf-token': auth.csrfToken,
      'x-tenant-id': String(auth.tenantId),
      'content-type': 'application/json',
    };

    const summaryBefore = await requestJson(base, '/api/points/summary', {
      method: 'GET',
      headers: authHeaders,
    });
    assert(summaryBefore.status === 200, `points summary before sign-in failed: ${summaryBefore.status}`);
    const balanceBefore = Number(summaryBefore.body?.balance || 0);
    assert(balanceBefore >= 200, `unexpected starting balance: ${balanceBefore}`);

    const signIn = await requestJson(base, '/api/sign-in', {
      method: 'POST',
      headers: authHeaders,
    });
    checks.push({
      name: 'points.sign-in',
      status: signIn.status,
      ok: signIn.status === 200 && Number(signIn.body?.reward || 0) > 0,
    });
    const balanceAfterSignIn = Number(signIn.body?.balance || 0);
    assert(balanceAfterSignIn > balanceBefore, 'sign-in should increase balance');

    const signInAgain = await requestJson(base, '/api/sign-in', {
      method: 'POST',
      headers: authHeaders,
    });
    checks.push({
      name: 'points.sign-in.idempotent',
      status: signInAgain.status,
      ok: signInAgain.status === 409 && signInAgain.body?.code === 'ALREADY_SIGNED',
    });

    const seededProduct = ensureRedeemableProduct({
      getState,
      nextId,
      persistState,
      maxPointsCost: balanceAfterSignIn,
      tenantId: auth.tenantId,
      creatorId: auth.ownerAgentId,
    });

    const mallItems = await requestJson(base, '/api/mall/items', {
      method: 'GET',
      headers: authHeaders,
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
      },
      body: JSON.stringify({ itemId: Number(item.id) }),
    });
    checks.push({
      name: 'points.redeem',
      status: redeem.status,
      ok: redeem.status === 200 && Number(redeem.body?.redemption?.id || 0) > 0,
    });

    const redemptionId = Number(redeem.body?.redemption?.id || 0);
    const orderNo = String(redeem.body?.redemption?.orderNo || '');
    const writeoffToken = String(redeem.body?.token || '');
    assert(redemptionId > 0, 'redeem redemption id missing');
    assert(orderNo, 'redeem orderNo missing');
    assert(writeoffToken, 'redeem writeoff token missing');

    const summaryAfterRedeem = await requestJson(base, '/api/points/summary', {
      method: 'GET',
      headers: authHeaders,
    });
    assert(summaryAfterRedeem.status === 200, `points summary after redeem failed: ${summaryAfterRedeem.status}`);
    const balanceAfterRedeem = Number(summaryAfterRedeem.body?.balance || 0);
    assert(balanceAfterRedeem === balanceAfterSignIn - Number(item.pointsCost || 0), 'redeem balance mismatch');

    const orders = await requestJson(base, '/api/orders', {
      method: 'GET',
      headers: authHeaders,
    });
    checks.push({
      name: 'points.orders.list',
      status: orders.status,
      ok: orders.status === 200 && Array.isArray(orders.body?.list),
    });
    assert(
      Array.isArray(orders.body?.list) && orders.body.list.some((row) => String(row?.orderNo || '') === orderNo),
      'orders list missing redeemed order',
    );
    const order = (orders.body?.list || []).find((row) => String(row?.orderNo || '') === orderNo) || null;
    assert(Number(order?.id || 0) > 0, 'orders list returned order without id');

    const orderDetail = await requestJson(base, `/api/orders/${Number(order.id)}`, {
      method: 'GET',
      headers: authHeaders,
    });
    checks.push({
      name: 'points.orders.detail',
      status: orderDetail.status,
      ok: orderDetail.status === 200 && String(orderDetail.body?.order?.orderNo || '') === orderNo,
    });

    const redemptions = await requestJson(base, '/api/redemptions', {
      method: 'GET',
      headers: authHeaders,
    });
    checks.push({
      name: 'points.redemptions.list',
      status: redemptions.status,
      ok: redemptions.status === 200 && Array.isArray(redemptions.body?.list),
    });
    assert(
      Array.isArray(redemptions.body?.list) && redemptions.body.list.some((row) => Number(row?.id || 0) === redemptionId),
      'redemptions list missing redemption',
    );

    const writeoff = await requestJson(base, `/api/redemptions/${redemptionId}/writeoff`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ token: writeoffToken }),
    });
    checks.push({
      name: 'points.writeoff',
      status: writeoff.status,
      ok: writeoff.status === 200 && writeoff.body?.ok === true,
    });

    const writeoffAgain = await requestJson(base, `/api/redemptions/${redemptionId}/writeoff`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ token: writeoffToken }),
    });
    checks.push({
      name: 'points.writeoff.idempotent',
      status: writeoffAgain.status,
      ok: writeoffAgain.status === 409 && writeoffAgain.body?.code === 'ALREADY_WRITTEN_OFF',
    });

    const failed = checks.filter((item) => !item.ok);
    const report = {
      ok: failed.length === 0,
      base,
      customerMobile: auth.mobile,
      tenantId: auth.tenantId,
      itemId: Number(item.id),
      redemptionId,
      balances: {
        before: balanceBefore,
        afterSignIn: balanceAfterSignIn,
        afterRedeem: balanceAfterRedeem,
      },
      checks,
    };

    console.log(JSON.stringify(report, null, 2));
    if (failed.length > 0) process.exitCode = 1;
  } finally {
    readiness.ready = false;
    await new Promise((resolve) => server.close(resolve));
    await closeState();
  }
}

main().catch((err) => {
  console.error(`[smoke:points-service-week5] ${err.message}`);
  process.exit(1);
});
