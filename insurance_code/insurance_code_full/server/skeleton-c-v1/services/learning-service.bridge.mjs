const DEFAULT_LEARNING_SERVICE_BASE_URL = 'http://127.0.0.1:4103';
const BRIDGE_HEADERS = [
  'accept',
  'authorization',
  'content-type',
  'x-csrf-token',
  'x-trace-id',
  'x-request-id',
  'x-tenant-id',
  'x-tenant-code',
  'x-tenant-key',
  'x-org-id',
  'x-team-id',
  'x-owner-user-id',
  'x-actor-type',
  'x-actor-id',
];

function trimTrailingSlashes(value) {
  return String(value || '').replace(/\/+$/, '');
}

export function resolveLearningServiceBaseUrl(env = process.env) {
  return trimTrailingSlashes(env.LEARNING_SERVICE_BASE_URL || env.GATEWAY_LEARNING_SERVICE_URL || DEFAULT_LEARNING_SERVICE_BASE_URL);
}

function buildBridgeHeaders(req) {
  const headers = {
    'x-legacy-bridge': 'skeleton-c-v1',
    'x-service-name': 'v1-monolith',
  };

  for (const name of BRIDGE_HEADERS) {
    const rawValue = req.headers?.[name];
    if (rawValue == null || rawValue === '') continue;
    headers[name] = Array.isArray(rawValue) ? rawValue.join(',') : String(rawValue);
  }

  if (!headers.accept) headers.accept = 'application/json';
  return headers;
}

async function parseBridgeResponse(response) {
  const raw = await response.text();
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  const isJson = contentType.includes('application/json');
  if (!raw) {
    return { isJson, payload: null, raw: '' };
  }
  if (!isJson) {
    return { isJson, payload: null, raw };
  }
  try {
    return { isJson, payload: JSON.parse(raw), raw };
  } catch {
    return { isJson: false, payload: null, raw };
  }
}

export async function forwardLearningServiceRequest(req, res, { routeTag = 'legacy-bridge', targetPath = null } = {}) {
  const baseUrl = resolveLearningServiceBaseUrl();
  const pathname = targetPath || req.originalUrl || req.url || '';
  const targetUrl = `${baseUrl}${pathname}`;
  const method = String(req.method || 'GET').toUpperCase();
  const hasBody = method !== 'GET' && method !== 'HEAD' && req.body !== undefined;

  let upstreamResponse;
  try {
    upstreamResponse = await fetch(targetUrl, {
      method,
      headers: buildBridgeHeaders(req),
      body: hasBody ? JSON.stringify(req.body ?? {}) : undefined,
    });
  } catch (error) {
    res.set('x-learning-legacy-bridge', routeTag);
    return res.status(502).json({
      code: 'LEARNING_SERVICE_UPSTREAM_UNAVAILABLE',
      message: 'learning-service 暂时不可用',
      route: pathname,
      target: targetUrl,
      cause: String(error?.message || error),
    });
  }

  const parsed = await parseBridgeResponse(upstreamResponse);
  res.set('x-learning-legacy-bridge', routeTag);
  res.set('x-learning-bridge-target', 'learning-service');

  if (parsed.isJson) {
    return res.status(upstreamResponse.status).json(parsed.payload);
  }

  const upstreamType = upstreamResponse.headers.get('content-type');
  if (upstreamType) res.type(upstreamType);
  return res.status(upstreamResponse.status).send(parsed.raw);
}

export function respondLearningRouteDeprecated(res, { route, replacement = '/api/learning/courses' } = {}) {
  res.set('x-learning-deprecated', 'true');
  return res.status(410).json({
    code: 'LEARNING_ROUTE_DEPRECATED',
    message: '该学习入口已正式弃用，请使用 learning-service 正式课程能力',
    route,
    replacement,
  });
}
