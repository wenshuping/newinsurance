#!/usr/bin/env node

const BASE = process.env.API_BASE_URL || 'http://127.0.0.1:4000';
const TENANT_ID_FROM_ENV = Number(process.env.SMOKE_TENANT_ID || 0);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function api(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });

  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  return { status: response.status, body };
}

async function loginPAdmin() {
  const password = process.env.SMOKE_P_PASSWORD || '123456';
  const candidates = process.env.SMOKE_P_ACCOUNT
    ? [process.env.SMOKE_P_ACCOUNT]
    : [
        'xinhua@126.com',
        'fangyuqing@126.com',
        'tenanta_admin@demo.local',
        'tenanta_admin',
        'platform001',
      ];

  let lastStatus = 0;
  for (const account of candidates) {
    const res = await api('/api/p/auth/login', {
      method: 'POST',
      body: JSON.stringify({ account, password }),
    });
    lastStatus = res.status;
    if (res.status !== 200) continue;

    const token = String(res.body?.session?.token || '');
    const csrfToken = String(res.body?.session?.csrfToken || '');
    const tenantId = Number(res.body?.session?.tenantId || 0);
    assert(token, 'p admin token missing');
    assert(csrfToken, 'p admin csrfToken missing');
    assert(tenantId > 0, 'p admin tenantId missing');
    return { token, csrfToken, tenantId, account };
  }

  throw new Error(`p admin login failed: ${lastStatus}`);
}

async function ensureTeamId(headers) {
  const listRes = await api('/api/p/teams', { method: 'GET', headers });
  assert(listRes.status === 200, `list teams failed: ${listRes.status}`);
  const teams = Array.isArray(listRes.body?.list) ? listRes.body.list : [];
  if (teams.length > 0) return Number(teams[0].id);

  const createRes = await api('/api/p/teams', {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: `链路冒烟团队_${Date.now()}` }),
  });
  assert(createRes.status === 200, `create team failed: ${createRes.status}`);
  const teamId = Number(createRes.body?.team?.id || 0);
  assert(teamId > 0, 'create team missing id');
  return teamId;
}

async function createEmployeeForSmoke(headers) {
  const teamId = await ensureTeamId(headers);
  const suffix = Date.now();
  const email = `chain_smoke_${suffix}@demo.local`;
  const mobile = `137${String(suffix).slice(-8)}`;
  const initialPassword = '123456';
  const name = `链路冒烟员工_${String(suffix).slice(-6)}`;

  const createRes = await api('/api/p/employees', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name,
      email,
      mobile,
      role: 'salesperson',
      teamId,
      initialPassword,
    }),
  });
  assert(createRes.status === 200, `create employee failed: ${createRes.status}`);
  const employeeId = Number(createRes.body?.employee?.id || 0);
  assert(employeeId > 0, 'create employee missing id');
  return { id: employeeId, email, mobile, initialPassword, name };
}

async function loginBAdmin(account, password) {
  const res = await api('/api/b/auth/login', {
    method: 'POST',
    body: JSON.stringify({ account, password }),
  });
  assert(res.status === 200, `b admin login failed: ${res.status}`);
  const token = String(res.body?.session?.token || '');
  const csrfToken = String(res.body?.session?.csrfToken || '');
  const tenantId = Number(res.body?.session?.tenantId || 0);
  assert(token, 'b token missing');
  assert(csrfToken, 'b csrf token missing');
  assert(tenantId > 0, 'b tenant id missing');
  return { token, csrfToken, tenantId };
}

async function createBTemplates(headers) {
  const suffix = Date.now();
  const activityTitle = `链路活动_${suffix}`;
  const courseTitle = `链路课程_${suffix}`;
  const productName = `链路商品_${suffix}`;

  const activityRes = await api('/api/b/activity-configs', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: activityTitle,
      category: 'task',
      desc: '链路活动详情',
      rewardPoints: 12,
      status: 'online',
    }),
  });
  assert(activityRes.status === 200, `create b activity failed: ${activityRes.status}`);

  const courseRes = await api('/api/b/content/items', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: courseTitle,
      category: '保险课堂',
      body: '链路课程详情',
      contentType: 'article',
      rewardPoints: 8,
      status: 'published',
    }),
  });
  assert(courseRes.status === 200, `create b content failed: ${courseRes.status}`);

  const productRes = await api('/api/b/mall/products', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: productName,
      desc: '链路商品详情',
      points: 5,
      stock: 5,
      status: 'active',
    }),
  });
  assert(productRes.status === 200, `create b product failed: ${productRes.status}`);

  return {
    activityTitle,
    courseTitle,
    productName,
  };
}

async function loginCustomer(tenantId) {
  const mobile = `139${String(Date.now()).slice(-8)}`;
  const res = await api('/api/auth/verify-basic', {
    method: 'POST',
    headers: { 'x-tenant-id': String(tenantId) },
    body: JSON.stringify({
      name: '链路验证客户',
      mobile,
      code: '123456',
    }),
  });
  assert(res.status === 200, `customer login failed: ${res.status}`);
  const token = String(res.body?.token || '');
  const csrfToken = String(res.body?.csrfToken || '');
  const userId = Number(res.body?.user?.id || 0);
  assert(token, 'customer token missing');
  assert(csrfToken, 'customer csrfToken missing');
  assert(userId > 0, 'customer id missing');
  return { token, csrfToken, mobile, userId, tenantId };
}

