function toFiniteNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function clampText(value, maxLength) {
  const text = String(value || '');
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

export const touchUser = ({ user, userAgent }) => {
  user.lastActiveAt = new Date().toISOString();
  user.deviceInfo = user.deviceInfo || clampText(userAgent, 255);
  return user;
};

export const findCustomerById = ({ state, customerId }) =>
  (state.users || []).find((row) => Number(row.id || 0) === Number(customerId || 0)) || null;

export const findCustomerByMobile = ({ state, mobile }) =>
  (state.users || []).find((row) => String(row.mobile || '') === String(mobile || '')) || null;

export function assignCustomerOwnerScope(customer, { tenantId, orgId, teamId, agentId, updatedAt }) {
  const nextTenantId = tenantId == null ? null : toFiniteNumber(tenantId);
  const nextOrgId = toFiniteNumber(orgId);
  const nextTeamId = toFiniteNumber(teamId);
  const nextAgentId = toFiniteNumber(agentId);

  if (nextOrgId == null || nextTeamId == null || nextAgentId == null) {
    return { ok: false, code: 'AGENT_SCOPE_INVALID' };
  }
  if (tenantId != null && nextTenantId == null) {
    return { ok: false, code: 'AGENT_SCOPE_INVALID' };
  }

  if (nextTenantId != null) customer.tenantId = nextTenantId;
  customer.orgId = nextOrgId;
  customer.teamId = nextTeamId;
  customer.ownerUserId = nextAgentId;
  customer.updatedAt = updatedAt || new Date().toISOString();
  return { ok: true, customer };
}

export function batchAssignCustomerOwnerScope(customers, { tenantId, orgId, teamId, agentId, updatedAt }) {
  if (!Array.isArray(customers) || customers.length === 0) return [];
  const assigned = [];

  for (const customer of customers) {
    const result = assignCustomerOwnerScope(customer, {
      tenantId,
      orgId,
      teamId,
      agentId,
      updatedAt,
    });
    if (!result.ok) continue;
    assigned.push({
      id: Number(customer.id),
      name: String(customer.name || ''),
      mobile: String(customer.mobile || ''),
    });
  }

  return assigned;
}
