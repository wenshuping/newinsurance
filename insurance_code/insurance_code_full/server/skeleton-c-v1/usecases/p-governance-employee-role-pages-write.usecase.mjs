import { runInStateTransaction } from '../common/state.mjs';
import { replaceEmployeeRolePagePermissions } from '../repositories/p-governance-employee-role-pages-write.repository.mjs';

export const executeUpdateEmployeeRolePages = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const contextTenantId = Number(command.tenantContext?.tenantId || 0);
    if (!Number.isFinite(contextTenantId) || contextTenantId <= 0) throw new Error('TENANT_CONTEXT_REQUIRED');

    const isPlatformAdmin = command.hasRole(state, command.actor, 'platform_admin');
    const requestedTenantId = Number(command.requestedTenantId || 0);
    const tenantId = isPlatformAdmin && Number.isFinite(requestedTenantId) && requestedTenantId > 0 ? requestedTenantId : contextTenantId;
    if (!isPlatformAdmin && requestedTenantId > 0 && requestedTenantId !== contextTenantId) throw new Error('NO_PERMISSION');

    const roleKey = command.normalizeEmployeeRoleKey(command.roleKey);
    if (!command.configurableRoleKeys.includes(roleKey)) throw new Error('ROLE_NOT_CONFIGURABLE');

    const validPageIds = new Set(
      typeof command.resolveEmployeeRolePageIdsForTenant === 'function'
        ? command.resolveEmployeeRolePageIdsForTenant(state, tenantId)
        : command.allEmployeeRolePageIds()
    );
    const grants = Array.isArray(command.grants)
      ? command.grants
          .map((row) => ({
            pageId: String(row?.pageId || '').trim(),
            enabled: Boolean(row?.enabled),
          }))
          .filter((row) => row.pageId && validPageIds.has(row.pageId))
      : [];

    if (!grants.length || !grants.some((row) => row.enabled)) throw new Error('PERMISSION_GRANTS_REQUIRED');

    const now = new Date().toISOString();
    replaceEmployeeRolePagePermissions({
      state,
      tenantId,
      roleKey,
      grants,
      nextId: command.nextId,
      now,
    });

    command.appendAuditLog({
      tenantId,
      actorType: command.actor.actorType,
      actorId: command.actor.actorId,
      action: 'employee_role_page_permission.update',
      resourceType: 'role_page_permission',
      resourceId: `${tenantId}:${roleKey}`,
      result: 'success',
      meta: { roleKey, grants, dataPermissionPreset: 'reserved' },
    });
    command.persistState();
    return {
      ok: true,
      tenantId,
      roleKey,
      grants,
      dataPermission: { supported: false, status: 'reserved' },
    };
  });
