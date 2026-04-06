import {
  toApproveApprovalCommand,
  toCreateApprovalCommand,
  toCreateTenantCommand,
  toDeleteTenantCommand,
  toUpdateEmployeeRolePagesCommand,
  toUpdateCompanyAdminPagesCommand,
  toUpdateTenantCommand,
} from '../dto/write-commands.dto.mjs';
import { executeCreateTenant, executeDeleteTenant, executeUpdateTenant } from '../usecases/p-governance-tenant-write.usecase.mjs';
import { executeApproveApproval, executeCreateApproval } from '../usecases/p-governance-approval-write.usecase.mjs';
import { executeUpdateCompanyAdminPages } from '../usecases/p-governance-company-admin-pages-write.usecase.mjs';
import { executeUpdateEmployeeRolePages } from '../usecases/p-governance-employee-role-pages-write.usecase.mjs';
import { buildEmployeeRolePageResponse } from './employee-role-page-permissions.shared.mjs';

function tenantWriteErrorResponse(res, err) {
  const code = String(err?.code || err?.message || '');
  if (code === 'TENANT_NOT_FOUND') return res.status(404).json({ code, message: '租户不存在' });
  if (code === 'NO_PERMISSION') return res.status(403).json({ code, message: '暂无权限，请联系管理员' });
  if (code === 'TENANT_PROTECTED') return res.status(409).json({ code, message: '公共池租户是系统租户，不支持修改或删除' });
  if (code === 'TENANT_NAME_REQUIRED') return res.status(400).json({ code, message: '租户名称不能为空' });
  if (code === 'ADMIN_EMAIL_REQUIRED') return res.status(400).json({ code, message: '管理员邮箱不能为空' });
  if (code === 'ADMIN_EMAIL_INVALID') return res.status(400).json({ code, message: '管理员邮箱格式错误' });
  if (code === 'ADMIN_PASSWORD_INVALID') return res.status(400).json({ code, message: '初始密码至少6位' });
  if (code === 'ADMIN_EMAIL_CONFLICT') return res.status(409).json({ code, message: '管理员邮箱已存在' });
  return res.status(400).json({ code: code || 'TENANT_WRITE_FAILED', message: '租户写入失败' });
}

function approvalWriteErrorResponse(res, err) {
  const code = String(err?.code || err?.message || '');
  if (code === 'APPROVAL_NOT_FOUND') return res.status(404).json({ code, message: '审批单不存在' });
  return res.status(400).json({ code: code || 'APPROVAL_WRITE_FAILED', message: '审批写入失败' });
}

function companyAdminPagesWriteErrorResponse(res, err) {
  const code = String(err?.code || err?.message || '');
  if (code === 'TENANT_CONTEXT_REQUIRED') return res.status(400).json({ code, message: '缺少租户上下文' });
  if (code === 'NO_PERMISSION') return res.status(403).json({ code, message: '仅可修改本租户权限配置' });
  if (code === 'PERMISSION_GRANTS_REQUIRED') return res.status(400).json({ code, message: '请至少提交一条页面权限' });
  return res.status(400).json({ code: code || 'PERMISSION_WRITE_FAILED', message: '权限配置写入失败' });
}

function employeeRolePagesWriteErrorResponse(res, err) {
  const code = String(err?.code || err?.message || '');
  if (code === 'TENANT_CONTEXT_REQUIRED') return res.status(400).json({ code, message: '缺少租户上下文' });
  if (code === 'NO_PERMISSION') return res.status(403).json({ code, message: '仅可修改本租户权限配置' });
  if (code === 'ROLE_NOT_CONFIGURABLE') return res.status(400).json({ code, message: '当前角色仅支持查看，不支持编辑' });
  if (code === 'PERMISSION_GRANTS_REQUIRED') return res.status(400).json({ code, message: '请至少保留一个可见页面' });
  return res.status(400).json({ code: code || 'EMPLOYEE_ROLE_PERMISSION_WRITE_FAILED', message: '角色页面权限写入失败' });
}

