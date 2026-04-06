import { toBOrderWriteoffCommand } from '../dto/write-commands.dto.mjs';
import { executeBOrderWriteoff } from '../usecases/b-order-writeoff.usecase.mjs';
import { buildActivityWriteoffToken, isActivityCompletionWrittenOff, toActivityOrderId } from '../common/activity-writeoff.mjs';

export function registerBAdminOrderRoutes(app, deps) {
  const { dataScope, fulfillOrderWriteoff, getState, permissionRequired, tenantContext } = deps;

  app.get('/api/b/orders', tenantContext, permissionRequired('customer:read'), dataScope('customer'), (req, res) => {
    const state = getState();
    const tenantId = Number(req.tenantContext.tenantId || 0);
    if (!Number.isFinite(tenantId) || tenantId <= 0) {
      return res.status(400).json({ code: 'TENANT_CONTEXT_REQUIRED', message: '缺少租户上下文' });
    }
    const redemptionByOrderId = new Map(
      (Array.isArray(state.redemptions) ? state.redemptions : []).map((row) => [Number(row.orderId || 0), row])
    );
    const productOrders = (state.orders || [])
      .filter((row) => {
        const customer = (state.users || []).find((user) => Number(user.id) === Number(row.customerId));
        return req.dataScope.canAccessCustomer(customer);
      })
      .map((row) => {
        const redemption = redemptionByOrderId.get(Number(row.id || 0)) || null;
        return {
          ...row,
          orderType: String(row.orderType || 'product'),
          sourceRecordId: Number(row.id || 0),
          writeoffToken: String(redemption?.writeoffToken || ''),
        };
      });
    const activityOrders = (state.activityCompletions || [])
      .filter((row) => {
        const customer = (state.users || []).find((user) => Number(user.id) === Number(row.userId));
        return req.dataScope.canAccessCustomer(customer);
      })
      .map((row) => {
        const activity =
          (state.activities || []).find((a) => Number(a.id) === Number(row.activityId))
          || (state.mallActivities || []).find((a) => Number(a.id) === Number(row.activityId))
          || (state.bCustomerActivities || []).find((a) => Number(a.id) === Number(row.activityId));
        const createdAt = row.completedAt || row.createdAt || new Date().toISOString();
        const writtenOff = isActivityCompletionWrittenOff(row);
        return {
          id: toActivityOrderId(Number(row.id || 0)),
          tenantId,
          customerId: Number(row.userId),
          productId: Number(row.activityId),
          productName: String(activity?.title || `活动#${row.activityId}`),
          quantity: 1,
          pointsAmount: Number(row.pointsAwarded || activity?.rewardPoints || 0),
          status: writtenOff ? 'completed' : 'paid',
          paymentStatus: 'paid',
          fulfillmentStatus: writtenOff ? 'written_off' : 'pending',
          refundStatus: 'none',
          orderNo: `ACT-${String(row.completedDate || '').replace(/-/g, '')}-${row.id}`,
          createdAt,
          updatedAt: row.writtenOffAt || createdAt,
          orderType: 'activity',
          sourceRecordId: Number(row.id || 0),
          writeoffToken: buildActivityWriteoffToken(row),
        };
      });
    const list = [...productOrders, ...activityOrders].sort(
      (a, b) => new Date(String(b.createdAt || 0)).getTime() - new Date(String(a.createdAt || 0)).getTime()
    );
    res.json({ list });
  });

  app.post('/api/b/orders/:id/writeoff', tenantContext, permissionRequired('order:writeoff'), (req, res) => {
    const command = toBOrderWriteoffCommand({
      params: req.params,
      body: req.body,
      actor: req.actor,
      tenantContext: req.tenantContext,
      deps: { fulfillOrderWriteoff },
    });
    executeBOrderWriteoff(command)
      .then((result) => res.json({ ok: true, ...result }))
      .catch((err) => {
        const code = err?.message || 'WRITE_OFF_FAILED';
        const mapping = {
          ORDER_NOT_FOUND: [404, '订单不存在'],
          ORDER_NOT_PAID: [409, '订单未支付'],
          REDEMPTION_NOT_FOUND: [404, '兑换记录不存在'],
          INVALID_TOKEN: [400, '核销码错误'],
          TOKEN_EXPIRED: [410, '核销已过期'],
        };
        const [status, message] = mapping[code] || [400, '核销失败'];
        return res.status(status).json({ code, message });
      });
  });
}
