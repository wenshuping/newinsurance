#!/usr/bin/env node

process.env.STORAGE_BACKEND = process.env.STORAGE_BACKEND || 'file';

const HOST = '127.0.0.1';

const request = async (base, pathname, { method = 'GET', token = '', csrfToken = '', body } = {}) => {
  const headers = {
    ...(body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase()) ? { 'x-csrf-token': csrfToken } : {}),
  };

  const res = await fetch(`${base}${pathname}`, {
    method,
    headers,
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

const generateMobile = () => {
  const suffix = String(Date.now()).slice(-8);
  return `139${suffix}`;
};

const main = async () => {
  const { closeState, getState, initializeState } = await import('../server/skeleton-c-v1/common/state.mjs');
  const { createUserServiceApp } = await import('../server/microservices/user-service/app.mjs');

  await initializeState();

  const app = createUserServiceApp();
  const server = app.listen(0, HOST);
  await new Promise((resolve) => server.once('listening', resolve));

  try {
    const addr = server.address();
    const port = Number(addr?.port || 0);
    const base = `http://${HOST}:${port}`;
    const checks = [];
    const pushCheck = (name, response, extra = {}) => {
      const { okOverride, ...rest } = extra;
      checks.push({ name, ok: typeof okOverride === 'boolean' ? okOverride : response.ok, status: response.status, ...rest });
    };

    const health = await request(base, '/health');
    ensure(health.ok && health.data?.service === 'user-service', 'health failed', { health });
    pushCheck('health', health);

    const ready = await request(base, '/ready');
    ensure(ready.ok && ready.data?.service === 'user-service', 'ready failed', { ready });
    pushCheck('ready', ready, { ownership: ready.data?.ownership || null });

    const meUnauthorized = await request(base, '/api/me');
    ensure(meUnauthorized.status === 401 && meUnauthorized.data?.code === 'UNAUTHORIZED', 'unauthorized me contract failed', {
      meUnauthorized,
    });
    pushCheck('me.unauthorized', meUnauthorized, { okOverride: true });

    const tenantId = resolveTenantId(getState());
    const mobile = generateMobile();
    const name = process.env.C_SMOKE_NAME || '张三';
    const code = process.env.DEV_SMS_CODE || '123456';

    const sendCode = await request(base, '/api/auth/send-code', {
      method: 'POST',
      body: { mobile },
    });
    ensure(sendCode.ok && sendCode.data?.ok === true, 'send-code contract failed', { sendCode });
    pushCheck('auth.send-code', sendCode);

    const verifyBasic = await request(base, '/api/auth/verify-basic', {
      method: 'POST',
      body: { name, mobile, code, tenantId },
    });
    const user = verifyBasic.data?.user || {};
    ensure(verifyBasic.ok, 'verify-basic failed', { verifyBasic });
    ensure(typeof verifyBasic.data?.token === 'string' && verifyBasic.data.token.length > 0, 'missing token', { verifyBasic });
    ensure(typeof verifyBasic.data?.csrfToken === 'string' && verifyBasic.data.csrfToken.length > 0, 'missing csrfToken', { verifyBasic });
    ensure(typeof user.id === 'number', 'missing user.id', { verifyBasic });
    ensure(typeof user.name === 'string', 'missing user.name', { verifyBasic });
    ensure(typeof user.mobile === 'string', 'missing user.mobile', { verifyBasic });
    ensure(Object.prototype.hasOwnProperty.call(user, 'nick_name'), 'missing user.nick_name', { verifyBasic });
    ensure(Object.prototype.hasOwnProperty.call(user, 'avatar_url'), 'missing user.avatar_url', { verifyBasic });
    ensure(Object.prototype.hasOwnProperty.call(user, 'is_verified_basic'), 'missing user.is_verified_basic', { verifyBasic });
    ensure(Object.prototype.hasOwnProperty.call(user, 'verified_at'), 'missing user.verified_at', { verifyBasic });
    pushCheck('auth.verify-basic', verifyBasic);

    const me = await request(base, '/api/me', {
      token: String(verifyBasic.data?.token || ''),
    });
    ensure(me.ok, 'me failed', { me });
    ensure(me.data?.user?.mobile === mobile, 'me user mismatch', { me, mobile });
    ensure(Object.prototype.hasOwnProperty.call(me.data || {}, 'balance'), 'missing me.balance', { me });
    ensure(Object.prototype.hasOwnProperty.call(me.data || {}, 'csrfToken'), 'missing me.csrfToken', { me });
    pushCheck('me.authorized', me, { balance: Number(me.data?.balance || 0) });

    console.log(
      JSON.stringify(
        {
          ok: true,
          base,
          checks,
        },
        null,
        2,
      ),
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
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
