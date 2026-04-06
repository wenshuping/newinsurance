const DEFAULT_SERVICE_URLS = {
  'v1-monolith': 'http://127.0.0.1:4000',
  'user-service': 'http://127.0.0.1:4101',
  'points-service': 'http://127.0.0.1:4102',
  'learning-service': 'http://127.0.0.1:4103',
  'activity-service': 'http://127.0.0.1:4104',
};

export const gatewayServiceRegistry = {
  'v1-monolith': {
    service: 'v1-monolith',
    ownership: 'fallback-monolith',
    envKey: 'GATEWAY_V1_BASE_URL',
    defaultUrl: DEFAULT_SERVICE_URLS['v1-monolith'],
    healthPath: '/api/health',
    observabilityPath: null,
  },
  'user-service': {
    service: 'user-service',
    ownership: 'identity-and-profile',
    envKey: 'GATEWAY_USER_SERVICE_URL',
    defaultUrl: DEFAULT_SERVICE_URLS['user-service'],
    healthPath: '/health',
    observabilityPath: '/internal/user-service/observability',
  },
  'points-service': {
    service: 'points-service',
    ownership: 'points-and-commerce',
    envKey: 'GATEWAY_POINTS_SERVICE_URL',
    defaultUrl: DEFAULT_SERVICE_URLS['points-service'],
    healthPath: '/health',
    observabilityPath: '/internal/points-service/observability',
  },
  'learning-service': {
    service: 'learning-service',
    ownership: 'learning-content',
    envKey: 'GATEWAY_LEARNING_SERVICE_URL',
    flagEnvKey: 'GATEWAY_ENABLE_LEARNING_SERVICE',
    enabledByDefault: false,
    defaultUrl: DEFAULT_SERVICE_URLS['learning-service'],
    healthPath: '/health',
    observabilityPath: null,
  },
  'activity-service': {
    service: 'activity-service',
    ownership: 'activity-content',
    envKey: 'GATEWAY_ACTIVITY_SERVICE_URL',
    flagEnvKey: 'GATEWAY_ENABLE_ACTIVITY_SERVICE',
    enabledByDefault: false,
    defaultUrl: DEFAULT_SERVICE_URLS['activity-service'],
    healthPath: '/health',
    observabilityPath: '/internal/activity-service/observability',
  },
};

export const gatewayRouteMap = [
  {
    service: 'user-service',
    ownership: 'identity-and-profile',
    routes: ['/api/auth/send-code', '/api/auth/verify-basic', '/api/me'],
  },
  {
    service: 'points-service',
    ownership: 'points-and-commerce',
    routes: [
      '/api/sign-in',
      '/api/points/summary',
      '/api/points/transactions',
      '/api/points/detail',
      '/api/mall/items',
      '/api/mall/activities',
      '/api/mall/redeem',
      '/api/mall/activities/:id/join',
      '/api/redemptions',
      '/api/redemptions/:id/writeoff',
      '/api/orders',
      '/api/orders/:id',
      '/api/orders/:id/pay',
      '/api/orders/:id/cancel',
      '/api/orders/:id/refund',
    ],
  },
  {
    service: 'learning-service',
    ownership: 'learning-content',
    routes: [
      '/api/learning/courses',
      '/api/learning/games',
      '/api/learning/tools',
      '/api/learning/courses/:id',
      '/api/learning/courses/:id/complete',
      '/api/p/learning/courses',
      '/api/p/learning/courses/batch',
      '/api/p/learning/courses/:id',
    ],
  },
  {
    service: 'activity-service',
    ownership: 'activity-content',
    routes: [
      '/api/activities',
      '/api/activities/:id/complete',
      '/api/p/activities',
      '/api/p/activities/reorder',
      '/api/p/activities/:id',
      '/api/b/activity-configs',
      '/api/b/activity-configs/:id',
    ],
  },
];

export const gatewayOwnershipSummary = gatewayRouteMap.map((item) => ({
  service: item.service,
  ownership: item.ownership,
  routeCount: item.routes.length,
}));

