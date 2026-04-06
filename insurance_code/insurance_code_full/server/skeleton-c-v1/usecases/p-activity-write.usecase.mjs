import { runInStateTransaction, withIdempotency } from '../common/state.mjs';
import { isPublishedLikeStatus } from '../common/status-policy.mjs';
import { isPlatformTemplate } from '../common/template-visibility.mjs';
import {
  findPActivityById,
  findPActivityIndexById,
  findPCompanyOverrideActivityIndex,
  insertPActivity,
  removePActivityByIndex,
} from '../repositories/p-activity-write.repository.mjs';
import { resolvePActivityMedia } from '../services/p-activity-media.service.mjs';
import { executeUploadBase64 } from './upload-write.usecase.mjs';

const ACTIVITY_CREATE_BIZ_TYPE = 'p.activity.create';
const toUniquePositiveIds = (ids) =>
  [...new Set((Array.isArray(ids) ? ids : []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
const isDeletableActivityStatus = (status) => !isPublishedLikeStatus(status);

const createInlineUploadHandler = (command) => {
  if (!command?.uploadDeps) return null;
  return async (item) => {
    const payload = await executeUploadBase64({
      tenantId: Number(command?.tenantContext?.tenantId || 0),
      dataUrl: String(item?.dataUrl || ''),
      type: String(item?.type || 'application/octet-stream'),
      name: String(item?.name || 'upload'),
      protocol: String(command?.protocol || 'http'),
      host: String(command?.host || '127.0.0.1:4000'),
      uploadsRoot: command.uploadDeps.uploadsRoot,
      mkdirRecursive: command.uploadDeps.mkdirRecursive,
      writeFileBuffer: command.uploadDeps.writeFileBuffer,
      nowMs: command.uploadDeps.nowMs,
      randomHex: command.uploadDeps.randomHex,
    });
    return payload.file;
  };
};

const ensureCreatePActivityPermission = ({ command, state }) => {
  const { isCompanyAdmin, isPlatformAdmin, isCompanyActor } = command.canOperateTenantTemplates(state, command.actor);
  if (!isPlatformAdmin && !isCompanyActor) throw new Error('COMPANY_ACCOUNT_REQUIRED');
  return { isCompanyAdmin, isPlatformAdmin };
};

const resolveCompanyAdminActivityWriteTarget = ({ command, state, source, tenantId }) => {
  const sourceTemplateId = Number(source.sourceTemplateId || source.id || 0);
  const overrideIndex = findPCompanyOverrideActivityIndex({ state, tenantId, sourceTemplateId });
  if (overrideIndex >= 0) return state.activities[overrideIndex];

  const nowIso = new Date().toISOString();
  const row = {
    ...source,
    id: command.nextId(state.activities || []),
    tenantId,
    sourceTemplateId,
    platformTemplate: true,
    templateTag: '平台模板',
    createdBy: Number(command.actor.actorId || source.createdBy || 0),
    creatorRole: 'company_admin',
    templateScope: 'tenant',
    createdAt: nowIso,
    updatedAt: nowIso,
    media: Array.isArray(source.media) ? source.media.slice(0, 6) : [],
  };
  insertPActivity({ state, row });
  return row;
};

const createPActivityOnce = async ({ command, state, roleContext, persistState = true }) => {
  const title = String(command.title || '').trim();
  if (!title) throw new Error('ACTIVITY_TITLE_REQUIRED');
  const media = await resolvePActivityMedia({
    media: Array.isArray(command.media) ? command.media : [],
    uploadItems: Array.isArray(command.uploadItems) ? command.uploadItems : [],
    uploadFile: createInlineUploadHandler(command),
    limit: 6,
  });
  const row = {
    id: command.nextId(state.activities || []),
    tenantId: command.tenantContext.tenantId,
    sourceDomain: 'activity',
    title,
    category: String(command.category || 'task'),
    rewardPoints: Number(command.rewardPoints || 0),
    sortOrder: Number(command.sortOrder || (state.activities || []).length + 1),
    participants: 0,
    content: String(command.content || ''),
    media,
    status: String(command.status || 'online'),
    createdBy: Number(command.actor.actorId || 0),
    creatorRole: roleContext.isPlatformAdmin ? 'platform_admin' : roleContext.isCompanyAdmin ? 'company_admin' : 'agent',
    templateScope: roleContext.isPlatformAdmin ? 'platform' : 'tenant',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  insertPActivity({ state, row });
  if (persistState) command.persistState();
  return { ok: true, activity: row };
};

export const executeCreatePActivity = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const roleContext = ensureCreatePActivityPermission({ command, state });
    const createActivity = async () =>
      createPActivityOnce({
        command,
        state,
        roleContext,
        persistState: true,
      });

    const rawKey = String(command.idempotencyKey || '').trim();
    if (!rawKey) {
      const payload = await createActivity();
      return { ...payload, idempotent: false };
    }

    const idempotent = await withIdempotency({
      tenantId: Number(command?.tenantContext?.tenantId || 1),
      bizType: ACTIVITY_CREATE_BIZ_TYPE,
      bizKey: rawKey,
      execute: createActivity,
    });

    return {
      ...(idempotent.value || { ok: true, activity: null }),
      idempotent: idempotent.hit,
    };
  });

export const executeUpdatePActivity = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const id = Number(command.id || 0);
    const source = findPActivityById({ state, id });
    if (!source) throw new Error('ACTIVITY_NOT_FOUND');
    if (!command.canAccessTemplate(state, command.actor, source)) throw new Error('NO_PERMISSION_EDIT');

    const isCompanyAdmin = command.hasRole(state, command.actor, 'company_admin');
    const tenantId = Number(command.tenantContext.tenantId || 0);
    let row = source;
    if (isCompanyAdmin && isPlatformTemplate(state, source)) {
      row = resolveCompanyAdminActivityWriteTarget({ command, state, source, tenantId });
    }

    const title = String(command.title ?? row.title ?? '').trim();
    if (!title) throw new Error('ACTIVITY_TITLE_REQUIRED');
    row.title = title;
    row.sourceDomain = 'activity';
    row.category = String(command.category ?? row.category ?? 'task');
    row.rewardPoints = Number(command.rewardPoints ?? row.rewardPoints ?? 0);
    row.sortOrder = Number(command.sortOrder ?? row.sortOrder ?? 1);
    row.content = String(command.content ?? row.content ?? '');
    row.status = String(command.status ?? row.status ?? 'online');
    if (Array.isArray(command.media)) row.media = command.media.slice(0, 6);
    row.updatedAt = new Date().toISOString();
    command.persistState();
    return { ok: true, activity: row };
  });

