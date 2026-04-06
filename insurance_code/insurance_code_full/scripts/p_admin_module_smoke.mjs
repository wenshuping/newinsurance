#!/usr/bin/env node

const BASE = String(process.env.API_BASE_URL || process.env.API_BASE || 'http://127.0.0.1:4000').replace(/\/+$/, '');
const ACCOUNT = String(process.env.P_ADMIN_ACCOUNT || 'platform001');
const PASSWORD = String(process.env.P_ADMIN_PASSWORD || '123456');
const COMPANY_ACCOUNT = String(process.env.P_COMPANY_ADMIN_ACCOUNT || '');
const COMPANY_PASSWORD = String(process.env.P_COMPANY_ADMIN_PASSWORD || '');
const requireFlagRaw = String(process.env.REQUIRE_COMPANY_WORKFORCE || '').toLowerCase();
const REQUIRE_COMPANY_WORKFORCE =
  requireFlagRaw === 'true' || (requireFlagRaw === '' && Boolean(COMPANY_ACCOUNT && COMPANY_PASSWORD));

function fail(message, context) {
  const err = new Error(message);
  err.context = context;
  throw err;
}

async function request(path, { method = 'GET', token = '', csrfToken = '', body, extraHeaders = {} } = {}) {
  const headers = {
    ...(body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase()) ? { 'x-csrf-token': csrfToken } : {}),
    ...extraHeaders,
  };
  const res = await fetch(`${BASE}${path}`, {
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
}

async function main() {
  const login = await request('/api/p/auth/login', {
    method: 'POST',
    body: { account: ACCOUNT, password: PASSWORD },
  });
  if (!login.ok) {
    fail('P admin login failed', login);
  }
  const token = String(login.data?.session?.token || '');
  const csrfToken = String(login.data?.session?.csrfToken || '');
  if (!token || !csrfToken) {
    fail('Missing token/csrfToken after login', login.data);
  }

  const checks = [
    ['governance.tenants', '/api/p/tenants'],
    ['governance.permissions_matrix', '/api/p/permissions/matrix'],
    ['governance.company_admin_pages', '/api/p/permissions/company-admin-pages'],
    ['ops.stats_overview', '/api/p/stats/overview'],
    ['activity.list', '/api/p/activities'],
    ['learning.list', '/api/p/learning/courses'],
    ['mall.products', '/api/p/mall/products'],
    ['mall.activities', '/api/p/mall/activities'],
    ['mall.strategies', '/api/p/strategies'],
    ['tags.list', '/api/p/tags'],
    ['metrics.config', '/api/p/metrics/config'],
    ['events.definitions', '/api/p/events/definitions'],
  ];

  const results = [];
  for (const [name, path] of checks) {
    const res = await request(path, { token });
    results.push({ name, path, status: res.status, ok: res.ok });
    if (!res.ok) {
      fail(`Smoke check failed: ${name}`, { path, response: res });
    }
  }

  let workforceToken = token;
  let workforceCsrfToken = csrfToken;
  let workforceMode = 'platform';
  if (COMPANY_ACCOUNT && COMPANY_PASSWORD) {
    const companyLogin = await request('/api/p/auth/login', {
      method: 'POST',
      body: { account: COMPANY_ACCOUNT, password: COMPANY_PASSWORD },
    });
    if (companyLogin.ok && companyLogin.data?.session?.token && companyLogin.data?.session?.csrfToken) {
      workforceToken = String(companyLogin.data.session.token);
      workforceCsrfToken = String(companyLogin.data.session.csrfToken);
      workforceMode = 'company_admin';
    } else {
      if (REQUIRE_COMPANY_WORKFORCE) {
        fail('company admin login required but failed', companyLogin);
      }
      results.push({
        name: 'workforce.login',
        path: '/api/p/auth/login',
        ok: false,
        status: companyLogin.status,
        skipped: true,
        reason: 'company admin login failed, fallback to platform token',
      });
    }
  }

  const workforceChecks = [
    ['workforce.employees', '/api/p/employees'],
    ['workforce.teams', '/api/p/teams'],
    ['workforce.customers', '/api/p/customers'],
  ];
  for (const [name, path] of workforceChecks) {
    const res = await request(path, { token: workforceToken });
    if (!res.ok) {
      if (res.status === 403 && workforceMode === 'platform') {
        if (REQUIRE_COMPANY_WORKFORCE) {
          fail(`workforce check requires company admin: ${name}`, { path, response: res, workforceMode });
        }
        results.push({ name, path, status: res.status, ok: false, skipped: true, reason: 'needs company_admin token' });
        continue;
      }
      fail(`Smoke check failed: ${name}`, { path, response: res, workforceMode });
    }
    results.push({ name, path, status: res.status, ok: true, workforceMode });
  }

  const tempTitle = `smoke_learning_${Date.now()}`;
  const createCourse = await request('/api/p/learning/courses', {
    method: 'POST',
    token: workforceMode === 'company_admin' ? workforceToken : token,
    csrfToken: workforceMode === 'company_admin' ? workforceCsrfToken : csrfToken,
    body: {
      title: tempTitle,
      category: '通用培训',
      contentType: 'article',
      status: 'published',
      content: 'smoke',
      rewardPoints: 1,
      media: [],
    },
  });
  if (!createCourse.ok) {
    fail('Smoke check failed: learning.create', createCourse);
  }
  const createdCourseId = Number(createCourse.data?.course?.id || 0);
  if (!createdCourseId) {
    fail('Smoke check failed: learning.create missing id', createCourse.data);
  }
  results.push({ name: 'learning.create', path: '/api/p/learning/courses', status: createCourse.status, ok: true });

  const deleteCourse = await request(`/api/p/learning/courses/${createdCourseId}`, {
    method: 'DELETE',
    token: workforceMode === 'company_admin' ? workforceToken : token,
    csrfToken: workforceMode === 'company_admin' ? workforceCsrfToken : csrfToken,
  });
  if (!deleteCourse.ok) {
    fail('Smoke check failed: learning.delete', deleteCourse);
  }
  results.push({ name: 'learning.delete', path: `/api/p/learning/courses/${createdCourseId}`, status: deleteCourse.status, ok: true });

  const ts = Date.now();
  const tenantAdminEmail = `smoke.padmin.${ts}@example.com`;
  const tenantAdminPassword = 'Smoke123456';
  const createTenant = await request('/api/p/tenants', {
    method: 'POST',
    token,
    csrfToken,
    body: {
      name: `smoke_tenant_${ts}`,
      type: 'company',
      status: 'active',
      adminEmail: tenantAdminEmail,
      initialPassword: tenantAdminPassword,
    },
  });
  if (!createTenant.ok) {
    fail('Smoke check failed: tenant.create', createTenant);
  }
  const tempTenantId = Number(createTenant.data?.tenant?.id || 0);
  if (!tempTenantId) {
    fail('Smoke check failed: tenant.create missing id', createTenant.data);
  }
  results.push({ name: 'governance.tenant_create', path: '/api/p/tenants', status: createTenant.status, ok: true });

  try {
    const tenantAdminLogin = await request('/api/p/auth/login', {
      method: 'POST',
      body: { account: tenantAdminEmail, password: tenantAdminPassword },
    });
    if (!tenantAdminLogin.ok) {
      fail('Smoke check failed: tenant admin login', tenantAdminLogin);
    }
    const tenantToken = String(tenantAdminLogin.data?.session?.token || '');
    if (!tenantToken) {
      fail('Smoke check failed: tenant admin token missing', tenantAdminLogin.data);
    }

    const metricConfig = await request('/api/p/metrics/config', { token: tenantToken });
    if (!metricConfig.ok) {
      fail('Smoke check failed: metrics config auto-seed', metricConfig);
    }
    const metricRules = Array.isArray(metricConfig.data?.rules) ? metricConfig.data.rules : [];
    if (metricRules.length <= 0) {
      fail('Smoke check failed: metrics config seed empty', metricConfig.data);
    }
    results.push({
      name: 'metrics.config_auto_seed',
      path: '/api/p/metrics/config',
      status: metricConfig.status,
      ok: true,
      seededRules: metricRules.length,
    });

    const eventDefinitions = await request('/api/p/events/definitions', { token: tenantToken });
    if (!eventDefinitions.ok) {
      fail('Smoke check failed: events definitions auto-seed', eventDefinitions);
    }
    const eventList = Array.isArray(eventDefinitions.data?.list) ? eventDefinitions.data.list : [];
    if (eventList.length <= 0) {
      fail('Smoke check failed: events definitions seed empty', eventDefinitions.data);
    }
    const hasSystemSeed = eventList.some((item) => Number(item?.eventId || 0) === 1001);
    if (!hasSystemSeed) {
      fail('Smoke check failed: events definitions missing system seed(1001)', eventDefinitions.data);
    }
    results.push({
      name: 'events.definitions_auto_seed',
      path: '/api/p/events/definitions',
      status: eventDefinitions.status,
      ok: true,
      seededEvents: eventList.length,
    });
  } finally {
    const cleanupTenant = await request(`/api/p/tenants/${tempTenantId}`, {
      method: 'DELETE',
      token,
      csrfToken,
    });
    results.push({
      name: 'governance.tenant_cleanup',
      path: `/api/p/tenants/${tempTenantId}`,
      status: cleanupTenant.status,
      ok: cleanupTenant.ok,
    });
    if (!cleanupTenant.ok) {
      fail('Smoke check failed: tenant cleanup', cleanupTenant);
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        base: BASE,
        checks: results,
      },
      null,
      2
    )
  );
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
