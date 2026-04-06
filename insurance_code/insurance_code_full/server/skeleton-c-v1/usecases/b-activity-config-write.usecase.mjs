import { runInStateTransaction, withIdempotency } from '../common/state.mjs';
import {
  findActivityConfigById,
  insertActivityConfig,
  updateActivityConfigAndShadow,
} from '../repositories/b-activity-config-write.repository.mjs';

const normalizeMedia = (media, fallback = []) => {
  if (!Array.isArray(media)) return Array.isArray(fallback) ? fallback : [];
  return media
    .slice(0, 6)
    .map((item) => (typeof item === 'string' ? { name: item, type: 'image/*', preview: item } : item));
};

const B_ACTIVITY_CONFIG_CREATE_BIZ_TYPE = 'b.activity-config.create';

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

export const executeCreateBActivityConfig = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const createConfig = async () => {
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
        id: command.nextId(state.activities || []),
        tenantId: Number(command.tenantId || 0),
        title,
        sourceDomain: 'activity',
        category: String(command.category || 'task'),
        content: String(command.desc || ''),
        rewardPoints: Number(command.rewardPoints || 0),
        sortOrder: Number(command.sortOrder || 1),
        participants: 0,
        status: String(command.status || 'online'),
        media: normalizeMedia(command.media),
        createdBy: command.actor?.actorId,
        creatorRole,
        templateScope,
        createdAt: now,
        updatedAt: now,
      };

      insertActivityConfig({ state, row });
      command.persistState();
      return { ok: true, item: row };
    };

    const rawKey = String(command.idempotencyKey || '').trim();
    if (!rawKey) {
      return { ...(await createConfig()), idempotent: false };
    }

    const idempotent = await withIdempotency({
      tenantId: Number(command?.tenantId || 1),
      bizType: B_ACTIVITY_CONFIG_CREATE_BIZ_TYPE,
      bizKey: rawKey,
      execute: createConfig,
    });
    return {
      ...(idempotent.value || { ok: true, item: null }),
      idempotent: idempotent.hit,
    };
  });

export const executeUpdateBActivityConfig = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const id = Number(command.id || 0);
    const current = findActivityConfigById({ state, id });
    if (!current) throw new Error('ACTIVITY_NOT_FOUND');
    if (!command.canAccessTemplate(state, command.actor, current)) throw new Error('NO_PERMISSION');

    const title = String(command?.title ?? current.title ?? '').trim();
    if (!title) throw new Error('TITLE_REQUIRED');
    const patch = {
      title,
      category: String(command.category ?? current.category ?? 'task'),
      content: String(command.desc ?? current.content ?? ''),
      rewardPoints: Number(command.rewardPoints ?? current.rewardPoints ?? 0),
      sortOrder: Number(command.sortOrder ?? current.sortOrder ?? 1),
      status: String(command.status ?? current.status ?? 'online'),
      media: normalizeMedia(command.media, current.media),
      updatedAt: new Date().toISOString(),
    };
    const updated = updateActivityConfigAndShadow({ state, id, patch });
    if (!updated) throw new Error('ACTIVITY_NOT_FOUND');
    command.persistState();
    return { ok: true, item: updated };
  });
