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

async function ensureDemoProductAndActivity(headers) {
  const suffix = Date.now();
  const productRes = await api('/api/p/mall/products', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: `API回归商品_${suffix}`,
      points: 1,
      stock: 9,
      status: 'active',
      description: '用于商城兑换API回归',
      category: '回归测试',
    }),
  });
  assert(productRes.status === 200, `create product failed: ${productRes.status}`);
  const productId = Number(productRes.body?.product?.id || 0);
  assert(productId > 0, 'create product missing id');

  const activityRes = await api('/api/p/mall/activities', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: `API回归活动_${suffix}`,
      displayTitle: `API回归活动_${suffix}`,
      rewardPoints: 15,
      status: 'active',
      description: '用于商城活动参加API回归',
      type: 'task',
    }),
  });
  assert(activityRes.status === 200, `create mall activity failed: ${activityRes.status}`);
  const activityId = Number(activityRes.body?.activity?.id || 0);
  assert(activityId > 0, 'create activity missing id');

  return { productId, activityId };
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
  const teamId = Number(teams[0].id);

  const suffix = Date.now();
  const createRes = await api('/api/p/employees', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: `回归员工_${suffix}`,
      email: `smoke_${suffix}@demo.local`,
      mobile: `137${String(suffix).slice(-8)}`,
      teamId,
      role: 'salesperson',
      initialPassword: '123456',
    }),
  });
  assert(createRes.status === 200, `create employee failed: ${createRes.status}`);
  const employeeId = Number(createRes.body?.employee?.id || 0);
  assert(employeeId > 0, 'create employee missing id');
  return employeeId;
}

async function loginCustomer() {
  const mobile = `139${String(Date.now()).slice(-8)}`;
  const tenantId = TENANT_ID_FROM_ENV > 0 ? TENANT_ID_FROM_ENV : currentTenantId;
  const res = await api('/api/auth/verify-basic', {
    method: 'POST',
    headers: { 'x-tenant-id': String(tenantId) },
    body: JSON.stringify({ name: '张三', mobile, code: '123456' }),
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

let currentTenantId = TENANT_ID_FROM_ENV > 0 ? TENANT_ID_FROM_ENV : 0;

async function run() {
  const pAuth = await loginPAdmin();
  currentTenantId = TENANT_ID_FROM_ENV > 0 ? TENANT_ID_FROM_ENV : pAuth.tenantId;
  const pHeaders = {
    authorization: `Bearer ${pAuth.token}`,
    'x-csrf-token': pAuth.csrfToken,
    'x-tenant-id': String(currentTenantId),
  };
  const seeded = await ensureDemoProductAndActivity(pHeaders);
  const assignAgentId = await resolveAssignableAgentId(pHeaders);

  const cAuth = await loginCustomer();
  const assignRes = await api('/api/p/customers/assign-by-mobile', {
    method: 'POST',
    headers: {
      ...pHeaders,
      'x-action-confirm': 'YES',
    },
    body: JSON.stringify({
      mobile: cAuth.mobile,
      agentId: Number(process.env.SMOKE_ASSIGN_AGENT_ID || assignAgentId),
    }),
  });
  assert(assignRes.status === 200, `assign customer failed: ${assignRes.status}`);

  const cHeaders = {
    authorization: `Bearer ${cAuth.token}`,
    'x-csrf-token': cAuth.csrfToken,
    'x-tenant-id': String(cAuth.tenantId),
  };
  const balanceBefore = await fetchBalance(cHeaders);

  const redeemRes = await api('/api/mall/redeem', {
    method: 'POST',
    headers: {
      ...cHeaders,
      'x-action-confirm': 'YES',
    },
    body: JSON.stringify({ itemId: seeded.productId, quantity: 1 }),
  });
  assert(redeemRes.status === 200, `redeem failed: ${redeemRes.status}`);

  const balanceAfterRedeem = await fetchBalance(cHeaders);
  assert(
    balanceAfterRedeem === balanceBefore - 1,
    `redeem balance mismatch: before=${balanceBefore}, after=${balanceAfterRedeem}`
  );

  const joinRes = await api(`/api/mall/activities/${seeded.activityId}/join`, {
    method: 'POST',
    headers: cHeaders,
    body: JSON.stringify({}),
  });
  assert(joinRes.status === 200, `join activity failed: ${joinRes.status}`);
  assert(joinRes.body?.duplicated === false, 'first join should not be duplicated');

  const balanceAfterJoin = await fetchBalance(cHeaders);
  assert(
    balanceAfterJoin === balanceAfterRedeem + 15,
    `join reward mismatch: redeemAfter=${balanceAfterRedeem}, joinAfter=${balanceAfterJoin}`
  );

  const joinAgainRes = await api(`/api/mall/activities/${seeded.activityId}/join`, {
    method: 'POST',
    headers: cHeaders,
    body: JSON.stringify({}),
  });
  assert(joinAgainRes.status === 200, `join activity again failed: ${joinAgainRes.status}`);
  assert(joinAgainRes.body?.duplicated === true, 'second join should be duplicated');

  const balanceAfterJoinAgain = await fetchBalance(cHeaders);
  assert(balanceAfterJoinAgain === balanceAfterJoin, 'duplicated join should not change balance');

  const mallActivitiesRes = await api('/api/mall/activities', {
    method: 'GET',
    headers: cHeaders,
  });
  assert(mallActivitiesRes.status === 200, `list mall activities failed: ${mallActivitiesRes.status}`);
  const joinedActivity = Array.isArray(mallActivitiesRes.body?.list)
    ? mallActivitiesRes.body.list.find((row) => Number(row?.id || 0) === seeded.activityId)
    : null;
  assert(joinedActivity, `joined mall activity not found in list: ${seeded.activityId}`);
  assert(joinedActivity?.joined === true, 'joined mall activity should expose joined=true');

  console.log(
    JSON.stringify(
      {
        ok: true,
        tenantId: cAuth.tenantId,
        customer: cAuth.mobile,
        productId: seeded.productId,
        activityId: seeded.activityId,
        balanceBefore,
        balanceAfterRedeem,
        balanceAfterJoin,
        balanceAfterJoinAgain,
        joinedState: Boolean(joinedActivity?.joined),
      },
      null,
      2
    )
  );
}

run().catch((error) => {
  console.error(`[smoke:mall-commerce] ${error.message}`);
  process.exit(1);
});
