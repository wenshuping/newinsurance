import { isVisibleTemplateStatus } from './status-policy.mjs';

export function hasRole(state, { tenantId, userType, userId }, roleKey) {
  const roles = Array.isArray(state?.roles) ? state.roles : [];
  const userRoles = Array.isArray(state?.userRoles) ? state.userRoles : [];
  const roleIds = userRoles
    .filter(
      (row) =>
        Number(row.tenantId) === Number(tenantId) &&
        String(row.userType) === String(userType) &&
        Number(row.userId) === Number(userId)
    )
    .map((row) => Number(row.roleId));
  return roles.some((role) => roleIds.includes(Number(role.id)) && String(role.key) === String(roleKey));
}

function actorIdentity(actor = {}) {
  return {
    tenantId: Number(actor.tenantId || 1),
    userType: String(actor.actorType || 'employee'),
    userId: Number(actor.actorId || 0),
  };
}

function resolveCreatorRole(state, item = {}) {
  const createdBy = Number(item.createdBy || 0);
  if (!createdBy) return 'unknown';
  const explicitRole = String(item.creatorRole || '').trim();
  if (explicitRole) return explicitRole;
  if (String(item.templateScope || '').toLowerCase() === 'platform') return 'platform_admin';
  const tenantId = Number(item.tenantId || 1);
  if (hasRole(state, { tenantId, userType: 'employee', userId: createdBy }, 'platform_admin')) return 'platform_admin';
  if (hasRole(state, { tenantId, userType: 'employee', userId: createdBy }, 'company_admin')) return 'company_admin';
  if (hasRole(state, { tenantId, userType: 'employee', userId: createdBy }, 'team_lead')) return 'team_lead';
  if (hasRole(state, { tenantId, userType: 'agent', userId: createdBy }, 'agent')) return 'agent';
  return 'unknown';
}

function resolveActorRole(state, actor = {}) {
  const identity = actorIdentity(actor);
  if (hasRole(state, identity, 'platform_admin')) return 'platform_admin';
  if (hasRole(state, identity, 'company_admin')) return 'company_admin';
  if (hasRole(state, identity, 'team_lead')) return 'team_lead';
  if (hasRole(state, identity, 'agent')) return 'agent';
  return 'unknown';
}

function resolveCustomerOwnerActor(state, actor = {}) {
  if (String(actor.actorType || '') !== 'customer') return actor;
  const customers = Array.isArray(state?.users) ? state.users : [];
  const customer = customers.find((row) => Number(row.id) === Number(actor.actorId || 0));
  if (!customer) return null;
  const ownerUserId = Number(customer.ownerUserId || 0);
  if (ownerUserId <= 0) return null;
  const agents = Array.isArray(state?.agents) ? state.agents : [];
  const owner = agents.find(
    (row) => Number(row.id) === Number(ownerUserId) && Number(row.tenantId || 1) === Number(customer.tenantId || 1)
  );
  if (!owner) return null;
  const ownerRole = String(owner?.role || '').toLowerCase();
  const ownerActorType = ownerRole === 'manager' || ownerRole === 'support' || ownerRole === 'team_lead' ? 'employee' : 'agent';
  return {
    actorType: ownerActorType,
    actorId: ownerUserId,
    tenantId: Number(customer.tenantId || actor.tenantId || 1),
    orgId: Number(customer.orgId || actor.orgId || 0),
    teamId: Number(customer.teamId || actor.teamId || 0),
  };
}

export function isPlatformTemplate(state, item = {}) {
  const creatorRole = resolveCreatorRole(state, item);
  if (creatorRole === 'platform_admin') return true;
  const createdBy = Number(item.createdBy || 0);
  if (!createdBy) return false;
  return hasRole(state, { tenantId: Number(item.tenantId || 1), userType: 'employee', userId: createdBy }, 'platform_admin');
}

function canInheritBySourceStatus(item = {}) {
  // 硬口径：
  // 只有源模板状态为“有效 / 进行中 / 已发布”时，才允许向下一级下发；
  // 否则一律不下发。下一级收到后统一按“失效”展示，
  // 且“失效”模板不得继续向更下一级和客户端透传。
  const rawStatus = String(item?.status || '').trim();
  if (!rawStatus) return true;
  return isVisibleTemplateStatus(rawStatus);
}

