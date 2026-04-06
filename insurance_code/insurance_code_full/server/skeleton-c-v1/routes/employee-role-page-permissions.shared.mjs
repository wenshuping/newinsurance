import { COMPANY_ADMIN_PAGE_MODULES } from './p-admin.shared.mjs';

const EMPLOYEE_ROLE_PAGE_MODULES = COMPANY_ADMIN_PAGE_MODULES;

const CONFIGURABLE_EMPLOYEE_ROLE_KEYS = ['agent', 'team_lead'];

function normalizeEmployeeRoleKey(value) {
  const roleKey = String(value || '').trim().toLowerCase();
  if (roleKey === 'support') return 'team_lead';
  if (roleKey === 'salesperson') return 'agent';
  if (roleKey === 'manager') return 'company_admin';
  return roleKey;
}

function allEmployeeRolePageIds() {
  return EMPLOYEE_ROLE_PAGE_MODULES.flatMap((module) =>
    Array.isArray(module.pages) ? module.pages.map((page) => String(page.pageId || '')) : []
  ).filter(Boolean);
}

function defaultCompanyAdminVisiblePageIds() {
  return allEmployeeRolePageIds().filter((pageId) => pageId === 'points-rules');
}

function resolveCompanyAdminVisiblePageIds(state, tenantId) {
  const rows = Array.isArray(state?.companyAdminPagePermissions)
    ? state.companyAdminPagePermissions.filter(
        (row) => Number(row?.tenantId || 1) === Number(tenantId || 1) && String(row?.roleKey || 'company_admin') === 'company_admin'
      )
    : [];
  if (!rows.length) return defaultCompanyAdminVisiblePageIds();
  return rows.filter((row) => Boolean(row?.enabled)).map((row) => String(row?.pageId || '')).filter(Boolean);
}

function buildEmployeeRolePageModules(state, tenantId, enabledByPageId = new Map()) {
  const visiblePageIds = new Set(resolveCompanyAdminVisiblePageIds(state, tenantId));
  return EMPLOYEE_ROLE_PAGE_MODULES.map((module) => ({
    group: String(module.group || ''),
    pages: (module.pages || [])
      .filter((page) => visiblePageIds.has(String(page.pageId || '')))
      .map((page) => ({
        pageId: String(page.pageId || ''),
        pageName: String(page.pageName || ''),
        enabled:
          enabledByPageId.has(String(page.pageId || ''))
            ? Boolean(enabledByPageId.get(String(page.pageId || '')))
            : String(page.pageId || '') === 'points-rules'
              ? true
              : true,
      })),
  })).filter((module) => module.pages.length > 0);
}

function resolveEmployeeRolePageIdsForTenant(state, tenantId) {
  return buildEmployeeRolePageModules(state, tenantId, new Map())
    .flatMap((module) => module.pages.map((page) => String(page.pageId || '')))
    .filter(Boolean);
}

function defaultEmployeeRolePageGrants(state, tenantId, roleKey) {
  const normalizedRoleKey = normalizeEmployeeRoleKey(roleKey);
  if (normalizedRoleKey === 'company_admin') {
    return resolveEmployeeRolePageIdsForTenant(state, tenantId).map((pageId) => ({ pageId, enabled: true }));
  }
  if (!CONFIGURABLE_EMPLOYEE_ROLE_KEYS.includes(normalizedRoleKey)) return [];
  return resolveEmployeeRolePageIdsForTenant(state, tenantId).map((pageId) => ({ pageId, enabled: true }));
}

function resolveEmployeeRolePageGrants(state, tenantId, roleKey) {
  const normalizedRoleKey = normalizeEmployeeRoleKey(roleKey);
  const validPageIds = new Set(resolveEmployeeRolePageIdsForTenant(state, tenantId));
  const rows = Array.isArray(state?.employeeRolePagePermissions)
    ? state.employeeRolePagePermissions.filter(
        (row) =>
          Number(row?.tenantId || 1) === Number(tenantId || 1) &&
          normalizeEmployeeRoleKey(row?.roleKey) === normalizedRoleKey &&
          validPageIds.has(String(row?.pageId || ''))
      )
    : [];

  if (!rows.length) return defaultEmployeeRolePageGrants(state, tenantId, normalizedRoleKey);
  return rows.map((row) => ({
    pageId: String(row.pageId || ''),
    enabled: Boolean(row.enabled),
    dataPermissionPreset: String(row.dataPermissionPreset || 'reserved'),
  }));
}

function buildEmployeeRolePageResponse(state, tenantId, roleKey) {
  const normalizedRoleKey = normalizeEmployeeRoleKey(roleKey);
  const grants = resolveEmployeeRolePageGrants(state, tenantId, normalizedRoleKey);
  const enabledByPageId = new Map(grants.map((row) => [String(row.pageId || ''), Boolean(row.enabled)]));
  return {
    tenantId: Number(tenantId || 1),
    roleKey: normalizedRoleKey,
    editable: CONFIGURABLE_EMPLOYEE_ROLE_KEYS.includes(normalizedRoleKey),
    modules: buildEmployeeRolePageModules(state, tenantId, enabledByPageId),
    grants: grants.map((row) => ({
      pageId: String(row.pageId || ''),
      enabled: Boolean(row.enabled),
    })),
    dataPermission: { supported: false, status: 'reserved' },
  };
}

export {
  CONFIGURABLE_EMPLOYEE_ROLE_KEYS,
  EMPLOYEE_ROLE_PAGE_MODULES,
  allEmployeeRolePageIds,
  buildEmployeeRolePageModules,
  buildEmployeeRolePageResponse,
  defaultEmployeeRolePageGrants,
  normalizeEmployeeRoleKey,
  resolveCompanyAdminVisiblePageIds,
  resolveEmployeeRolePageIdsForTenant,
  resolveEmployeeRolePageGrants,
};
