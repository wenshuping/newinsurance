#!/usr/bin/env node

const BASE = String(process.env.API_BASE_URL || process.env.API_BASE || 'http://127.0.0.1:4000').replace(/\/+$/, '');
const PLATFORM_ACCOUNT = String(process.env.P_ADMIN_ACCOUNT || 'platform001');
const PLATFORM_PASSWORD = String(process.env.P_ADMIN_PASSWORD || '123456');

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

function assert(condition, message, context) {
  if (!condition) fail(message, context);
}

async function loginP(account, password) {
  const res = await request('/api/p/auth/login', {
    method: 'POST',
    body: { account, password },
  });
  assert(res.ok, 'P login failed', { account, res });
  const token = String(res.data?.session?.token || '');
  const csrfToken = String(res.data?.session?.csrfToken || '');
  const tenantId = Number(res.data?.session?.tenantId || 0);
  assert(token && csrfToken && tenantId > 0, 'P login missing token/csrf/tenant', { account, data: res.data });
  return { token, csrfToken, tenantId, account };
}

async function loginB(account, password) {
  const res = await request('/api/b/auth/login', {
    method: 'POST',
    body: { account, password },
  });
  assert(res.ok, 'B login failed', { account, res });
  const token = String(res.data?.session?.token || '');
  const csrfToken = String(res.data?.session?.csrfToken || '');
  assert(token && csrfToken, 'B login missing token/csrf', { account, data: res.data });
  return { token, csrfToken, account };
}

async function createTenant(platformAuth, ts) {
  const adminEmail = `template.cascade.${ts}@demo.local`;
  const initialPassword = 'Smoke123456';
  const res = await request('/api/p/tenants', {
    method: 'POST',
    token: platformAuth.token,
    csrfToken: platformAuth.csrfToken,
    body: {
      name: `template_cascade_${ts}`,
      type: 'company',
      status: 'active',
      adminEmail,
      initialPassword,
    },
  });
  assert(res.ok, 'create tenant failed', res);
  const tenantId = Number(res.data?.tenant?.id || 0);
  assert(tenantId > 0, 'create tenant missing id', res.data);
  return { tenantId, adminEmail, initialPassword };
}

async function ensureTeam(companyAuth) {
  const list = await request('/api/p/teams', { token: companyAuth.token });
  assert(list.ok, 'team list failed', list);
  const existing = Array.isArray(list.data?.list) ? list.data.list : [];
  if (existing.length > 0) return Number(existing[0].id);

  const create = await request('/api/p/teams', {
    method: 'POST',
    token: companyAuth.token,
    csrfToken: companyAuth.csrfToken,
    body: { name: `模板级联团队_${Date.now()}` },
  });
  assert(create.ok, 'team create failed', create);
  return Number(create.data?.team?.id || 0);
}

async function createEmployee(companyAuth, teamId, ts) {
  const email = `template.agent.${ts}@demo.local`;
  const mobile = `137${String(ts).slice(-8)}`;
  const initialPassword = '123456';
  const res = await request('/api/p/employees', {
    method: 'POST',
    token: companyAuth.token,
    csrfToken: companyAuth.csrfToken,
    body: {
      name: `模板级联员工_${String(ts).slice(-6)}`,
      email,
      mobile,
      teamId,
      role: 'salesperson',
      initialPassword,
    },
  });
  assert(res.ok, 'employee create failed', res);
  const employeeId = Number(res.data?.employee?.id || 0);
  assert(employeeId > 0, 'employee create missing id', res.data);
  return { employeeId, email, mobile, initialPassword };
}

async function createCustomer(tenantId, ts) {
  const mobile = `139${String(ts).slice(-8)}`;
  const res = await request('/api/auth/verify-basic', {
    method: 'POST',
    body: {
      name: '模板级联客户',
      mobile,
      code: '123456',
      tenantId,
    },
  });
  assert(res.ok, 'customer create/login failed', res);
  const token = String(res.data?.token || '');
  const csrfToken = String(res.data?.csrfToken || '');
  const customerId = Number(res.data?.user?.id || 0);
  assert(token && csrfToken && customerId > 0, 'customer login missing fields', res.data);
  return { token, csrfToken, customerId, mobile };
}

async function assignCustomer(companyAuth, mobile, employeeId) {
  const res = await request('/api/p/customers/assign-by-mobile', {
    method: 'POST',
    token: companyAuth.token,
    csrfToken: companyAuth.csrfToken,
    extraHeaders: { 'x-action-confirm': 'YES' },
    body: { mobile, agentId: employeeId },
  });
  assert(res.ok, 'assign customer failed', res);
}

