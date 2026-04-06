import { runInStateTransaction } from '../common/state.mjs';
import {
  findPTagByTenantAndId,
  hasPTagCodeConflict,
  insertPTag,
  isPTagInUseByRules,
  removePTagByTenantAndId,
} from '../repositories/p-tag-write.repository.mjs';

export const executeSavePTag = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const tenantId = Number(command.tenantContext?.tenantId || 0);
    const id = Number(command.id || 0);
    const tagCode = String(command.tagCode || '').trim();
    const tagName = String(command.tagName || '').trim();
    const tagType = command.normalizeTagType(command.tagType);
    const source = String(command.source || 'manual').trim() || 'manual';
    const description = String(command.description || '').trim();
    const status = command.normalizeTagStatus(command.status);
    const valueSchema = command.valueSchema && typeof command.valueSchema === 'object' ? command.valueSchema : {};

    if (!tagCode) throw new Error('TAG_CODE_REQUIRED');
    if (!tagName) throw new Error('TAG_NAME_REQUIRED');
    if (hasPTagCodeConflict({ state, tenantId, tagCode, excludeId: id })) throw new Error('TAG_CODE_CONFLICT');

    const now = new Date().toISOString();
    let row = findPTagByTenantAndId({ state, tenantId, id });
    if (row) {
      row.tagCode = tagCode;
      row.tagName = tagName;
      row.tagType = tagType;
      row.source = source;
      row.description = description;
      row.status = status;
      row.valueSchema = valueSchema;
      row.updatedAt = now;
    } else {
      row = insertPTag({
        state,
        row: {
          id: command.nextId(state.pTags || []),
          tenantId,
          tagCode,
          tagName,
          tagType,
          source,
          description,
          status,
          valueSchema,
          hitCount: 0,
          createdBy: Number(command.actor?.actorId || 0) || null,
          createdAt: now,
          updatedAt: now,
        },
      });
    }
    command.persistState();
    return { ok: true, item: row };
  });

export const executeUpdatePTagStatus = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const tenantId = Number(command.tenantContext?.tenantId || 0);
    const id = Number(command.id || 0);
    const row = findPTagByTenantAndId({ state, tenantId, id });
    if (!row) throw new Error('TAG_NOT_FOUND');
    row.status = command.normalizeTagStatus(command.status);
    row.updatedAt = new Date().toISOString();
    command.persistState();
    return { ok: true };
  });

export const executeDeletePTag = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const tenantId = Number(command.tenantContext?.tenantId || 0);
    const id = Number(command.id || 0);
    const row = findPTagByTenantAndId({ state, tenantId, id });
    if (!row) throw new Error('TAG_NOT_FOUND');
    if (isPTagInUseByRules({ state, tenantId, id })) throw new Error('TAG_IN_USE');
    const removed = removePTagByTenantAndId({ state, tenantId, id });
    if (!removed) throw new Error('TAG_NOT_FOUND');
    command.persistState();
    return { ok: true };
  });
