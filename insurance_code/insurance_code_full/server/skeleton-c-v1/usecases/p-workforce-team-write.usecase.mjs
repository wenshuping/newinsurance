import { runInStateTransaction } from '../common/state.mjs';
import { resolveCompanyAdminTenantContext } from '../services/workforce.service.mjs';
import {
  findTenantTeamById,
  findTenantTeamByName,
  hasTenantTeamMembers,
  insertTenantTeam,
  removeTenantTeam,
} from '../repositories/p-workforce-team-write.repository.mjs';

const resolveTenantOrg = ({ state, actor, tenantContext, hasRole }) =>
  resolveCompanyAdminTenantContext({
    state,
    actor,
    hasRole,
    tenantContext,
    scopeName: '本租户团队',
  });

export const executeCreateTeam = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const { tenantId, orgId } = resolveTenantOrg({
      state,
      actor: command.actor,
      tenantContext: command.tenantContext,
      hasRole: command.hasRole,
    });
    const name = String(command.name || '').trim();
    if (!name) throw new Error('TEAM_NAME_REQUIRED');
    if (findTenantTeamByName({ state, tenantId, name })) throw new Error('TEAM_NAME_EXISTS');

    const row = {
      id: command.nextId(state.teams || []),
      tenantId,
      orgId: Number(orgId || 0) > 0 ? Number(orgId) : null,
      name,
      createdAt: new Date().toISOString(),
    };
    insertTenantTeam({ state, team: row });
    command.persistState();
    return { ok: true, team: row };
  });

export const executeUpdateTeam = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const { tenantId } = resolveTenantOrg({
      state,
      actor: command.actor,
      tenantContext: command.tenantContext,
      hasRole: command.hasRole,
    });
    const teamId = Number(command.teamId || 0);
    if (!teamId) throw new Error('TEAM_ID_REQUIRED');
    const row = findTenantTeamById({ state, tenantId, teamId });
    if (!row) throw new Error('TEAM_NOT_FOUND');

    const name = String(command.name || '').trim();
    if (!name) throw new Error('TEAM_NAME_REQUIRED');
    if (findTenantTeamByName({ state, tenantId, name, excludeTeamId: teamId })) throw new Error('TEAM_NAME_EXISTS');
    row.name = name;
    row.updatedAt = new Date().toISOString();
    command.persistState();
    return { ok: true, team: row };
  });

export const executeDeleteTeam = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const { tenantId } = resolveTenantOrg({
      state,
      actor: command.actor,
      tenantContext: command.tenantContext,
      hasRole: command.hasRole,
    });
    const teamId = Number(command.teamId || 0);
    if (!teamId) throw new Error('TEAM_ID_REQUIRED');
    const row = findTenantTeamById({ state, tenantId, teamId });
    if (!row) throw new Error('TEAM_NOT_FOUND');
    if (hasTenantTeamMembers({ state, tenantId, teamId })) throw new Error('TEAM_HAS_MEMBERS');
    if (!removeTenantTeam({ state, tenantId, teamId })) throw new Error('TEAM_NOT_FOUND');
    command.persistState();
    return { ok: true };
  });
