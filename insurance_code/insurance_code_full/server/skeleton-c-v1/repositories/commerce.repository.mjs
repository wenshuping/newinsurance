import { nextId, persistState } from '../common/state.mjs';
import { buildActivityWriteoffToken } from '../common/activity-writeoff.mjs';

export function ensureCommerceArrays(state) {
  if (!Array.isArray(state.orders)) state.orders = [];
  if (!Array.isArray(state.orderPayments)) state.orderPayments = [];
  if (!Array.isArray(state.orderFulfillments)) state.orderFulfillments = [];
  if (!Array.isArray(state.orderRefunds)) state.orderRefunds = [];
  if (!Array.isArray(state.redemptions)) state.redemptions = [];
  if (!Array.isArray(state.bWriteOffRecords)) state.bWriteOffRecords = [];
  if (!Array.isArray(state.activityCompletions)) state.activityCompletions = [];
}

function isActiveProductRow(row) {
  const status = String(row?.status || row?.shelfStatus || '').trim().toLowerCase();
  const activeByStatus = ['active', 'online', 'published', 'on', 'running', '进行中', '生效'].includes(status);
  const activeByFlag = row?.isActive === true;
  return activeByFlag || activeByStatus;
}

function toProductRef(row, source, resolvedId = 0) {
  return {
    source,
    row,
    id: Number(resolvedId || row?.id || 0),
  };
}

export function findActiveProduct(state, productId) {
  const pid = Number(productId);
  const product = (state.pProducts || []).find((row) => Number(row.id) === pid && isActiveProductRow(row));
  if (product) return toProductRef(product, 'p_products', pid);

  const item = (state.mallItems || []).find((row) => {
    const mappedId = Number(row.sourceProductId || row.id || 0);
    return mappedId === pid && (Boolean(row.isActive) || isActiveProductRow(row));
  });
  if (item) return toProductRef(item, 'mall_items', Number(item.sourceProductId || item.id || 0));
  return null;
}

export function findOrderById(state, orderId) {
  return (state.orders || []).find((row) => Number(row.id) === Number(orderId));
}

export function findRedemptionByOrderId(state, orderId) {
  return (state.redemptions || []).find((row) => Number(row.orderId) === Number(orderId));
}

export function findActivityCompletion(state, customerId, activityId) {
  return (state.activityCompletions || []).find(
    (row) => Number(row.userId) === Number(customerId) && Number(row.activityId) === Number(activityId)
  );
}

export function findActivityCompletionById(state, completionId) {
  return (state.activityCompletions || []).find((row) => Number(row.id) === Number(completionId));
}

export function createOrder(state, payload) {
  ensureCommerceArrays(state);
  const now = new Date().toISOString();
  const order = {
    id: nextId(state.orders),
    tenantId: Number(payload.tenantId),
    customerId: Number(payload.customerId),
    productId: Number(payload.productId),
    productName: String(payload.productName || ''),
    quantity: Number(payload.quantity),
    pointsAmount: Number(payload.pointsAmount),
    status: 'created',
    paymentStatus: 'pending',
    fulfillmentStatus: 'pending',
    refundStatus: 'none',
    orderNo: `OD${Date.now()}${Math.floor(Math.random() * 1000)}`,
    createdAt: now,
    updatedAt: now,
  };
  state.orders.push(order);
  return order;
}

export function markOrderPaid(order) {
  order.status = 'paid';
  order.paymentStatus = 'paid';
  order.updatedAt = new Date().toISOString();
  return order;
}

export function markOrderRefundStatus(order, refundStatus = 'refunded') {
  order.refundStatus = refundStatus;
  order.updatedAt = new Date().toISOString();
  return order;
}

export function markOrderCancelled(order) {
  order.status = 'cancelled';
  order.updatedAt = new Date().toISOString();
  return order;
}

export function markOrderRefunded(order) {
  order.refundStatus = 'refunded';
  order.status = 'cancelled';
  order.updatedAt = new Date().toISOString();
  return order;
}

export function markOrderWrittenOff(order) {
  order.fulfillmentStatus = 'written_off';
  order.status = 'fulfilled';
  order.updatedAt = new Date().toISOString();
  return order;
}

