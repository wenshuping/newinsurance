import { isPlatformTemplate } from '../common/template-visibility.mjs';

function hasRole(state, actor, roleKey) {
  const roleIds = (state.userRoles || [])
    .filter(
      (row) =>
        Number(row.tenantId) === Number(actor.tenantId) &&
        String(row.userType) === String(actor.actorType) &&
        Number(row.userId) === Number(actor.actorId)
    )
    .map((row) => Number(row.roleId));
  return (state.roles || []).some((role) => roleIds.includes(Number(role.id)) && String(role.key) === String(roleKey));
}

function canOperateTenantTemplates(state, actor) {
  const isPlatformAdmin = hasRole(state, actor, 'platform_admin');
  const isCompanyAdmin = hasRole(state, actor, 'company_admin');
  const isTeamLead = hasRole(state, actor, 'team_lead');
  const isAgent = hasRole(state, actor, 'agent');
  const actorType = String(actor?.actorType || '');
  const isCompanyActor = (actorType === 'employee' && (isCompanyAdmin || isTeamLead)) || (actorType === 'agent' && isAgent);
  return { isPlatformAdmin, isCompanyAdmin, isTeamLead, isAgent, isCompanyActor };
}

function ensureTenantTeams(state, tenantId, orgId = 1) {
  if (!Array.isArray(state.teams)) state.teams = [];
  const tid = Number(tenantId || 0);
  if (!Number.isFinite(tid) || tid <= 0) return [];
  const existing = state.teams.filter((row) => Number(row.tenantId || 0) === tid);
  return existing;
}

function isPlatformTemplateFamilyRow(state, row = {}) {
  return Boolean(
    row?.platformTemplate ||
    Number(row?.sourceTemplateId || 0) > 0 ||
    isPlatformTemplate(state, row)
  );
}

function decoratePlatformTemplateRow(state, row = {}) {
  if (!row || typeof row !== 'object') return row;
  if (!isPlatformTemplateFamilyRow(state, row)) return row;
  return {
    ...row,
    isPlatformTemplate: true,
    templateTag: '平台模板',
  };
}

function preferActorTemplateRows(state, actor, rows = []) {
  const list = Array.isArray(rows) ? rows : [];
  const tenantId = Number(actor?.tenantId || 0);
  if (tenantId <= 0) return list;

  const overrideSourceIds = new Set(
    list
      .filter(
        (row) =>
          Number(row?.tenantId || 0) === tenantId &&
          Number(row?.sourceTemplateId || 0) > 0
      )
      .map((row) => Number(row?.sourceTemplateId || 0))
      .filter((id) => Number.isInteger(id) && id > 0)
  );

  return list.filter((row) => {
    if (!isPlatformTemplateFamilyRow(state, row)) return true;
    const sourceTemplateId = Number(row?.sourceTemplateId || 0);
    if (sourceTemplateId > 0) return true;
    return !overrideSourceIds.has(Number(row?.id || 0));
  });
}

const COMPANY_ADMIN_PAGE_MODULES = [
  { group: '租户管理', pages: [{ pageId: 'tenants', pageName: '租户列表' }, { pageId: 'create-tenant', pageName: '创建租户' }, { pageId: 'employees', pageName: '员工管理' }, { pageId: 'customer-pool', pageName: '公共客户池' }] },
  {
    group: '内容与营销',
    pages: [
      { pageId: 'activity', pageName: '活动中心' },
      { pageId: 'learning', pageName: '学习资料' },
      { pageId: 'shop', pageName: '积分商城' },
      { pageId: 'points-rules', pageName: '积分规则' },
    ],
  },
  { group: '策略引擎', pages: [{ pageId: 'tag-list', pageName: '标签列表' }, { pageId: 'tags', pageName: '标签规则库' }, { pageId: 'event-management', pageName: '事件管理' }, { pageId: 'metric-config', pageName: '指标配置' }, { pageId: 'strategy', pageName: '策略引擎' }] },
  { group: '数据统计', pages: [{ pageId: 'stats', pageName: '业绩看板' }] },
  { group: '平台运维', pages: [{ pageId: 'monitor', pageName: '监控大屏' }, { pageId: 'finance', pageName: '财务对账' }, { pageId: 'permissions', pageName: '权限管理' }] },
];

function allCompanyAdminPageIds() {
  return COMPANY_ADMIN_PAGE_MODULES.flatMap((m) => (Array.isArray(m.pages) ? m.pages.map((p) => String(p.pageId || '')) : [])).filter(Boolean);
}

export {
  COMPANY_ADMIN_PAGE_MODULES,
  allCompanyAdminPageIds,
  canOperateTenantTemplates,
  decoratePlatformTemplateRow,
  ensureTenantTeams,
  hasRole,
  preferActorTemplateRows,
};
