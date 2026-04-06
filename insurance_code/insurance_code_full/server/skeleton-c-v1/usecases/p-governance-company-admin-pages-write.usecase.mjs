import { runInStateTransaction } from '../common/state.mjs';
import { replaceCompanyAdminPagePermissions } from '../repositories/p-governance-company-admin-pages-write.repository.mjs';

export const executeUpdateCompanyAdminPages = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const contextTenantId = Number(command.tenantContext?.tenantId || 0);
    if (!Number.isFinite(contextTenantId) || contextTenantId <= 0) throw new Error('TENANT_CONTEXT_REQUIRED');

    const isPlatformAdmin = command.hasRole(state, command.actor, 'platform_admin');
    const requestedTenantId = Number(command.requestedTenantId || 0);
    const tenantId = isPlatformAdmin && Number.isFinite(requestedTenantId) && requestedTenantId > 0 ? requestedTenantId : contextTenantId;
    if (!isPlatformAdmin && requestedTenantId > 0 && requestedTenantId !== contextTenantId) throw new Error('NO_PERMISSION');

    const validPageIds = new Set(command.allCompanyAdminPageIds());
    const grants = Array.isArray(command.grants)
      ? command.grants
          .map((row) => ({
            pageId: String(row?.pageId || '').trim(),
            enabled: Boolean(row?.enabled),
          }))
          .filter((row) => row.pageId && validPageIds.has(row.pageId))
      : [];

    if (!grants.length) throw new Error('PERMISSION_GRANTS_REQUIRED');

    const now = new Date().toISOString();
    replaceCompanyAdminPagePermissions({
      state,
      tenantId,
      grants,
      nextId: command.nextId,
      now,
    });

    command.appendAuditLog({
      tenantId,
      actorType: command.actor.actorType,
      actorId: command.actor.actorId,
      action: 'company_admin_permission.update',
      resourceType: 'permission_matrix',
      resourceId: String(tenantId),
      result: 'success',
      meta: { grants },
    });
    command.persistState();
    return { ok: true, tenantId, roleKey: 'company_admin', grants };
  });
