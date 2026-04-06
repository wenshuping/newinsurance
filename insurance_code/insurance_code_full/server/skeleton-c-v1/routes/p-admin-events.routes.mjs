import {
  toDeleteEventDefinitionCommand,
  toSaveEventDefinitionCommand,
  toUpdateEventDefinitionStatusCommand,
} from '../dto/write-commands.dto.mjs';
import {
  executeDeleteEventDefinition,
  executeSaveEventDefinition,
  executeUpdateEventDefinitionStatus,
} from '../usecases/p-event-definition-write.usecase.mjs';

function eventWriteErrorResponse(res, err) {
  const code = String(err?.code || err?.message || '');
  if (code === 'EVENT_ID_REQUIRED') return res.status(400).json({ code, message: '事件ID不能为空且必须为数字' });
  if (code === 'EVENT_NAME_REQUIRED') return res.status(400).json({ code, message: '事件名称不能为空' });
  if (code === 'EVENT_ID_CONFLICT') return res.status(409).json({ code, message: '事件ID已存在' });
  if (code === 'EVENT_NOT_FOUND') return res.status(404).json({ code, message: '事件定义不存在' });
  if (code === 'SYSTEM_EVENT_CANNOT_DELETE') return res.status(400).json({ code, message: '系统预置事件不允许删除' });
  return res.status(400).json({ code: code || 'EVENT_WRITE_FAILED', message: '事件写入失败' });
}

export function registerPAdminEventRoutes(app, deps) {
  const {
    tenantContext,
    permissionRequired,
    getState,
    nextId,
    persistState,
    appendAuditLog,
    normalizeEventStatus,
    normalizeEventType,
    normalizeCollectMethod,
    eventSchemaTemplateById,
    toEventStatusCode,
    ensureEventDefinitionSeeds,
    normalizeDefinitionVersion,
    EVENT_DICTIONARY_VERSION,
  } = deps;

  app.get('/api/p/events/definitions', tenantContext, permissionRequired('customer:read'), (req, res) => {
    const state = getState();
    const tenantId = Number(req.tenantContext.tenantId || 0);
    const seeded = ensureEventDefinitionSeeds(state, tenantId, nextId);
    if (seeded) persistState();
    const query = String(req.query?.q || req.query?.query || '').trim().toLowerCase();
    const statusFilter = String(req.query?.status || '').trim().toLowerCase();
    const typeFilter = String(req.query?.type || '').trim().toLowerCase();
    const page = Math.max(1, Number(req.query?.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query?.pageSize || 20)));
    const offset = (page - 1) * pageSize;
    const listRaw = (state.eventDefinitions || []).filter((row) => Number(row.tenantId || 1) === tenantId);
    const filtered = listRaw
      .filter((row) => {
        const status = normalizeEventStatus(row.status);
        const type = normalizeEventType(row.eventType);
        const matchQuery = !query || String(row.eventName || '').toLowerCase().includes(query) || String(row.eventId || '').includes(query);
        const matchStatus = !statusFilter || status === normalizeEventStatus(statusFilter);
        const matchType = !typeFilter || type === normalizeEventType(typeFilter);
        return matchQuery && matchStatus && matchType;
      })
      .sort((a, b) => Number(a.eventId || 0) - Number(b.eventId || 0));
    const paged = filtered.slice(offset, offset + pageSize).map((row) => ({
      id: Number(row.id),
      eventId: Number(row.eventId || 0),
      eventName: String(row.eventName || ''),
      eventType: normalizeEventType(row.eventType),
      description: String(row.description || ''),
      collectMethod: normalizeCollectMethod(row.collectMethod),
      status: normalizeEventStatus(row.status),
      statusCode: toEventStatusCode(row.status),
      schema: row.schema || {},
      definitionVersion:
        typeof normalizeDefinitionVersion === 'function'
          ? normalizeDefinitionVersion(row.definitionVersion)
          : Math.max(1, Number(row.definitionVersion || 1)),
      createdAt: row.createdAt || new Date().toISOString(),
      updatedAt: row.updatedAt || new Date().toISOString(),
    }));
    res.json({
      list: paged,
      total: filtered.length,
      page,
      pageSize,
      dictionaryVersion: EVENT_DICTIONARY_VERSION,
    });
  });

  app.post('/api/p/events/definitions', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toSaveEventDefinitionCommand({ body: req.body, actor: req.actor, tenantContext: req.tenantContext, deps });
    executeSaveEventDefinition(command)
      .then((payload) => res.json(payload))
      .catch((err) => eventWriteErrorResponse(res, err));
  });

  app.post('/api/p/events/definitions/:id/status', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toUpdateEventDefinitionStatusCommand({ params: req.params, body: req.body, tenantContext: req.tenantContext, deps });
    executeUpdateEventDefinitionStatus(command)
      .then((payload) => res.json(payload))
      .catch((err) => eventWriteErrorResponse(res, err));
  });

  app.delete('/api/p/events/definitions/:id', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toDeleteEventDefinitionCommand({ params: req.params, tenantContext: req.tenantContext, deps });
    executeDeleteEventDefinition(command)
      .then((payload) => res.json(payload))
      .catch((err) => eventWriteErrorResponse(res, err));
  });
}
