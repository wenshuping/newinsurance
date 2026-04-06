import { runInStateTransaction } from '../common/state.mjs';
import { resolveCompanyAdminTenantContext } from '../services/workforce.service.mjs';
import {
  deleteTenantEmployeeById,
  findTenantEmployeeByEmailOrMobile,
  findTenantEmployeeById,
  insertEmployee,
  removeEmployeeRoleBindings,
  replaceEmployeeRoleBinding,
} from '../repositories/p-workforce-employee-write.repository.mjs';

const MOBILE_RE = /^1\d{10}$/;

const roleToRoleKey = (role) => {
  if (role === 'manager') return 'company_admin';
  if (role === 'support') return 'team_lead';
  return 'agent';
};

const resolveTenant = ({ state, actor, hasRole, tenantContext }) =>
  resolveCompanyAdminTenantContext({
    state,
    actor,
    hasRole,
    tenantContext,
    scopeName: '本租户员工',
  });

export const executeCreateEmployee = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    resolveTenant({ state, actor: command.actor, hasRole: command.hasRole, tenantContext: command.tenantContext });

    const tenantId = Number(command.tenantContext?.tenantId || 0);
    const defaultOrgId = Number(command.tenantContext?.orgId || 0);
    const name = String(command.name || '').trim();
    const email = String(command.email || '').trim();
    const mobile = String(command.mobile || '').trim();
    const role = String(command.role || 'salesperson');
    const initialPassword = String(command.initialPassword || '123456');
    const teamId = Number(command.teamId || 0);
    const orgId = Number(command.orgId || defaultOrgId || 0);

    if (!name) throw new Error('EMPLOYEE_NAME_REQUIRED');
    if (!email) throw new Error('EMPLOYEE_EMAIL_REQUIRED');
    if (!mobile) throw new Error('EMPLOYEE_MOBILE_REQUIRED');
    if (!MOBILE_RE.test(mobile)) throw new Error('EMPLOYEE_MOBILE_INVALID');
    if (!Number.isFinite(teamId) || teamId < 1) throw new Error('EMPLOYEE_TEAM_INVALID');
    const team = command.ensureTenantTeams(state, tenantId, orgId).find((x) => Number(x.id) === teamId);
    if (!team) throw new Error('EMPLOYEE_TEAM_NOT_FOUND');
    if (findTenantEmployeeByEmailOrMobile({ state, tenantId, email, mobile })) throw new Error('EMPLOYEE_ACCOUNT_CONFLICT');

    const row = {
      id: command.nextId(state.agents || []),
      tenantId,
      orgId,
      teamId,
      name,
      email,
      mobile,
      account: email,
      password: initialPassword,
      initialPassword,
      role,
      status: 'invited',
      createdAt: new Date().toISOString(),
      lastActiveAt: null,
    };
    insertEmployee({ state, employee: row });

    const roleKey = roleToRoleKey(role);
    const matchedRole = (state.roles || []).find((x) => String(x.key) === roleKey);
    if (matchedRole) {
      replaceEmployeeRoleBinding({
        state,
        tenantId,
        employeeId: Number(row.id),
        roleId: Number(matchedRole.id),
        userType: roleKey === 'agent' ? 'agent' : 'employee',
        nextId: command.nextId,
      });
    }

    command.persistState();
    return {
      ok: true,
      employee: { ...row, password: undefined },
      initialPassword,
    };
  });

export const executeUpdateEmployee = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    resolveTenant({ state, actor: command.actor, hasRole: command.hasRole, tenantContext: command.tenantContext });

    const tenantId = Number(command.tenantContext?.tenantId || 0);
    const id = Number(command.employeeId || 0);
    const row = findTenantEmployeeById({ state, tenantId, employeeId: id });
    if (!row) throw new Error('EMPLOYEE_NOT_FOUND');

    const name = String(command.name ?? row.name ?? '').trim();
    const email = String(command.email ?? row.email ?? '').trim();
    const mobile = String(command.mobile ?? row.mobile ?? '').trim();
    if (!name || !email || !mobile) throw new Error('EMPLOYEE_PARAMS_INVALID');
    if (!MOBILE_RE.test(mobile)) throw new Error('EMPLOYEE_MOBILE_INVALID');

    const nextTeamId = Number(command.teamId ?? row.teamId ?? 0);
    const nextOrgId = Number(command.orgId ?? row.orgId ?? 0);
    if (!Number.isFinite(nextTeamId) || nextTeamId < 1) throw new Error('EMPLOYEE_TEAM_INVALID');
    const team = command.ensureTenantTeams(state, tenantId, nextOrgId).find((x) => Number(x.id) === nextTeamId);
    if (!team) throw new Error('EMPLOYEE_TEAM_NOT_FOUND');

    const duplicated = findTenantEmployeeByEmailOrMobile({
      state,
      tenantId,
      email,
      mobile,
      excludeEmployeeId: id,
    });
    if (duplicated) throw new Error('EMPLOYEE_ACCOUNT_CONFLICT');

    row.name = name;
    row.email = email;
    row.mobile = mobile;
    row.role = String(command.role ?? row.role ?? 'salesperson');
    row.teamId = nextTeamId;
    row.orgId = nextOrgId;
    row.status = String(command.status ?? row.status ?? 'active');
    row.lastActiveAt = row.lastActiveAt || new Date().toISOString();
    row.updatedAt = new Date().toISOString();

    const roleKey = roleToRoleKey(row.role);
    const matchedRole = (state.roles || []).find((x) => String(x.key) === roleKey);
    replaceEmployeeRoleBinding({
      state,
      tenantId,
      employeeId: Number(row.id),
      roleId: matchedRole ? Number(matchedRole.id) : 0,
      userType: roleKey === 'agent' ? 'agent' : 'employee',
      nextId: command.nextId,
    });

    command.persistState();
    return { ok: true, employee: { ...row, password: undefined } };
  });

export const executeDeleteEmployee = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    resolveTenant({ state, actor: command.actor, hasRole: command.hasRole, tenantContext: command.tenantContext });
    const tenantId = Number(command.tenantContext?.tenantId || 0);
    const id = Number(command.employeeId || 0);
    const removed = deleteTenantEmployeeById({ state, tenantId, employeeId: id });
    if (!removed) throw new Error('EMPLOYEE_NOT_FOUND');
    removeEmployeeRoleBindings({ state, tenantId, employeeId: id });
    command.persistState();
    return { ok: true };
  });
