import { authRequired } from '../common/middleware.mjs';
import { tenantContext } from '../common/access-control.mjs';
import { getState } from '../common/state.mjs';
import {
  toCancelOrderCommand,
  toCreateOrderCommand,
  toPayOrderCommand,
  toRefundOrderCommand,
} from '../dto/write-commands.dto.mjs';
import { executeCreateOrder } from '../usecases/order-create.usecase.mjs';
import { executePayOrder } from '../usecases/order-pay.usecase.mjs';
import { executeCancelOrder } from '../usecases/order-cancel.usecase.mjs';
import { executeRefundOrder } from '../usecases/order-refund.usecase.mjs';
import { markPointsRequestFail, markPointsRequestSuccess, setPointsRequestContext } from '../../microservices/points-service/observability.mjs';

function mediaToUrl(mediaItem) {
  if (!mediaItem) return '';
  if (typeof mediaItem === 'string') return mediaItem;
  return String(mediaItem.preview || mediaItem.url || mediaItem.path || mediaItem.name || '');
}

function toAbsoluteUrl(req, url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (!raw.startsWith('/')) return raw;
  return `${req.protocol}://${req.get('host')}${raw}`;
}

function resolveProductSnapshot(state, req, productId) {
  const targetId = Number(productId || 0);
  if (targetId <= 0) return null;
  const product =
    (Array.isArray(state.pProducts) ? state.pProducts : []).find((row) => Number(row.id || 0) === targetId) ||
    (Array.isArray(state.mallItems) ? state.mallItems : []).find(
      (row) => Number(row.sourceProductId || row.id || 0) === targetId,
    ) ||
    null;
  if (!product) return null;
  const media = Array.isArray(product.media) ? product.media : [];
  const image = toAbsoluteUrl(req, mediaToUrl(media[0]) || String(product.image || ''));
  return {
    productName: String(product.name || product.title || ''),
    productImage: image || '',
  };
}

function enrichOrderRow(state, req, row) {
  const product = resolveProductSnapshot(state, req, row?.productId);
  return {
    ...row,
    productName: String(row?.productName || product?.productName || ''),
    productImage: String(product?.productImage || ''),
  };
}

function errorResponse(res, err) {
  const code = err?.message || 'UNKNOWN_ERROR';
  if (code === 'ITEM_NOT_FOUND') return res.status(404).json({ code, message: '商品不存在' });
  if (code === 'ORDER_NOT_FOUND') return res.status(404).json({ code, message: '订单不存在' });
  if (code === 'ORDER_FORBIDDEN') return res.status(403).json({ code, message: '无权访问该订单' });
  if (code === 'OUT_OF_STOCK') return res.status(409).json({ code, message: '库存不足' });
  if (code === 'INSUFFICIENT_POINTS') return res.status(409).json({ code, message: '积分不足' });
  if (code === 'ORDER_ALREADY_FULFILLED') return res.status(409).json({ code, message: '订单已履约，不能操作' });
  if (code === 'ORDER_NOT_PAID') return res.status(409).json({ code, message: '订单未支付' });
  return res.status(400).json({ code, message: '请求处理失败' });
}

