#!/usr/bin/env node

process.env.STORAGE_BACKEND = process.env.STORAGE_BACKEND || 'file';

const HOST = '127.0.0.1';

const request = async (base, pathname, { method = 'GET', token = '', body, headers = {} } = {}) => {
  const res = await fetch(`${base}${pathname}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return {
    ok: res.ok,
    status: res.status,
    data,
    traceId: String(res.headers.get('x-trace-id') || ''),
    requestId: String(res.headers.get('x-request-id') || ''),
    serviceName: String(res.headers.get('x-service-name') || ''),
  };
};

function assert(condition, message, context = null) {
  if (condition) return;
  const error = new Error(message);
  error.context = context;
  throw error;
}

function resolveTenantId(state) {
  return Number((state.tenants || []).find((item) => Number(item?.id || 0) > 0)?.id || 1);
}

async function main() {
  const { closeState, getState, initializeState } = await import('../server/skeleton-c-v1/common/state.mjs');
  const { createUserServiceApp } = await import('../server/microservices/user-service/app.mjs');

  await initializeState();
  const app = createUserServiceApp();
  const server = app.listen(0, HOST);
  await new Promise((resolve) => server.once('listening', resolve));

  try {
    const port = Number(server.address()?.port || 0);
    const base = `http://${HOST}:${port}`;
    const tenantId = resolveTenantId(getState());
    const mobile = `139${String(Date.now()).slice(-8)}`;
    const name = '观测客户';
    const checks = [];

    const sendCode = await request(base, '/api/auth/send-code', {
      method: 'POST',
      body: { mobile },
      headers: { 'x-trace-id': 'week7-smoke-send-code' },
    });
    assert(sendCode.ok, 'send-code failed', { sendCode });
    assert(sendCode.traceId === 'week7-smoke-send-code', 'send-code trace header mismatch', { sendCode });
    assert(sendCode.requestId.length > 0, 'send-code request id missing', { sendCode });
    assert(sendCode.serviceName === 'user-service', 'send-code service header mismatch', { sendCode });
    checks.push({ name: 'send-code', ok: true, traceId: sendCode.traceId });

    const loginFailure = await request(base, '/api/auth/verify-basic', {
      method: 'POST',
      body: { name, mobile, code: '000000', tenantId },
      headers: { 'x-trace-id': 'week7-smoke-login-failure' },
    });
    assert(loginFailure.status === 400, 'verify-basic failure missing', { loginFailure });
    assert(loginFailure.traceId === 'week7-smoke-login-failure', 'login failure trace mismatch', { loginFailure });
    checks.push({ name: 'login.failure', ok: true, code: loginFailure.data?.code || '' });

    const loginSuccess = await request(base, '/api/auth/verify-basic', {
      method: 'POST',
      body: { name, mobile, code: process.env.DEV_SMS_CODE || '123456', tenantId },
      headers: { 'x-trace-id': 'week7-smoke-login-success' },
    });
    assert(loginSuccess.ok, 'verify-basic success failed', { loginSuccess });
    const token = String(loginSuccess.data?.token || '');
    assert(token, 'login token missing', { loginSuccess });
    assert(loginSuccess.traceId === 'week7-smoke-login-success', 'login success trace mismatch', { loginSuccess });
    assert(loginSuccess.requestId.length > 0, 'login success request id missing', { loginSuccess });
    assert(loginSuccess.serviceName === 'user-service', 'login success service header mismatch', { loginSuccess });
    checks.push({ name: 'login.success', ok: true, traceId: loginSuccess.traceId });

    const meUnauthorized = await request(base, '/api/me', {
      headers: { 'x-trace-id': 'week7-smoke-me-missing' },
    });
    assert(meUnauthorized.status === 401, 'missing token me should be 401', { meUnauthorized });
    assert(meUnauthorized.traceId === 'week7-smoke-me-missing', 'me missing trace mismatch', { meUnauthorized });
    checks.push({ name: 'me.unauthorized.missing', ok: true, traceId: meUnauthorized.traceId });

    const meInvalid = await request(base, '/api/me', {
      token: 'bad-token',
      headers: { 'x-trace-id': 'week7-smoke-me-invalid' },
    });
    assert(meInvalid.status === 401, 'invalid token me should be 401', { meInvalid });
    assert(meInvalid.traceId === 'week7-smoke-me-invalid', 'me invalid trace mismatch', { meInvalid });
    checks.push({ name: 'me.unauthorized.invalid', ok: true, traceId: meInvalid.traceId });

    const meSuccess = await request(base, '/api/me', {
      token,
      headers: { 'x-trace-id': 'week7-smoke-me-success' },
    });
    assert(meSuccess.ok, 'me success failed', { meSuccess });
    assert(meSuccess.traceId === 'week7-smoke-me-success', 'me success trace mismatch', { meSuccess });
    assert(meSuccess.requestId.length > 0, 'me success request id missing', { meSuccess });
    assert(meSuccess.serviceName === 'user-service', 'me success service header mismatch', { meSuccess });
    checks.push({ name: 'me.success', ok: true, traceId: meSuccess.traceId });

    const observability = await request(base, '/internal/user-service/observability', {
      headers: { 'x-trace-id': 'week7-smoke-observability' },
    });
    assert(observability.ok, 'observability endpoint failed', { observability });

    const metrics = observability.data?.metrics || {};
    const logs = Array.isArray(observability.data?.recentLogs) ? observability.data.recentLogs : [];
    const errors = Array.isArray(observability.data?.errors?.stats) ? observability.data.errors.stats : [];
    const logFields = Array.isArray(observability.data?.logFields) ? observability.data.logFields : [];

    assert(metrics.login?.attempts === 2, 'login attempts mismatch', { metrics });
    assert(metrics.login?.success === 1, 'login success mismatch', { metrics });
    assert(metrics.login?.failure === 1, 'login failure mismatch', { metrics });
    assert(metrics.me?.clientError4xx >= 2, 'me 4xx mismatch', { metrics });
    assert(metrics.me?.serverError5xx === 0, 'me 5xx mismatch', { metrics });
    assert(metrics.tokenAnomalies?.missingBearer >= 1, 'missing bearer metric missing', { metrics });
    assert(metrics.tokenAnomalies?.invalidBearer >= 1, 'invalid bearer metric missing', { metrics });
    assert(logFields.includes('trace_id'), 'trace_id field missing', { logFields });
    assert(logFields.includes('user_id'), 'user_id field missing', { logFields });
    assert(logFields.includes('tenant_id'), 'tenant_id field missing', { logFields });
    assert(logFields.includes('route'), 'route field missing', { logFields });
    assert(logFields.includes('result'), 'result field missing', { logFields });

    const targetLog = logs.find((entry) => entry.route === '/api/auth/verify-basic' && entry.result === 'login_success');
    assert(targetLog, 'login success log missing', { logs });
    assert(typeof targetLog.trace_id === 'string' && targetLog.trace_id.length > 0, 'trace_id missing in log', { targetLog });
    assert('user_id' in targetLog, 'user_id missing in log', { targetLog });
    assert('tenant_id' in targetLog, 'tenant_id missing in log', { targetLog });

    const codeNotFound = errors.find((entry) => entry.code === 'CODE_NOT_FOUND');
    const tokenMissing = errors.find((entry) => entry.code === 'TOKEN_MISSING');
    const tokenInvalid = errors.find((entry) => entry.code === 'TOKEN_INVALID');
    assert(codeNotFound?.count >= 1, 'CODE_NOT_FOUND stats missing', { errors });
    assert(tokenMissing?.count >= 1, 'TOKEN_MISSING stats missing', { errors });
    assert(tokenInvalid?.count >= 1, 'TOKEN_INVALID stats missing', { errors });

    console.log(
      JSON.stringify(
        {
          ok: true,
          base,
          checks,
          metrics,
          observedErrorCodes: errors.map((entry) => entry.code),
        },
        null,
        2,
      ),
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
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
