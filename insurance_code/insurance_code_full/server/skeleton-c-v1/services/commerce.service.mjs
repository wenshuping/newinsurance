import {
  dateOnly,
  generateWriteoffToken,
  getBalance,
  getState,
  withIdempotency,
} from '../common/state.mjs';
import { buildActivityWriteoffToken, parseActivityOrderId } from '../common/activity-writeoff.mjs';
import { recordPoints } from './points.service.mjs';
import {
  appendPointsAuditLog,
  appendPointsDomainEvent,
  recordOrderStatusTransition,
  setPointsRequestContext,
} from '../../microservices/points-service/observability.mjs';
import {
  commitCommerceWrite,
  addOrderFulfillment,
  addOrderPayment,
  addOrderRefund,
  addRedemption,
  addWriteoffRecord,
  addActivityCompletion,
  adjustProductStock,
  createOrder as createOrderRow,
  ensureCommerceArrays,
  findActivityCompletion,
  findActivityCompletionById,
  findActiveProduct,
  findOrderById,
  findRedemptionByOrderId,
  markActivityCompletionWrittenOff,
  markOrderCancelled,
  markOrderPaid,
  markOrderRefunded,
  markOrderRefundStatus,
  markOrderWrittenOff,
  markRedemptionWrittenOff,
} from '../repositories/commerce.repository.mjs';

function resolveProductView(productRef) {
  const row = productRef?.row || {};
  return {
    id: Number(productRef?.id || row.id || 0),
    name: String(row.name || row.title || ''),
    stock: Number(row.stock || 0),
    pointsCost: Number(row.pointsCost ?? row.points ?? 0),
  };
}

function findActivityById(state, activityId) {
  return (
    (state.activities || []).find((row) => Number(row.id || 0) === Number(activityId || 0))
    || (state.mallActivities || []).find((row) => Number(row.id || 0) === Number(activityId || 0))
    || (state.bCustomerActivities || []).find((row) => Number(row.id || 0) === Number(activityId || 0))
    || null
  );
}

export async function createOrder({ tenantId = 1, customerId, productId, quantity = 1, idempotencyKey, actor }) {
  const state = getState();
  ensureCommerceArrays(state);

  const productRef = findActiveProduct(state, productId);
  if (!productRef) throw new Error('ITEM_NOT_FOUND');
  const product = resolveProductView(productRef);
  if (Number(quantity) <= 0) throw new Error('INVALID_QUANTITY');
  if (Number(product.stock) < Number(quantity)) throw new Error('OUT_OF_STOCK');

  const createOrderWrite = () => {
    const order = createOrderRow(state, {
      tenantId,
      customerId,
      productId: product.id,
      productName: product.name,
      quantity,
      pointsAmount: Number(product.pointsCost) * Number(quantity),
    });
    setPointsRequestContext({
      user_id: Number(customerId),
      order_id: Number(order.id || 0),
    });
    recordOrderStatusTransition({
      orderId: Number(order.id || 0),
      fromStatus: 'none',
      toStatus: order.status,
    });
    appendPointsDomainEvent('order.created', { orderId: order.id, tenantId: order.tenantId, customerId: order.customerId }, { tenantId });
    appendPointsAuditLog({
      tenantId,
      actorType: actor?.actorType || 'customer',
      actorId: Number(actor?.actorId || customerId),
      action: 'order.create',
      resourceType: 'order',
      resourceId: String(order.id),
      result: 'success',
      userId: Number(customerId),
      orderId: Number(order.id || 0),
    });
    return order;
  };

  const idempotent = idempotencyKey
    ? await withIdempotency({
        tenantId,
        bizType: 'order.create',
        bizKey: idempotencyKey,
        execute: createOrderWrite,
      })
    : {
        hit: false,
        value: createOrderWrite(),
      };

  commitCommerceWrite();
  return { order: idempotent.value, idempotent: idempotent.hit };
}

