#!/usr/bin/env node

process.env.STORAGE_BACKEND = process.env.STORAGE_BACKEND || 'file';

const HOST = '127.0.0.1';

function assert(condition, message, context = null) {
  if (condition) return;
  const err = new Error(message);
  err.context = context;
  throw err;
}

function generateMobile() {
  const suffix = String(Date.now()).slice(-8);
  return `139${suffix}`;
}

function idempotencyKey(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
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

async function requestJson(base, path, { method = 'GET', headers = {}, body } = {}) {
  const response = await fetch(`${base}${path}`, {
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

function pickOwnerAgent(state) {
  const agents = Array.isArray(state.agents) ? state.agents : [];
  const owner = agents.find((row) => Number(row?.tenantId || 0) > 0);
  assert(owner, 'owner agent seed missing');
  return owner;
}

function seedVisibleMallData({ getState, nextId, persistState, tenantId, creatorId, pointsCost = 10 }) {
  const state = getState();
  const now = new Date().toISOString();

  const product = {
    id: nextId(state.pProducts || []),
    tenantId: Number(tenantId),
    name: 'Week5 总联调商品',
    title: 'Week5 总联调商品',
    pointsCost: Number(pointsCost),
    stock: 9,
    status: 'active',
    isActive: true,
    createdBy: Number(creatorId || 0),
    creatorRole: 'agent',
    templateScope: 'tenant',
    media: [],
    createdAt: now,
    updatedAt: now,
  };

  const activity = {
    id: nextId(state.mallActivities || []),
    tenantId: Number(tenantId),
    title: 'Week5 总联调活动',
    displayTitle: 'Week5 总联调活动',
    description: '用于 Week5 gateway -> user-service -> points-service 全链路校验',
    rewardPoints: 30,
    status: 'active',
    createdBy: Number(creatorId || 0),
    creatorRole: 'agent',
    templateScope: 'tenant',
    media: [],
    createdAt: now,
    updatedAt: now,
  };

  state.pProducts.push(product);
  state.mallActivities = Array.isArray(state.mallActivities) ? state.mallActivities : [];
  state.mallActivities.push(activity);
  persistState();
  return { product, activity };
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
    { closeState, getState, initializeState, nextId, persistState },
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
    })
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
    const checks = [];
    const state = getState();
    const ownerAgent = pickOwnerAgent(state);
    const tenantId = Number(ownerAgent.tenantId || 1);
    const mobile = generateMobile();

    const pushCheck = (name, response, ok) => {
      checks.push({
        name,
        status: Number(response?.status || 0),
        ok: Boolean(ok),
        mode: response?.headers?.['x-gateway-mode'] || null,
        target: response?.headers?.['x-gateway-target-service'] || null,
      });
    };

    const sendCode = await requestJson(gateway.base, '/api/auth/send-code', {
      method: 'POST',
      headers: { 'x-tenant-id': String(tenantId) },
      body: { mobile },
    });
    pushCheck('auth.send-code', sendCode, sendCode.status === 200 && sendCode.body?.ok === true);
    assert(sendCode.status === 200, 'send-code failed', sendCode);

    const verifyBasic = await requestJson(gateway.base, '/api/auth/verify-basic', {
      method: 'POST',
      headers: { 'x-tenant-id': String(tenantId) },
      body: {
        name: '张三',
        mobile,
        code: String(sendCode.body?.dev_code || '123456'),
        tenantId,
      },
    });
    const token = String(verifyBasic.body?.token || '');
    const csrfToken = String(verifyBasic.body?.csrfToken || '');
    pushCheck('auth.verify-basic', verifyBasic, verifyBasic.status === 200 && Boolean(token) && Boolean(csrfToken));
    assert(verifyBasic.status === 200, 'verify-basic failed', verifyBasic);

    const user = (getState().users || []).find((row) => String(row.mobile || '') === mobile);
    assert(user, 'customer row missing after verify-basic');
    user.ownerUserId = Number(ownerAgent.id);
    user.tenantId = Number(ownerAgent.tenantId || tenantId);
    user.orgId = Number(ownerAgent.orgId || user.orgId || 0);
    user.teamId = Number(ownerAgent.teamId || user.teamId || 0);
    persistState();

    const seeded = seedVisibleMallData({
      getState,
      nextId,
      persistState,
      tenantId,
      creatorId: Number(ownerAgent.id),
      pointsCost: 10,
    });

    const authHeaders = {
      authorization: `Bearer ${token}`,
      'x-csrf-token': csrfToken,
      'x-tenant-id': String(tenantId),
    };

    const me = await requestJson(gateway.base, '/api/me', {
      method: 'GET',
      headers: authHeaders,
    });
    pushCheck('me.get', me, me.status === 200 && me.body?.user?.mobile === mobile);
    assert(me.status === 200, 'me failed', me);

    const signIn = await requestJson(gateway.base, '/api/sign-in', {
      method: 'POST',
      headers: authHeaders,
    });
    pushCheck('points.sign-in', signIn, signIn.status === 200 && Number(signIn.body?.reward || 0) > 0);
    assert(signIn.status === 200, 'sign-in failed', signIn);

    const signInAgain = await requestJson(gateway.base, '/api/sign-in', {
      method: 'POST',
      headers: authHeaders,
    });
    pushCheck(
      'points.sign-in.idempotent',
      signInAgain,
      signInAgain.status === 409 && signInAgain.body?.code === 'ALREADY_SIGNED'
    );
    assert(signInAgain.status === 409, 'repeat sign-in should be 409', signInAgain);

    const pointsSummary = await requestJson(gateway.base, '/api/points/summary', {
      method: 'GET',
      headers: authHeaders,
    });
    const balanceAfterSignIn = Number(pointsSummary.body?.balance || 0);
    pushCheck('points.summary', pointsSummary, pointsSummary.status === 200 && balanceAfterSignIn > 0);
    assert(pointsSummary.status === 200, 'points summary failed', pointsSummary);

    const pointsDetail = await requestJson(gateway.base, '/api/points/detail', {
      method: 'GET',
      headers: authHeaders,
    });
    pushCheck(
      'points.detail',
      pointsDetail,
      pointsDetail.status === 200 && Array.isArray(pointsDetail.body?.groups)
    );
    assert(pointsDetail.status === 200, 'points detail failed', pointsDetail);

    const mallItems = await requestJson(gateway.base, '/api/mall/items', {
      method: 'GET',
      headers: authHeaders,
    });
    const mallItem = Array.isArray(mallItems.body?.items)
      ? mallItems.body.items.find((row) => Number(row?.id || 0) === Number(seeded.product.id))
      : null;
    pushCheck('mall.items', mallItems, mallItems.status === 200 && Boolean(mallItem));
    assert(mallItems.status === 200 && mallItem, 'mall items missing seeded product', mallItems);

    const mallActivities = await requestJson(gateway.base, '/api/mall/activities', {
      method: 'GET',
      headers: authHeaders,
    });
    const mallActivity = Array.isArray(mallActivities.body?.list)
      ? mallActivities.body.list.find((row) => Number(row?.id || 0) === Number(seeded.activity.id))
      : null;
    pushCheck('mall.activities', mallActivities, mallActivities.status === 200 && Boolean(mallActivity));
    assert(mallActivities.status === 200 && mallActivity, 'mall activities missing seeded activity', mallActivities);

    const redeem = await requestJson(gateway.base, '/api/mall/redeem', {
      method: 'POST',
      headers: {
        ...authHeaders,
        'x-action-confirm': 'YES',
      },
      body: { itemId: Number(seeded.product.id) },
    });
    const redemptionId = Number(redeem.body?.redemption?.id || 0);
    const orderNo = String(redeem.body?.redemption?.orderNo || '');
    const writeoffToken = String(redeem.body?.token || '');
    pushCheck('mall.redeem', redeem, redeem.status === 200 && redemptionId > 0 && Boolean(writeoffToken));
    assert(redeem.status === 200, 'mall redeem failed', redeem);

    const ordersAfterRedeem = await requestJson(gateway.base, '/api/orders', {
      method: 'GET',
      headers: authHeaders,
    });
    const redeemedOrder = Array.isArray(ordersAfterRedeem.body?.list)
      ? ordersAfterRedeem.body.list.find((row) => String(row?.orderNo || '') === orderNo)
      : null;
    pushCheck('orders.list', ordersAfterRedeem, ordersAfterRedeem.status === 200 && Boolean(redeemedOrder));
    assert(ordersAfterRedeem.status === 200 && redeemedOrder, 'orders list missing redeemed order', ordersAfterRedeem);

    const redeemOrderDetail = await requestJson(gateway.base, `/api/orders/${Number(redeemedOrder.id)}`, {
      method: 'GET',
      headers: authHeaders,
    });
    pushCheck(
      'orders.detail',
      redeemOrderDetail,
      redeemOrderDetail.status === 200 && String(redeemOrderDetail.body?.order?.orderNo || '') === orderNo
    );
    assert(redeemOrderDetail.status === 200, 'order detail failed', redeemOrderDetail);

    const writeoff = await requestJson(gateway.base, `/api/redemptions/${redemptionId}/writeoff`, {
      method: 'POST',
      headers: authHeaders,
      body: { token: writeoffToken },
    });
    pushCheck('redemptions.writeoff', writeoff, writeoff.status === 200 && writeoff.body?.ok === true);
    assert(writeoff.status === 200, 'writeoff failed', writeoff);

    const writeoffAgain = await requestJson(gateway.base, `/api/redemptions/${redemptionId}/writeoff`, {
      method: 'POST',
      headers: authHeaders,
      body: { token: writeoffToken },
    });
    pushCheck(
      'redemptions.writeoff.idempotent',
      writeoffAgain,
      writeoffAgain.status === 409 && writeoffAgain.body?.code === 'ALREADY_WRITTEN_OFF'
    );
    assert(writeoffAgain.status === 409, 'repeat writeoff should be 409', writeoffAgain);

    const order1Create = await requestJson(gateway.base, '/api/orders', {
      method: 'POST',
      headers: authHeaders,
      body: {
        productId: Number(seeded.product.id),
        quantity: 1,
        idempotencyKey: idempotencyKey('week5-order-1'),
      },
    });
    const order1Id = Number(order1Create.body?.order?.id || 0);
    pushCheck('orders.create', order1Create, order1Create.status === 200 && order1Id > 0);
    assert(order1Create.status === 200, 'order create failed', order1Create);

    const order1Pay = await requestJson(gateway.base, `/api/orders/${order1Id}/pay`, {
      method: 'POST',
      headers: authHeaders,
      body: {},
    });
    pushCheck('orders.pay', order1Pay, order1Pay.status === 200 && order1Pay.body?.ok === true);
    assert(order1Pay.status === 200, 'order pay failed', order1Pay);

    const order1Cancel = await requestJson(gateway.base, `/api/orders/${order1Id}/cancel`, {
      method: 'POST',
      headers: authHeaders,
      body: { reason: 'week5_smoke_cancel' },
    });
    pushCheck('orders.cancel', order1Cancel, order1Cancel.status === 200 && order1Cancel.body?.ok === true);
    assert(order1Cancel.status === 200, 'order cancel failed', order1Cancel);

    const order2Create = await requestJson(gateway.base, '/api/orders', {
      method: 'POST',
      headers: authHeaders,
      body: {
        productId: Number(seeded.product.id),
        quantity: 1,
        idempotencyKey: idempotencyKey('week5-order-2'),
      },
    });
    const order2Id = Number(order2Create.body?.order?.id || 0);
    assert(order2Create.status === 200, 'order2 create failed', order2Create);

    const order2Pay = await requestJson(gateway.base, `/api/orders/${order2Id}/pay`, {
      method: 'POST',
      headers: authHeaders,
      body: {},
    });
    assert(order2Pay.status === 200, 'order2 pay failed', order2Pay);

    const order2Refund = await requestJson(gateway.base, `/api/orders/${order2Id}/refund`, {
      method: 'POST',
      headers: authHeaders,
      body: { reason: 'week5_smoke_refund' },
    });
    pushCheck('orders.refund', order2Refund, order2Refund.status === 200 && order2Refund.body?.ok === true);
    assert(order2Refund.status === 200, 'order refund failed', order2Refund);

    const v2Default = await requestJson(gateway.base, '/api/auth/send-code', {
      method: 'POST',
      headers: { 'x-tenant-id': String(tenantId) },
      body: { mobile: generateMobile() },
    });
    pushCheck(
      'gateway.cutover.v2-default',
      v2Default,
      v2Default.status === 200 &&
        v2Default.headers['x-gateway-mode'] === 'v2' &&
        v2Default.headers['x-gateway-target-service'] === 'user-service'
    );
    assert(v2Default.headers['x-gateway-mode'] === 'v2', 'gateway default should target v2', v2Default);

    process.env.GATEWAY_FORCE_V1 = 'true';
    const forcedV1 = await requestJson(gateway.base, '/api/auth/send-code', {
      method: 'POST',
      headers: { 'x-tenant-id': String(tenantId) },
      body: { mobile: generateMobile() },
    });
    pushCheck(
      'gateway.cutover.force-v1',
      forcedV1,
      forcedV1.status === 200 &&
        forcedV1.headers['x-gateway-mode'] === 'v1' &&
        forcedV1.headers['x-gateway-target-service'] === 'v1-monolith'
    );
    assert(forcedV1.headers['x-gateway-mode'] === 'v1', 'gateway force-v1 failed', forcedV1);

    process.env.GATEWAY_FORCE_V1 = 'false';
    const backToV2 = await requestJson(gateway.base, '/api/mall/items', {
      method: 'GET',
      headers: authHeaders,
    });
    pushCheck(
      'gateway.cutover.back-to-v2',
      backToV2,
      backToV2.status === 200 &&
        backToV2.headers['x-gateway-mode'] === 'v2' &&
        backToV2.headers['x-gateway-target-service'] === 'points-service'
    );
    assert(backToV2.headers['x-gateway-mode'] === 'v2', 'gateway should switch back to v2', backToV2);

    process.env.GATEWAY_POINTS_SERVICE_URL = 'http://127.0.0.1:1';
    const fallback = await requestJson(gateway.base, '/api/mall/items', {
      method: 'GET',
      headers: authHeaders,
    });
    pushCheck(
      'gateway.fallback.points-get',
      fallback,
      fallback.status === 200 &&
        fallback.headers['x-gateway-mode'] === 'v1' &&
        fallback.headers['x-gateway-target-service'] === 'v1-monolith'
    );
    assert(
      fallback.status === 200 &&
        fallback.headers['x-gateway-mode'] === 'v1' &&
        fallback.headers['x-gateway-target-service'] === 'v1-monolith',
      'gateway fallback to v1 failed',
      fallback
    );
    process.env.GATEWAY_POINTS_SERVICE_URL = pointsService.base;

    const failed = checks.filter((item) => !item.ok);
    console.log(
      JSON.stringify(
        {
          ok: failed.length === 0,
          gatewayBase: gateway.base,
          userServiceBase: userService.base,
          pointsServiceBase: pointsService.base,
          tenantId,
          customerMobile: mobile,
          seededProductId: Number(seeded.product.id),
          seededActivityId: Number(seeded.activity.id),
          redemptionId,
          checks,
        },
        null,
        2
      )
    );
    if (failed.length > 0) process.exitCode = 1;
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
    await closeState();
  }
}

main().catch((err) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: String(err?.message || err),
        context: err?.context || null,
      },
      null,
      2
    )
  );
  process.exit(1);
});
