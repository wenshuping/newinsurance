import { assertPlatformOrCompanyAdmin, resolveCompanyAdminTenantContext, toHttpError } from '../services/workforce.service.mjs';
import {
  toCreatePEmployeeCommand,
  toCreatePTeamCommand,
  toDeletePEmployeeCommand,
  toDeletePTeamCommand,
  toUpdatePEmployeeCommand,
  toUpdatePTeamCommand,
} from '../dto/write-commands.dto.mjs';
import { executeCreateTeam, executeDeleteTeam, executeUpdateTeam } from '../usecases/p-workforce-team-write.usecase.mjs';
import { executeCreateEmployee, executeDeleteEmployee, executeUpdateEmployee } from '../usecases/p-workforce-employee-write.usecase.mjs';

function teamErrorResponse(res, err) {
  const code = String(err?.code || err?.message || '');
  if (code === 'COMPANY_ACCOUNT_REQUIRED') return res.status(403).json({ code, message: '仅公司账号可管理本租户团队' });
  if (code === 'TENANT_CONTEXT_REQUIRED') return res.status(400).json({ code, message: '缺少租户上下文' });
  if (code === 'TEAM_NAME_REQUIRED') return res.status(400).json({ code, message: '团队名称不能为空' });
  if (code === 'TEAM_NAME_EXISTS') return res.status(409).json({ code, message: '团队名称已存在' });
  if (code === 'TEAM_ID_REQUIRED') return res.status(400).json({ code, message: '团队ID不能为空' });
  if (code === 'TEAM_NOT_FOUND') return res.status(404).json({ code, message: '团队不存在' });
  if (code === 'TEAM_HAS_MEMBERS') return res.status(409).json({ code, message: '团队下存在员工，无法删除' });
  const e = toHttpError(err);
  return res.status(e.status).json({ code: e.code, message: e.message });
}

function employeeErrorResponse(res, err) {
  const code = String(err?.code || err?.message || '');
  if (code === 'COMPANY_ACCOUNT_REQUIRED') return res.status(403).json({ code, message: '仅公司账号可管理本租户员工' });
  if (code === 'TENANT_CONTEXT_REQUIRED') return res.status(400).json({ code, message: '缺少租户上下文' });
  if (code === 'EMPLOYEE_NOT_FOUND') return res.status(404).json({ code, message: '员工不存在' });
  if (code === 'EMPLOYEE_NAME_REQUIRED') return res.status(400).json({ code, message: '员工姓名不能为空' });
  if (code === 'EMPLOYEE_EMAIL_REQUIRED') return res.status(400).json({ code, message: '员工邮箱不能为空' });
  if (code === 'EMPLOYEE_MOBILE_REQUIRED') return res.status(400).json({ code, message: '员工手机号不能为空' });
  if (code === 'EMPLOYEE_MOBILE_INVALID') return res.status(400).json({ code, message: '手机号格式错误，请输入11位手机号' });
  if (code === 'EMPLOYEE_TEAM_INVALID') return res.status(400).json({ code, message: '团队ID必须是大于0的数字' });
  if (code === 'EMPLOYEE_TEAM_NOT_FOUND') return res.status(400).json({ code, message: '请选择有效团队' });
  if (code === 'EMPLOYEE_PARAMS_INVALID') return res.status(400).json({ code, message: '员工姓名、邮箱、手机号不能为空' });
  if (code === 'EMPLOYEE_ACCOUNT_CONFLICT') return res.status(409).json({ code, message: '邮箱或手机号已存在' });
  const e = toHttpError(err);
  return res.status(e.status).json({ code: e.code, message: e.message });
}

function customerAssignErrorResponse(res, err) {
  const code = String(err?.code || err?.message || '');
  if (code === 'AGENT_SCOPE_INVALID') {
    return res.status(400).json({ code, message: '员工租户组织信息不完整，无法分配客户' });
  }
  if (code === 'CUSTOMER_NOT_FOUND') {
    return res.status(404).json({ code, message: '客户不存在，请先让客户在C端注册/登录' });
  }
  const e = toHttpError(err);
  return res.status(e.status).json({ code: e.code, message: e.message });
}