export async function payOrderWithPoints({ tenantId = 1, orderId, customerId, idempotencyKey, actor }) {
  const state = getState();
  ensureCommerceArrays(state);

  const order = findOrderById(state, orderId);
  if (!order) throw new Error('ORDER_NOT_FOUND');
  if (Number(order.customerId) !== Number(customerId)) throw new Error('ORDER_FORBIDDEN');
  setPointsRequestContext({
    user_id: Number(customerId),
    order_id: Number(order.id || 0),
  });
  if (order.paymentStatus === 'paid') {
    const existingRedemption = findRedemptionByOrderId(state, order.id);
    if (existingRedemption) {
      setPointsRequestContext({
        redemption_id: Number(existingRedemption.id || 0),
      });
    }
    return { order, redemption: existingRedemption || null, idempotent: true };
  }

  const key = idempotencyKey || `order-pay:${tenantId}:${orderId}`;
  const idempotent = await withIdempotency({
    tenantId,
    bizType: 'order.pay',
    bizKey: key,
    execute: () => {
      const productRef = findActiveProduct(state, order.productId);
      if (!productRef) throw new Error('ITEM_NOT_FOUND');
      const product = resolveProductView(productRef);
      if (Number(product.stock) < Number(order.quantity)) throw new Error('OUT_OF_STOCK');
      const balance = getBalance(customerId);
      if (balance < Number(order.pointsAmount)) throw new Error('INSUFFICIENT_POINTS');

      const previousStatus = String(order.status || '');
      adjustProductStock(state, productRef, -Number(order.quantity));
      markOrderPaid(order);
      recordOrderStatusTransition({
        orderId: Number(order.id || 0),
        fromStatus: previousStatus,
        toStatus: order.status,
      });

      recordPoints({
        tenantId,
        userId: Number(customerId),
        direction: 'out',
        amount: Number(order.pointsAmount),
        sourceType: 'order_pay',
        sourceId: String(order.id),
        idempotencyKey: `points-order-pay:${tenantId}:${order.id}`,
        description: `订单支付 ${order.orderNo}`,
      });

      addOrderPayment(state, {
        tenantId,
        orderId: order.id,
        paymentMethod: 'points',
        paymentStatus: 'paid',
        amount: Number(order.pointsAmount),
      });

      const redemption = addRedemption(state, {
        orderId: order.id,
        userId: customerId,
        itemId: order.productId,
        pointsCost: order.pointsAmount,
        status: 'pending',
        writeoffToken: generateWriteoffToken(),
        expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      });

      setPointsRequestContext({
        user_id: Number(customerId),
        order_id: Number(order.id || 0),
        redemption_id: Number(redemption.id || 0),
      });

      appendPointsDomainEvent(
        'order.paid',
        { orderId: order.id, customerId: order.customerId, points: order.pointsAmount, productId: order.productId },
        { tenantId }
      );
      appendPointsDomainEvent(
        'inventory.decremented',
        { productId: order.productId, quantity: order.quantity, orderId: order.id },
        { tenantId }
      );
      appendPointsAuditLog({
        tenantId,
        actorType: actor?.actorType || 'customer',
        actorId: Number(actor?.actorId || customerId),
        action: 'order.pay',
        resourceType: 'order',
        resourceId: String(order.id),
        result: 'success',
        userId: Number(customerId),
        orderId: Number(order.id || 0),
        redemptionId: Number(redemption.id || 0),
      });
      return { order, redemption };
    },
  });

  commitCommerceWrite();
  const value = idempotent.value;
  return { order: value.order || value, redemption: value.redemption || null, idempotent: idempotent.hit };
}

export function cancelOrder({ tenantId = 1, orderId, customerId, reason = '', actor }) {
  const state = getState();
  ensureCommerceArrays(state);
  const order = findOrderById(state, orderId);
  if (!order) throw new Error('ORDER_NOT_FOUND');
  if (Number(order.customerId) !== Number(customerId)) throw new Error('ORDER_FORBIDDEN');
  if (order.fulfillmentStatus === 'written_off' || order.fulfillmentStatus === 'shipped') throw new Error('ORDER_ALREADY_FULFILLED');
  setPointsRequestContext({
    user_id: Number(customerId),
    order_id: Number(order.id || 0),
  });
  if (order.status === 'cancelled') return { order, idempotent: true };

  const previousStatus = String(order.status || '');
  if (order.paymentStatus === 'paid' && order.refundStatus !== 'refunded') {
    recordPoints({
      tenantId,
      userId: Number(customerId),
      direction: 'in',
      amount: Number(order.pointsAmount),
      sourceType: 'order_cancel_refund',
      sourceId: String(order.id),
      idempotencyKey: `points-order-cancel-refund:${tenantId}:${order.id}`,
      description: `取消订单返还 ${order.orderNo}`,
    });

    const productRef = findActiveProduct(state, order.productId);
    if (productRef) adjustProductStock(state, productRef, Number(order.quantity));
    markOrderRefundStatus(order, 'refunded');
  }

  markOrderCancelled(order);
  recordOrderStatusTransition({
    orderId: Number(order.id || 0),
    fromStatus: previousStatus,
    toStatus: order.status,
  });
  addOrderRefund(state, {
    tenantId,
    orderId: order.id,
    refundType: 'cancel',
    status: 'success',
    reason,
  });
  appendPointsDomainEvent('order.cancelled', { orderId: order.id, reason }, { tenantId });
  appendPointsAuditLog({
    tenantId,
    actorType: actor?.actorType || 'customer',
    actorId: Number(actor?.actorId || customerId),
    action: 'order.cancel',
    resourceType: 'order',
    resourceId: String(order.id),
    result: 'success',
    userId: Number(customerId),
    orderId: Number(order.id || 0),
  });

  commitCommerceWrite();
  return { order, idempotent: false };
}

