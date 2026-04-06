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
    assert(csrfToken, 'p admin csrf token missing');
    assert(tenantId > 0, 'p admin tenant id missing');
    return { token, csrfToken, tenantId };
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
      name: `订单冒烟员工_${suffix}`,
      email: `orders_smoke_${suffix}@demo.local`,
      mobile: `137${String(suffix).slice(-8)}`,
      teamId: Number(teams[0].id),
      role: 'salesperson',
      initialPassword: '123456',
    }),
  });
  assert(createRes.status === 200, `create employee failed: ${createRes.status}`);
  const employeeId = Number(createRes.body?.employee?.id || 0);
  assert(employeeId > 0, 'create employee missing id');
  return employeeId;
}

async function loginCustomer(tenantId) {
  const mobile = `139${String(Date.now()).slice(-8)}`;
  const res = await api('/api/auth/verify-basic', {
    method: 'POST',
    headers: { 'x-tenant-id': String(tenantId) },
    body: JSON.stringify({
      name: '订单链路验证客户',
      mobile,
      code: '123456',
    }),
  });
  assert(res.status === 200, `customer login failed: ${res.status}`);
  const token = String(res.body?.token || '');
  const csrfToken = String(res.body?.csrfToken || '');
  assert(token, 'customer token missing');
  assert(csrfToken, 'customer csrf token missing');
  return { token, csrfToken, mobile, tenantId };
}

async function fetchBalance(headers) {
  const res = await api('/api/points/summary', { method: 'GET', headers });
  assert(res.status === 200, `points summary failed: ${res.status}`);
  return Number(res.body?.balance || 0);
}

async function createProduct(headers, points) {
  const suffix = Date.now();
  const res = await api('/api/p/mall/products', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: `订单链路商品_${suffix}`,
      points,
      stock: 10,
      status: 'active',
      description: '用于订单生命周期冒烟验证',
      category: '订单冒烟',
    }),
  });
  assert(res.status === 200, `create p mall product failed: ${res.status}`);
  const productId = Number(res.body?.product?.id || 0);
  assert(productId > 0, 'create product missing id');
  return { productId, title: `订单链路商品_${suffix}` };
}

async function fetchProductStock(headers, productId) {
  const res = await api('/api/mall/items', { method: 'GET', headers });
  assert(res.status === 200, `mall items failed: ${res.status}`);
  const items = Array.isArray(res.body?.items) ? res.body.items : [];
  const row = items.find((item) => Number(item.id || 0) === Number(productId));
  assert(row, `product not visible in customer mall list: ${productId}`);
  return Number(row.stock || 0);
}

