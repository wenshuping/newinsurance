const ensureRows = (state) => {
  if (!Array.isArray(state.companyAdminPagePermissions)) state.companyAdminPagePermissions = [];
};

export const replaceCompanyAdminPagePermissions = ({ state, tenantId, grants, nextId, now }) => {
  ensureRows(state);
  state.companyAdminPagePermissions = state.companyAdminPagePermissions.filter(
    (row) => !(Number(row.tenantId || 1) === Number(tenantId) && String(row.roleKey || 'company_admin') === 'company_admin')
  );
  for (const row of grants) {
    state.companyAdminPagePermissions.push({
      id: nextId(state.companyAdminPagePermissions),
      tenantId: Number(tenantId),
      roleKey: 'company_admin',
      pageId: String(row.pageId),
      enabled: Boolean(row.enabled),
      updatedAt: now,
    });
  }
  return grants.length;
};
