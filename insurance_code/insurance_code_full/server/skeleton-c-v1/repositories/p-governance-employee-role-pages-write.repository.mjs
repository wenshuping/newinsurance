const ensureRows = (state) => {
  if (!Array.isArray(state.employeeRolePagePermissions)) state.employeeRolePagePermissions = [];
};

export const replaceEmployeeRolePagePermissions = ({ state, tenantId, roleKey, grants, nextId, now }) => {
  ensureRows(state);
  state.employeeRolePagePermissions = state.employeeRolePagePermissions.filter(
    (row) => !(Number(row.tenantId || 1) === Number(tenantId) && String(row.roleKey || '') === String(roleKey || ''))
  );
  for (const row of grants) {
    state.employeeRolePagePermissions.push({
      id: nextId(state.employeeRolePagePermissions),
      tenantId: Number(tenantId),
      roleKey: String(roleKey || ''),
      pageId: String(row.pageId || ''),
      enabled: Boolean(row.enabled),
      dataPermissionPreset: 'reserved',
      updatedAt: now,
    });
  }
  return grants.length;
};
