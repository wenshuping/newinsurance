import {
  toCreateMetricRuleCommand,
  toDeleteMetricRuleCommand,
  toUpdateMetricRuleCommand,
} from '../dto/write-commands.dto.mjs';
import {
  executeCreateMetricRule,
  executeDeleteMetricRule,
  executeUpdateMetricRule,
} from '../usecases/p-metric-rule-write.usecase.mjs';

function metricRuleWriteErrorResponse(res, err) {
  const code = String(err?.code || err?.message || '');
  if (code === 'METRIC_NAME_REQUIRED') return res.status(400).json({ code, message: '指标名称不能为空' });
  if (code === 'METRIC_FORMULA_REQUIRED') return res.status(400).json({ code, message: '口径/公式不能为空' });
  if (code === 'METRIC_PERIOD_REQUIRED') return res.status(400).json({ code, message: '统计周期不能为空' });
  if (code === 'METRIC_SOURCE_REQUIRED') return res.status(400).json({ code, message: '数据源不能为空' });
  if (code === 'METRIC_RULE_DUPLICATE') return res.status(409).json({ code, message: '同端同名指标规则已存在' });
  if (code === 'METRIC_RULE_NOT_FOUND') return res.status(404).json({ code, message: '指标规则不存在' });
  return res.status(400).json({ code: code || 'METRIC_RULE_WRITE_FAILED', message: '指标规则写入失败' });
}

