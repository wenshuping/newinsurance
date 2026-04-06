import {
  toCreatePMallActivityCommand,
  toCreatePMallProductCommand,
  toDeletePMallActivityCommand,
  toDeletePMallProductCommand,
  toReorderPMallActivitiesCommand,
  toReorderPMallProductsCommand,
  toUpdatePMallActivityCommand,
  toUpdatePMallProductCommand,
} from '../dto/write-commands.dto.mjs';
import {
  executeCreatePMallActivity,
  executeCreatePMallProduct,
  executeDeletePMallActivity,
  executeDeletePMallProduct,
  executeReorderPMallActivities,
  executeReorderPMallProducts,
  executeUpdatePMallActivity,
  executeUpdatePMallProduct,
} from '../usecases/p-mall-write.usecase.mjs';
import { buildAdminMallActivityList, buildAdminMallProductList } from './mall-admin.shared.mjs';

function mallWriteErrorResponse(res, err) {
  const code = String(err?.code || err?.message || '');
  if (code === 'COMPANY_ACCOUNT_REQUIRED') {
    return res.status(403).json({ code, message: '仅平台管理员、公司管理员或业务员可管理积分商城(v2)' });
  }
  if (code === 'PRODUCT_TITLE_REQUIRED') return res.status(400).json({ code, message: '商品标题不能为空' });
  if (code === 'MALL_PRODUCT_REORDER_IDS_REQUIRED') return res.status(400).json({ code, message: '请至少保留一个有效商品顺序' });
  if (code === 'PRODUCT_NOT_FOUND') return res.status(404).json({ code, message: '商品不存在' });
  if (code === 'MALL_ACTIVITY_NOT_FOUND') return res.status(404).json({ code, message: '活动不存在' });
  if (code === 'ACTIVITY_TITLE_REQUIRED') return res.status(400).json({ code, message: '活动标题不能为空' });
  if (code === 'MALL_ACTIVITY_REORDER_IDS_REQUIRED') return res.status(400).json({ code, message: '请至少保留一个有效活动顺序' });
  if (code === 'PLATFORM_TEMPLATE_SOURCE_IMMUTABLE') return res.status(403).json({ code: 'NO_PERMISSION', message: '平台模板源数据不可直接删除' });
  if (code === 'NO_PERMISSION_EDIT_PRODUCT') return res.status(403).json({ code: 'NO_PERMISSION', message: '无权限编辑该商城模板' });
  if (code === 'NO_PERMISSION_DELETE_PRODUCT') return res.status(403).json({ code: 'NO_PERMISSION', message: '无权限删除该商城模板' });
  if (code === 'NO_PERMISSION_EDIT_ACTIVITY') return res.status(403).json({ code: 'NO_PERMISSION', message: '无权限编辑该商城活动模板' });
  if (code === 'NO_PERMISSION_DELETE_ACTIVITY') return res.status(403).json({ code: 'NO_PERMISSION', message: '无权限删除该商城活动模板' });
  return res.status(400).json({ code: code || 'MALL_WRITE_FAILED', message: '商城写入失败' });
}

export function registerPAdminMallRoutes(app, deps) {
  const {
    tenantContext,
    permissionRequired,
    getState,
    canAccessTemplate,
    effectiveTemplateStatusForActor,
  } = deps;

  app.get('/api/p/mall/products', tenantContext, permissionRequired('customer:read'), (req, res) => {
    const state = getState();
    const list = buildAdminMallProductList({
      state,
      actor: req.actor,
      canAccessTemplate,
      effectiveTemplateStatusForActor,
    });
    res.json({ list });
  });

  app.post('/api/p/mall/products', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toCreatePMallProductCommand({ body: req.body, actor: req.actor, tenantContext: req.tenantContext, deps });
    executeCreatePMallProduct(command)
      .then((payload) => res.json(payload))
      .catch((err) => mallWriteErrorResponse(res, err));
  });

  app.put('/api/p/mall/products/:id', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toUpdatePMallProductCommand({ params: req.params, body: req.body, actor: req.actor, tenantContext: req.tenantContext, deps });
    executeUpdatePMallProduct(command)
      .then((payload) => res.json(payload))
      .catch((err) => mallWriteErrorResponse(res, err));
  });

  app.post('/api/p/mall/products/reorder', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toReorderPMallProductsCommand({ body: req.body, actor: req.actor, tenantContext: req.tenantContext, deps });
    executeReorderPMallProducts(command)
      .then((payload) => res.json(payload))
      .catch((err) => mallWriteErrorResponse(res, err));
  });

  app.delete('/api/p/mall/products/:id', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toDeletePMallProductCommand({ params: req.params, actor: req.actor, tenantContext: req.tenantContext, deps });
    executeDeletePMallProduct(command)
      .then((payload) => res.json(payload))
      .catch((err) => mallWriteErrorResponse(res, err));
  });

  app.get('/api/p/mall/activities', tenantContext, permissionRequired('customer:read'), (req, res) => {
    const state = getState();
    const list = buildAdminMallActivityList({
      state,
      actor: req.actor,
      canAccessTemplate,
      effectiveTemplateStatusForActor,
    });
    res.json({ list });
  });

  app.get('/api/p/strategies', tenantContext, permissionRequired('customer:read'), (req, res) => {
    const state = getState();
    const source = Array.isArray(state.pActivities) && state.pActivities.length ? state.pActivities : state.activities || [];
    const list = source.slice(0, 6).map((item, idx) => {
      const id = Number(item.id || idx + 1);
      const matchedCustomers = 80 + idx * 24;
      return {
        id: `POLICY-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${String(id).padStart(2, '0')}`,
        name: String(item.title || item.name || `策略${id}`),
        status: idx % 4 === 3 ? 'draft' : 'active',
        lastExecutedAt: idx % 4 === 3 ? null : new Date(Date.now() - idx * 3600 * 1000).toISOString(),
        priority: idx % 2 === 0 ? 'P1' : 'P2',
        frequency: idx % 2 === 0 ? '每1小时' : '每天09:00',
        matchedCustomers,
        successRate: Math.max(88, 99 - idx * 3),
        tenantId: req.tenantContext.tenantId,
      };
    });
    res.json({ list });
  });

  app.post('/api/p/mall/activities', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toCreatePMallActivityCommand({ body: req.body, actor: req.actor, tenantContext: req.tenantContext, deps });
    executeCreatePMallActivity(command)
      .then((payload) => res.json(payload))
      .catch((err) => mallWriteErrorResponse(res, err));
  });

  app.put('/api/p/mall/activities/:id', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toUpdatePMallActivityCommand({ params: req.params, body: req.body, actor: req.actor, tenantContext: req.tenantContext, deps });
    executeUpdatePMallActivity(command)
      .then((payload) => res.json(payload))
      .catch((err) => mallWriteErrorResponse(res, err));
  });

  app.post('/api/p/mall/activities/reorder', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toReorderPMallActivitiesCommand({ body: req.body, actor: req.actor, tenantContext: req.tenantContext, deps });
    executeReorderPMallActivities(command)
      .then((payload) => res.json(payload))
      .catch((err) => mallWriteErrorResponse(res, err));
  });

  app.delete('/api/p/mall/activities/:id', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toDeletePMallActivityCommand({ params: req.params, actor: req.actor, tenantContext: req.tenantContext, deps });
    executeDeletePMallActivity(command)
      .then((payload) => res.json(payload))
      .catch((err) => mallWriteErrorResponse(res, err));
  });
}
