import { buildEmployeeRolePageResponse, normalizeEmployeeRoleKey } from './employee-role-page-permissions.shared.mjs';

export function registerBAdminPermissionRoutes(app, deps) {
  const { getState, tenantContext } = deps;

  app.get('/api/b/permissions/page-views', tenantContext, (req, res) => {
    const state = getState();
    const tenantId = Number(req.tenantContext?.tenantId || req.user?.tenantId || 0);
    if (!Number.isFinite(tenantId) || tenantId <= 0) {
      return res.status(400).json({ code: 'TENANT_CONTEXT_REQUIRED', message: '缺少租户上下文' });
    }

    const roleKey = normalizeEmployeeRoleKey(req.user?.role || 'agent') || 'agent';
    const payload = buildEmployeeRolePageResponse(state, tenantId, roleKey);
    return res.json({
      tenantId,
      roleKey,
      allowedViews: (payload.grants || []).filter((row) => Boolean(row.enabled)).map((row) => String(row.pageId || '')),
      modules: payload.modules || [],
      grants: payload.grants || [],
      dataPermission: payload.dataPermission,
    });
  });
}
