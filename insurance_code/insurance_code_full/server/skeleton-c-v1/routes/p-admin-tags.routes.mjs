import {
  toCreatePTagRuleJobCommand,
  toDeletePTagCommand,
  toDeletePTagRuleCommand,
  toSavePTagCommand,
  toSavePTagRuleCommand,
  toUpdatePTagStatusCommand,
  toUpdatePTagRuleStatusCommand,
} from '../dto/write-commands.dto.mjs';
import { executeCreatePTagRuleJob } from '../usecases/p-tag-rule-job-write.usecase.mjs';
import {
  executeDeletePTagRule,
  executeSavePTagRule,
  executeUpdatePTagRuleStatus,
} from '../usecases/p-tag-rule-write.usecase.mjs';
import { executeDeletePTag, executeSavePTag, executeUpdatePTagStatus } from '../usecases/p-tag-write.usecase.mjs';

function tagWriteErrorResponse(res, err) {
  const code = String(err?.code || err?.message || '');
  if (code === 'TAG_CODE_REQUIRED') return res.status(400).json({ code, message: '标签编码不能为空' });
  if (code === 'TAG_NAME_REQUIRED') return res.status(400).json({ code, message: '标签名称不能为空' });
  if (code === 'TAG_CODE_CONFLICT') return res.status(409).json({ code, message: '标签编码已存在' });
  if (code === 'TAG_NOT_FOUND') return res.status(404).json({ code, message: '标签不存在' });
  if (code === 'TAG_IN_USE') return res.status(409).json({ code, message: '标签已被规则使用，不能删除' });
  return res.status(400).json({ code: code || 'TAG_WRITE_FAILED', message: '标签写入失败' });
}

function tagRuleWriteErrorResponse(res, err) {
  const code = String(err?.code || err?.message || '');
  if (code === 'RULE_CODE_REQUIRED') return res.status(400).json({ code, message: '规则编码不能为空' });
  if (code === 'RULE_NAME_REQUIRED') return res.status(400).json({ code, message: '规则名称不能为空' });
  if (code === 'TARGET_TAG_REQUIRED') return res.status(400).json({ code, message: '请选择目标标签' });
  if (code === 'TARGET_TAG_NOT_FOUND') return res.status(404).json({ code, message: '目标标签不存在' });
  if (code === 'RULE_CODE_CONFLICT') return res.status(409).json({ code, message: '规则编码已存在' });
  if (code === 'RULE_NOT_FOUND') return res.status(404).json({ code, message: '规则不存在' });
  if (code === 'TARGET_RULE_REQUIRED') return res.status(400).json({ code, message: '请至少选择一条规则' });
  return res.status(400).json({ code: code || 'TAG_RULE_WRITE_FAILED', message: '标签规则写入失败' });
}

