import { resolveSessionFromBearer, resolveUserFromBearer } from '../../skeleton-c-v1/common/state.mjs';
import { applyOpsApiAuth, resolveOpsApiAuth } from '../../skeleton-c-v1/common/ops-api-auth.mjs';

const ADMIN_PREFIXES = ['/api/p/', '/api/b/'];
const TENANT_REQUIRED_PREFIXES = ['/api/p/', '/api/b/', '/api/track/'];

const toPositiveInt = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
};

const resolveTenantContext = (req) => {
  const tenantId = toPositiveInt(req.headers['x-tenant-id']);
  const tenantCodeRaw = String(req.headers['x-tenant-code'] || req.headers['x-tenant-key'] || '').trim();
  return {
    tenantId,
    tenantCode: tenantCodeRaw || null,
  };
};

const isPrefixMatch = (path, prefixes) => prefixes.some((p) => path.startsWith(p));

const attachSessionAndUser = (req) => {
  const auth = req.headers.authorization;
  req.user = resolveUserFromBearer(auth) || null;
  req.session = resolveSessionFromBearer(auth) || null;
};

export const unifiedAuthAndTenantContext = (req, res, next) => {
  const path = String(req.path || '');
  const isAdminPath = isPrefixMatch(path, ADMIN_PREFIXES);
  const isAdminLogin = path === '/api/p/auth/login' || path === '/api/b/auth/login';

  attachSessionAndUser(req);
  if (isAdminPath && !isAdminLogin && !req.user) {
    const opsApiAuth = resolveOpsApiAuth(req);
    if (opsApiAuth.status === 'granted') {
      applyOpsApiAuth(req, opsApiAuth.context);
    } else if (opsApiAuth.status === 'invalid') {
      return res.status(401).json({ code: opsApiAuth.code, message: '运营 API Key 无效' });
    }
  }
  req.tenantContext = resolveTenantContext(req);

  if (isAdminPath && !isAdminLogin && !req.user) {
    return res.status(401).json({ code: 'UNAUTHORIZED', message: '请先登录' });
  }

  const requireTenant = String(process.env.REQUIRE_TENANT_CONTEXT || 'false').toLowerCase() === 'true';
  if (requireTenant && isPrefixMatch(path, TENANT_REQUIRED_PREFIXES)) {
    const hasTenant = Number.isFinite(Number(req.tenantContext?.tenantId)) && Number(req.tenantContext.tenantId) > 0;
    if (!hasTenant) {
      return res.status(400).json({ code: 'TENANT_CONTEXT_REQUIRED', message: '缺少租户上下文，请携带 x-tenant-id' });
    }
  }

  return next();
};
