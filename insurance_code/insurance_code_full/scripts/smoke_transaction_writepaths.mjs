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

async function loginCustomer(tenantId) {
  const mobile = `139${String(Date.now()).slice(-8)}`;
  const res = await api('/api/auth/verify-basic', {
    method: 'POST',
    headers: { 'x-tenant-id': String(tenantId) },
    body: JSON.stringify({ name: '事务回滚验证用户', mobile, code: '123456' }),
  });
  assert(res.status === 200, `customer login failed: ${res.status}`);
  const token = String(res.body?.token || '');
  const csrfToken = String(res.body?.csrfToken || '');
  assert(token, 'customer token missing');
  assert(csrfToken, 'customer csrfToken missing');
  return { token, csrfToken, mobile, tenantId };
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
      name: `事务回滚员工_${suffix}`,
      email: `txn_smoke_${suffix}@demo.local`,
      mobile: `137${String(suffix).slice(-8)}`,
      teamId: Number(teams[0].id),
      role: 'salesperson',
      initialPassword: '123456',
    }),
  });
  assert(createRes.status === 200, `create employee failed: ${createRes.status}`);
  return Number(createRes.body?.employee?.id || 0);
}

async function fetchBalance(headers) {
  const res = await api('/api/points/summary', { method: 'GET', headers });
  assert(res.status === 200, `points summary failed: ${res.status}`);
  return Number(res.body?.balance || 0);
}

async function fetchOrders(headers) {
  const res = await api('/api/orders', { method: 'GET', headers });
  assert(res.status === 200, `orders list failed: ${res.status}`);
  const list = Array.isArray(res.body?.list) ? res.body.list : [];
  return { count: list.length, list };
}

async function createExpensiveProduct(headers) {
  const suffix = Date.now();
  const res = await api('/api/p/mall/products', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: `事务回滚商品_${suffix}`,
      points: 99999,
      stock: 6,
      status: 'active',
      description: '用于验证 redeem 事务回滚',
      category: '事务回滚',
    }),
  });
  assert(res.status === 200, `create product failed: ${res.status}`);
  const product = res.body?.product;
  const productId = Number(product?.id || 0);
  assert(productId > 0, 'create product missing id');
  return { productId, stock: Number(product?.stock || 0) };
}

async function fetchProductStock(headers, productId) {
  const res = await api('/api/mall/items', { method: 'GET', headers });
  assert(res.status === 200, `mall items failed: ${res.status}`);
  const items = Array.isArray(res.body?.items) ? res.body.items : [];
  const row = items.find((x) => Number(x.id) === Number(productId));
  assert(row, `product not visible for customer: ${productId}`);
  return Number(row.stock || 0);
}

async function run() {
  const pAuth = await loginPAdmin();
  const tenantId = TENANT_ID_FROM_ENV > 0 ? TENANT_ID_FROM_ENV : pAuth.tenantId;
  const pHeaders = {
    authorization: `Bearer ${pAuth.token}`,
    'x-csrf-token': pAuth.csrfToken,
    'x-tenant-id': String(tenantId),
  };

  const product = await createExpensiveProduct(pHeaders);
  const assignAgentId = await resolveAssignableAgentId(pHeaders);
  const cAuth = await loginCustomer(tenantId);
  const assignRes = await api('/api/p/customers/assign-by-mobile', {
    method: 'POST',
    headers: {
      ...pHeaders,
      'x-action-confirm': 'YES',
    },
    body: JSON.stringify({
      mobile: cAuth.mobile,
      agentId: assignAgentId,
    }),
  });
  assert(assignRes.status === 200, `assign customer failed: ${assignRes.status}`);

  const cHeaders = {
    authorization: `Bearer ${cAuth.token}`,
    'x-csrf-token': cAuth.csrfToken,
    'x-tenant-id': String(cAuth.tenantId),
  };

  const balanceBefore = await fetchBalance(cHeaders);
  const ordersBefore = await fetchOrders(cHeaders);
  const stockBefore = await fetchProductStock(cHeaders, product.productId);

  const redeemRes = await api('/api/mall/redeem', {
    method: 'POST',
    headers: {
      ...cHeaders,
      'x-action-confirm': 'YES',
    },
    body: JSON.stringify({ itemId: product.productId, quantity: 1 }),
  });

  assert(redeemRes.status === 409, `redeem should fail with 409, got ${redeemRes.status}`);
  assert(redeemRes.body?.code === 'INSUFFICIENT_POINTS', `unexpected error code: ${redeemRes.body?.code || 'N/A'}`);

  const balanceAfter = await fetchBalance(cHeaders);
  const ordersAfter = await fetchOrders(cHeaders);
  const stockAfter = await fetchProductStock(cHeaders, product.productId);

  assert(balanceAfter === balanceBefore, `balance changed unexpectedly: before=${balanceBefore}, after=${balanceAfter}`);
  assert(ordersAfter.count === ordersBefore.count, `order count changed unexpectedly: before=${ordersBefore.count}, after=${ordersAfter.count}`);
  assert(stockAfter === stockBefore, `stock changed unexpectedly: before=${stockBefore}, after=${stockAfter}`);

  console.log(
    JSON.stringify(
      {
        ok: true,
        tenantId,
        customer: cAuth.mobile,
        productId: product.productId,
        expectedFailure: 'INSUFFICIENT_POINTS',
        rollbackVerified: {
          balanceUnchanged: true,
          orderCountUnchanged: true,
          stockUnchanged: true,
        },
        snapshot: {
          balanceBefore,
          balanceAfter,
          ordersBefore: ordersBefore.count,
          ordersAfter: ordersAfter.count,
          stockBefore,
          stockAfter,
        },
      },
      null,
      2
    )
  );
}

run().catch((error) => {
  console.error(`[smoke:transaction-writepaths] ${error.message}`);
  process.exit(1);
});