export function registerPAdminTagRoutes(app, deps) {
  const {
    tenantContext,
    permissionRequired,
    getState,
    nextId,
    persistState,
    normalizeTagType,
    normalizeTagStatus,
    normalizeTagRuleStatus,
    ensureTagSeeds,
    buildTagJobCustomerMetrics,
    evaluateTagRuleByCustomer,
    resolveTagRuleOutputValue,
    collectCustomerIdsForTagJob,
  } = deps;

  app.get('/api/p/tags', tenantContext, permissionRequired('customer:read'), (req, res) => {
    const state = getState();
    const tenantId = Number(req.tenantContext.tenantId || 0);
    const seeded = ensureTagSeeds(state, tenantId, nextId);
    if (seeded) persistState();
    const query = String(req.query?.q || req.query?.query || '').trim().toLowerCase();
    const statusFilter = String(req.query?.status || '').trim().toLowerCase();
    const page = Math.max(1, Number(req.query?.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query?.pageSize || 20)));
    const offset = (page - 1) * pageSize;

    const listRaw = (state.pTags || []).filter((row) => Number(row.tenantId || 1) === tenantId);
    const filtered = listRaw
      .filter((row) => {
        const status = normalizeTagStatus(row.status);
        const matchQuery =
          !query ||
          String(row.tagName || '').toLowerCase().includes(query) ||
          String(row.tagCode || '').toLowerCase().includes(query) ||
          String(row.source || '').toLowerCase().includes(query);
        const matchStatus = !statusFilter || status === normalizeTagStatus(statusFilter);
        return matchQuery && matchStatus;
      })
      .sort((a, b) => Number(b.id || 0) - Number(a.id || 0));

    const paged = filtered.slice(offset, offset + pageSize).map((row) => ({
      id: Number(row.id || 0),
      tenantId,
      tagCode: String(row.tagCode || ''),
      tagName: String(row.tagName || ''),
      tagType: normalizeTagType(row.tagType),
      source: String(row.source || 'manual'),
      description: String(row.description || ''),
      status: normalizeTagStatus(row.status),
      valueSchema: row.valueSchema && typeof row.valueSchema === 'object' ? row.valueSchema : {},
      hitCount: Number(row.hitCount || 0),
      createdBy: Number(row.createdBy || 0) || null,
      createdAt: row.createdAt || new Date().toISOString(),
      updatedAt: row.updatedAt || row.createdAt || new Date().toISOString(),
    }));
    return res.json({ list: paged, total: filtered.length, page, pageSize });
  });

  app.post('/api/p/tags', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toSavePTagCommand({ body: req.body, actor: req.actor, tenantContext: req.tenantContext, deps });
    executeSavePTag(command)
      .then((payload) => res.json(payload))
      .catch((err) => tagWriteErrorResponse(res, err));
  });

  app.post('/api/p/tags/:id/status', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toUpdatePTagStatusCommand({ params: req.params, body: req.body, tenantContext: req.tenantContext, deps });
    executeUpdatePTagStatus(command)
      .then((payload) => res.json(payload))
      .catch((err) => tagWriteErrorResponse(res, err));
  });

  app.delete('/api/p/tags/:id', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toDeletePTagCommand({ params: req.params, tenantContext: req.tenantContext, deps });
    executeDeletePTag(command)
      .then((payload) => res.json(payload))
      .catch((err) => tagWriteErrorResponse(res, err));
  });

  app.get('/api/p/tag-rules', tenantContext, permissionRequired('customer:read'), (req, res) => {
    const state = getState();
    const tenantId = Number(req.tenantContext.tenantId || 0);
    const seeded = ensureTagSeeds(state, tenantId, nextId);
    if (seeded) persistState();
    const query = String(req.query?.q || req.query?.query || '').trim().toLowerCase();
    const statusFilter = String(req.query?.status || '').trim().toLowerCase();
    const tagIdFilter = Number(req.query?.tagId || 0);
    const page = Math.max(1, Number(req.query?.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query?.pageSize || 20)));
    const offset = (page - 1) * pageSize;
    const tagMap = new Map((state.pTags || []).filter((row) => Number(row.tenantId || 1) === tenantId).map((row) => [Number(row.id), row]));
    const listRaw = (state.pTagRules || []).filter((row) => Number(row.tenantId || 1) === tenantId);
    const filtered = listRaw
      .filter((row) => {
        const status = normalizeTagRuleStatus(row.status);
        const targetIds = Array.isArray(row.targetTagIds) && row.targetTagIds.length ? row.targetTagIds.map((x) => Number(x || 0)) : [Number(row.targetTagId || 0)];
        const tag = tagMap.get(Number(targetIds[0] || 0));
        const matchQuery =
          !query ||
          String(row.ruleName || '').toLowerCase().includes(query) ||
          String(row.ruleCode || '').toLowerCase().includes(query) ||
          String(tag?.tagName || '').toLowerCase().includes(query);
        const matchStatus = !statusFilter || status === normalizeTagRuleStatus(statusFilter);
        const matchTag = !tagIdFilter || targetIds.includes(tagIdFilter);
        return matchQuery && matchStatus && matchTag;
      })
      .sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
    const paged = filtered.slice(offset, offset + pageSize).map((row) => ({
      id: Number(row.id || 0),
      tenantId,
      ruleCode: String(row.ruleCode || ''),
      ruleName: String(row.ruleName || ''),
      targetTagId: Number((Array.isArray(row.targetTagIds) && row.targetTagIds[0]) || row.targetTagId || 0),
      targetTagIds: Array.isArray(row.targetTagIds) && row.targetTagIds.length ? row.targetTagIds.map((x) => Number(x || 0)) : [Number(row.targetTagId || 0)],
      targetTagName: String(tagMap.get(Number((Array.isArray(row.targetTagIds) && row.targetTagIds[0]) || row.targetTagId || 0))?.tagName || ''),
      targetTagNames: (Array.isArray(row.targetTagIds) && row.targetTagIds.length ? row.targetTagIds : [row.targetTagId])
        .map((x) => String(tagMap.get(Number(x || 0))?.tagName || ''))
        .filter(Boolean),
      priority: Number(row.priority || 100),
      status: normalizeTagRuleStatus(row.status),
      conditionDsl: row.conditionDsl && typeof row.conditionDsl === 'object' ? row.conditionDsl : {},
      outputExpr: row.outputExpr && typeof row.outputExpr === 'object' ? row.outputExpr : {},
      effectiveStartAt: row.effectiveStartAt || null,
      effectiveEndAt: row.effectiveEndAt || null,
      createdBy: Number(row.createdBy || 0) || null,
      createdAt: row.createdAt || new Date().toISOString(),
      updatedAt: row.updatedAt || row.createdAt || new Date().toISOString(),
    }));
    return res.json({ list: paged, total: filtered.length, page, pageSize });
  });

  app.post('/api/p/tag-rules', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toSavePTagRuleCommand({ body: req.body, actor: req.actor, tenantContext: req.tenantContext, deps });
    executeSavePTagRule(command)
      .then((payload) => res.json(payload))
      .catch((err) => tagRuleWriteErrorResponse(res, err));
  });

  app.post('/api/p/tag-rules/:id/status', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toUpdatePTagRuleStatusCommand({ params: req.params, body: req.body, tenantContext: req.tenantContext, deps });
    executeUpdatePTagRuleStatus(command)
      .then((payload) => res.json(payload))
      .catch((err) => tagRuleWriteErrorResponse(res, err));
  });

  app.delete('/api/p/tag-rules/:id', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toDeletePTagRuleCommand({ params: req.params, tenantContext: req.tenantContext, deps });
    executeDeletePTagRule(command)
      .then((payload) => res.json(payload))
      .catch((err) => tagRuleWriteErrorResponse(res, err));
  });

  app.post('/api/p/tag-rule-jobs', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toCreatePTagRuleJobCommand({ body: req.body, tenantContext: req.tenantContext, deps });
    executeCreatePTagRuleJob(command)
      .then((payload) => res.json(payload))
      .catch((err) => tagRuleWriteErrorResponse(res, err));
  });

  app.get('/api/p/tag-rule-jobs', tenantContext, permissionRequired('customer:read'), (req, res) => {
    const state = getState();
    const tenantId = Number(req.tenantContext.tenantId || 0);
    const statusFilter = String(req.query?.status || '').trim().toLowerCase();
    const page = Math.max(1, Number(req.query?.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query?.pageSize || 20)));
    const offset = (page - 1) * pageSize;
    const all = (state.pTagRuleJobs || [])
      .filter((row) => Number(row.tenantId || 1) === tenantId)
      .filter((row) => !statusFilter || String(row.status || '').toLowerCase() === statusFilter)
      .sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
    const list = all.slice(offset, offset + pageSize);
    return res.json({ list, total: all.length, page, pageSize });
  });

  app.get('/api/p/tag-rule-jobs/:id', tenantContext, permissionRequired('customer:read'), (req, res) => {
    const state = getState();
    const tenantId = Number(req.tenantContext.tenantId || 0);
    const id = Number(req.params.id || 0);
    const item = (state.pTagRuleJobs || []).find((row) => Number(row.id || 0) === id && Number(row.tenantId || 1) === tenantId);
    if (!item) return res.status(404).json({ code: 'JOB_NOT_FOUND', message: '任务不存在' });
    return res.json({ item });
  });

  app.get('/api/p/tag-rule-jobs/:id/logs', tenantContext, permissionRequired('customer:read'), (req, res) => {
    const state = getState();
    const tenantId = Number(req.tenantContext.tenantId || 0);
    const id = Number(req.params.id || 0);
    const resultFilter = String(req.query?.result || '').trim().toLowerCase();
    const page = Math.max(1, Number(req.query?.page || 1));
    const pageSize = Math.min(500, Math.max(1, Number(req.query?.pageSize || 50)));
    const offset = (page - 1) * pageSize;
    const all = (state.pTagRuleJobLogs || [])
      .filter((row) => Number(row.jobId || 0) === id && Number(row.tenantId || 1) === tenantId)
      .filter((row) => !resultFilter || String(row.result || '').toLowerCase() === resultFilter)
      .sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
    const list = all.slice(offset, offset + pageSize);
    return res.json({ list, total: all.length, page, pageSize });
  });
}
