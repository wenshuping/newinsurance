const DEFAULT_POINTS_SERVICE_BASE_URL = 'http://127.0.0.1:4102';
const LEARNING_REWARD_SETTLEMENT_PATH = '/internal/points-service/learning-rewards/settle';

function trimToNull(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function toPositiveInt(value, fallback = 0) {
  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized > 0 ? Math.floor(normalized) : fallback;
}

function resolvePointsServiceBaseUrl(env = process.env) {
  return String(env.LEARNING_POINTS_SERVICE_URL || env.GATEWAY_POINTS_SERVICE_URL || DEFAULT_POINTS_SERVICE_BASE_URL).replace(/\/+$/, '');
}

function buildHeaders({ tenantId, tenantCode, traceId, requestId }) {
  const headers = {
    'content-type': 'application/json',
    'x-internal-service': 'learning-service',
    'x-service-name': 'learning-service',
    'x-tenant-id': String(tenantId),
  };

  const normalizedTenantCode = trimToNull(tenantCode);
  const normalizedTraceId = trimToNull(traceId);
  const normalizedRequestId = trimToNull(requestId) || normalizedTraceId;

  if (normalizedTenantCode) headers['x-tenant-code'] = normalizedTenantCode;
  if (normalizedTraceId) headers['x-trace-id'] = normalizedTraceId;
  if (normalizedRequestId) headers['x-request-id'] = normalizedRequestId;

  return headers;
}

async function fetchWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function parseJson(response) {
  const raw = await response.text();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

export async function settleLearningRewardOverHttp({
  tenantId,
  tenantCode = null,
  userId,
  courseId,
  courseTitle,
  rewardPoints,
  traceId = null,
  requestId = null,
}) {
  const normalizedTenantId = toPositiveInt(tenantId, 0);
  if (normalizedTenantId <= 0) {
    throw new Error('TENANT_CONTEXT_REQUIRED');
  }

  const targetBaseUrl = resolvePointsServiceBaseUrl();
  const targetUrl = `${targetBaseUrl}${LEARNING_REWARD_SETTLEMENT_PATH}`;
  const timeoutMs = Math.max(300, Number(process.env.LEARNING_POINTS_HTTP_TIMEOUT_MS || 2500));

  let response;
  try {
    response = await fetchWithTimeout(
      targetUrl,
      {
        method: 'POST',
        headers: buildHeaders({
          tenantId: normalizedTenantId,
          tenantCode,
          traceId,
          requestId,
        }),
        body: JSON.stringify({
          tenantId: normalizedTenantId,
          userId: Number(userId || 0),
          courseId: Number(courseId || 0),
          courseTitle: String(courseTitle || courseId || ''),
          rewardPoints: Number(rewardPoints || 0),
        }),
      },
      timeoutMs,
    );
  } catch (error) {
    const upstreamUnavailable = new Error('LEARNING_POINTS_UPSTREAM_UNAVAILABLE');
    upstreamUnavailable.cause = error;
    throw upstreamUnavailable;
  }

  const payload = await parseJson(response);
  if (!response.ok) {
    const code = trimToNull(payload?.code);
    if (
      code === 'INVALID_LEARNING_REWARD_USER'
      || code === 'INVALID_LEARNING_REWARD_COURSE_ID'
      || code === 'INVALID_LEARNING_REWARD_POINTS'
      || code === 'LEARNING_REWARD_SETTLEMENT_FAILED'
    ) {
      throw new Error(code);
    }
    const contractRejected = new Error('LEARNING_POINTS_CONTRACT_REJECTED');
    contractRejected.upstreamStatus = response.status;
    contractRejected.upstreamCode = code;
    contractRejected.upstreamBody = payload;
    throw contractRejected;
  }

  return payload;
}
