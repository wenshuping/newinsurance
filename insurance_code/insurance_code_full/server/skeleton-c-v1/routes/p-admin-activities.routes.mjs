import { toCreatePActivityCommand, toDeletePActivityBatchCommand, toDeletePActivityCommand, toReorderPActivitiesCommand, toUpdatePActivityCommand } from '../dto/write-commands.dto.mjs';
import { createUploadWriteDeps } from '../common/upload-write.deps.mjs';
import { executeCreatePActivity, executeDeletePActivity, executeDeletePActivityBatch, executeReorderPActivities, executeUpdatePActivity } from '../usecases/p-activity-write.usecase.mjs';

function activityWriteErrorResponse(res, err) {
  const code = String(err?.code || err?.message || '');
  if (code === 'COMPANY_ACCOUNT_REQUIRED') {
    return res.status(403).json({ code, message: '仅平台管理员、公司管理员或业务员可发布活动(v2)' });
  }
  if (code === 'ACTIVITY_TITLE_REQUIRED') return res.status(400).json({ code, message: '活动标题不能为空' });
  if (code === 'ACTIVITY_BATCH_DELETE_IDS_REQUIRED') return res.status(400).json({ code, message: '请至少勾选一个活动' });
  if (code === 'ACTIVITY_REORDER_IDS_REQUIRED') return res.status(400).json({ code, message: '请至少保留一个有效活动顺序' });
  if (code === 'ACTIVITY_ACTIVE_DELETE_FORBIDDEN') return res.status(400).json({ code, message: '进行中的活动不能删除，请先下线后再删除' });
  if (code === 'INVALID_DATA_URL') return res.status(400).json({ code, message: '上传内容格式错误' });
  if (code === 'FILE_TOO_LARGE') return res.status(413).json({ code, message: '文件过大，单文件最大 12MB' });
  if (code === 'ACTIVITY_NOT_FOUND') return res.status(404).json({ code, message: '活动不存在' });
  if (code === 'PLATFORM_TEMPLATE_SOURCE_IMMUTABLE') return res.status(403).json({ code, message: '平台模板源数据不可直接删除' });
  if (code === 'NO_PERMISSION_EDIT') return res.status(403).json({ code: 'NO_PERMISSION', message: '无权限编辑该活动模板' });
  if (code === 'NO_PERMISSION_DELETE') return res.status(403).json({ code: 'NO_PERMISSION', message: '无权限删除该活动模板' });
  return res.status(400).json({ code: code || 'ACTIVITY_WRITE_FAILED', message: '活动写入失败' });
}

export function registerPAdminActivityRoutes(app, deps) {
  const {
    tenantContext,
    permissionRequired,
    getState,
    canAccessTemplate,
    decoratePlatformTemplateRow,
    effectiveTemplateStatusForActor,
    preferActorTemplateRows,
  } = deps;
  const uploadDeps = createUploadWriteDeps();

  app.get('/api/p/activities', tenantContext, permissionRequired('customer:read'), (req, res) => {
    const state = getState();
    const list = preferActorTemplateRows(
      state,
      req.actor,
      (state.activities || []).filter((row) => canAccessTemplate(state, req.actor, row))
    )
      .map((row) => {
        const decorated = decoratePlatformTemplateRow(state, row);
        return {
          ...decorated,
          status: effectiveTemplateStatusForActor(state, req.actor, row, { inheritedStatus: 'offline' }) || String(row.status || 'offline'),
          templateSource: decorated.isPlatformTemplate ? 'platform' : 'tenant',
          templateTag: String(decorated.templateTag || ''),
        };
      })
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || Number(a.id || 0) - Number(b.id || 0));
    res.json({ activities: list });
  });

  app.post('/api/p/activities', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toCreatePActivityCommand({
      body: req.body,
      actor: req.actor,
      tenantContext: req.tenantContext,
      headers: req.headers,
      protocol: req.protocol,
      host: req.get('host'),
      deps: { ...deps, uploadDeps },
    });
    executeCreatePActivity(command)
      .then((payload) => res.json(payload))
      .catch((err) => activityWriteErrorResponse(res, err));
  });

  app.post('/api/p/activities/batch-delete', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toDeletePActivityBatchCommand({
      body: req.body,
      actor: req.actor,
      tenantContext: req.tenantContext,
      deps,
    });
    executeDeletePActivityBatch(command)
      .then((payload) => res.json(payload))
      .catch((err) => activityWriteErrorResponse(res, err));
  });

  app.post('/api/p/activities/reorder', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toReorderPActivitiesCommand({
      body: req.body,
      actor: req.actor,
      tenantContext: req.tenantContext,
      deps,
    });
    executeReorderPActivities(command)
      .then((payload) => res.json(payload))
      .catch((err) => activityWriteErrorResponse(res, err));
  });

  app.put('/api/p/activities/:id', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toUpdatePActivityCommand({ params: req.params, body: req.body, actor: req.actor, tenantContext: req.tenantContext, deps });
    executeUpdatePActivity(command)
      .then((payload) => res.json(payload))
      .catch((err) => activityWriteErrorResponse(res, err));
  });

  app.delete('/api/p/activities/:id', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toDeletePActivityCommand({ params: req.params, actor: req.actor, tenantContext: req.tenantContext, deps });
    executeDeletePActivity(command)
      .then((payload) => res.json(payload))
      .catch((err) => activityWriteErrorResponse(res, err));
  });
}
