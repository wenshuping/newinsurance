#!/usr/bin/env node

process.env.STORAGE_BACKEND = process.env.STORAGE_BACKEND || 'file';
process.env.GATEWAY_ENABLE_V2 = 'true';
process.env.GATEWAY_ENABLE_V1_FALLBACK = 'false';

const HOST = '127.0.0.1';

const request = async (base, pathname, { method = 'GET', token = '', csrfToken = '', body, headers = {} } = {}) => {
  const finalHeaders = {
    ...(body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase()) ? { 'x-csrf-token': csrfToken } : {}),
    ...headers,
  };

  const res = await fetch(`${base}${pathname}`, {
    method,
    headers: finalHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data };
};

const ensure = (condition, message, context = null) => {
  if (condition) return;
  const err = new Error(message);
  err.context = context;
  throw err;
};

const resolveTenantId = (state) => Number((state.tenants || []).find((item) => Number(item?.id) > 0)?.id || 1);
const generateMobile = () => `139${String(Date.now()).slice(-8)}`;
const deepClone = (value) => JSON.parse(JSON.stringify(value));

const startServer = async (app) => {
  const server = app.listen(0, HOST);
  await new Promise((resolve) => server.once('listening', resolve));
  const port = Number(server.address()?.port || 0);
  return {
    server,
    port,
    base: `http://${HOST}:${port}`,
  };
};

const stopServer = async (server) => new Promise((resolve) => server.close(resolve));

const extractUserSnapshot = ({ state, userId, token }) => {
  const user = (state.users || []).find((row) => Number(row.id) === Number(userId));
  const session = (state.sessions || []).find((row) => String(row.token || '') === String(token || ''));
  return {
    userCount: Array.isArray(state.users) ? state.users.length : 0,
    sessionCount: Array.isArray(state.sessions) ? state.sessions.length : 0,
    user: deepClone(user || null),
    session: deepClone(session || null),
  };
};

