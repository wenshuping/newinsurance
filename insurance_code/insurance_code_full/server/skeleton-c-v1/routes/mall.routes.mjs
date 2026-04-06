import { authOptional, authRequired, requireActionConfirmation, validateBody } from '../common/middleware.mjs';
import { tenantContext } from '../common/access-control.mjs';
import { redeemBodySchema } from '../schemas/mall.schemas.mjs';
import { toRedeemCommand } from '../dto/write-commands.dto.mjs';
import { executeRedeem } from '../usecases/redeem.usecase.mjs';
import { listMallActivities, listMallItems, assertRedeemableProduct } from '../usecases/mall-query.usecase.mjs';
import { executeMallActivityJoin } from '../usecases/mall-join-activity.usecase.mjs';
import { markPointsRequestFail, recordPointsOperationOutcome, setPointsRequestContext } from '../../microservices/points-service/observability.mjs';

function errorResponse(res, err) {
  const code = err?.message || 'REDEEM_FAILED';
  if (code === 'ITEM_NOT_FOUND') return res.status(404).json({ code, message: '商品不存在' });
  if (code === 'ITEM_NOT_AVAILABLE') return res.status(409).json({ code, message: '商品未上架或无权限' });
  if (code === 'INVALID_ITEM_ID') return res.status(400).json({ code, message: '商品ID无效' });
  if (code === 'OUT_OF_STOCK') return res.status(409).json({ code, message: '库存不足' });
  if (code === 'INSUFFICIENT_POINTS') return res.status(409).json({ code, message: '积分不足' });
  if (code === 'INVALID_ACTIVITY_ID') return res.status(400).json({ code, message: '活动ID无效' });
  if (code === 'MALL_ACTIVITY_NOT_FOUND') return res.status(404).json({ code, message: '商城活动不存在' });
  if (code === 'MALL_ACTIVITY_NOT_AVAILABLE') return res.status(409).json({ code, message: '活动未上架或已下线' });
  if (code === 'NO_PERMISSION') return res.status(403).json({ code, message: '暂无权限，请联系管理员' });
  return res.status(400).json({ code, message: '兑换失败' });
}

export function registerMallRoutes(app) {
  app.get('/api/mall/items', authOptional, tenantContext, (req, res) => {
    return res.json(listMallItems({ actor: req.actor, req }));
  });

  app.get('/api/mall/activities', authOptional, tenantContext, (req, res) => {
    return res.json(listMallActivities({ actor: req.actor, req }));
  });

  app.post('/api/mall/redeem', authRequired, tenantContext, requireActionConfirmation('积分兑换'), validateBody(redeemBodySchema), async (req, res) => {
    setPointsRequestContext({
      route: `${String(req.method || 'POST').toUpperCase()} ${String(req.path || '/api/mall/redeem')}`,
      user_id: Number(req.user?.id || 0),
    });

    if (!req.user.isVerifiedBasic) {
      recordPointsOperationOutcome('redeem', {
        result: 'fail',
        code: 'NEED_BASIC_VERIFY',
        patch: { user_id: Number(req.user?.id || 0) },
      });
      return res.status(403).json({ code: 'NEED_BASIC_VERIFY', message: '请先完成基础身份确认' });
    }

    try {
      assertRedeemableProduct({ itemId: req.body?.itemId, actor: req.actor });
      const command = toRedeemCommand({
        body: req.body,
        user: req.user,
        tenantContext: req.tenantContext,
        actor: req.actor,
      });
      const { order, redemption, balance } = await executeRedeem(command);
      recordPointsOperationOutcome('redeem', {
        result: 'success',
        patch: {
          user_id: Number(req.user?.id || 0),
          order_id: Number(order?.id || 0),
          redemption_id: Number(redemption?.id || 0),
        },
      });
      return res.json({
        ok: true,
        redemption: {
          id: redemption.id,
          orderNo: order.orderNo,
          itemName: order.productName,
          pointsCost: redemption.pointsCost,
          status: redemption.status,
          expiresAt: redemption.expiresAt,
          writeoffToken: redemption.writeoffToken,
        },
        token: redemption.writeoffToken,
        balance,
      });
    } catch (err) {
      recordPointsOperationOutcome('redeem', {
        result: 'fail',
        code: err?.message || 'REDEEM_FAILED',
        patch: {
          user_id: Number(req.user?.id || 0),
        },
      });
      return errorResponse(res, err);
    }
  });

  app.post('/api/mall/activities/:id/join', authRequired, tenantContext, async (req, res) => {
    setPointsRequestContext({
      route: `${String(req.method || 'POST').toUpperCase()} ${String(req.path || '/api/mall/activities/:id/join')}`,
      user_id: Number(req.user?.id || 0),
    });

    if (!req.user.isVerifiedBasic) {
      markPointsRequestFail('NEED_BASIC_VERIFY', { user_id: Number(req.user?.id || 0) });
      return res.status(403).json({ code: 'NEED_BASIC_VERIFY', message: '请先完成基础身份确认' });
    }

    try {
      const { joinResult, activity } = await executeMallActivityJoin({
        tenantId: req.tenantContext.tenantId,
        customerId: Number(req.user.id),
        activityId: Number(req.params.id),
        actor: req.actor,
      });
      return res.json({
        ok: true,
        duplicated: Boolean(joinResult.duplicated),
        reward: Number(joinResult.reward || 0),
        balance: Number(joinResult.balance || 0),
        activity,
      });
    } catch (err) {
      markPointsRequestFail(err?.message || 'MALL_ACTIVITY_JOIN_FAILED', {
        user_id: Number(req.user?.id || 0),
      });
      return errorResponse(res, err);
    }
  });
}