function toPositiveInt(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

function parseCsv(rawValue) {
  return String(rawValue || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function matchesPathPattern(pattern, pathname) {
  const patternSegments = String(pattern || '')
    .split('/')
    .filter(Boolean);
  const pathnameSegments = String(pathname || '')
    .split('/')
    .filter(Boolean);

  if (patternSegments.length !== pathnameSegments.length) return false;

  return patternSegments.every((segment, index) => {
    if (segment.startsWith(':')) return Boolean(pathnameSegments[index]);
    return segment === pathnameSegments[index];
  });
}

function matchesPrefixRule(pathname, prefixes) {
  return prefixes.some((prefix) => {
    const normalized = String(prefix || '').trim();
    if (!normalized) return false;
    if (normalized.endsWith('*')) {
      return String(pathname || '').startsWith(normalized.slice(0, -1));
    }
    return pathname === normalized || String(pathname || '').startsWith(`${normalized}/`);
  });
}

function tenantTokenFromHeaders(headers) {
  const tenantId = toPositiveInt(headers?.['x-tenant-id']);
  const tenantCode = String(headers?.['x-tenant-code'] || headers?.['x-tenant-key'] || '')
    .trim()
    .toLowerCase();
  return {
    tenantId: tenantId ? String(tenantId) : '',
    tenantCode,
  };
}

export function isGatewayServiceEnabled(service, env = process.env) {
  const registryItem = gatewayServiceRegistry[service];
  if (!registryItem) return false;
  if (!registryItem.flagEnvKey) return true;
  const rawValue = env[registryItem.flagEnvKey];
  if (rawValue == null || String(rawValue).trim() === '') {
    return Boolean(registryItem.enabledByDefault);
  }
  return String(rawValue).toLowerCase() !== 'false';
}

export function listGatewayActiveServices(env = process.env) {
  return Object.keys(gatewayServiceRegistry).filter((service) => {
    if (service === 'v1-monolith') return true;
    return isGatewayServiceEnabled(service, env);
  });
}

export function resolveGatewayConfig(env = process.env) {
  return {
    enableV2: String(env.GATEWAY_ENABLE_V2 || 'true').toLowerCase() !== 'false',
    forceV1: String(env.GATEWAY_FORCE_V1 || 'false').toLowerCase() === 'true',
    enableV1Fallback: String(env.GATEWAY_ENABLE_V1_FALLBACK || 'true').toLowerCase() !== 'false',
    forceV1Paths: parseCsv(env.GATEWAY_FORCE_V1_PATHS),
    forceV2Paths: parseCsv(env.GATEWAY_FORCE_V2_PATHS),
    v2Tenants: parseCsv(env.GATEWAY_V2_TENANTS || 'all').map((item) => item.toLowerCase()),
    readyTimeoutMs: Math.max(200, Number(env.GATEWAY_READY_TIMEOUT_MS || 1500)),
    proxyTimeoutMs: Math.max(1000, Number(env.GATEWAY_PROXY_TIMEOUT_MS || env.GATEWAY_READY_TIMEOUT_MS || 15000)),
  };
}

export function resolveServiceBaseUrl(service, env = process.env) {
  const registryItem = gatewayServiceRegistry[service];
  if (!registryItem) return '';
  return String(env[registryItem.envKey] || registryItem.defaultUrl || '').replace(/\/+$/, '');
}

export function findGatewayRoute(pathname) {
  for (const owner of gatewayRouteMap) {
    for (const routePattern of owner.routes) {
      if (matchesPathPattern(routePattern, pathname)) {
        return {
          service: owner.service,
          ownership: owner.ownership,
          routePattern,
        };
      }
    }
  }
  return null;
}

function tenantAllowed(config, headers) {
  const tenantRules = config.v2Tenants;
  if (!tenantRules.length || tenantRules.includes('all')) return true;
  const tenant = tenantTokenFromHeaders(headers);
  return tenantRules.includes(tenant.tenantId) || tenantRules.includes(tenant.tenantCode);
}

export function resolveGatewayTarget({ pathname, headers = {}, env = process.env }) {
  const route = findGatewayRoute(pathname);
  const config = resolveGatewayConfig(env);
  const v1BaseUrl = resolveServiceBaseUrl('v1-monolith', env);

  if (!route) {
    return {
      mode: 'v1',
      service: 'v1-monolith',
      ownership: 'fallback-monolith',
      routePattern: null,
      targetBaseUrl: v1BaseUrl,
      fallbackBaseUrl: null,
      reason: 'v1-catchall',
    };
  }

  const forceV1ByPath = matchesPrefixRule(pathname, config.forceV1Paths);
  const forceV2ByPath = matchesPrefixRule(pathname, config.forceV2Paths);
  const serviceEnabled = isGatewayServiceEnabled(route.service, env);
  const canUseV2 =
    serviceEnabled
    && config.enableV2
    && !config.forceV1
    && !forceV1ByPath
    && (forceV2ByPath || tenantAllowed(config, headers));

  if (!canUseV2) {
    return {
      mode: 'v1',
      service: 'v1-monolith',
      ownership: route.ownership,
      routePattern: route.routePattern,
      targetBaseUrl: v1BaseUrl,
      fallbackBaseUrl: null,
      reason: !serviceEnabled ? 'v1-service-disabled' : forceV1ByPath || config.forceV1 ? 'forced-v1' : 'v1-tenant-policy',
    };
  }

  return {
    mode: 'v2',
    service: route.service,
    ownership: route.ownership,
    routePattern: route.routePattern,
    targetBaseUrl: resolveServiceBaseUrl(route.service, env),
    fallbackBaseUrl: config.enableV1Fallback ? v1BaseUrl : null,
    reason: forceV2ByPath ? 'forced-v2' : 'v2-default',
  };
}

export function describeGatewayRoutes(env = process.env) {
  const config = resolveGatewayConfig(env);
  return gatewayRouteMap.map((item) => ({
    service: item.service,
    ownership: item.ownership,
    targetBaseUrl: resolveServiceBaseUrl(item.service, env),
    enabled: isGatewayServiceEnabled(item.service, env),
    defaultMode: config.enableV2 && !config.forceV1 && isGatewayServiceEnabled(item.service, env) ? 'v2' : 'v1',
    routes: item.routes,
  }));
}
