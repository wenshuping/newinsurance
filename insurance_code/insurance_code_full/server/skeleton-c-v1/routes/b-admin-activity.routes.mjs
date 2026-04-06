import { toCreateBActivityConfigCommand, toReorderPActivitiesCommand, toUpdateBActivityConfigCommand } from '../dto/write-commands.dto.mjs';
import { executeCreateBActivityConfig, executeUpdateBActivityConfig } from '../usecases/b-activity-config-write.usecase.mjs';
import { executeReorderPActivities } from '../usecases/p-activity-write.usecase.mjs';

const B_ACTIVITY_CREATE_ROUTE = 'POST /api/b/activity-configs';

function resolveRequestTraceId(req) {
  return String(req?.traceId || req?.headers?.['x-trace-id'] || '').trim() || null;
}

function resolveRequestId(req) {
  return String(req?.requestId || req?.headers?.['x-request-id'] || req?.traceId || req?.headers?.['x-trace-id'] || '').trim() || null;
}

function buildActivityCreateLogEntry(req, patch = {}) {
  return {
    ts: new Date().toISOString(),
    service: 'api-v1',
    domain: 'b-activity-config',
    event: 'create',
    route: B_ACTIVITY_CREATE_ROUTE,
    trace_id: resolveRequestTraceId(req),
    request_id: resolveRequestId(req),
    tenant_id: Number(req?.tenantContext?.tenantId || 0) || null,
    actor_type: String(req?.actor?.actorType || '').trim() || null,
    actor_id: Number(req?.actor?.actorId || 0) || null,
    title: String(req?.body?.title ?? '').trim(),
    ...patch,
  };
}

export function registerBAdminActivityRoutes(app, deps) {
  const {
    canAccessTemplate,
    effectiveTemplateStatusForActor,
    getState,
    permissionRequired,
    tenantContext,
  } = deps;

  app.post('/api/b/activity-configs', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toCreateBActivityConfigCommand({ body: req.body, actor: req.actor, tenantContext: req.tenantContext, deps });
    return executeCreateBActivityConfig(command)
      .then((payload) => {
        console.info(
          JSON.stringify(
            buildActivityCreateLogEntry(req, {
              result: 'success',
              status_code: 200,
              activity_id: Number(payload?.item?.id || 0) || null,
              title: String(payload?.item?.title || req?.body?.title || '').trim(),
              idempotent: Boolean(payload?.idempotent),
            })
          )
        );
        return res.json(payload);
      })
      .catch((err) => {
        const code = err?.message || 'CREATE_ACTIVITY_FAILED';
        const statusCode = code === 'TITLE_REQUIRED' ? 400 : 400;
        console.warn(
          JSON.stringify(
            buildActivityCreateLogEntry(req, {
              result: 'error',
              status_code: statusCode,
              error_code: code,
            })
          )
        );
        if (code === 'TITLE_REQUIRED') return res.status(statusCode).json({ code, message: '活动名称不能为空' });
        return res.status(statusCode).json({ code, message: '创建活动配置失败' });
      });
  });

  app.put('/api/b/activity-configs/:id', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toUpdateBActivityConfigCommand({ params: req.params, body: req.body, actor: req.actor, deps });
    return executeUpdateBActivityConfig(command)
      .then((payload) => res.json(payload))
      .catch((err) => {
        const code = err?.message || 'UPDATE_ACTIVITY_FAILED';
        if (code === 'ACTIVITY_NOT_FOUND') return res.status(404).json({ code, message: '活动配置不存在' });
        if (code === 'ACTIVITY_REORDER_IDS_REQUIRED') return res.status(400).json({ code, message: '请至少保留一个有效活动顺序' });
        if (code === 'NO_PERMISSION') return res.status(403).json({ code, message: '无权限编辑该活动配置' });
        if (code === 'TITLE_REQUIRED') return res.status(400).json({ code, message: '活动名称不能为空' });
        return res.status(400).json({ code, message: '更新活动配置失败' });
      });
  });

  app.post('/api/b/activity-configs/reorder', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toReorderPActivitiesCommand({ body: req.body, actor: req.actor, tenantContext: req.tenantContext, deps });
    return executeReorderPActivities(command)
      .then((payload) => res.json(payload))
      .catch((err) => {
        const code = err?.message || 'REORDER_ACTIVITY_FAILED';
        if (code === 'ACTIVITY_REORDER_IDS_REQUIRED') return res.status(400).json({ code, message: '请至少保留一个有效活动顺序' });
        if (code === 'NO_PERMISSION') return res.status(403).json({ code, message: '无权限编辑该活动配置' });
        return res.status(400).json({ code, message: '更新活动排序失败' });
      });
  });

  app.get('/api/b/activity-configs', tenantContext, permissionRequired('customer:read'), (req, res) => {
    const state = getState();
    const list = deps.preferActorTemplateRows(
      state,
      req.actor,
      (Array.isArray(state.activities) ? state.activities : []).filter((row) => canAccessTemplate(state, req.actor, row))
    )
      .map((row) => {
        const decorated = deps.decoratePlatformTemplateRow(state, row);
        return {
          ...decorated,
          title: String(decorated.title || ''),
          status: String(
            effectiveTemplateStatusForActor(state, req.actor, row, { inheritedStatus: 'offline' })
            || row.status
            || 'offline'
          ),
          rewardPoints: Number(row.rewardPoints || 0),
          sortOrder: Number(row.sortOrder || 0),
          content: String(row.content || row.desc || ''),
          media: Array.isArray(row.media) ? row.media : [],
          updatedAt: row.updatedAt || row.createdAt || new Date().toISOString(),
          isPlatformTemplate: Boolean(decorated.isPlatformTemplate),
          templateSource: decorated.isPlatformTemplate ? 'platform' : 'tenant',
          templateTag: String(decorated.templateTag || ''),
        };
      })
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || Number(a.id || 0) - Number(b.id || 0));
    return res.json({ list });
  });
}
