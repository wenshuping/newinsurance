import { runInStateTransaction } from '../common/state.mjs';
import { isActiveStatus } from '../routes/b-admin.shared.mjs';
import {
  findMallActivityById,
  findMallProductById,
  insertMallActivityAndCustomerActivity,
  insertMallProductAndItem,
  updateMallActivityAndCustomerActivities,
  updateMallProductAndItems,
} from '../repositories/b-mall-config-write.repository.mjs';

const normalizeMedia = (media, fallback = []) => {
  if (!Array.isArray(media)) return Array.isArray(fallback) ? fallback : [];
  return media
    .slice(0, 6)
    .map((item) => (typeof item === 'string' ? { name: item, type: 'image/*', preview: item } : item));
};

const resolveCreatorRole = ({ state, tenantId, actor, hasRole }) => {
  const actorIdentity = {
    tenantId: Number(tenantId || 0),
    userType: String(actor?.actorType || 'agent'),
    userId: Number(actor?.actorId || 0),
  };
  if (hasRole(state, actorIdentity, 'platform_admin')) return 'platform_admin';
  if (hasRole(state, actorIdentity, 'company_admin')) return 'company_admin';
  return 'agent';
};

export const executeCreateBMallProduct = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const name = String(command?.name || '').trim();
    if (!name) throw new Error('NAME_REQUIRED');
    const creatorRole = resolveCreatorRole({
      state,
      tenantId: command.tenantId,
      actor: command.actor,
      hasRole: command.hasRole,
    });
    const templateScope = creatorRole === 'platform_admin' ? 'platform' : 'tenant';
    const now = new Date().toISOString();
    const pointsCost = Number(command.pointsCost ?? command.points ?? 0);
    const status = String(command.status || 'active');
    const product = {
      id: command.nextId(state.pProducts || []),
      tenantId: Number(command.tenantId || 0),
      title: name,
      name,
      description: String(command.desc || ''),
      desc: String(command.desc || ''),
      points: pointsCost,
      pointsCost,
      stock: Number(command.stock || 0),
      sortOrder: Number(command.sortOrder || 1),
      status,
      media: normalizeMedia(command.media),
      createdBy: command.actor?.actorId,
      creatorRole,
      templateScope,
      createdAt: now,
      updatedAt: now,
    };
    const item = {
      id: command.nextId(state.mallItems || []),
      sourceProductId: Number(product.id),
      tenantId: Number(command.tenantId || 0),
      name,
      pointsCost,
      stock: Number(command.stock || 0),
      description: String(command.desc || ''),
      isActive: isActiveStatus(status),
      media: product.media,
      createdBy: command.actor?.actorId,
      creatorRole,
      templateScope,
      createdAt: now,
      updatedAt: now,
    };
    insertMallProductAndItem({ state, product, item });
    command.persistState();
    return { ok: true, product };
  });

export const executeUpdateBMallProduct = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const id = Number(command.id || 0);
    const row = findMallProductById({ state, id });
    if (!row) throw new Error('PRODUCT_NOT_FOUND');
    if (!command.canAccessTemplate(state, command.actor, row)) throw new Error('NO_PERMISSION');

    const name = String(command.name ?? command.title ?? row.name ?? row.title ?? '').trim();
    if (!name) throw new Error('NAME_REQUIRED');
    const media = normalizeMedia(command.media, row.media);
    const points = Number(command.points ?? command.pointsCost ?? row.points ?? row.pointsCost ?? 0);
    const status = String(command.status ?? row.status ?? 'active');
    const now = new Date().toISOString();
    const description = String(command.desc ?? command.description ?? row.description ?? row.desc ?? '');
    const productPatch = {
      title: name,
      name,
      description,
      desc: description,
      points,
      pointsCost: points,
      stock: Number(command.stock ?? row.stock ?? 0),
      sortOrder: Number(command.sortOrder ?? row.sortOrder ?? 1),
      status,
      media,
      updatedAt: now,
    };
    const itemPatch = {
      name,
      pointsCost: points,
      stock: productPatch.stock,
      description,
      isActive: isActiveStatus(status),
      media,
      updatedAt: now,
    };
    const updated = updateMallProductAndItems({ state, id, productPatch, itemPatch });
    if (!updated) throw new Error('PRODUCT_NOT_FOUND');
    command.persistState();
    return { ok: true, product: updated };
  });

export const executeCreateBMallActivity = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const title = String(command?.title || '').trim();
    if (!title) throw new Error('TITLE_REQUIRED');
    const creatorRole = resolveCreatorRole({
      state,
      tenantId: command.tenantId,
      actor: command.actor,
      hasRole: command.hasRole,
    });
    const templateScope = creatorRole === 'platform_admin' ? 'platform' : 'tenant';
    const now = new Date().toISOString();
    const row = {
      id: command.nextId(state.mallActivities || []),
      tenantId: Number(command.tenantId || 0),
      title,
      displayTitle: String(command.title || ''),
      type: String(command.type || 'task'),
      description: String(command.desc || ''),
      desc: String(command.desc || ''),
      rewardPoints: Number(command.rewardPoints || 0),
      sortOrder: Number(command.sortOrder || 1),
      status: String(command.status || 'active'),
      media: normalizeMedia(command.media),
      createdBy: command.actor?.actorId,
      creatorRole,
      templateScope,
      sourceDomain: 'mall',
      createdAt: now,
      updatedAt: now,
    };
    const customerActivity = {
      ...row,
      sourceMallActivityId: Number(row.id),
    };
    insertMallActivityAndCustomerActivity({
      state,
      mallActivity: row,
      customerActivity,
    });
    command.persistState();
    return { ok: true, activity: row };
  });

export const executeUpdateBMallActivity = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const id = Number(command.id || 0);
    const row = findMallActivityById({ state, id });
    if (!row) throw new Error('MALL_ACTIVITY_NOT_FOUND');
    if (!command.canAccessTemplate(state, command.actor, row)) throw new Error('NO_PERMISSION');

    const title = String(command.title ?? row.title ?? '').trim();
    if (!title) throw new Error('TITLE_REQUIRED');
    const media = normalizeMedia(command.media, row.media);
    const description = String(command.desc ?? command.description ?? row.description ?? row.desc ?? '');
    const patch = {
      title,
      displayTitle: String(command.displayTitle ?? row.displayTitle ?? title),
      type: String(command.type ?? row.type ?? 'task'),
      description,
      desc: description,
      rewardPoints: Number(command.rewardPoints ?? row.rewardPoints ?? 0),
      sortOrder: Number(command.sortOrder ?? row.sortOrder ?? 1),
      status: String(command.status ?? row.status ?? 'active'),
      media,
      updatedAt: new Date().toISOString(),
    };
    const updated = updateMallActivityAndCustomerActivities({ state, id, patch });
    if (!updated) throw new Error('MALL_ACTIVITY_NOT_FOUND');
    command.persistState();
    return { ok: true, activity: updated };
  });