export function fulfillOrderWriteoff({ tenantId = 1, orderId, orderType = '', sourceRecordId = 0, operatorAgentId, token, actor }) {
  const state = getState();
  ensureCommerceArrays(state);
  const normalizedOrderType = String(orderType || '').trim().toLowerCase();
  const activityCompletionId = Number(sourceRecordId || 0) > 0
    ? Number(sourceRecordId || 0)
    : normalizedOrderType === 'activity'
      ? parseActivityOrderId(orderId)
      : 0;
  if (normalizedOrderType === 'activity' || activityCompletionId > 0) {
    const completion = findActivityCompletionById(state, activityCompletionId);
    if (!completion) throw new Error('ORDER_NOT_FOUND');
    const expectedToken = buildActivityWriteoffToken(completion);
    if (token && token !== expectedToken) throw new Error('INVALID_TOKEN');
    if (String(completion.writtenOffAt || '').trim()) {
      const activity = findActivityById(state, completion.activityId);
      return {
        order: {
          id: orderId,
          customerId: Number(completion.userId || 0),
          productId: Number(completion.activityId || 0),
          productName: String(activity?.title || `活动#${completion.activityId || 0}`),
          pointsAmount: Number(completion.pointsAwarded || activity?.rewardPoints || 0),
          paymentStatus: 'paid',
          fulfillmentStatus: 'written_off',
          status: 'completed',
          orderType: 'activity',
        },
        activityCompletion: completion,
        idempotent: true,
      };
    }
    markActivityCompletionWrittenOff(completion);
    commitCommerceWrite();
    const activity = findActivityById(state, completion.activityId);
    return {
      order: {
        id: orderId,
        customerId: Number(completion.userId || 0),
        productId: Number(completion.activityId || 0),
        productName: String(activity?.title || `活动#${completion.activityId || 0}`),
        pointsAmount: Number(completion.pointsAwarded || activity?.rewardPoints || 0),
        paymentStatus: 'paid',
        fulfillmentStatus: 'written_off',
        status: 'completed',
        orderType: 'activity',
      },
      activityCompletion: completion,
      idempotent: false,
    };
  }
  const order = findOrderById(state, orderId);
  if (!order) throw new Error('ORDER_NOT_FOUND');
  if (order.paymentStatus !== 'paid') throw new Error('ORDER_NOT_PAID');
  setPointsRequestContext({
    user_id: Number(actor?.actorId || operatorAgentId || order.customerId),
    order_id: Number(order.id || 0),
  });
  if (order.fulfillmentStatus === 'written_off') return { order, idempotent: true };

  const redemption = findRedemptionByOrderId(state, order.id);
  if (!redemption) throw new Error('REDEMPTION_NOT_FOUND');
  if (token && token !== redemption.writeoffToken) throw new Error('INVALID_TOKEN');
  if (new Date(redemption.expiresAt).getTime() < Date.now()) throw new Error('TOKEN_EXPIRED');

  const previousStatus = String(order.status || '');
  markRedemptionWrittenOff(redemption);
  markOrderWrittenOff(order);
  recordOrderStatusTransition({
    orderId: Number(order.id || 0),
    fromStatus: previousStatus,
    toStatus: order.status,
  });
  setPointsRequestContext({
    redemption_id: Number(redemption.id || 0),
  });

  addOrderFulfillment(state, {
    tenantId,
    orderId: order.id,
    mode: 'writeoff',
    operatorAgentId,
  });
  addWriteoffRecord(state, {
    tenantId,
    redeemRecordId: redemption.id,
    operatorAgentId,
    writeoffToken: redemption.writeoffToken,
    status: 'success',
  });
  appendPointsDomainEvent('order.written_off', { orderId: order.id, redemptionId: redemption.id }, { tenantId });
  appendPointsAuditLog({
    tenantId,
    actorType: actor?.actorType || 'agent',
    actorId: Number(actor?.actorId || operatorAgentId),
    action: 'order.writeoff',
    resourceType: 'order',
    resourceId: String(order.id),
    result: 'success',
    userId: Number(order.customerId || 0),
    orderId: Number(order.id || 0),
    redemptionId: Number(redemption.id || 0),
  });

  commitCommerceWrite();
  return { order, redemption, idempotent: false };
}

