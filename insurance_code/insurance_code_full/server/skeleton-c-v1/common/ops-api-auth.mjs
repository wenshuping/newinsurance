const OPS_API_ALLOWED_CONTRACTS = new Set([
  'POST /api/p/activities',
  'POST /api/p/learning/courses',
  'POST /api/p/learning/courses/batch',
]);

function readHeader(headers, key) {
  const value = headers?.[key];
  if (Array.isArray(value)) return String(value[0] || '').trim();
  return String(value || '').trim();
}

function buildRequestContract(req) {
  const method = String(req?.method || 'GET').toUpperCase();
  const path = String(req?.path || req?.originalUrl || req?.url || '').split('?')[0];
  return `${method} ${path}`;
}

export function resolveOpsApiAuth(req) {
  const contract = buildRequestContract(req);
  if (!OPS_API_ALLOWED_CONTRACTS.has(contract)) {
    return { status: 'not_applicable', code: null, context: null };
  }

  const providedKey = readHeader(req?.headers, 'x-ops-api-key');
  if (!providedKey) {
    return { status: 'missing', code: 'OPS_API_KEY_REQUIRED', context: null };
  }

  const expectedKey = String(process.env.P_OPS_API_KEY || process.env.P_LEARNING_OPS_API_KEY || '').trim();
  if (!expectedKey || providedKey !== expectedKey) {
    return { status: 'invalid', code: 'OPS_API_KEY_INVALID', context: null };
  }

  return {
    status: 'granted',
    code: null,
    context: {
      authMode: 'ops_api_key',
      actorType: 'employee',
      actorId: 9001,
      tenantId: 1,
      orgId: 1,
      teamId: 1,
      role: 'platform_admin',
      name: '运营接口',
      account: 'ops-api',
    },
  };
}

export function applyOpsApiAuth(req, context) {
  const safe = {
    authMode: String(context?.authMode || 'ops_api_key'),
    actorType: String(context?.actorType || 'employee'),
    actorId: Number(context?.actorId || 0),
    tenantId: Number(context?.tenantId || 1),
    orgId: Number(context?.orgId || 1),
    teamId: Number(context?.teamId || 1),
    role: String(context?.role || 'platform_admin'),
    name: String(context?.name || '运营接口'),
    account: String(context?.account || 'ops-api'),
  };

  req.opsApiAuth = safe;
  req.user = {
    id: safe.actorId,
    actorType: safe.actorType,
    tenantId: safe.tenantId,
    orgId: safe.orgId,
    teamId: safe.teamId,
    ownerUserId: 0,
    name: safe.name,
    mobile: '',
    email: '',
    account: safe.account,
    role: safe.role,
  };
  req.session = {
    actorType: safe.actorType,
    actorId: safe.actorId,
    tenantId: safe.tenantId,
    orgId: safe.orgId,
    teamId: safe.teamId,
    role: safe.role,
    token: 'ops-api-key',
    csrfToken: 'ops-api-key',
    expiresAt: '9999-12-31T23:59:59.999Z',
  };
  return safe;
}
