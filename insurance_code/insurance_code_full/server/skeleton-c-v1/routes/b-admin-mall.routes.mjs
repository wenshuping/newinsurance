import {
  toCreateBMallActivityCommand,
  toCreateBMallProductCommand,
  toReorderPMallActivitiesCommand,
  toReorderPMallProductsCommand,
  toUpdateBMallActivityCommand,
  toUpdateBMallProductCommand,
} from '../dto/write-commands.dto.mjs';
import {
  executeCreateBMallActivity,
  executeCreateBMallProduct,
  executeUpdateBMallActivity,
  executeUpdateBMallProduct,
} from '../usecases/b-mall-config-write.usecase.mjs';
import {
  executeReorderPMallActivities,
  executeReorderPMallProducts,
} from '../usecases/p-mall-write.usecase.mjs';
import { buildAdminMallActivityList, buildAdminMallProductList } from './mall-admin.shared.mjs';

function mallWriteErrorResponse(res, err, fallbackCode, fallbackMessage) {
  const code = err?.message || fallbackCode;
  if (code === 'PRODUCT_NOT_FOUND') return res.status(404).json({ code, message: '商品不存在' });
  if (code === 'MALL_ACTIVITY_NOT_FOUND') return res.status(404).json({ code, message: '商城活动不存在' });
  if (code === 'NO_PERMISSION') return res.status(403).json({ code, message: '无权限编辑该模板' });
  if (code === 'NAME_REQUIRED') return res.status(400).json({ code, message: '商品名称不能为空' });
  if (code === 'TITLE_REQUIRED') return res.status(400).json({ code, message: '活动名称不能为空' });
  if (code === 'MALL_PRODUCT_REORDER_IDS_REQUIRED') return res.status(400).json({ code, message: '请提供商品排序列表' });
  if (code === 'MALL_ACTIVITY_REORDER_IDS_REQUIRED') return res.status(400).json({ code, message: '请提供活动排序列表' });
  return res.status(400).json({ code, message: fallbackMessage });
}

export function registerBAdminMallRoutes(app, deps) {
  const {
    canAccessTemplate,
    effectiveTemplateStatusForActor,
    getState,
    permissionRequired,
    tenantContext,
  } = deps;

  app.post('/api/b/mall/products', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toCreateBMallProductCommand({ body: req.body, actor: req.actor, tenantContext: req.tenantContext, deps });
    executeCreateBMallProduct(command)
      .then((payload) => res.json(payload))
      .catch((err) => mallWriteErrorResponse(res, err, 'CREATE_PRODUCT_FAILED', '创建商品失败'));
  });

  app.put('/api/b/mall/products/:id', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toUpdateBMallProductCommand({ params: req.params, body: req.body, actor: req.actor, deps });
    executeUpdateBMallProduct(command)
      .then((payload) => res.json(payload))
      .catch((err) => mallWriteErrorResponse(res, err, 'UPDATE_PRODUCT_FAILED', '更新商品失败'));
  });

  app.post('/api/b/mall/products/reorder', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toReorderPMallProductsCommand({ body: req.body, actor: req.actor, tenantContext: req.tenantContext, deps });
    executeReorderPMallProducts(command)
      .then((payload) => res.json(payload))
      .catch((err) => mallWriteErrorResponse(res, err, 'REORDER_PRODUCT_FAILED', '更新商品排序失败'));
  });

  app.post('/api/b/mall/activities', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toCreateBMallActivityCommand({ body: req.body, actor: req.actor, tenantContext: req.tenantContext, deps });
    executeCreateBMallActivity(command)
      .then((payload) => res.json(payload))
      .catch((err) => mallWriteErrorResponse(res, err, 'CREATE_MALL_ACTIVITY_FAILED', '创建商城活动失败'));
  });

  app.put('/api/b/mall/activities/:id', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toUpdateBMallActivityCommand({ params: req.params, body: req.body, actor: req.actor, deps });
    executeUpdateBMallActivity(command)
      .then((payload) => res.json(payload))
      .catch((err) => mallWriteErrorResponse(res, err, 'UPDATE_MALL_ACTIVITY_FAILED', '更新商城活动失败'));
  });

  app.post('/api/b/mall/activities/reorder', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toReorderPMallActivitiesCommand({ body: req.body, actor: req.actor, tenantContext: req.tenantContext, deps });
    executeReorderPMallActivities(command)
      .then((payload) => res.json(payload))
      .catch((err) => mallWriteErrorResponse(res, err, 'REORDER_MALL_ACTIVITY_FAILED', '更新商城活动排序失败'));
  });

  app.get('/api/b/mall/products', tenantContext, permissionRequired('customer:read'), (req, res) => {
    const state = getState();
    const list = buildAdminMallProductList({
      state,
      actor: req.actor,
      canAccessTemplate,
      effectiveTemplateStatusForActor,
    });
    return res.json({ list });
  });

  app.get('/api/b/mall/activities', tenantContext, permissionRequired('customer:read'), (req, res) => {
    const state = getState();
    const list = buildAdminMallActivityList({
      state,
      actor: req.actor,
      canAccessTemplate,
      effectiveTemplateStatusForActor,
    });
    return res.json({ list });
  });
}