function governancePermissionWriteRequired(getState, hasRole) {
  return (req, res, next) => {
    const state = getState();
    const isPlatformAdmin = hasRole(state, req.actor, 'platform_admin');
    const isCompanyAdmin = String(req.actor?.actorType || '') === 'employee' && hasRole(state, req.actor, 'company_admin');
    if (!isPlatformAdmin && !isCompanyAdmin) {
      return res.status(403).json({ code: 'NO_PERMISSION', message: '暂无权限，请联系管理员' });
    }
    return next();
  };
}

export function registerPAdminGovernanceRoutes(app, deps) {
  const {
    tenantContext,
    permissionRequired,
    getState,
    nextId,
    persistState,
    appendAuditLog,
    hasRole,
    COMPANY_ADMIN_PAGE_MODULES,
    allCompanyAdminPageIds,
    configurableEmployeeRoleKeys,
    normalizeEmployeeRoleKey,
  } = deps;
  const governanceWriteRequired = governancePermissionWriteRequired(getState, hasRole);
  const governanceActorViewRoleKeys = new Set(['company_admin', ...configurableEmployeeRoleKeys]);

  app.get('/api/p/tenants', tenantContext, permissionRequired('tenant:read'), (req, res) => {
    const state = getState();
    const list = (state.tenants || []).filter((row) => Number(row.id) === Number(req.tenantContext.tenantId) || req.actor.actorId === 9001);
    res.json({ list });
  });

  app.post('/api/p/tenants', tenantContext, permissionRequired('tenant:write'), (req, res) => {
    const command = toCreateTenantCommand({ body: req.body, actor: req.actor, tenantContext: req.tenantContext, deps });
    executeCreateTenant(command)
      .then((payload) => res.json(payload))
      .catch((err) => tenantWriteErrorResponse(res, err));
  });

  app.put('/api/p/tenants/:id', tenantContext, permissionRequired('tenant:write'), (req, res) => {
    const command = toUpdateTenantCommand({ params: req.params, body: req.body, actor: req.actor, tenantContext: req.tenantContext, deps });
    executeUpdateTenant(command)
      .then((payload) => res.json(payload))
      .catch((err) => tenantWriteErrorResponse(res, err));
  });

  app.delete('/api/p/tenants/:id', tenantContext, permissionRequired('tenant:write'), (req, res) => {
    const command = toDeleteTenantCommand({ params: req.params, actor: req.actor, tenantContext: req.tenantContext, deps });
    executeDeleteTenant(command)
      .then((payload) => res.json(payload))
      .catch((err) => tenantWriteErrorResponse(res, err));
  });

  app.get('/api/p/permissions/matrix', tenantContext, permissionRequired('tenant:read'), (_req, res) => {
    const state = getState();
    res.json({
      roles: state.roles || [],
      permissions: state.permissions || [],
      rolePermissions: state.rolePermissions || [],
      userRoles: state.userRoles || [],
    });
  });

  app.get('/api/p/permissions/company-admin-pages', tenantContext, permissionRequired('tenant:read'), (req, res) => {
    const state = getState();
    const contextTenantId = Number(req.tenantContext?.tenantId || 0);
    if (!Number.isFinite(contextTenantId) || contextTenantId <= 0) {
      return res.status(400).json({ code: 'TENANT_CONTEXT_REQUIRED', message: '缺少租户上下文' });
    }
    const isPlatformAdmin = hasRole(state, req.actor, 'platform_admin');
    const requestedTenantId = Number(req.query?.tenantId || 0);
    const tenantId = isPlatformAdmin && Number.isFinite(requestedTenantId) && requestedTenantId > 0 ? requestedTenantId : contextTenantId;
    if (!isPlatformAdmin && requestedTenantId > 0 && requestedTenantId !== contextTenantId) {
      return res.status(403).json({ code: 'NO_PERMISSION', message: '仅可查看本租户权限配置' });
    }
    const rows = (state.companyAdminPagePermissions || []).filter(
      (row) => Number(row.tenantId || 1) === tenantId && String(row.roleKey || 'company_admin') === 'company_admin'
    );
    const enabledByPageId = new Map(rows.map((row) => [String(row.pageId || ''), Boolean(row.enabled)]));
    const modules = COMPANY_ADMIN_PAGE_MODULES.map((module) => ({
      group: String(module.group || ''),
      pages: (module.pages || []).map((page) => ({
        pageId: String(page.pageId || ''),
        pageName: String(page.pageName || ''),
        enabled:
          enabledByPageId.has(String(page.pageId || ''))
            ? Boolean(enabledByPageId.get(String(page.pageId || '')))
            : String(page.pageId || '') === 'points-rules',
      })),
    }));
    return res.json({
      tenantId,
      roleKey: 'company_admin',
      modules,
      grants: modules.flatMap((m) => m.pages),
    });
  });

  app.post('/api/p/permissions/company-admin-pages', tenantContext, governanceWriteRequired, (req, res) => {
    const command = toUpdateCompanyAdminPagesCommand({ body: req.body, actor: req.actor, tenantContext: req.tenantContext, deps });
    executeUpdateCompanyAdminPages(command)
      .then((payload) => res.json(payload))
      .catch((err) => companyAdminPagesWriteErrorResponse(res, err));
  });

  app.get('/api/p/permissions/employee-role-pages', tenantContext, (req, res) => {
    const state = getState();
    const contextTenantId = Number(req.tenantContext?.tenantId || 0);
    if (!Number.isFinite(contextTenantId) || contextTenantId <= 0) {
      return res.status(400).json({ code: 'TENANT_CONTEXT_REQUIRED', message: '缺少租户上下文' });
    }
    const isPlatformAdmin = hasRole(state, req.actor, 'platform_admin');
    const isCompanyAdmin = String(req.actor?.actorType || '') === 'employee' && hasRole(state, req.actor, 'company_admin');
    const actorRoleKey = normalizeEmployeeRoleKey(req.user?.role || '');
    const requestedTenantId = Number(req.query?.tenantId || 0);
    const tenantId = isPlatformAdmin && Number.isFinite(requestedTenantId) && requestedTenantId > 0 ? requestedTenantId : contextTenantId;
    if (!isPlatformAdmin && requestedTenantId > 0 && requestedTenantId !== contextTenantId) {
      return res.status(403).json({ code: 'NO_PERMISSION', message: '仅可查看本租户权限配置' });
    }
    const requestedRoleKey = normalizeEmployeeRoleKey(req.query?.roleKey || actorRoleKey || 'company_admin');
    const roleKey = requestedRoleKey || actorRoleKey || 'company_admin';
    if (roleKey !== 'company_admin' && !configurableEmployeeRoleKeys.includes(roleKey)) {
      return res.status(400).json({ code: 'ROLE_NOT_SUPPORTED', message: '当前角色暂不支持页面权限配置' });
    }
    if (!isPlatformAdmin && !isCompanyAdmin) {
      if (!governanceActorViewRoleKeys.has(actorRoleKey) || actorRoleKey !== roleKey) {
        return res.status(403).json({ code: 'NO_PERMISSION', message: '仅可查看当前角色的页面权限' });
      }
    }
    return res.json(buildEmployeeRolePageResponse(state, tenantId, roleKey));
  });

  app.post('/api/p/permissions/employee-role-pages', tenantContext, governanceWriteRequired, (req, res) => {
    const command = toUpdateEmployeeRolePagesCommand({ body: req.body, actor: req.actor, tenantContext: req.tenantContext, deps });
    executeUpdateEmployeeRolePages(command)
      .then((payload) => res.json(payload))
      .catch((err) => employeeRolePagesWriteErrorResponse(res, err));
  });

  app.post('/api/p/approvals', tenantContext, permissionRequired('approval:write'), (req, res) => {
    const command = toCreateApprovalCommand({ body: req.body, actor: req.actor, tenantContext: req.tenantContext, deps });
    executeCreateApproval(command)
      .then((payload) => res.json(payload))
      .catch((err) => approvalWriteErrorResponse(res, err));
  });

  app.post('/api/p/approvals/:id/approve', tenantContext, permissionRequired('approval:write'), (req, res) => {
    const command = toApproveApprovalCommand({ params: req.params, actor: req.actor, tenantContext: req.tenantContext, deps });
    executeApproveApproval(command)
      .then((payload) => res.json(payload))
      .catch((err) => approvalWriteErrorResponse(res, err));
  });
}