const deletePActivityById = ({ command, state, id, strict = true }) => {
  let index = findPActivityIndexById({ state, id });
  if (index < 0) {
    if (!strict) return false;
    throw new Error('ACTIVITY_NOT_FOUND');
  }

  const isCompanyAdmin = command.hasRole(state, command.actor, 'company_admin');
  const target = state.activities[index];
  if (isCompanyAdmin && isPlatformTemplate(state, target)) {
    const tenantId = Number(command.tenantContext.tenantId || 0);
    index = findPCompanyOverrideActivityIndex({
      state,
      tenantId,
      sourceTemplateId: Number(target.sourceTemplateId || target.id || 0),
    });
    if (index < 0) throw new Error('PLATFORM_TEMPLATE_SOURCE_IMMUTABLE');
  }

  if (!command.canAccessTemplate(state, command.actor, state.activities[index])) throw new Error('NO_PERMISSION_DELETE');
  if (!isDeletableActivityStatus(state.activities[index]?.status)) throw new Error('ACTIVITY_ACTIVE_DELETE_FORBIDDEN');
  const removed = removePActivityByIndex({ state, index });
  if (!removed) {
    if (!strict) return false;
    throw new Error('ACTIVITY_NOT_FOUND');
  }
  return true;
};

export const executeDeletePActivity = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const id = Number(command.id || 0);
    deletePActivityById({ command, state, id, strict: true });
    command.persistState();
    return { ok: true };
  });

export const executeDeletePActivityBatch = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const ids = toUniquePositiveIds(command.ids);
    if (!ids.length) throw new Error('ACTIVITY_BATCH_DELETE_IDS_REQUIRED');

    const deletedIds = [];
    const blockedIds = [];
    for (const id of ids) {
      try {
        if (deletePActivityById({ command, state, id, strict: false })) {
          deletedIds.push(id);
        }
      } catch (err) {
        if (String(err?.message || '') === 'ACTIVITY_ACTIVE_DELETE_FORBIDDEN') {
          blockedIds.push(id);
          continue;
        }
        throw err;
      }
    }

    command.persistState();
    return {
      ok: true,
      deletedCount: deletedIds.length,
      ids: deletedIds,
      blockedIds,
    };
  });

export const executeReorderPActivities = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const ids = toUniquePositiveIds(command.ids);
    if (!ids.length) throw new Error('ACTIVITY_REORDER_IDS_REQUIRED');

    const isCompanyAdmin = command.hasRole(state, command.actor, 'company_admin');
    const tenantId = Number(command.tenantContext.tenantId || 0);
    const orderedRows = ids.map((id) => {
      const source = findPActivityById({ state, id });
      if (!source) throw new Error('ACTIVITY_NOT_FOUND');
      if (!command.canAccessTemplate(state, command.actor, source)) throw new Error('NO_PERMISSION_EDIT');
      if (isCompanyAdmin && isPlatformTemplate(state, source)) {
        return resolveCompanyAdminActivityWriteTarget({ command, state, source, tenantId });
      }
      return source;
    });

    const requestedIds = new Set(ids);
    const targetIds = new Set(orderedRows.map((row) => Number(row.id || 0)));
    const remainingRows = (state.activities || [])
      .filter((row) => command.canAccessTemplate(state, command.actor, row))
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || Number(a.id || 0) - Number(b.id || 0))
      .filter((row) => {
        const rowId = Number(row.id || 0);
        return !requestedIds.has(rowId) && !targetIds.has(rowId);
      });

    const finalRows = [...orderedRows, ...remainingRows];
    const nowIso = new Date().toISOString();
    finalRows.forEach((row, index) => {
      row.sortOrder = index + 1;
      row.updatedAt = nowIso;
    });

    command.persistState();
    return { ok: true };
  });