export function canAccessTemplate(state, actor = {}, item = {}) {
  const actorRole = resolveActorRole(state, actor);
  const creatorRole = resolveCreatorRole(state, item);
  const sameTenant = Number(item.tenantId || 1) === Number(actor.tenantId || 1);
  const sameCreator = Number(item.createdBy || 0) === Number(actor.actorId || 0);
  // 层级口径见 docs/template-visibility-cascade-v1.md
  // 硬口径：
  // 只有源模板状态为“有效 / 进行中 / 已发布”时，才允许向下一级下发；
  // 否则一律不下发。下一级收到后统一按“失效”展示，
  // 且“失效”模板不得继续向更下一级和客户端透传。
  // Backward compatibility:
  // old seeded/runtime rows may miss creatorRole/userRoles, yielding "unknown".
  // For same-tenant tenant-scope content, treat unknown as tenant-side templates.
  const tenantSideRoles = ['company_admin', 'team_lead', 'agent', 'unknown'];

  if (actorRole === 'platform_admin') {
    // 平台管理员仅看自己创建的平台模板
    return creatorRole === 'platform_admin' && sameCreator;
  }
  if (actorRole === 'company_admin') {
    // 公司管理员：可看平台模板 + 本租户模板。
    // 其中平台模板属于“上级模板”，展示层应转成失效态。
    if (creatorRole === 'platform_admin') return canInheritBySourceStatus(item);
    return sameTenant && tenantSideRoles.includes(creatorRole);
  }
  if (actorRole === 'team_lead') {
    // 团队主管：可看本租户模板，但不直接看平台模板。
    // 公司管理员创建的模板属于“上级模板”，展示层应转成失效态。
    if (!sameTenant || !tenantSideRoles.includes(creatorRole)) return false;
    if (creatorRole === 'company_admin') return canInheritBySourceStatus(item);
    return true;
  }
  if (actorRole === 'agent') {
    // 业务员：可看本租户模板，但不直接看平台模板。
    // 公司管理员创建的模板属于“上级模板”，展示层应转成失效态。
    if (!sameTenant || !tenantSideRoles.includes(creatorRole)) return false;
    if (creatorRole === 'company_admin' || creatorRole === 'team_lead') return canInheritBySourceStatus(item);
    return sameCreator;
  }
  if (String(actor.actorType || '') === 'customer') {
    // 客户端不是模板管理视图，只允许沿“归属员工 -> 客户”链路查看最终可投放模板。
    // 失效态不会再继续向客户透传。
    const ownerActor = resolveCustomerOwnerActor(state, actor);
    if (!ownerActor) return false;
    return canAccessTemplate(
      state,
      ownerActor,
      item
    );
  }
  return false;
}

export function isInheritedTemplateForActor(state, actor = {}, item = {}) {
  const viewer = resolveCustomerOwnerActor(state, actor);
  if (!viewer) return false;
  const actorRole = resolveActorRole(state, viewer);
  const creatorRole = resolveCreatorRole(state, item);
  const isCustomerActor = String(actor.actorType || '') === 'customer';

  if (actorRole === 'company_admin') return creatorRole === 'platform_admin';
  if (isCustomerActor && actorRole === 'team_lead') return creatorRole === 'company_admin';
  if (isCustomerActor && actorRole === 'agent') return creatorRole === 'company_admin' || creatorRole === 'team_lead';
  return false;
}

export function effectiveTemplateStatusForActor(state, actor = {}, item = {}, options = {}) {
  const inheritedStatus = String(options.inheritedStatus || 'inactive');
  const rawStatus = String(item?.status || '');
  if (!canAccessTemplate(state, actor, item)) return rawStatus;
  if (isInheritedTemplateForActor(state, actor, item)) return inheritedStatus;
  return rawStatus;
}

export function canDeliverTemplateToActor(state, actor = {}, item = {}, options = {}) {
  if (!canAccessTemplate(state, actor, item)) return false;
  const effectiveStatus = effectiveTemplateStatusForActor(state, actor, item, options);
  return isVisibleTemplateStatus(effectiveStatus);
}
