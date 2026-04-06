import { runInStateTransaction } from '../common/state.mjs';
import {
  findPTagRuleByTenantAndId,
  hasPTagRuleCodeConflict,
  insertPTagRule,
  removePTagRuleByTenantAndId,
} from '../repositories/p-tag-rule-write.repository.mjs';

const toTargetTagIds = (command) => {
  const fromArray = Array.isArray(command.targetTagIds)
    ? command.targetTagIds.map((x) => Number(x || 0)).filter((x) => x > 0)
    : [];
  if (fromArray.length) return [...new Set(fromArray)];
  const firstId = Number(command.targetTagId || 0);
  return firstId > 0 ? [firstId] : [];
};

export const executeSavePTagRule = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    if (!Array.isArray(state.pTagRules)) state.pTagRules = [];
    const tenantId = Number(command.tenantContext?.tenantId || 0);
    const id = Number(command.id || 0);
    const ruleCode = String(command.ruleCode || '').trim();
    const ruleName = String(command.ruleName || '').trim();
    const targetTagIds = toTargetTagIds(command);
    const priority = Math.max(1, Number(command.priority || 100));
    const status = command.normalizeTagRuleStatus(command.status);
    const conditionDsl = command.conditionDsl && typeof command.conditionDsl === 'object' ? command.conditionDsl : {};
    const outputExpr = command.outputExpr && typeof command.outputExpr === 'object' ? command.outputExpr : {};
    const effectiveStartAt = command.effectiveStartAt || null;
    const effectiveEndAt = command.effectiveEndAt || null;

    if (!ruleCode) throw new Error('RULE_CODE_REQUIRED');
    if (!ruleName) throw new Error('RULE_NAME_REQUIRED');
    if (!targetTagIds.length) throw new Error('TARGET_TAG_REQUIRED');
    const allTargetTagsExist = targetTagIds.every((tid) =>
      (state.pTags || []).some((row) => Number(row.tenantId || 1) === tenantId && Number(row.id || 0) === Number(tid))
    );
    if (!allTargetTagsExist) throw new Error('TARGET_TAG_NOT_FOUND');
    if (hasPTagRuleCodeConflict({ state, tenantId, ruleCode, excludeId: id })) throw new Error('RULE_CODE_CONFLICT');

    const now = new Date().toISOString();
    let row = findPTagRuleByTenantAndId({ state, tenantId, id });
    if (row) {
      row.ruleCode = ruleCode;
      row.ruleName = ruleName;
      row.targetTagId = targetTagIds[0];
      row.targetTagIds = targetTagIds;
      row.priority = priority;
      row.status = status;
      row.conditionDsl = conditionDsl;
      row.outputExpr = outputExpr;
      row.effectiveStartAt = effectiveStartAt;
      row.effectiveEndAt = effectiveEndAt;
      row.updatedAt = now;
    } else {
      row = insertPTagRule({
        state,
        row: {
          id: command.nextId(state.pTagRules),
          tenantId,
          ruleCode,
          ruleName,
          targetTagId: targetTagIds[0],
          targetTagIds,
          priority,
          status,
          conditionDsl,
          outputExpr,
          effectiveStartAt,
          effectiveEndAt,
          createdBy: Number(command.actor?.actorId || 0) || null,
          createdAt: now,
          updatedAt: now,
        },
      });
    }
    command.persistState();
    return { ok: true, item: row };
  });

export const executeUpdatePTagRuleStatus = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const tenantId = Number(command.tenantContext?.tenantId || 0);
    const id = Number(command.id || 0);
    const row = findPTagRuleByTenantAndId({ state, tenantId, id });
    if (!row) throw new Error('RULE_NOT_FOUND');
    row.status = command.normalizeTagRuleStatus(command.status);
    row.updatedAt = new Date().toISOString();
    command.persistState();
    return { ok: true };
  });

export const executeDeletePTagRule = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const tenantId = Number(command.tenantContext?.tenantId || 0);
    const id = Number(command.id || 0);
    const removed = removePTagRuleByTenantAndId({ state, tenantId, id });
    if (!removed) throw new Error('RULE_NOT_FOUND');
    command.persistState();
    return { ok: true };
  });
