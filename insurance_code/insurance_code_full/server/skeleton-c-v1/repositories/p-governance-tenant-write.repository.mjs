const ensureTenantArrays = (state) => {
  if (!Array.isArray(state.tenants)) state.tenants = [];
  if (!Array.isArray(state.orgUnits)) state.orgUnits = [];
  if (!Array.isArray(state.teams)) state.teams = [];
  if (!Array.isArray(state.agents)) state.agents = [];
  if (!Array.isArray(state.userRoles)) state.userRoles = [];
};

export const findTenantById = ({ state, tenantId }) => {
  ensureTenantArrays(state);
  return state.tenants.find((row) => Number(row.id) === Number(tenantId)) || null;
};

export const findAgentByEmailGlobal = ({ state, email, excludeTenantId = 0 }) => {
  ensureTenantArrays(state);
  const normalized = String(email || '').trim().toLowerCase();
  return (
    state.agents.find(
      (row) =>
        String(row.email || '').toLowerCase() === normalized &&
        Number(row.tenantId || 0) !== Number(excludeTenantId || 0)
    ) || null
  );
};

export const insertTenantSkeleton = ({ state, tenant, org, team, adminAgent, roleBinding }) => {
  ensureTenantArrays(state);
  state.tenants.push(tenant);
  state.orgUnits.push(org);
  state.teams.push(team);
  state.agents.push(adminAgent);
  if (roleBinding) state.userRoles.push(roleBinding);
  return { tenant, org, team, adminAgent, roleBinding };
};

export const updateTenantAdminAgents = ({ state, tenantId, adminEmail }) => {
  ensureTenantArrays(state);
  const now = new Date().toISOString();
  const admins = state.agents.filter(
    (row) => Number(row.tenantId || 0) === Number(tenantId) && String(row.role || '').toLowerCase() === 'manager'
  );
  for (const admin of admins) {
    admin.email = adminEmail;
    admin.account = adminEmail;
    admin.updatedAt = now;
  }
  return admins.length;
};

export const removeTenantById = ({ state, tenantId }) => {
  ensureTenantArrays(state);
  const idx = state.tenants.findIndex((row) => Number(row.id) === Number(tenantId));
  if (idx < 0) return null;
  const [removed] = state.tenants.splice(idx, 1);
  return removed || null;
};