export function toPAdminCustomerListItem(row, owner, tenant = null) {
  const ownerUserId = Number(row?.ownerUserId || 0);
  const referrerCustomerId = Number(row?.referrerCustomerId || 0);
  const referrerShareCode = String(row?.referrerShareCode || '').trim();
  const acquisitionSource = referrerCustomerId > 0 || referrerShareCode ? 'shared' : 'direct';
  const poolStatus = ownerUserId > 0 ? 'assigned' : 'unassigned';
  const tenantId = Number(row?.tenantId || 0);
  return {
    id: Number(row?.id || 0),
    name: String(row?.name || ''),
    mobile: String(row?.mobile || ''),
    tenantId,
    tenantName: tenant ? String(tenant.name || '') : '',
    ownerUserId,
    ownerName: owner ? String(owner.name || owner.email || owner.account || '') : '',
    orgId: Number(row?.orgId || 1),
    teamId: Number(row?.teamId || 1),
    referrerCustomerId,
    referrerShareCode,
    referredAt: row?.referredAt || null,
    acquisitionSource,
    poolStatus,
  };
}

export function listVisiblePAdminEmployees({ state, tenantId, orgId, ensureTenantTeams, includeAllTenants = false }) {
  const tenantMap = new Map((state.tenants || []).map((row) => [Number(row.id), String(row.name || `租户${row.id}`)]));
  const visibleEmployees = (state.agents || []).filter((row) =>
    includeAllTenants ? true : Number(row.tenantId || 0) === Number(tenantId || 0),
  );
  const visibleTenantIds = new Set(
    visibleEmployees.map((row) => Number(row.tenantId || 0)).filter((rowTenantId) => rowTenantId > 0),
  );
  const teams = includeAllTenants
    ? (state.teams || []).filter((row) => visibleTenantIds.has(Number(row.tenantId || 0)))
    : ensureTenantTeams(state, tenantId, orgId);
  const teamMap = new Map(
    teams.map((row) => [`${Number(row.tenantId || 0)}:${Number(row.id || 0)}`, String(row.name || '')]),
  );

  return visibleEmployees
    .map((row) => ({
      ...row,
      tenantName: tenantMap.get(Number(row.tenantId || 0)) || '',
      teamName:
        teamMap.get(`${Number(row.tenantId || 0)}:${Number(row.teamId || 0)}`) ||
        `团队 ${Number(row.teamId || 0)}`,
      password: undefined,
    }))
    .sort((a, b) => Number(a.tenantId || 0) - Number(b.tenantId || 0) || Number(a.id || 0) - Number(b.id || 0));
}

