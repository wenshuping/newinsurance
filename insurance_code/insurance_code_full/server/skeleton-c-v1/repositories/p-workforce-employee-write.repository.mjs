const ensureArrays = (state) => {
  if (!Array.isArray(state.agents)) state.agents = [];
  if (!Array.isArray(state.userRoles)) state.userRoles = [];
};

export const findTenantEmployeeById = ({ state, tenantId, employeeId }) => {
  ensureArrays(state);
  return (
    state.agents.find(
      (row) => Number(row.id) === Number(employeeId) && Number(row.tenantId || 0) === Number(tenantId)
    ) || null
  );
};

export const findTenantEmployeeByEmailOrMobile = ({ state, tenantId, email, mobile, excludeEmployeeId = 0 }) => {
  ensureArrays(state);
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedMobile = String(mobile || '').trim();
  return (
    state.agents.find((row) => {
      if (Number(row.tenantId || 0) !== Number(tenantId)) return false;
      if (Number(row.id || 0) === Number(excludeEmployeeId || 0)) return false;
      const emailHit = normalizedEmail && String(row.email || '').toLowerCase() === normalizedEmail;
      const mobileHit = normalizedMobile && String(row.mobile || '') === normalizedMobile;
      return emailHit || mobileHit;
    }) || null
  );
};

export const insertEmployee = ({ state, employee }) => {
  ensureArrays(state);
  state.agents.push(employee);
  return employee;
};

export const deleteTenantEmployeeById = ({ state, tenantId, employeeId }) => {
  ensureArrays(state);
  const idx = state.agents.findIndex(
    (row) => Number(row.id) === Number(employeeId) && Number(row.tenantId || 0) === Number(tenantId)
  );
  if (idx < 0) return false;
  state.agents.splice(idx, 1);
  return true;
};

export const replaceEmployeeRoleBinding = ({ state, tenantId, employeeId, roleId, userType, nextId }) => {
  ensureArrays(state);
  state.userRoles = state.userRoles.filter(
    (row) =>
      !(
        Number(row.tenantId || 0) === Number(tenantId) &&
        Number(row.userId || 0) === Number(employeeId) &&
        (String(row.userType) === 'employee' || String(row.userType) === 'agent')
      )
  );
  if (!roleId) return null;
  const binding = {
    id: nextId(state.userRoles),
    tenantId: Number(tenantId),
    userType: String(userType || 'employee'),
    userId: Number(employeeId),
    roleId: Number(roleId),
  };
  state.userRoles.push(binding);
  return binding;
};

export const removeEmployeeRoleBindings = ({ state, tenantId, employeeId }) => {
  ensureArrays(state);
  state.userRoles = state.userRoles.filter(
    (row) => !(Number(row.tenantId || 0) === Number(tenantId) && Number(row.userId || 0) === Number(employeeId))
  );
};