export function registerOrdersRoutes(app) {
  app.get('/api/orders', authRequired, tenantContext, (req, res) => {
    setPointsRequestContext({
      route: `${String(req.method || 'GET').toUpperCase()} ${String(req.path || '/api/orders')}`,
      user_id: Number(req.user?.id || 0),
    });
    const state = getState();
    const list = (state.orders || [])
      .filter((row) => Number(row.customerId) === Number(req.user.id))
      .map((row) => enrichOrderRow(state, req, row))
      .sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
    markPointsRequestSuccess({ user_id: Number(req.user?.id || 0) });
    res.json({ list });
  });

  app.get('/api/orders/:id', authRequired, tenantContext, (req, res) => {
    const orderId = Number(req.params?.id || 0);
    setPointsRequestContext({
      route: `${String(req.method || 'GET').toUpperCase()} ${String(req.path || '/api/orders/:id')}`,
      user_id: Number(req.user?.id || 0),
      order_id: orderId,
    });
    if (!Number.isFinite(orderId) || orderId <= 0) {
      markPointsRequestFail('INVALID_ORDER_ID', { user_id: Number(req.user?.id || 0) });
      return res.status(400).json({ code: 'INVALID_ORDER_ID', message: '订单ID无效' });
    }

    const state = getState();
    const order = (state.orders || []).find((row) => Number(row.id) === orderId);
    if (!order) {
      markPointsRequestFail('ORDER_NOT_FOUND', { user_id: Number(req.user?.id || 0), order_id: orderId });
      return res.status(404).json({ code: 'ORDER_NOT_FOUND', message: '订单不存在' });
    }
    if (Number(order.customerId) !== Number(req.user.id)) {
      markPointsRequestFail('ORDER_FORBIDDEN', { user_id: Number(req.user?.id || 0), order_id: orderId });
      return res.status(403).json({ code: 'ORDER_FORBIDDEN', message: '无权访问该订单' });
    }

    const redemption = (state.redemptions || []).find((row) => Number(row.orderId) === Number(order.id)) || null;
    markPointsRequestSuccess({
      user_id: Number(req.user?.id || 0),
      order_id: Number(order?.id || 0),
      redemption_id: Number(redemption?.id || 0),
    });
    return res.json({ order: enrichOrderRow(state, req, order), redemption });
  });

  app.post('/api/orders', authRequired, tenantContext, async (req, res) => {
    setPointsRequestContext({
      route: `${String(req.method || 'POST').toUpperCase()} ${String(req.path || '/api/orders')}`,
      user_id: Number(req.user?.id || 0),
    });
    try {
      const command = toCreateOrderCommand({
        body: req.body || {},
        user: req.user,
        tenantContext: req.tenantContext,
        actor: req.actor,
      });
      const { order } = await executeCreateOrder(command);
      markPointsRequestSuccess({
        user_id: Number(req.user?.id || 0),
        order_id: Number(order?.id || 0),
      });
      return res.json({ ok: true, order });
    } catch (err) {
      if (err?.message === 'INVALID_PRODUCT_ID') {
        markPointsRequestFail('INVALID_PRODUCT_ID', { user_id: Number(req.user?.id || 0) });
        return res.status(400).json({ code: 'INVALID_PRODUCT_ID', message: '商品ID无效' });
      }
      markPointsRequestFail(err?.message || 'ORDER_REQUEST_FAILED', { user_id: Number(req.user?.id || 0) });
      return errorResponse(res, err);
    }
  });

  app.post('/api/orders/:id/pay', authRequired, tenantContext, async (req, res) => {
    const orderId = Number(req.params?.id || 0);
    setPointsRequestContext({
      route: `${String(req.method || 'POST').toUpperCase()} ${String(req.path || '/api/orders/:id/pay')}`,
      user_id: Number(req.user?.id || 0),
      order_id: orderId,
    });
    try {
      const command = toPayOrderCommand({
        params: req.params,
        body: req.body || {},
        user: req.user,
        tenantContext: req.tenantContext,
        actor: req.actor,
      });
      const { order, redemption } = await executePayOrder(command);
      markPointsRequestSuccess({
        user_id: Number(req.user?.id || 0),
        order_id: Number(order?.id || 0),
        redemption_id: Number(redemption?.id || 0),
      });
      return res.json({ ok: true, order, redemption });
    } catch (err) {
      if (err?.message === 'INVALID_ORDER_ID') {
        markPointsRequestFail('INVALID_ORDER_ID', { user_id: Number(req.user?.id || 0), order_id: orderId });
        return res.status(400).json({ code: 'INVALID_ORDER_ID', message: '订单ID无效' });
      }
      markPointsRequestFail(err?.message || 'ORDER_PAY_FAILED', { user_id: Number(req.user?.id || 0), order_id: orderId });
      return errorResponse(res, err);
    }
  });

  app.post('/api/orders/:id/cancel', authRequired, tenantContext, async (req, res) => {
    const orderId = Number(req.params?.id || 0);
    setPointsRequestContext({
      route: `${String(req.method || 'POST').toUpperCase()} ${String(req.path || '/api/orders/:id/cancel')}`,
      user_id: Number(req.user?.id || 0),
      order_id: orderId,
    });
    try {
      const command = toCancelOrderCommand({
        params: req.params,
        body: req.body || {},
        user: req.user,
        tenantContext: req.tenantContext,
        actor: req.actor,
      });
      const { order } = await executeCancelOrder(command);
      markPointsRequestSuccess({
        user_id: Number(req.user?.id || 0),
        order_id: Number(order?.id || 0),
      });
      return res.json({ ok: true, order });
    } catch (err) {
      if (err?.message === 'INVALID_ORDER_ID') {
        markPointsRequestFail('INVALID_ORDER_ID', { user_id: Number(req.user?.id || 0), order_id: orderId });
        return res.status(400).json({ code: 'INVALID_ORDER_ID', message: '订单ID无效' });
      }
      markPointsRequestFail(err?.message || 'ORDER_CANCEL_FAILED', { user_id: Number(req.user?.id || 0), order_id: orderId });
      return errorResponse(res, err);
    }
  });

  app.post('/api/orders/:id/refund', authRequired, tenantContext, async (req, res) => {
    const orderId = Number(req.params?.id || 0);
    setPointsRequestContext({
      route: `${String(req.method || 'POST').toUpperCase()} ${String(req.path || '/api/orders/:id/refund')}`,
      user_id: Number(req.user?.id || 0),
      order_id: orderId,
    });
    try {
      const command = toRefundOrderCommand({
        params: req.params,
        body: req.body || {},
        user: req.user,
        tenantContext: req.tenantContext,
        actor: req.actor,
      });
      const { order } = await executeRefundOrder(command);
      markPointsRequestSuccess({
        user_id: Number(req.user?.id || 0),
        order_id: Number(order?.id || 0),
      });
      return res.json({ ok: true, order });
    } catch (err) {
      if (err?.message === 'INVALID_ORDER_ID') {
        markPointsRequestFail('INVALID_ORDER_ID', { user_id: Number(req.user?.id || 0), order_id: orderId });
        return res.status(400).json({ code: 'INVALID_ORDER_ID', message: '订单ID无效' });
      }
      markPointsRequestFail(err?.message || 'ORDER_REFUND_FAILED', { user_id: Number(req.user?.id || 0), order_id: orderId });
      return errorResponse(res, err);
    }
  });
}
