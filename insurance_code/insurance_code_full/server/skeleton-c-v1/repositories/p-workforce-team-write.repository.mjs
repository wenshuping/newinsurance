const ensureTeams = (state) => {
  if (!Array.isArray(state.teams)) state.teams = [];
};

export const findTenantTeamById = ({ state, tenantId, teamId }) => {
  ensureTeams(state);
  return state.teams.find((row) => Number(row.id) === Number(teamId) && Number(row.tenantId || 0) === Number(tenantId)) || null;
};

export const findTenantTeamByName = ({ state, tenantId, name, excludeTeamId = 0 }) => {
  ensureTeams(state);
  const normalizedName = String(name || '').trim();
  return (
    state.teams.find(
      (row) =>
        Number(row.tenantId || 0) === Number(tenantId) &&
        Number(row.id || 0) !== Number(excludeTeamId || 0) &&
        String(row.name || '').trim() === normalizedName
    ) || null
  );
};

export const insertTenantTeam = ({ state, team }) => {
  ensureTeams(state);
  state.teams.push(team);
  return team;
};

export const removeTenantTeam = ({ state, tenantId, teamId }) => {
  ensureTeams(state);
  const index = state.teams.findIndex((row) => Number(row.id) === Number(teamId) && Number(row.tenantId || 0) === Number(tenantId));
  if (index < 0) return false;
  state.teams.splice(index, 1);
  return true;
};

export const hasTenantTeamMembers = ({ state, tenantId, teamId }) =>
  (state.agents || []).some((row) => Number(row.tenantId || 0) === Number(tenantId) && Number(row.teamId || 0) === Number(teamId));