async function createPlatformTemplates(platformAuth, ts) {
  const activityTitle = `平台活动模板_${ts}`;
  const courseTitle = `平台课程模板_${ts}`;
  const productTitle = `平台商品模板_${ts}`;

  const [activity, course, product] = await Promise.all([
    request('/api/p/activities', {
      method: 'POST',
      token: platformAuth.token,
      csrfToken: platformAuth.csrfToken,
      body: { title: activityTitle, category: 'task', status: 'online', rewardPoints: 10, content: 'platform activity' },
    }),
    request('/api/p/learning/courses', {
      method: 'POST',
      token: platformAuth.token,
      csrfToken: platformAuth.csrfToken,
      body: { title: courseTitle, category: '通用培训', status: 'published', contentType: 'article', rewardPoints: 10, content: 'platform course' },
    }),
    request('/api/p/mall/products', {
      method: 'POST',
      token: platformAuth.token,
      csrfToken: platformAuth.csrfToken,
      body: { title: productTitle, status: 'active', points: 20, stock: 9, description: 'platform product' },
    }),
  ]);

  assert(activity.ok, 'platform activity create failed', activity);
  assert(course.ok, 'platform course create failed', course);
  assert(product.ok, 'platform product create failed', product);

  return { activityTitle, courseTitle, productTitle };
}

async function createCompanyTemplates(companyAuth, ts) {
  const activityTitle = `租户活动模板_${ts}`;
  const courseTitle = `租户课程模板_${ts}`;
  const productTitle = `租户商品模板_${ts}`;

  const [activity, course, product] = await Promise.all([
    request('/api/p/activities', {
      method: 'POST',
      token: companyAuth.token,
      csrfToken: companyAuth.csrfToken,
      body: { title: activityTitle, category: 'task', status: 'online', rewardPoints: 12, content: 'company activity' },
    }),
    request('/api/p/learning/courses', {
      method: 'POST',
      token: companyAuth.token,
      csrfToken: companyAuth.csrfToken,
      body: { title: courseTitle, category: '通用培训', status: 'published', contentType: 'article', rewardPoints: 12, content: 'company course' },
    }),
    request('/api/p/mall/products', {
      method: 'POST',
      token: companyAuth.token,
      csrfToken: companyAuth.csrfToken,
      body: { title: productTitle, status: 'active', points: 24, stock: 9, description: 'company product' },
    }),
  ]);

  assert(activity.ok, 'company activity create failed', activity);
  assert(course.ok, 'company course create failed', course);
  assert(product.ok, 'company product create failed', product);

  return { activityTitle, courseTitle, productTitle };
}

function findByTitle(list, title, keys = ['title', 'name']) {
  return (Array.isArray(list) ? list : []).find((row) => keys.some((key) => String(row?.[key] || '') === title));
}

