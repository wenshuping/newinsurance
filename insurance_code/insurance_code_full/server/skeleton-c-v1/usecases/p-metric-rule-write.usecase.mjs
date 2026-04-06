import { runInStateTransaction } from '../common/state.mjs';
import {
  findMetricRuleByTenantAndId,
  hasMetricRuleDuplicate,
  insertMetricRule,
  removeMetricRuleByTenantAndId,
} from '../repositories/p-metric-rule-write.repository.mjs';

export const executeCreateMetricRule = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const tenantId = Number(command.tenantContext?.tenantId || 0);
    const name = String(command.name || '').trim();
    const formula = String(command.formula || '').trim();
    const period = String(command.period || '').trim();
    const source = String(command.source || '').trim();
    const end = command.normalizeMetricEnd(command.end);
    if (!name) throw new Error('METRIC_NAME_REQUIRED');
    if (!formula) throw new Error('METRIC_FORMULA_REQUIRED');
    if (!period) throw new Error('METRIC_PERIOD_REQUIRED');
    if (!source) throw new Error('METRIC_SOURCE_REQUIRED');

    const key = command.metricRuleKey(end, name);
    if (hasMetricRuleDuplicate({ state, tenantId, key, metricRuleKey: command.metricRuleKey })) {
      throw new Error('METRIC_RULE_DUPLICATE');
    }

    const remarkMode = command.normalizeMetricRemarkMode(command.remarkMode ?? command.remark_mode);
    const manualRemark = String(command.remark || '').trim();
    const remark =
      remarkMode === 'manual' && manualRemark
        ? manualRemark
        : command.buildMetricRuleRemark({ name, formula, period, source });

    const row = {
      id: command.nextId(state.metricRules || []),
      tenantId,
      end,
      name,
      formula,
      period,
      source,
      status: command.normalizeMetricRuleStatus(command.status),
      threshold: String(command.threshold || ''),
      remark,
      remarkMode,
      ruleVersion: 1,
      createdBy: Number(command.actor.actorId || 0) || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    insertMetricRule({ state, row });
    command.appendAuditLog({
      tenantId,
      actorType: command.actor.actorType,
      actorId: command.actor.actorId,
      action: 'metric_rule.create',
      resourceType: 'metric_rule',
      resourceId: String(row.id),
      result: 'success',
      meta: { end: row.end, name: row.name, ruleVersion: row.ruleVersion || 1 },
    });
    command.persistState();
    return { ok: true, rule: row };
  });

export const executeUpdateMetricRule = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const tenantId = Number(command.tenantContext?.tenantId || 0);
    const id = Number(command.id || 0);
    const row = findMetricRuleByTenantAndId({ state, tenantId, id });
    if (!row) throw new Error('METRIC_RULE_NOT_FOUND');

    const name = String(command.name || row.name || '').trim();
    const formula = String(command.formula || row.formula || '').trim();
    const period = String(command.period || row.period || '').trim();
    const source = String(command.source || row.source || '').trim();
    const nextEnd = command.normalizeMetricEnd(command.end || row.end);
    if (!name) throw new Error('METRIC_NAME_REQUIRED');
    if (!formula) throw new Error('METRIC_FORMULA_REQUIRED');
    if (!period) throw new Error('METRIC_PERIOD_REQUIRED');
    if (!source) throw new Error('METRIC_SOURCE_REQUIRED');

    const key = command.metricRuleKey(nextEnd, name);
    if (hasMetricRuleDuplicate({ state, tenantId, key, excludeId: id, metricRuleKey: command.metricRuleKey })) {
      throw new Error('METRIC_RULE_DUPLICATE');
    }

    const beforeSignature = JSON.stringify({
      end: String(row.end || ''),
      name: String(row.name || ''),
      formula: String(row.formula || ''),
      period: String(row.period || ''),
      source: String(row.source || ''),
    });

    row.name = name;
    row.formula = formula;
    row.period = period;
    row.source = source;
    row.end = nextEnd;
    row.status = command.normalizeMetricRuleStatus(command.status || row.status);
    row.threshold = String(command.threshold ?? row.threshold ?? '');
    const remarkMode = command.normalizeMetricRemarkMode(command.remarkMode ?? command.remark_mode);
    const manualRemark = String(command.remark ?? row.remark ?? '').trim();
    row.remark =
      remarkMode === 'manual' && manualRemark
        ? manualRemark
        : command.buildMetricRuleRemark({ name, formula, period, source });
    row.remarkMode = remarkMode;
    const afterSignature = JSON.stringify({
      end: String(row.end || ''),
      name: String(row.name || ''),
      formula: String(row.formula || ''),
      period: String(row.period || ''),
      source: String(row.source || ''),
    });
    const currentVersion =
      typeof command.normalizeRuleVersion === 'function'
        ? command.normalizeRuleVersion(row.ruleVersion)
        : Math.max(1, Number(row.ruleVersion || 1));
    row.ruleVersion = beforeSignature !== afterSignature ? currentVersion + 1 : currentVersion;
    row.updatedAt = new Date().toISOString();

    command.appendAuditLog({
      tenantId,
      actorType: command.actor.actorType,
      actorId: command.actor.actorId,
      action: 'metric_rule.update',
      resourceType: 'metric_rule',
      resourceId: String(row.id),
      result: 'success',
      meta: { end: row.end, name: row.name, ruleVersion: row.ruleVersion || 1 },
    });
    command.persistState();
    return { ok: true, rule: row };
  });

export const executeDeleteMetricRule = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const tenantId = Number(command.tenantContext?.tenantId || 0);
    const id = Number(command.id || 0);
    const removed = removeMetricRuleByTenantAndId({ state, tenantId, id });
    if (!removed) throw new Error('METRIC_RULE_NOT_FOUND');
    command.persistState();
    return { ok: true };
  });