export function registerPAdminWorkforceRoutes(app, deps) {
  const {
    tenantContext,
    permissionRequired,
    requireActionConfirmation,
    getState,
    hasRole,
    ensureTenantTeams,
    assignCustomerByMobile,
    systemAssignCustomers,
  } = deps;

  app.get('/api/p/employees', tenantContext, permissionRequired('customer:read'), (req, res) => {
    const state = getState();
    const scope = String(req.query?.scope || 'manage').trim().toLowerCase() === 'assignable' ? 'assignable' : 'manage';
    let isPlatformAdmin = false;
    let tenantId = 0;
    let orgId = 0;
    try {
      ({ isPlatformAdmin } = assertPlatformOrCompanyAdmin({
        state,
        actor: req.actor,
        hasRole,
        actionMessage: '仅平台管理员或公司账号可查看员工列表',
      }));
      if (!isPlatformAdmin) {
        ({ tenantId, orgId } = resolveCompanyAdminTenantContext({
          state,
          actor: req.actor,
          hasRole,
          tenantContext: req.tenantContext,
          scopeName: '本租户员工',
        }));
      }
    } catch (err) {
      const e = toHttpError(err);
      return res.status(e.status).json({ code: e.code, message: e.message });
    }

    if (isPlatformAdmin) {
      tenantId = Number(req.tenantContext?.tenantId || req.actor?.tenantId || 0);
      orgId = Number(req.tenantContext?.orgId || 0);
    }
    const list = listVisiblePAdminEmployees({
      state,
      tenantId,
      orgId,
      ensureTenantTeams,
      includeAllTenants: isPlatformAdmin && scope === 'assignable',
    });
    res.json({ list });
  });

  app.get('/api/p/teams', tenantContext, permissionRequired('customer:read'), (req, res) => {
    const state = getState();
    let tenantId = 0;
    let orgId = 0;
    try {
      ({ tenantId, orgId } = resolveCompanyAdminTenantContext({
        state,
        actor: req.actor,
        hasRole,
        tenantContext: req.tenantContext,
        scopeName: '本租户团队',
      }));
    } catch (err) {
      const e = toHttpError(err);
      return res.status(e.status).json({ code: e.code, message: e.message });
    }
    const list = ensureTenantTeams(state, tenantId, orgId)
      .map((row) => ({
        id: Number(row.id),
        tenantId,
        orgId: Number(row.orgId || 0),
        name: String(row.name || ''),
        createdAt: row.createdAt || new Date().toISOString(),
      }))
      .sort((a, b) => Number(a.id) - Number(b.id));
    res.json({ list });
  });

  app.post('/api/p/teams', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toCreatePTeamCommand({ body: req.body, actor: req.actor, tenantContext: req.tenantContext, deps });
    executeCreateTeam(command)
      .then((payload) => res.json(payload))
      .catch((err) => teamErrorResponse(res, err));
  });

  app.put('/api/p/teams/:id', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toUpdatePTeamCommand({ params: req.params, body: req.body, actor: req.actor, tenantContext: req.tenantContext, deps });
    executeUpdateTeam(command)
      .then((payload) => res.json(payload))
      .catch((err) => teamErrorResponse(res, err));
  });

  app.delete('/api/p/teams/:id', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toDeletePTeamCommand({ params: req.params, actor: req.actor, tenantContext: req.tenantContext, deps });
    executeDeleteTeam(command)
      .then((payload) => res.json(payload))
      .catch((err) => teamErrorResponse(res, err));
  });

  app.get('/api/p/customers', tenantContext, permissionRequired('customer:read'), (req, res) => {
    const state = getState();
    const tenantMap = new Map((state.tenants || []).map((row) => [Number(row.id), row]));
    let isPlatformAdmin = false;
    try {
      ({ isPlatformAdmin } = assertPlatformOrCompanyAdmin({
        state,
        actor: req.actor,
        hasRole,
        actionMessage: '仅平台管理员或公司账号可查看客户分配',
      }));
    } catch (err) {
      const e = toHttpError(err);
      return res.status(e.status).json({ code: e.code, message: e.message });
    }

    const tenantId = Number(req.tenantContext.tenantId);
    const visibleAgents = (state.agents || []).filter((row) => (isPlatformAdmin ? true : Number(row.tenantId) === tenantId));
    const agentMap = new Map(visibleAgents.map((row) => [Number(row.id), row]));
    const list = (state.users || [])
      .filter((row) => (isPlatformAdmin ? true : Number(row.tenantId || 0) === tenantId))
      .map((row) =>
        toPAdminCustomerListItem(
          row,
          agentMap.get(Number(row.ownerUserId || 0)),
          tenantMap.get(Number(row.tenantId || 0)) || null,
        ),
      )
      .sort((a, b) => {
        if (a.poolStatus !== b.poolStatus) return a.poolStatus === 'unassigned' ? -1 : 1;
        return Number(b.id || 0) - Number(a.id || 0);
      });
    res.json({ list });
  });

  app.post('/api/p/customers/system-assign', tenantContext, permissionRequired('customer:write'), requireActionConfirmation('客户系统分配'), (req, res) => {
    const state = getState();
    try {
      assertPlatformOrCompanyAdmin({
        state,
        actor: req.actor,
        hasRole,
        actionMessage: '仅平台管理员或公司账号可执行系统分配',
      });
    } catch (err) {
      const e = toHttpError(err);
      return res.status(e.status).json({ code: e.code, message: e.message });
    }

    const tenantId = Number(req.tenantContext.tenantId);
    const agentId = Number(req.body?.agentId || 0);
    const customerIds = Array.isArray(req.body?.customerIds)
      ? req.body.customerIds.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0)
      : [];
    if (!agentId) return res.status(400).json({ code: 'AGENT_REQUIRED', message: 'agentId 不能为空' });
    if (!customerIds.length) {
      return res.status(400).json({ code: 'CUSTOMER_IDS_REQUIRED', message: 'customerIds 不能为空，禁止默认全量分配' });
    }

    const agent = (state.agents || []).find((row) => Number(row.id) === agentId && Number(row.tenantId || 1) === tenantId);
    if (!agent) return res.status(404).json({ code: 'AGENT_NOT_FOUND', message: '员工不存在或不在当前租户' });

    const allCustomers = (state.users || []).filter((row) => Number(row.tenantId || 1) === tenantId);
    const selected = allCustomers.filter((row) => customerIds.includes(Number(row.id)));

    return systemAssignCustomers({
      state,
      tenantId,
      actor: req.actor,
      agent,
      customers: selected,
    })
      .then((payload) => res.json(payload))
      .catch((err) => customerAssignErrorResponse(res, err));
  });

  app.post('/api/p/customers/assign-by-mobile', tenantContext, permissionRequired('customer:write'), requireActionConfirmation('客户归属绑定'), (req, res) => {
    const state = getState();
    try {
      assertPlatformOrCompanyAdmin({
        state,
        actor: req.actor,
        hasRole,
        actionMessage: '仅平台管理员或公司账号可执行客户绑定',
      });
    } catch (err) {
      const e = toHttpError(err);
      return res.status(e.status).json({ code: e.code, message: e.message });
    }

    const mobile = String(req.body?.mobile || '').trim();
    const agentId = Number(req.body?.agentId || 0);
    if (!/^1\d{10}$/.test(mobile)) {
      return res.status(400).json({ code: 'CUSTOMER_MOBILE_INVALID', message: '客户手机号格式错误' });
    }
    if (!agentId) {
      return res.status(400).json({ code: 'AGENT_REQUIRED', message: 'agentId 不能为空' });
    }

    const agent = (state.agents || []).find((row) => Number(row.id) === agentId);
    if (!agent) return res.status(404).json({ code: 'AGENT_NOT_FOUND', message: '员工不存在' });

    return assignCustomerByMobile({
      state,
      actor: req.actor,
      mobile,
      agent,
    })
      .then((payload) => res.json(payload))
      .catch((err) => customerAssignErrorResponse(res, err));
  });

  app.post('/api/p/employees', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toCreatePEmployeeCommand({ body: req.body, actor: req.actor, tenantContext: req.tenantContext, deps });
    executeCreateEmployee(command)
      .then((payload) => res.json(payload))
      .catch((err) => employeeErrorResponse(res, err));
  });

  app.put('/api/p/employees/:id', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toUpdatePEmployeeCommand({ params: req.params, body: req.body, actor: req.actor, tenantContext: req.tenantContext, deps });
    executeUpdateEmployee(command)
      .then((payload) => res.json(payload))
      .catch((err) => employeeErrorResponse(res, err));
  });

  app.delete('/api/p/employees/:id', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toDeletePEmployeeCommand({ params: req.params, actor: req.actor, tenantContext: req.tenantContext, deps });
    executeDeleteEmployee(command)
      .then((payload) => res.json(payload))
      .catch((err) => employeeErrorResponse(res, err));
  });
}