async function run() {
  const ts = Date.now();
  const platformAuth = await loginP(PLATFORM_ACCOUNT, PLATFORM_PASSWORD);
  const tenant = await createTenant(platformAuth, ts);

  try {
    const companyAuth = await loginP(tenant.adminEmail, tenant.initialPassword);
    const teamId = await ensureTeam(companyAuth);
    const employee = await createEmployee(companyAuth, teamId, ts);
    const bAuth = await loginB(employee.email, employee.initialPassword);
    const customer = await createCustomer(tenant.tenantId, ts);
    await assignCustomer(companyAuth, customer.mobile, employee.employeeId);

    const platformTemplates = await createPlatformTemplates(platformAuth, ts);
    const companyTemplates = await createCompanyTemplates(companyAuth, ts);

    const [pActivities, pCourses, pProducts] = await Promise.all([
      request('/api/p/activities', { token: companyAuth.token }),
      request('/api/p/learning/courses', { token: companyAuth.token }),
      request('/api/p/mall/products', { token: companyAuth.token }),
    ]);
    assert(pActivities.ok && pCourses.ok && pProducts.ok, 'company P list failed', { pActivities, pCourses, pProducts });

    const companyPlatformActivity = findByTitle(pActivities.data?.activities, platformTemplates.activityTitle);
    const companyPlatformCourse = findByTitle(pCourses.data?.list || pCourses.data?.courses, platformTemplates.courseTitle);
    const companyPlatformProduct = findByTitle(pProducts.data?.list, platformTemplates.productTitle);
    assert(companyPlatformActivity, 'platform activity missing in company list', pActivities.data);
    assert(companyPlatformCourse, 'platform course missing in company list', pCourses.data);
    assert(companyPlatformProduct, 'platform product missing in company list', pProducts.data);
    assert(String(companyPlatformActivity.status || '') === 'offline', 'platform activity should be offline for company', companyPlatformActivity);
    assert(String(companyPlatformCourse.status || '') === 'inactive', 'platform course should be inactive for company', companyPlatformCourse);
    assert(String(companyPlatformProduct.status || '') === 'inactive', 'platform product should be inactive for company', companyPlatformProduct);

    const [bActivities, bCourses, bProducts] = await Promise.all([
      request('/api/b/activity-configs', { token: bAuth.token }),
      request('/api/b/content/items', { token: bAuth.token }),
      request('/api/b/mall/products', { token: bAuth.token }),
    ]);
    assert(bActivities.ok && bCourses.ok && bProducts.ok, 'B list failed', { bActivities, bCourses, bProducts });

    assert(!findByTitle(bActivities.data?.list, platformTemplates.activityTitle), 'platform activity should not reach employee B list', bActivities.data);
    assert(!findByTitle(bCourses.data?.list, platformTemplates.courseTitle), 'platform course should not reach employee B list', bCourses.data);
    assert(!findByTitle(bProducts.data?.list, platformTemplates.productTitle), 'platform product should not reach employee B list', bProducts.data);

    const bCompanyActivity = findByTitle(bActivities.data?.list, companyTemplates.activityTitle);
    const bCompanyCourse = findByTitle(bCourses.data?.list, companyTemplates.courseTitle);
    const bCompanyProduct = findByTitle(bProducts.data?.list, companyTemplates.productTitle);
    assert(bCompanyActivity, 'company activity missing in employee B list', bActivities.data);
    assert(bCompanyCourse, 'company course missing in employee B list', bCourses.data);
    assert(bCompanyProduct, 'company product missing in employee B list', bProducts.data);
    assert(String(bCompanyActivity.status || '') === 'inactive', 'company activity should be inactive for employee', bCompanyActivity);
    assert(String(bCompanyCourse.status || '') === 'inactive', 'company course should be inactive for employee', bCompanyCourse);
    assert(String(bCompanyProduct.status || '') === 'inactive', 'company product should be inactive for employee', bCompanyProduct);

    const cHeaders = {
      token: customer.token,
    };
    const [cActivities, cCourses, cProducts] = await Promise.all([
      request('/api/activities', { token: cHeaders.token }),
      request('/api/learning/courses', { token: cHeaders.token }),
      request('/api/mall/items', { token: cHeaders.token }),
    ]);
    assert(cActivities.ok && cCourses.ok && cProducts.ok, 'C list failed', { cActivities, cCourses, cProducts });

    assert(!findByTitle(cActivities.data?.activities, platformTemplates.activityTitle), 'platform activity should not reach customer', cActivities.data);
    assert(!findByTitle(cCourses.data?.courses, platformTemplates.courseTitle), 'platform course should not reach customer', cCourses.data);
    assert(!findByTitle(cProducts.data?.items, platformTemplates.productTitle, ['title', 'name']), 'platform product should not reach customer', cProducts.data);

    assert(!findByTitle(cActivities.data?.activities, companyTemplates.activityTitle), 'company activity should not reach customer', cActivities.data);
    assert(!findByTitle(cCourses.data?.courses, companyTemplates.courseTitle), 'company course should not reach customer', cCourses.data);
    assert(!findByTitle(cProducts.data?.items, companyTemplates.productTitle, ['title', 'name']), 'company product should not reach customer', cProducts.data);

    console.log(
      JSON.stringify(
        {
          ok: true,
          base: BASE,
          tenantId: tenant.tenantId,
          accounts: {
            platform: platformAuth.account,
            company: tenant.adminEmail,
            employee: employee.email,
            customer: customer.mobile,
          },
          assertions: {
            companySeesPlatformAsInactive: true,
            employeeDoesNotSeePlatformTemplates: true,
            employeeSeesCompanyAsInactive: true,
            customerSeesNoInheritedTemplates: true,
          },
        },
        null,
        2
      )
    );
  } finally {
    await request(`/api/p/tenants/${tenant.tenantId}`, {
      method: 'DELETE',
      token: platformAuth.token,
      csrfToken: platformAuth.csrfToken,
    });
  }
}

run().catch((err) => {
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
