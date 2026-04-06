process.env.STORAGE_BACKEND = process.env.STORAGE_BACKEND || 'file';

const HOST = '127.0.0.1';

function generateMobile() {
  const suffix = String(Date.now()).slice(-8);
  return `139${suffix}`;
}

async function getJson(base, path, init) {
  const res = await fetch(`${base}${path}`, init);
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
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

const main = async () => {
  const previousEnv = {
    GATEWAY_V1_BASE_URL: process.env.GATEWAY_V1_BASE_URL,
    GATEWAY_USER_SERVICE_URL: process.env.GATEWAY_USER_SERVICE_URL,
    GATEWAY_POINTS_SERVICE_URL: process.env.GATEWAY_POINTS_SERVICE_URL,
    GATEWAY_LEARNING_SERVICE_URL: process.env.GATEWAY_LEARNING_SERVICE_URL,
    GATEWAY_ENABLE_V2: process.env.GATEWAY_ENABLE_V2,
    GATEWAY_ENABLE_V1_FALLBACK: process.env.GATEWAY_ENABLE_V1_FALLBACK,
    GATEWAY_ENABLE_LEARNING_SERVICE: process.env.GATEWAY_ENABLE_LEARNING_SERVICE,
  };

  const { closeState, initializeState } = await import('../server/skeleton-c-v1/common/state.mjs');
  const { createSkeletonApp } = await import('../server/skeleton-c-v1/app.mjs');
  const { createGatewayApp } = await import('../server/microservices/gateway/app.mjs');
  const { createUserServiceApp } = await import('../server/microservices/user-service/app.mjs');
  const { createPointsServiceApp } = await import('../server/microservices/points-service/app.mjs');

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

  const gateway = await listen(createGatewayApp());

  const checks = [];
  const mobile = generateMobile();

  const gatewayHealth = await getJson(gateway.base, '/health');
  checks.push({
    name: 'gateway.health',
    status: gatewayHealth.status,
    ok: gatewayHealth.status === 200 && gatewayHealth.body?.ok === true,
  });

  const gatewayReady = await getJson(gateway.base, '/ready');
  checks.push({
    name: 'gateway.ready',
    status: gatewayReady.status,
    ok: gatewayReady.status === 200 && gatewayReady.body?.ready === true,
  });

  const routeMap = await getJson(gateway.base, '/internal/gateway/routes');
  const pointsOwner = Array.isArray(routeMap.body?.routeMap)
    ? routeMap.body.routeMap.find((item) => item?.service === 'points-service')
    : null;
  checks.push({
    name: 'gateway.routes',
    status: routeMap.status,
    ok:
      routeMap.status === 200 &&
      Array.isArray(routeMap.body?.routeMap) &&
      routeMap.body.routeMap.length >= 2 &&
      Array.isArray(routeMap.body?.services) &&
      routeMap.body.services.length >= 3 &&
      Array.isArray(pointsOwner?.routes) &&
      pointsOwner.routes.includes('/api/sign-in') &&
      pointsOwner.routes.includes('/api/orders/:id/pay') &&
      pointsOwner.routes.includes('/api/orders/:id/cancel') &&
      pointsOwner.routes.includes('/api/orders/:id/refund'),
  });

  const apiHealth = await getJson(gateway.base, '/api/health');
  checks.push({
    name: 'gateway.api.health',
    status: apiHealth.status,
    ok: apiHealth.status === 200 && apiHealth.body?.ok === true,
  });

  const sendCode = await getJson(gateway.base, '/api/auth/send-code', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-tenant-id': '1',
    },
    body: JSON.stringify({ mobile }),
  });
  checks.push({
    name: 'gateway.proxy.user-service',
    status: sendCode.status,
    ok: sendCode.status === 200 && sendCode.body?.ok === true,
  });

  const verifyBasic = await getJson(gateway.base, '/api/auth/verify-basic', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-tenant-id': '1',
    },
    body: JSON.stringify({
      name: '张三',
      mobile,
      code: String(sendCode.body?.dev_code || '123456'),
      tenantId: 1,
    }),
  });
  const token = String(verifyBasic.body?.token || '');
  const csrfToken = String(verifyBasic.body?.csrfToken || '');
  checks.push({
    name: 'gateway.proxy.user-service.login',
    status: verifyBasic.status,
    ok: verifyBasic.status === 200 && Boolean(token),
  });

  const mallItems = await getJson(gateway.base, '/api/mall/items');
  checks.push({
    name: 'gateway.proxy.points-service',
    status: mallItems.status,
    ok: mallItems.status === 200 && Array.isArray(mallItems.body?.items),
  });

  const signIn = await getJson(gateway.base, '/api/sign-in', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'x-csrf-token': csrfToken,
      'x-tenant-id': '1',
    },
  });
  checks.push({
    name: 'gateway.proxy.points-service.sign-in',
    status: signIn.status,
    ok: signIn.status === 200 && signIn.body?.ok === true,
  });

  await closeServer(gateway.server);
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
  process.env.GATEWAY_ENABLE_LEARNING_SERVICE = previousEnv.GATEWAY_ENABLE_LEARNING_SERVICE;

  const failed = checks.filter((item) => !item.ok);
  console.log(JSON.stringify({ ok: failed.length === 0, checks }, null, 2));

  if (failed.length > 0) process.exit(1);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