export function adjustProductStock(state, productRef, delta) {
  const resolvedId = Number(productRef?.id || productRef?.row?.id || productRef?.sourceProductId || 0);
  const currentStock = Number(productRef?.row?.stock || 0);
  const nextStock = currentStock + Number(delta || 0);
  if (productRef?.row) productRef.row.stock = nextStock;

  for (const row of state.pProducts || []) {
    if (Number(row.id || 0) !== resolvedId) continue;
    row.stock = nextStock;
  }
  for (const item of state.mallItems || []) {
    const mappedId = Number(item.sourceProductId || item.id || 0);
    if (mappedId !== resolvedId) continue;
    item.stock = nextStock;
  }

  return nextStock;
}

export function addOrderPayment(state, payload) {
  ensureCommerceArrays(state);
  const payment = {
    id: nextId(state.orderPayments),
    tenantId: Number(payload.tenantId),
    orderId: Number(payload.orderId),
    paymentMethod: payload.paymentMethod || 'points',
    paymentStatus: payload.paymentStatus || 'paid',
    amount: Number(payload.amount || 0),
    createdAt: new Date().toISOString(),
  };
  state.orderPayments.push(payment);
  return payment;
}

export function addRedemption(state, payload) {
  ensureCommerceArrays(state);
  const redemption = {
    id: nextId(state.redemptions),
    orderId: Number(payload.orderId),
    userId: Number(payload.userId),
    itemId: Number(payload.itemId),
    pointsCost: Number(payload.pointsCost || 0),
    status: payload.status || 'pending',
    writeoffToken: payload.writeoffToken,
    expiresAt: payload.expiresAt,
    createdAt: new Date().toISOString(),
    writtenOffAt: null,
  };
  state.redemptions.push(redemption);
  return redemption;
}

export function markRedemptionWrittenOff(redemption) {
  redemption.status = 'written_off';
  redemption.writtenOffAt = new Date().toISOString();
  return redemption;
}

export function addOrderRefund(state, payload) {
  ensureCommerceArrays(state);
  const refund = {
    id: nextId(state.orderRefunds),
    tenantId: Number(payload.tenantId),
    orderId: Number(payload.orderId),
    refundType: payload.refundType || 'manual',
    status: payload.status || 'success',
    reason: payload.reason || '',
    createdAt: new Date().toISOString(),
  };
  state.orderRefunds.push(refund);
  return refund;
}

export function addOrderFulfillment(state, payload) {
  ensureCommerceArrays(state);
  const fulfillment = {
    id: nextId(state.orderFulfillments),
    tenantId: Number(payload.tenantId),
    orderId: Number(payload.orderId),
    mode: payload.mode || 'writeoff',
    operatorAgentId: Number(payload.operatorAgentId),
    createdAt: new Date().toISOString(),
  };
  state.orderFulfillments.push(fulfillment);
  return fulfillment;
}

export function addWriteoffRecord(state, payload) {
  ensureCommerceArrays(state);
  const record = {
    id: nextId(state.bWriteOffRecords),
    tenantId: Number(payload.tenantId),
    redeemRecordId: Number(payload.redeemRecordId),
    operatorAgentId: Number(payload.operatorAgentId),
    writeoffToken: payload.writeoffToken,
    status: payload.status || 'success',
    createdAt: new Date().toISOString(),
  };
  state.bWriteOffRecords.push(record);
  return record;
}

export function addActivityCompletion(state, payload) {
  ensureCommerceArrays(state);
  const completedAt = payload.completedAt || payload.createdAt || new Date().toISOString();
  const completionId = nextId(state.activityCompletions);
  const completion = {
    id: completionId,
    tenantId: Number(payload.tenantId || 1),
    userId: Number(payload.userId),
    activityId: Number(payload.activityId),
    completedDate: payload.completedDate,
    pointsAwarded: Number(payload.pointsAwarded || 0),
    completedAt,
    createdAt: completedAt,
    writeoffToken: String(payload.writeoffToken || '').trim() || buildActivityWriteoffToken({
      tenantId: Number(payload.tenantId || 1),
      userId: Number(payload.userId),
      activityId: Number(payload.activityId),
      id: completionId,
    }),
    writtenOffAt: payload.writtenOffAt || null,
  };
  state.activityCompletions.push(completion);
  return completion;
}

export function markActivityCompletionWrittenOff(completion) {
  completion.writtenOffAt = new Date().toISOString();
  return completion;
}

export function commitCommerceWrite() {
  persistState();
}
