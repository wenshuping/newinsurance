import { runInStateTransaction } from '../common/state.mjs';
import {
  findPMallActivityById,
  findPMallActivityCompanyOverrideIndex,
  findPMallActivityIndexById,
  findPMallProductById,
  findPMallProductCompanyOverrideIndex,
  findPMallProductIndexById,
  insertMallItemMirror,
  insertPMallActivity,
  insertPMallProduct,
  removeMallItemMirrorsByProductId,
  removePMallActivityByIndex,
  removePMallProductByIndex,
  syncMallItemMirrorByProduct,
} from '../repositories/p-mall-write.repository.mjs';

export const executeCreatePMallProduct = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const { isCompanyAdmin, isPlatformAdmin, isCompanyActor } = command.canOperateTenantTemplates(state, command.actor);
    if (!isPlatformAdmin && !isCompanyActor) throw new Error('COMPANY_ACCOUNT_REQUIRED');
    const title = String(command.title || '').trim();
    if (!title) throw new Error('PRODUCT_TITLE_REQUIRED');

    const media = Array.isArray(command.media) ? command.media.slice(0, 6) : [];
    const status = String(command.status || 'active');
    const row = {
      id: command.nextId(state.pProducts || []),
      tenantId: command.tenantContext.tenantId,
      title,
      points: Number(command.points ?? command.pointsCost ?? 0),
      stock: Number(command.stock || 0),
      sortOrder: Number(command.sortOrder || (state.pProducts || []).length + 1),
      category: String(command.category || '实物礼品 (Gift)'),
      description: String(command.description || ''),
      limitPerUser: Boolean(command.limitPerUser),
      vipOnly: Boolean(command.vipOnly),
      enableCountdown: Boolean(command.enableCountdown),
      media,
      createdBy: Number(command.actor.actorId || 0),
      creatorRole: isPlatformAdmin ? 'platform_admin' : isCompanyAdmin ? 'company_admin' : 'agent',
      templateScope: isPlatformAdmin ? 'platform' : 'tenant',
      status,
      updatedAt: new Date().toISOString(),
    };
    insertPMallProduct({ state, row });
    insertMallItemMirror({
      state,
      row: {
        id: command.nextId(state.mallItems || []),
        sourceProductId: Number(row.id),
        name: row.title,
        pointsCost: row.points,
        stock: row.stock,
        isActive: ['active', 'online', 'published', 'on', '进行中', '生效'].includes(status.toLowerCase()),
        media,
        description: row.description,
        tenantId: row.tenantId,
        createdBy: row.createdBy,
        creatorRole: row.creatorRole,
        templateScope: row.templateScope,
      },
    });
    command.persistState();
    return { ok: true, product: row };
  });

export const executeUpdatePMallProduct = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const id = Number(command.id || 0);
    const source = findPMallProductById({ state, id });
    if (!source) throw new Error('PRODUCT_NOT_FOUND');
    if (!command.canAccessTemplate(state, command.actor, source)) throw new Error('NO_PERMISSION_EDIT_PRODUCT');

    const isCompanyAdmin = command.hasRole(state, command.actor, 'company_admin');
    const tenantId = Number(command.tenantContext.tenantId || 0);
    const row = source;
    if (isCompanyAdmin && String(source.creatorRole || '') === 'platform_admin') {
      row.sourceTemplateId = Number(source.sourceTemplateId || source.id || 0);
      row.platformTemplate = true;
      row.templateTag = '平台模板';
      row.creatorRole = 'company_admin';
      row.templateScope = 'tenant';
      row.tenantId = tenantId;
      row.createdBy = Number(command.actor.actorId || source.createdBy || 0);
    }
    const title = String(command.title ?? row.title ?? '').trim();
    if (!title) throw new Error('PRODUCT_TITLE_REQUIRED');
    row.title = title;
    row.points = Number(command.points ?? command.pointsCost ?? row.points ?? 0);
    row.stock = Number(command.stock ?? row.stock ?? 0);
    row.sortOrder = Number(command.sortOrder ?? row.sortOrder ?? 1);
    row.category = String(command.category ?? row.category ?? '实物礼品 (Gift)');
    row.description = String(command.description ?? row.description ?? '');
    row.limitPerUser = Boolean(command.limitPerUser ?? row.limitPerUser);
    row.vipOnly = Boolean(command.vipOnly ?? row.vipOnly);
    row.enableCountdown = Boolean(command.enableCountdown ?? row.enableCountdown);
    row.status = String(command.status ?? row.status ?? 'active');
    if (Array.isArray(command.media)) row.media = command.media.slice(0, 6);
    row.updatedAt = new Date().toISOString();
    syncMallItemMirrorByProduct({ state, product: row });
    command.persistState();
    return { ok: true, product: row };
  });