async function assignCustomerByMobile(pHeaders, mobile, agentId) {
  const res = await api('/api/p/customers/assign-by-mobile', {
    method: 'POST',
    headers: {
      ...pHeaders,
      'x-action-confirm': 'YES',
    },
    body: JSON.stringify({ mobile, agentId }),
  });
  assert(res.status === 200, `assign-by-mobile failed: ${res.status}`);
}

async function assertOwnerLinked(pHeaders, mobile, expectedAgentId) {
  const res = await api('/api/p/customers', { method: 'GET', headers: pHeaders });
  assert(res.status === 200, `p customers list failed: ${res.status}`);
  const list = Array.isArray(res.body?.list) ? res.body.list : [];
  const customer = list.find((row) => String(row.mobile || '') === mobile);
  assert(customer, `customer not found in p list: ${mobile}`);
  assert(
    Number(customer.ownerUserId || 0) === Number(expectedAgentId),
    `owner mismatch: expected=${expectedAgentId}, actual=${Number(customer.ownerUserId || 0)}`
  );
}

async function assertVisibleInBCustomerList(bHeaders, mobile) {
  const res = await api('/api/b/customers', { method: 'GET', headers: bHeaders });
  assert(res.status === 200, `b customers list failed: ${res.status}`);
  const list = Array.isArray(res.body?.list) ? res.body.list : [];
  const matched = list.some((row) => String(row.mobile || '') === mobile);
  assert(matched, `customer not visible in b customer list: ${mobile}`);
}

async function assertVisibleInCApp(cHeaders, expected) {
  const [learningRes, activitiesRes, mallRes] = await Promise.all([
    api('/api/learning/courses', { method: 'GET', headers: cHeaders }),
    api('/api/activities', { method: 'GET', headers: cHeaders }),
    api('/api/mall/items', { method: 'GET', headers: cHeaders }),
  ]);
  assert(learningRes.status === 200, `c learning list failed: ${learningRes.status}`);
  assert(activitiesRes.status === 200, `c activities list failed: ${activitiesRes.status}`);
  assert(mallRes.status === 200, `c mall list failed: ${mallRes.status}`);

  const courses = Array.isArray(learningRes.body?.courses) ? learningRes.body.courses : [];
  const activities = Array.isArray(activitiesRes.body?.activities) ? activitiesRes.body.activities : [];
  const items = Array.isArray(mallRes.body?.items) ? mallRes.body.items : [];

  const hasCourse = courses.some((row) => String(row.title || '') === expected.courseTitle);
  const hasActivity = activities.some((row) => String(row.title || '') === expected.activityTitle);
  const hasProduct = items.some(
    (row) => String(row.name || row.title || '') === expected.productName
  );

  assert(hasCourse, `course not visible in c app: ${expected.courseTitle}`);
  assert(hasActivity, `activity not visible in c app: ${expected.activityTitle}`);
  assert(hasProduct, `product not visible in c app: ${expected.productName}`);
}

async function run() {
  const pAuth = await loginPAdmin();
  const tenantId = TENANT_ID_FROM_ENV > 0 ? TENANT_ID_FROM_ENV : pAuth.tenantId;
  const pHeaders = {
    authorization: `Bearer ${pAuth.token}`,
    'x-csrf-token': pAuth.csrfToken,
    'x-tenant-id': String(tenantId),
  };

  const employee = await createEmployeeForSmoke(pHeaders);
  const bAuth = await loginBAdmin(employee.email, employee.initialPassword);
  const bHeaders = {
    authorization: `Bearer ${bAuth.token}`,
    'x-csrf-token': bAuth.csrfToken,
    'x-tenant-id': String(tenantId),
  };

  const expectedTemplates = await createBTemplates(bHeaders);
  const customer = await loginCustomer(tenantId);
  await assignCustomerByMobile(pHeaders, customer.mobile, employee.id);
  await assertOwnerLinked(pHeaders, customer.mobile, employee.id);
  await assertVisibleInBCustomerList(bHeaders, customer.mobile);

  const cHeaders = {
    authorization: `Bearer ${customer.token}`,
    'x-csrf-token': customer.csrfToken,
    'x-tenant-id': String(tenantId),
  };
  await assertVisibleInCApp(cHeaders, expectedTemplates);

  console.log(
    JSON.stringify(
      {
        ok: true,
        tenantId,
        pAdminAccount: pAuth.account,
        employee: {
          id: employee.id,
          email: employee.email,
          mobile: employee.mobile,
        },
        customer: {
          id: customer.userId,
          mobile: customer.mobile,
        },
        templates: expectedTemplates,
      },
      null,
      2
    )
  );
}

run().catch((error) => {
  console.error(`[smoke:assignment-visibility] ${error.message}`);
  process.exit(1);
});
