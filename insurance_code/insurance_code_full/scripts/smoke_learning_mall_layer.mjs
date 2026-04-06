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
    : ['xinhua@126.com', 'fangyuqing@126.com', 'tenanta_admin@demo.local', 'tenanta_admin', 'platform001'];
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

async function resolveAssignableAgentId(headers) {
  const employeeRes = await api('/api/p/employees', { method: 'GET', headers });
  assert(employeeRes.status === 200, `list employees failed: ${employeeRes.status}`);
  const existing = Array.isArray(employeeRes.body?.list) ? employeeRes.body.list : [];
  if (existing.length > 0) return Number(existing[0].id);

  const teamRes = await api('/api/p/teams', { method: 'GET', headers });
  assert(teamRes.status === 200, `list teams failed: ${teamRes.status}`);
  const teams = Array.isArray(teamRes.body?.list) ? teamRes.body.list : [];
  assert(teams.length > 0, 'no team available to create employee');

  const suffix = Date.now();
  const createRes = await api('/api/p/employees', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: `学习商城回归员工_${suffix}`,
      email: `learning_mall_${suffix}@demo.local`,
      mobile: `137${String(suffix).slice(-8)}`,
      teamId: Number(teams[0].id),
      role: 'salesperson',
      initialPassword: '123456',
    }),
  });
  assert(createRes.status === 200, `create employee failed: ${createRes.status}`);
  return Number(createRes.body?.employee?.id || 0);
}

async function loginCustomer(tenantId) {
  const mobile = `139${String(Date.now()).slice(-8)}`;
  const res = await api('/api/auth/verify-basic', {
    method: 'POST',
    headers: { 'x-tenant-id': String(tenantId) },
    body: JSON.stringify({ name: '学习商城回归用户', mobile, code: '123456' }),
  });
  assert(res.status === 200, `customer login failed: ${res.status}`);
  const token = String(res.body?.token || '');
  const csrfToken = String(res.body?.csrfToken || '');
  assert(token, 'customer token missing');
  assert(csrfToken, 'customer csrfToken missing');
  return { token, csrfToken, mobile, tenantId };
}

async function fetchBalance(headers) {
  const res = await api('/api/points/summary', { method: 'GET', headers });
  assert(res.status === 200, `points summary failed: ${res.status}`);
  return Number(res.body?.balance || 0);
}

async function run() {
  const pAuth = await loginPAdmin();
  const tenantId = TENANT_ID_FROM_ENV > 0 ? TENANT_ID_FROM_ENV : pAuth.tenantId;
  const pHeaders = {
    authorization: `Bearer ${pAuth.token}`,
    'x-csrf-token': pAuth.csrfToken,
    'x-tenant-id': String(tenantId),
  };

  const agentId = await resolveAssignableAgentId(pHeaders);
  const cAuth = await loginCustomer(tenantId);
  const assignRes = await api('/api/p/customers/assign-by-mobile', {
    method: 'POST',
    headers: {
      ...pHeaders,
      'x-action-confirm': 'YES',
    },
    body: JSON.stringify({
      mobile: cAuth.mobile,
      agentId,
    }),
  });
  assert(assignRes.status === 200, `assign customer failed: ${assignRes.status}`);

  const cHeaders = {
    authorization: `Bearer ${cAuth.token}`,
    'x-csrf-token': cAuth.csrfToken,
    'x-tenant-id': String(cAuth.tenantId),
  };

  const coursesRes = await api('/api/learning/courses', { method: 'GET', headers: cHeaders });
  assert(coursesRes.status === 200, `learning courses failed: ${coursesRes.status}`);
  const courses = Array.isArray(coursesRes.body?.courses) ? coursesRes.body.courses : [];

  let completionVerified = false;
  let completionSkippedByPermission = false;
  let selectedCourseId = 0;
  let before = await fetchBalance(cHeaders);
  let afterFirst = before;
  let afterSecond = before;

  if (courses.length > 0) {
    const target = courses.find((c) => Number(c.id) > 0) || null;
    if (target) {
      selectedCourseId = Number(target.id || 0);
      const rewardPoints = Number(target.points || 0);

      const detailRes = await api(`/api/learning/courses/${selectedCourseId}`, { method: 'GET', headers: cHeaders });
      assert(detailRes.status === 200, `learning detail failed: ${detailRes.status}`);

      const completeRes = await api(`/api/learning/courses/${selectedCourseId}/complete`, {
        method: 'POST',
        headers: cHeaders,
        body: JSON.stringify({}),
      });
      if (completeRes.status === 403) {
        completionSkippedByPermission = true;
      } else {
        assert(completeRes.status === 200, `learning complete failed: ${completeRes.status}`);
        assert(completeRes.body?.duplicated === false, 'first complete should not be duplicated');

        afterFirst = await fetchBalance(cHeaders);
        assert(afterFirst === before + rewardPoints, `learning reward mismatch: before=${before}, reward=${rewardPoints}, after=${afterFirst}`);

        const completeAgainRes = await api(`/api/learning/courses/${selectedCourseId}/complete`, {
          method: 'POST',
          headers: cHeaders,
          body: JSON.stringify({}),
        });
        assert(completeAgainRes.status === 200, `learning complete again failed: ${completeAgainRes.status}`);
        assert(completeAgainRes.body?.duplicated === true, 'second complete should be duplicated');

        afterSecond = await fetchBalance(cHeaders);
        assert(afterSecond === afterFirst, 'duplicated complete should not change balance');
        completionVerified = true;
      }
    }
  }

  const mallItemsRes = await api('/api/mall/items', { method: 'GET', headers: cHeaders });
  assert(mallItemsRes.status === 200, `mall items failed: ${mallItemsRes.status}`);
  const mallActivitiesRes = await api('/api/mall/activities', { method: 'GET', headers: cHeaders });
  assert(mallActivitiesRes.status === 200, `mall activities failed: ${mallActivitiesRes.status}`);

  console.log(
    JSON.stringify(
      {
        ok: true,
        tenantId,
        customer: cAuth.mobile,
        learning: {
          coursesVisible: courses.length,
          completionVerified,
          completionSkippedByPermission,
          selectedCourseId,
          balanceBefore: before,
          balanceAfterFirst: afterFirst,
          balanceAfterSecond: afterSecond,
        },
        mall: {
          items: Array.isArray(mallItemsRes.body?.items) ? mallItemsRes.body.items.length : 0,
          activities: Array.isArray(mallActivitiesRes.body?.list) ? mallActivitiesRes.body.list.length : 0,
        },
      },
      null,
      2
    )
  );
}

run().catch((error) => {
  console.error(`[smoke:learning-mall-layer] ${error.message}`);
  process.exit(1);
});