export function registerPAdminMetricRoutes(app, deps) {
  const {
    tenantContext,
    permissionRequired,
    getState,
    nextId,
    persistState,
    appendAuditLog,
    computeMetricCards,
    normalizeMetricEnd,
    normalizeMetricRuleStatus,
    normalizeMetricRemarkMode,
    buildMetricRuleRemark,
    metricRuleKey,
    parseNumber,
    rowDate,
    ensureMetricRuleSeeds,
    normalizeRuleVersion,
    METRIC_RULEBOOK_VERSION,
  } = deps;

  app.get('/api/p/metrics/config', tenantContext, permissionRequired('customer:read'), (req, res) => {
    const state = getState();
    const tenantId = Number(req.tenantContext.tenantId || 0);
    const seeded = ensureMetricRuleSeeds(state, tenantId, nextId);
    if (seeded) persistState();

    const rules = (state.metricRules || [])
      .filter((row) => Number(row.tenantId || 1) === tenantId)
      .sort((a, b) => {
        const endCmp = String(a.end || '').localeCompare(String(b.end || ''));
        if (endCmp !== 0) return endCmp;
        return Number(a.id || 0) - Number(b.id || 0);
      })
      .map((row) => ({
        id: Number(row.id),
        tenantId: Number(row.tenantId || 1),
        end: normalizeMetricEnd(row.end),
        name: String(row.name || ''),
        formula: String(row.formula || ''),
        period: String(row.period || '每日'),
        source: String(row.source || ''),
        status: normalizeMetricRuleStatus(row.status),
        threshold: String(row.threshold || ''),
        remark: String(row.remark || ''),
        remarkMode: normalizeMetricRemarkMode(row.remarkMode || row.remark_mode || 'sync'),
        ruleVersion:
          typeof normalizeRuleVersion === 'function'
            ? normalizeRuleVersion(row.ruleVersion)
            : Math.max(1, Number(row.ruleVersion || 1)),
        updatedAt: row.updatedAt || row.createdAt || new Date().toISOString(),
      }));

    res.json({
      cardsByEnd: computeMetricCards(state, req.actor),
      rules,
      rulebookVersion: METRIC_RULEBOOK_VERSION,
    });
  });

  app.get('/api/p/metrics/share-daily', tenantContext, permissionRequired('customer:read'), (req, res) => {
    const state = getState();
    const tenantId = Number(req.tenantContext.tenantId || 0);

    const now = new Date();
    const defaultDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const day = String(req.query?.day || defaultDay).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      return res.status(400).json({ code: 'DAY_INVALID', message: 'day 必须为 YYYY-MM-DD' });
    }
    const [yy, mm, dd] = day.split('-').map((x) => Number(x));
    const dayStart = new Date(yy, mm - 1, dd, 0, 0, 0, 0);
    if (Number.isNaN(dayStart.getTime())) {
      return res.status(400).json({ code: 'DAY_INVALID', message: 'day 必须为有效日期' });
    }
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const actorIdRaw = parseNumber(req.query?.actorId, 0);
    const cActorId = parseNumber(req.query?.cActorId, actorIdRaw);
    const bActorId = parseNumber(req.query?.bActorId, actorIdRaw);
    if (cActorId <= 0 && bActorId <= 0) {
      return res.status(400).json({ code: 'ACTOR_ID_REQUIRED', message: '请传 actorId 或 cActorId/bActorId' });
    }

    const dailyCounters = (Array.isArray(state.metricDailyCounters) ? state.metricDailyCounters : []).filter(
      (row) => Number(row?.tenantId || 1) === tenantId && String(row?.statDate || '') === day
    );
    const counterSum = (metricKey, actorId) =>
      dailyCounters
        .filter((row) => String(row?.metricKey || '') === metricKey && parseNumber(row?.actorId, 0) === actorId)
        .reduce((sum, row) => sum + parseNumber(row?.cnt, 0), 0);

    const trackRows = (Array.isArray(state.trackEvents) ? state.trackEvents : []).filter(
      (row) => Number(row?.tenantId || 1) === tenantId
    );
    const fallbackCount = (eventName, actorId) =>
      trackRows.filter((row) => {
        if (parseNumber(row?.actorId, 0) !== actorId) return false;
        if (String(row?.event || '').toLowerCase() !== String(eventName || '').toLowerCase()) return false;
        const dt = rowDate(row, ['createdAt']);
        return Boolean(dt && dt >= dayStart && dt < dayEnd);
      }).length;

    const cShareCounter = cActorId > 0 ? counterSum('c_share_success_cnt', cActorId) : 0;
    const bShareCounter = bActorId > 0 ? counterSum('b_share_success_cnt', bActorId) : 0;
    const cShareCount = cActorId > 0 ? (cShareCounter > 0 ? cShareCounter : fallbackCount('c_share_success', cActorId)) : 0;
    const bShareCount =
      bActorId > 0 ? (bShareCounter > 0 ? bShareCounter : fallbackCount('b_tools_share_success', bActorId)) : 0;

    return res.json({
      day,
      cActorId: cActorId > 0 ? cActorId : null,
      bActorId: bActorId > 0 ? bActorId : null,
      cShareCount,
      bShareCount,
      metricKeys: {
        c: 'c_share_success_cnt',
        b: 'b_share_success_cnt',
      },
      eventNames: {
        c: 'c_share_success',
        b: 'b_tools_share_success',
      },
    });
  });

  app.post('/api/p/metrics/rules', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toCreateMetricRuleCommand({ body: req.body, actor: req.actor, tenantContext: req.tenantContext, deps });
    executeCreateMetricRule(command)
      .then((payload) => res.json(payload))
      .catch((err) => metricRuleWriteErrorResponse(res, err));
  });

  app.put('/api/p/metrics/rules/:id', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toUpdateMetricRuleCommand({ params: req.params, body: req.body, actor: req.actor, tenantContext: req.tenantContext, deps });
    executeUpdateMetricRule(command)
      .then((payload) => res.json(payload))
      .catch((err) => metricRuleWriteErrorResponse(res, err));
  });

  app.delete('/api/p/metrics/rules/:id', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toDeleteMetricRuleCommand({ params: req.params, tenantContext: req.tenantContext, deps });
    executeDeleteMetricRule(command)
      .then((payload) => res.json(payload))
      .catch((err) => metricRuleWriteErrorResponse(res, err));
  });
}
