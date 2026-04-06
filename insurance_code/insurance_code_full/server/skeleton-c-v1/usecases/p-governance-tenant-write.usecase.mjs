import { runInStateTransaction } from '../common/state.mjs';
import { isPublicPoolTenant } from '../common/public-pool-tenant.mjs';
import {
  findAgentByEmailGlobal,
  findTenantById,
  insertTenantSkeleton,
  removeTenantById,
  updateTenantAdminAgents,
} from '../repositories/p-governance-tenant-write.repository.mjs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeTenantType = (type) => (String(type || '').toLowerCase() === 'individual' ? 'individual' : 'company');
const normalizeTenantStatus = (status) => {
  const value = String(status || '').trim().toLowerCase();
  return ['active', 'inactive', 'disabled'].includes(value) ? value : 'active';
};

const canManageTenant = ({ actor, tenantId, contextTenantId }) =>
  Number(actor?.actorId || 0) === 9001 || Number(tenantId) === Number(contextTenantId);

export const executeCreateTenant = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const name = String(command.name || '').trim();
    const adminEmail = String(command.adminEmail || '').trim().toLowerCase();
    const initialPassword = String(command.initialPassword || '').trim();
    if (!name) throw new Error('TENANT_NAME_REQUIRED');
    if (!adminEmail) throw new Error('ADMIN_EMAIL_REQUIRED');
    if (!EMAIL_RE.test(adminEmail)) throw new Error('ADMIN_EMAIL_INVALID');
    if (initialPassword.length < 6) throw new Error('ADMIN_PASSWORD_INVALID');
    if (findAgentByEmailGlobal({ state, email: adminEmail })) throw new Error('ADMIN_EMAIL_CONFLICT');

    const tenant = {
      id: command.nextId(state.tenants || []),
      name,
      type: normalizeTenantType(command.type),
      status: normalizeTenantStatus(command.status),
      adminEmail,
      createdBy: command.actor.actorId,
      createdAt: new Date().toISOString(),
    };
    const org = {
      id: command.nextId(state.orgUnits || []),
      tenantId: Number(tenant.id),
      name: `${tenant.name}默认机构`,
      createdAt: new Date().toISOString(),
    };
    const team = {
      id: command.nextId(state.teams || []),
      tenantId: Number(tenant.id),
      orgId: Number(org.id),
      name: `${tenant.name}默认团队`,
      createdAt: new Date().toISOString(),
    };
    const adminAgent = {
      id: command.nextId(state.agents || []),
      tenantId: Number(tenant.id),
      orgId: Number(org.id),
      teamId: Number(team.id),
      name: `${tenant.name}管理员`,
      email: adminEmail,
      account: adminEmail,
      mobile: '',
      password: initialPassword,
      initialPassword,
      role: 'manager',
      status: tenant.status === 'active' ? 'active' : 'invited',
      createdAt: new Date().toISOString(),
      lastActiveAt: null,
    };
    const companyAdminRole = (state.roles || []).find((row) => String(row.key) === 'company_admin');
    const roleBinding = companyAdminRole
      ? {
          id: command.nextId(state.userRoles || []),
          tenantId: Number(tenant.id),
          userType: 'employee',
          userId: Number(adminAgent.id),
          roleId: Number(companyAdminRole.id),
        }
      : null;

    insertTenantSkeleton({ state, tenant, org, team, adminAgent, roleBinding });
    command.appendAuditLog({
      tenantId: Number(command.tenantContext?.tenantId || 0),
      actorType: command.actor.actorType,
      actorId: command.actor.actorId,
      action: 'tenant.create',
      resourceType: 'tenant',
      resourceId: String(tenant.id),
      result: 'success',
    });
    command.persistState();
    return { ok: true, tenant };
  });

export const executeUpdateTenant = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const tenantId = Number(command.tenantId || 0);
    const row = findTenantById({ state, tenantId });
    if (!row) throw new Error('TENANT_NOT_FOUND');
    if (!canManageTenant({ actor: command.actor, tenantId, contextTenantId: command.tenantContext?.tenantId })) {
      throw new Error('NO_PERMISSION');
    }
    if (isPublicPoolTenant(row)) throw new Error('TENANT_PROTECTED');

    const name = String(command.name ?? row.name ?? '').trim();
    const adminEmailRaw = String(command.adminEmail ?? row.adminEmail ?? '').trim().toLowerCase();
    if (!name) throw new Error('TENANT_NAME_REQUIRED');
    if (!adminEmailRaw) throw new Error('ADMIN_EMAIL_REQUIRED');
    if (!EMAIL_RE.test(adminEmailRaw)) throw new Error('ADMIN_EMAIL_INVALID');
    if (findAgentByEmailGlobal({ state, email: adminEmailRaw, excludeTenantId: tenantId })) throw new Error('ADMIN_EMAIL_CONFLICT');

    row.name = name;
    row.status = normalizeTenantStatus(command.status ?? row.status);
    row.type = normalizeTenantType(command.type ?? row.type);
    row.adminEmail = adminEmailRaw;
    row.updatedAt = new Date().toISOString();
    updateTenantAdminAgents({ state, tenantId, adminEmail: adminEmailRaw });
    command.persistState();
    return { ok: true, tenant: row };
  });

export const executeDeleteTenant = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const tenantId = Number(command.tenantId || 0);
    const target = findTenantById({ state, tenantId });
    if (!target) throw new Error('TENANT_NOT_FOUND');
    if (!canManageTenant({ actor: command.actor, tenantId, contextTenantId: command.tenantContext?.tenantId })) {
      throw new Error('NO_PERMISSION');
    }
    if (isPublicPoolTenant(target)) throw new Error('TENANT_PROTECTED');
    const removed = removeTenantById({ state, tenantId });
    if (!removed) throw new Error('TENANT_NOT_FOUND');
    command.persistState();
    return { ok: true };
  });