const main = async () => {
  const { closeState, getState, initializeState } = await import('../server/skeleton-c-v1/common/state.mjs');
  const { createUserServiceApp } = await import('../server/microservices/user-service/app.mjs');
  const { createPointsServiceApp } = await import('../server/microservices/points-service/app.mjs');

  await initializeState();

  let userRuntime;
  let pointsRuntime;
  let gatewayRuntime;

  try {
    userRuntime = await startServer(createUserServiceApp());
    pointsRuntime = await startServer(createPointsServiceApp());

    process.env.GATEWAY_USER_SERVICE_URL = userRuntime.base;
    process.env.GATEWAY_POINTS_SERVICE_URL = pointsRuntime.base;
    process.env.GATEWAY_V1_BASE_URL = 'http://127.0.0.1:9';

    const { createGatewayApp } = await import('../server/microservices/gateway/app.mjs');
    gatewayRuntime = await startServer(createGatewayApp());

    const base = gatewayRuntime.base;
    const checks = [];
    const pushCheck = (name, response, extra = {}) => {
      checks.push({ name, ok: response.ok, status: response.status, ...extra });
    };

    const tenantId = resolveTenantId(getState());
    const mobile = generateMobile();
    const name = process.env.C_SMOKE_NAME || '张三';
    const code = process.env.DEV_SMS_CODE || '123456';

    const sendCode = await request(base, '/api/auth/send-code', {
      method: 'POST',
      body: { mobile },
    });
    ensure(sendCode.ok && sendCode.data?.ok === true, 'gateway send-code failed', { sendCode });
    pushCheck('gateway.auth.send-code', sendCode);

    const verifyBasic = await request(base, '/api/auth/verify-basic', {
      method: 'POST',
      body: { name, mobile, code, tenantId },
    });
    ensure(verifyBasic.ok, 'gateway verify-basic failed', { verifyBasic });
    ensure(typeof verifyBasic.data?.token === 'string' && verifyBasic.data.token.length > 0, 'missing token after login', {
      verifyBasic,
    });
    ensure(typeof verifyBasic.data?.csrfToken === 'string' && verifyBasic.data.csrfToken.length > 0, 'missing csrfToken after login', {
      verifyBasic,
    });
    pushCheck('gateway.auth.verify-basic', verifyBasic, {
      userId: Number(verifyBasic.data?.user?.id || 0),
    });

    const token = String(verifyBasic.data?.token || '');
    const csrfToken = String(verifyBasic.data?.csrfToken || '');
    const userId = Number(verifyBasic.data?.user?.id || 0);

    const boundaryReady = await request(userRuntime.base, '/ready');
    ensure(boundaryReady.ok, 'user-service ready failed', { boundaryReady });
    ensure(Array.isArray(boundaryReady.data?.boundary?.mainWriteTables), 'missing user boundary declaration', { boundaryReady });
    pushCheck('user-service.ready', boundaryReady, {
      mainWriteTables: boundaryReady.data?.boundary?.mainWriteTables?.map((item) => item.table) || [],
    });

    const beforePoints = extractUserSnapshot({ state: getState(), userId, token });
    ensure(beforePoints.user, 'user snapshot missing after login', { beforePoints, userId });
    ensure(beforePoints.session, 'session snapshot missing after login', { beforePoints, token });

    const pointsSummary = await request(base, '/api/points/summary', {
      method: 'GET',
      token,
    });
    ensure(pointsSummary.ok && Object.prototype.hasOwnProperty.call(pointsSummary.data || {}, 'balance'), 'points summary failed', {
      pointsSummary,
    });
    pushCheck('gateway.points.summary', pointsSummary, {
      balance: Number(pointsSummary.data?.balance || 0),
    });

    const mallItems = await request(base, '/api/mall/items', {
      method: 'GET',
      token,
    });
    ensure(mallItems.ok, 'mall items failed', { mallItems });
    pushCheck('gateway.mall.items', mallItems);

    const signIn = await request(base, '/api/sign-in', {
      method: 'POST',
      token,
      csrfToken,
    });
    ensure(signIn.ok && signIn.data?.ok === true, 'sign-in failed', { signIn });
    pushCheck('gateway.points.sign-in', signIn, {
      reward: Number(signIn.data?.reward || 0),
      balance: Number(signIn.data?.balance || 0),
    });

    const afterPoints = extractUserSnapshot({ state: getState(), userId, token });
    ensure(afterPoints.userCount === beforePoints.userCount, 'points flow changed user count', {
      before: beforePoints.userCount,
      after: afterPoints.userCount,
    });
    ensure(afterPoints.sessionCount === beforePoints.sessionCount, 'points flow changed session count', {
      before: beforePoints.sessionCount,
      after: afterPoints.sessionCount,
    });
    ensure(JSON.stringify(afterPoints.user) === JSON.stringify(beforePoints.user), 'points flow mutated user aggregate', {
      before: beforePoints.user,
      after: afterPoints.user,
    });
    ensure(JSON.stringify(afterPoints.session) === JSON.stringify(beforePoints.session), 'points flow mutated session aggregate', {
      before: beforePoints.session,
      after: afterPoints.session,
    });
    checks.push({
      name: 'user-boundary.stable-after-points',
      ok: true,
      status: 200,
      userCount: afterPoints.userCount,
      sessionCount: afterPoints.sessionCount,
    });

    console.log(
      JSON.stringify(
        {
          ok: true,
          gatewayBase: base,
          checks,
        },
        null,
        2,
      ),
    );
  } finally {
    if (gatewayRuntime?.server) await stopServer(gatewayRuntime.server);
    if (pointsRuntime?.server) await stopServer(pointsRuntime.server);
    if (userRuntime?.server) await stopServer(userRuntime.server);
    await closeState();
  }
};

main().catch((err) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: String(err?.message || err),
        context: err?.context || null,
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