export function refundOrder({ tenantId = 1, orderId, operatorId, reason = 'manual_refund', actor }) {
  const state = getState();
  ensureCommerceArrays(state);
  const order = findOrderById(state, orderId);
  if (!order) throw new Error('ORDER_NOT_FOUND');
  if (order.paymentStatus !== 'paid') throw new Error('ORDER_NOT_PAID');
  setPointsRequestContext({
    user_id: Number(order.customerId || operatorId || 0),
    order_id: Number(order.id || 0),
  });
  if (order.refundStatus === 'refunded') return { order, idempotent: true };
  if (order.fulfillmentStatus === 'written_off' || order.fulfillmentStatus === 'shipped') {
    throw new Error('ORDER_ALREADY_FULFILLED');
  }

  const previousStatus = String(order.status || '');
  recordPoints({
    tenantId,
    userId: Number(order.customerId),
    direction: 'in',
    amount: Number(order.pointsAmount),
    sourceType: 'order_refund',
    sourceId: String(order.id),
    idempotencyKey: `points-order-refund:${tenantId}:${order.id}`,
    description: `订单退款返还 ${order.orderNo}`,
  });
  const productRef = findActiveProduct(state, order.productId);
  if (productRef) adjustProductStock(state, productRef, Number(order.quantity));

  markOrderRefunded(order);
  recordOrderStatusTransition({
    orderId: Number(order.id || 0),
    fromStatus: previousStatus,
    toStatus: order.status,
  });
  addOrderRefund(state, {
    tenantId,
    orderId: order.id,
    refundType: 'manual',
    status: 'success',
    reason,
  });
  appendPointsDomainEvent('order.refunded', { orderId: order.id, reason }, { tenantId });
  appendPointsAuditLog({
    tenantId,
    actorType: actor?.actorType || 'employee',
    actorId: Number(actor?.actorId || operatorId),
    action: 'order.refund',
    resourceType: 'order',
    resourceId: String(order.id),
    result: 'success',
    userId: Number(order.customerId || 0),
    orderId: Number(order.id || 0),
  });

  commitCommerceWrite();
  return { order, idempotent: false };
}

export function joinMallActivity({ tenantId = 1, customerId, activityId, rewardPoints, activityTitle, actor }) {
  const state = getState();
  ensureCommerceArrays(state);

  const existed = findActivityCompletion(state, customerId, activityId);
  if (existed) {
    return {
      duplicated: true,
      reward: Number(existed.pointsAwarded || 0),
      balance: getBalance(Number(customerId)),
      completion: existed,
    };
  }

  const now = new Date().toISOString();
  const completion = addActivityCompletion(state, {
    userId: customerId,
    activityId,
    completedDate: dateOnly(new Date()),
    pointsAwarded: Number(rewardPoints || 0),
    createdAt: now,
  });

  recordPoints({
    tenantId,
    userId: Number(customerId),
    direction: 'in',
    amount: Number(rewardPoints || 0),
    sourceType: 'mall_activity',
    sourceId: String(activityId),
    idempotencyKey: `mall-activity:${customerId}:${activityId}`,
    description: `参与商城活动 ${String(activityTitle || activityId)}`,
  });

  setPointsRequestContext({
    user_id: Number(customerId),
  });

  appendPointsDomainEvent(
    'mall.activity.joined',
    { tenantId: Number(tenantId), customerId: Number(customerId), activityId: Number(activityId), pointsAwarded: Number(rewardPoints || 0) },
    { tenantId: Number(tenantId) }
  );
  appendPointsAuditLog({
    tenantId: Number(tenantId),
    actorType: actor?.actorType || 'customer',
    actorId: Number(actor?.actorId || customerId),
    action: 'mall.activity.join',
    resourceType: 'mall_activity',
    resourceId: String(activityId),
    result: 'success',
    userId: Number(customerId),
  });

  commitCommerceWrite();
  return {
    duplicated: false,
    reward: Number(rewardPoints || 0),
    balance: getBalance(Number(customerId)),
    completion,
  };
}