async function createOrder(headers, productId) {
  const res = await api('/api/orders', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      productId,
      quantity: 1,
      idempotencyKey: `smoke-order-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    }),
  });
  assert(res.status === 200, `create order failed: ${res.status}`);
  const order = res.body?.order || {};
  const orderId = Number(order.id || 0);
  assert(orderId > 0, 'create order missing id');
  return orderId;
}

async function payOrder(headers, orderId) {
  const res = await api(`/api/orders/${orderId}/pay`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });
  assert(res.status === 200, `pay order failed: ${res.status}`);
}

async function cancelOrder(headers, orderId) {
  const res = await api(`/api/orders/${orderId}/cancel`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ reason: 'smoke_cancel' }),
  });
  assert(res.status === 200, `cancel order failed: ${res.status}`);
}

async function refundOrder(headers, orderId) {
  const res = await api(`/api/orders/${orderId}/refund`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ reason: 'smoke_refund' }),
  });
  assert(res.status === 200, `refund order failed: ${res.status}`);
}

async function fetchOrders(headers) {
  const res = await api('/api/orders', { method: 'GET', headers });
  assert(res.status === 200, `orders list failed: ${res.status}`);
  const list = Array.isArray(res.body?.list) ? res.body.list : [];
  return list;
}

function pickOrder(orders, orderId) {
  return orders.find((row) => Number(row.id) === Number(orderId)) || null;
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

async function run() {
  const pAuth = await loginPAdmin();
  const tenantId = TENANT_ID_FROM_ENV > 0 ? TENANT_ID_FROM_ENV : pAuth.tenantId;
  const pHeaders = {
    authorization: `Bearer ${pAuth.token}`,
    'x-csrf-token': pAuth.csrfToken,
    'x-tenant-id': String(tenantId),
  };

  const cAuth = await loginCustomer(tenantId);
  const assignAgentId = await resolveAssignableAgentId(pHeaders);
  await assignCustomerByMobile(pHeaders, cAuth.mobile, assignAgentId);

  const cHeaders = {
    authorization: `Bearer ${cAuth.token}`,
    'x-csrf-token': cAuth.csrfToken,
    'x-tenant-id': String(tenantId),
  };

  const balanceBefore = await fetchBalance(cHeaders);
  assert(balanceBefore > 0, 'customer balance should be positive');
  const costPerOrder = Math.max(1, Math.min(20, Math.floor(balanceBefore / 4) || 1));
  const product = await createProduct(pHeaders, costPerOrder);
  const stockBefore = await fetchProductStock(cHeaders, product.productId);

  const order1 = await createOrder(cHeaders, product.productId);
  await payOrder(cHeaders, order1);
  const balanceAfterOrder1Pay = await fetchBalance(cHeaders);
  const stockAfterOrder1Pay = await fetchProductStock(cHeaders, product.productId);
  assert(
    balanceAfterOrder1Pay === balanceBefore - costPerOrder,
    `order1 pay balance mismatch: before=${balanceBefore}, after=${balanceAfterOrder1Pay}, cost=${costPerOrder}`
  );
  assert(
    stockAfterOrder1Pay === stockBefore - 1,
    `order1 pay stock mismatch: before=${stockBefore}, after=${stockAfterOrder1Pay}`
  );

  const ordersAfterOrder1Pay = await fetchOrders(cHeaders);
  const order1AfterPay = pickOrder(ordersAfterOrder1Pay, order1);
  assert(order1AfterPay, `order1 missing after pay: ${order1}`);
  assert(
    String(order1AfterPay.paymentStatus || '') === 'paid',
    `order1 paymentStatus should be paid, got ${String(order1AfterPay.paymentStatus || '')}`
  );

  await cancelOrder(cHeaders, order1);
  const balanceAfterOrder1Cancel = await fetchBalance(cHeaders);
  const stockAfterOrder1Cancel = await fetchProductStock(cHeaders, product.productId);
  assert(
    balanceAfterOrder1Cancel === balanceBefore,
    `order1 cancel refund mismatch: before=${balanceBefore}, after=${balanceAfterOrder1Cancel}`
  );
  assert(
    stockAfterOrder1Cancel === stockBefore,
    `order1 cancel stock restore mismatch: before=${stockBefore}, after=${stockAfterOrder1Cancel}`
  );

  const ordersAfterOrder1Cancel = await fetchOrders(cHeaders);
  const order1AfterCancel = pickOrder(ordersAfterOrder1Cancel, order1);
  assert(order1AfterCancel, `order1 missing after cancel: ${order1}`);
  assert(
    String(order1AfterCancel.status || '') === 'cancelled',
    `order1 status should be cancelled, got ${String(order1AfterCancel.status || '')}`
  );
  assert(
    String(order1AfterCancel.refundStatus || '') === 'refunded',
    `order1 refundStatus should be refunded, got ${String(order1AfterCancel.refundStatus || '')}`
  );

  const order2 = await createOrder(cHeaders, product.productId);
  await payOrder(cHeaders, order2);
  const balanceAfterOrder2Pay = await fetchBalance(cHeaders);
  const stockAfterOrder2Pay = await fetchProductStock(cHeaders, product.productId);
  assert(
    balanceAfterOrder2Pay === balanceBefore - costPerOrder,
    `order2 pay balance mismatch: before=${balanceBefore}, after=${balanceAfterOrder2Pay}, cost=${costPerOrder}`
  );
  assert(
    stockAfterOrder2Pay === stockBefore - 1,
    `order2 pay stock mismatch: before=${stockBefore}, after=${stockAfterOrder2Pay}`
  );

  const ordersAfterOrder2Pay = await fetchOrders(cHeaders);
  const order2AfterPay = pickOrder(ordersAfterOrder2Pay, order2);
  assert(order2AfterPay, `order2 missing after pay: ${order2}`);
  assert(
    String(order2AfterPay.paymentStatus || '') === 'paid',
    `order2 paymentStatus should be paid, got ${String(order2AfterPay.paymentStatus || '')}`
  );

  await refundOrder(cHeaders, order2);
  const balanceAfterOrder2Refund = await fetchBalance(cHeaders);
  const stockAfterOrder2Refund = await fetchProductStock(cHeaders, product.productId);
  assert(
    balanceAfterOrder2Refund === balanceBefore,
    `order2 refund mismatch: before=${balanceBefore}, after=${balanceAfterOrder2Refund}`
  );
  assert(
    stockAfterOrder2Refund === stockBefore,
    `order2 refund stock restore mismatch: before=${stockBefore}, after=${stockAfterOrder2Refund}`
  );

  const ordersAfterOrder2Refund = await fetchOrders(cHeaders);
  const order2AfterRefund = pickOrder(ordersAfterOrder2Refund, order2);
  assert(order2AfterRefund, `order2 missing after refund: ${order2}`);
  assert(
    String(order2AfterRefund.refundStatus || '') === 'refunded',
    `order2 refundStatus should be refunded, got ${String(order2AfterRefund.refundStatus || '')}`
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        tenantId,
        customer: cAuth.mobile,
        assignAgentId,
        productId: product.productId,
        costPerOrder,
        snapshots: {
          balanceBefore,
          balanceAfterOrder1Pay,
          balanceAfterOrder1Cancel,
          balanceAfterOrder2Pay,
          balanceAfterOrder2Refund,
          stockBefore,
          stockAfterOrder1Pay,
          stockAfterOrder1Cancel,
          stockAfterOrder2Pay,
          stockAfterOrder2Refund,
          order1StatusAfterCancel: String(order1AfterCancel.status || ''),
          order1RefundStatusAfterCancel: String(order1AfterCancel.refundStatus || ''),
          order2PaymentStatusAfterPay: String(order2AfterPay.paymentStatus || ''),
          order2RefundStatusAfterRefund: String(order2AfterRefund.refundStatus || ''),
        },
      },
      null,
      2
    )
  );
}

run().catch((error) => {
  console.error(`[smoke:orders-lifecycle] ${error.message}`);
  process.exit(1);
});