export const executeDeletePMallProduct = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const id = Number(command.id || 0);
    let index = findPMallProductIndexById({ state, id });
    if (index < 0) throw new Error('PRODUCT_NOT_FOUND');

    const isCompanyAdmin = command.hasRole(state, command.actor, 'company_admin');
    const target = state.pProducts[index];
    if (isCompanyAdmin && String(target.creatorRole || '') === 'platform_admin') {
      const tenantId = Number(command.tenantContext.tenantId || 0);
      index = findPMallProductCompanyOverrideIndex({ state, tenantId, sourceTemplateId: target.id });
      if (index < 0) throw new Error('PLATFORM_TEMPLATE_SOURCE_IMMUTABLE');
    }
    if (!command.canAccessTemplate(state, command.actor, state.pProducts[index])) throw new Error('NO_PERMISSION_DELETE_PRODUCT');
    const removed = removePMallProductByIndex({ state, index });
    if (!removed) throw new Error('PRODUCT_NOT_FOUND');
    removeMallItemMirrorsByProductId({ state, productId: Number(removed.id || 0) });
    command.persistState();
    return { ok: true };
  });

const SORT_ORDER_COMPARATOR = (left, right) =>
  Number(left?.sortOrder || 0) - Number(right?.sortOrder || 0) || Number(left?.id || 0) - Number(right?.id || 0);

const dedupePositiveIds = (ids) => {
  const result = [];
  const seen = new Set();
  for (const value of Array.isArray(ids) ? ids : []) {
    const id = Number(value || 0);
    if (!Number.isInteger(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
};

const buildReorderedMallRows = ({ rows, ids, state, actor, canAccessTemplate, idsRequiredCode }) => {
  const requestedIds = dedupePositiveIds(ids);
  if (requestedIds.length === 0) throw new Error(idsRequiredCode);

  const orderedRows = rows.slice().sort(SORT_ORDER_COMPARATOR);
  const visibleRows = orderedRows.filter((row) => canAccessTemplate(state, actor, row));
  const hiddenRows = orderedRows.filter((row) => !canAccessTemplate(state, actor, row));
  const visibleById = new Map(visibleRows.map((row) => [Number(row.id || 0), row]));
  const requestedRows = requestedIds.map((id) => visibleById.get(id)).filter(Boolean);
  if (requestedRows.length === 0) throw new Error(idsRequiredCode);

  const requestedIdSet = new Set(requestedRows.map((row) => Number(row.id || 0)));
  const remainingVisibleRows = visibleRows.filter((row) => !requestedIdSet.has(Number(row.id || 0)));
  return [...requestedRows, ...remainingVisibleRows, ...hiddenRows];
};

const normalizeMallSortOrders = (rows) => {
  const now = new Date().toISOString();
  rows.forEach((row, idx) => {
    row.sortOrder = idx + 1;
    row.updatedAt = now;
  });
  return rows;
};

export const executeReorderPMallProducts = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const { isPlatformAdmin, isCompanyActor } = command.canOperateTenantTemplates(state, command.actor);
    if (!isPlatformAdmin && !isCompanyActor) throw new Error('COMPANY_ACCOUNT_REQUIRED');

    const rows = Array.isArray(state.pProducts) ? state.pProducts : [];
    const finalRows = normalizeMallSortOrders(
      buildReorderedMallRows({
        rows,
        ids: command.ids,
        state,
        actor: command.actor,
        canAccessTemplate: command.canAccessTemplate,
        idsRequiredCode: 'MALL_PRODUCT_REORDER_IDS_REQUIRED',
      })
    );

    finalRows.forEach((row) => {
      syncMallItemMirrorByProduct({ state, product: row });
    });
    command.persistState();
    return {
      ok: true,
      ids: finalRows.filter((row) => command.canAccessTemplate(state, command.actor, row)).map((row) => Number(row.id || 0)),
    };
  });

export const executeCreatePMallActivity = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const { isCompanyAdmin, isPlatformAdmin, isCompanyActor } = command.canOperateTenantTemplates(state, command.actor);
    if (!isPlatformAdmin && !isCompanyActor) throw new Error('COMPANY_ACCOUNT_REQUIRED');
    const title = String(command.title || '').trim();
    if (!title) throw new Error('ACTIVITY_TITLE_REQUIRED');
    const row = {
      id: command.nextId(state.mallActivities || []),
      tenantId: command.tenantContext.tenantId,
      title,
      displayTitle: String(command.displayTitle || title),
      type: String(command.type || 'task'),
      rewardPoints: Number(command.rewardPoints || 0),
      sortOrder: Number(command.sortOrder || (state.mallActivities || []).length + 1),
      description: String(command.description || ''),
      media: Array.isArray(command.media) ? command.media.slice(0, 6) : [],
      createdBy: Number(command.actor.actorId || 0),
      creatorRole: isPlatformAdmin ? 'platform_admin' : isCompanyAdmin ? 'company_admin' : 'agent',
      templateScope: isPlatformAdmin ? 'platform' : 'tenant',
      sourceDomain: 'mall',
      status: String(command.status || 'active'),
      updatedAt: new Date().toISOString(),
    };
    insertPMallActivity({ state, row });
    command.persistState();
    return { ok: true, activity: row };
  });

