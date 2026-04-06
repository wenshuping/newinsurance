export const PUBLIC_POOL_TENANT_CODE = 'public-pool';
export const PUBLIC_POOL_TENANT_NAME = '公共池租户';
export const PUBLIC_POOL_ORG_NAME = '公共池默认机构';
export const PUBLIC_POOL_TEAM_NAME = '公共池默认团队';

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function allocateId(list, nextId) {
  if (typeof nextId === 'function') return Number(nextId(list) || 0) || 1;
  const items = ensureArray(list);
  if (!items.length) return 1;
  return Math.max(...items.map((row) => Number(row?.id || 0))) + 1;
}

function normalizeTenantCode(value) {
  return String(value || '').trim().toLowerCase();
}

function toPositiveInt(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function isPublicPoolTenant(target) {
  if (!target || typeof target !== 'object') return false;
  return (
    normalizeTenantCode(target.tenantCode || target.code || target.tenantKey) === PUBLIC_POOL_TENANT_CODE ||
    String(target.name || '').trim() === PUBLIC_POOL_TENANT_NAME
  );
}

export function isDirectUnassignedCustomer(customer) {
  if (!customer || typeof customer !== 'object') return false;
  const ownerUserId = toPositiveInt(customer.ownerUserId);
  const referrerCustomerId = toPositiveInt(customer.referrerCustomerId);
  const referrerShareCode = String(customer.referrerShareCode || '').trim();
  return ownerUserId <= 0 && referrerCustomerId <= 0 && !referrerShareCode;
}

export function ensurePublicPoolTenantState({ state, nextId }) {
  if (!state || typeof state !== 'object') {
    return { changed: false, tenant: null, org: null, team: null };
  }

  if (!Array.isArray(state.tenants)) state.tenants = [];
  if (!Array.isArray(state.orgUnits)) state.orgUnits = [];
  if (!Array.isArray(state.teams)) state.teams = [];
  if (!Array.isArray(state.users)) state.users = [];

  const now = new Date().toISOString();
  let changed = false;

  let tenant = ensureArray(state.tenants).find((row) => isPublicPoolTenant(row)) || null;
  if (!tenant) {
    tenant = {
      id: allocateId(state.tenants, nextId),
      tenantCode: PUBLIC_POOL_TENANT_CODE,
      name: PUBLIC_POOL_TENANT_NAME,
      type: 'company',
      status: 'active',
      adminEmail: null,
      createdBy: 9001,
      createdAt: now,
    };
    state.tenants.push(tenant);
    changed = true;
  } else {
    if (normalizeTenantCode(tenant.tenantCode || tenant.code || tenant.tenantKey) !== PUBLIC_POOL_TENANT_CODE) {
      tenant.tenantCode = PUBLIC_POOL_TENANT_CODE;
      changed = true;
    }
    if (String(tenant.name || '').trim() !== PUBLIC_POOL_TENANT_NAME) {
      tenant.name = PUBLIC_POOL_TENANT_NAME;
      changed = true;
    }
    if (String(tenant.type || '').trim().toLowerCase() !== 'company') {
      tenant.type = 'company';
      changed = true;
    }
    if (String(tenant.status || '').trim().toLowerCase() !== 'active') {
      tenant.status = 'active';
      changed = true;
    }
    if (!tenant.createdAt) {
      tenant.createdAt = now;
      changed = true;
    }
  }

  const tenantId = Number(tenant.id || 0);
  let org =
    ensureArray(state.orgUnits)
      .filter((row) => Number(row?.tenantId || 0) === tenantId)
      .sort((a, b) => Number(a?.id || 0) - Number(b?.id || 0))[0] || null;
  if (!org) {
    org = {
      id: allocateId(state.orgUnits, nextId),
      tenantId,
      name: PUBLIC_POOL_ORG_NAME,
      createdAt: now,
    };
    state.orgUnits.push(org);
    changed = true;
  } else {
    if (Number(org.tenantId || 0) !== tenantId) {
      org.tenantId = tenantId;
      changed = true;
    }
    if (String(org.name || '').trim() !== PUBLIC_POOL_ORG_NAME) {
      org.name = PUBLIC_POOL_ORG_NAME;
      changed = true;
    }
    if (!org.createdAt) {
      org.createdAt = now;
      changed = true;
    }
  }

  let team =
    ensureArray(state.teams)
      .filter((row) => Number(row?.tenantId || 0) === tenantId)
      .sort((a, b) => Number(a?.id || 0) - Number(b?.id || 0))[0] || null;
  if (!team) {
    team = {
      id: allocateId(state.teams, nextId),
      tenantId,
      orgId: Number(org.id || 0),
      name: PUBLIC_POOL_TEAM_NAME,
      createdAt: now,
    };
    state.teams.push(team);
    changed = true;
  } else {
    if (Number(team.tenantId || 0) !== tenantId) {
      team.tenantId = tenantId;
      changed = true;
    }
    if (Number(team.orgId || 0) !== Number(org.id || 0)) {
      team.orgId = Number(org.id || 0);
      changed = true;
    }
    if (String(team.name || '').trim() !== PUBLIC_POOL_TEAM_NAME) {
      team.name = PUBLIC_POOL_TEAM_NAME;
      changed = true;
    }
    if (!team.createdAt) {
      team.createdAt = now;
      changed = true;
    }
  }

  for (const customer of ensureArray(state.users)) {
    if (!isDirectUnassignedCustomer(customer)) continue;
    const needsMove =
      Number(customer.tenantId || 0) !== tenantId ||
      Number(customer.orgId || 0) !== Number(org.id || 0) ||
      Number(customer.teamId || 0) !== Number(team.id || 0);
    if (!needsMove) continue;
    customer.tenantId = tenantId;
    customer.orgId = Number(org.id || 0);
    customer.teamId = Number(team.id || 0);
    customer.updatedAt = now;
    changed = true;
  }

  return { changed, tenant, org, team };
}