export const executeUpdatePMallActivity = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const id = Number(command.id || 0);
    const source = findPMallActivityById({ state, id });
    if (!source) throw new Error('MALL_ACTIVITY_NOT_FOUND');
    if (!command.canAccessTemplate(state, command.actor, source)) throw new Error('NO_PERMISSION_EDIT_ACTIVITY');

    const isCompanyAdmin = command.hasRole(state, command.actor, 'company_admin');
    const tenantId = Number(command.tenantContext.tenantId || 0);
    const row = source;
    if (isCompanyAdmin && String(source.creatorRole || '') === 'platform_admin') {
      row.sourceTemplateId = Number(source.sourceTemplateId || source.id || 0);
      row.platformTemplate = true;
      row.templateTag = '平台模板';
      row.creatorRole = 'company_admin';
      row.templateScope = 'tenant';
      row.tenantId = tenantId;
      row.createdBy = Number(command.actor.actorId || source.createdBy || 0);
    }
    const title = String(command.title ?? row.title ?? '').trim();
    if (!title) throw new Error('ACTIVITY_TITLE_REQUIRED');
    row.title = title;
    row.displayTitle = String(command.displayTitle ?? row.displayTitle ?? title);
    row.type = String(command.type ?? row.type ?? 'task');
    row.rewardPoints = Number(command.rewardPoints ?? row.rewardPoints ?? 0);
    row.sortOrder = Number(command.sortOrder ?? row.sortOrder ?? 1);
    row.description = String(command.description ?? row.description ?? '');
    row.status = String(command.status ?? row.status ?? 'active');
    if (Array.isArray(command.media)) row.media = command.media.slice(0, 6);
    row.updatedAt = new Date().toISOString();
    command.persistState();
    return { ok: true, activity: row };
  });

export const executeDeletePMallActivity = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const id = Number(command.id || 0);
    let index = findPMallActivityIndexById({ state, id });
    if (index < 0) throw new Error('MALL_ACTIVITY_NOT_FOUND');

    const isCompanyAdmin = command.hasRole(state, command.actor, 'company_admin');
    const target = state.mallActivities[index];
    if (isCompanyAdmin && String(target.creatorRole || '') === 'platform_admin') {
      const tenantId = Number(command.tenantContext.tenantId || 0);
      index = findPMallActivityCompanyOverrideIndex({ state, tenantId, sourceTemplateId: target.id });
      if (index < 0) throw new Error('PLATFORM_TEMPLATE_SOURCE_IMMUTABLE');
    }
    if (!command.canAccessTemplate(state, command.actor, state.mallActivities[index])) {
      throw new Error('NO_PERMISSION_DELETE_ACTIVITY');
    }
    const removed = removePMallActivityByIndex({ state, index });
    if (!removed) throw new Error('MALL_ACTIVITY_NOT_FOUND');
    command.persistState();
    return { ok: true };
  });

export const executeReorderPMallActivities = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const { isPlatformAdmin, isCompanyActor } = command.canOperateTenantTemplates(state, command.actor);
    if (!isPlatformAdmin && !isCompanyActor) throw new Error('COMPANY_ACCOUNT_REQUIRED');

    const rows = Array.isArray(state.mallActivities) ? state.mallActivities : [];
    const finalRows = normalizeMallSortOrders(
      buildReorderedMallRows({
        rows,
        ids: command.ids,
        state,
        actor: command.actor,
        canAccessTemplate: command.canAccessTemplate,
        idsRequiredCode: 'MALL_ACTIVITY_REORDER_IDS_REQUIRED',
      })
    );

    command.persistState();
    return {
      ok: true,
      ids: finalRows.filter((row) => command.canAccessTemplate(state, command.actor, row)).map((row) => Number(row.id || 0)),
    };
  });
