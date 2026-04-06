const DEFAULT_POINTS_SERVICE_BASE_URL = 'http://127.0.0.1:4102';
const ACTIVITY_REWARD_SETTLEMENT_PATH = '/internal/points-service/activity-rewards/settle';

function trimToNull(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function toPositiveInt(value, fallback = 0) {
  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized > 0 ? Math.floor(normalized) : fallback;
}

function resolvePointsServiceBaseUrl(env = process.env) {
  return String(env.ACTIVITY_POINTS_SERVICE_URL || env.GATEWAY_POINTS_SERVICE_URL || DEFAULT_POINTS_SERVICE_BASE_URL).replace(/\/+$/, '');
}

function resolveRetryCount(env = process.env) {
  const parsed = Number(env.ACTIVITY_POINTS_HTTP_RETRY_COUNT || 2);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 2;
}

function resolveRetryDelayMs(env = process.env) {
  const parsed = Number(env.ACTIVITY_POINTS_HTTP_RETRY_DELAY_MS || 150);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 150;
}

function wait(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildHeaders({ tenantId, tenantCode, traceId, requestId }) {
  const headers = {
    'content-type': 'application/json',
    'x-internal-service': 'activity-service',
    'x-service-name': 'activity-service',
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

export async function settleActivityRewardOverHttp({
  tenantId,
  tenantCode = null,
  userId,
  activityId,
  activityTitle,
  rewardPoints,
  completionDate,
  traceId = null,
  requestId = null,
}) {
  const normalizedTenantId = toPositiveInt(tenantId, 0);
  if (normalizedTenantId <= 0) {
    throw new Error('TENANT_CONTEXT_REQUIRED');
  }

  const targetBaseUrl = resolvePointsServiceBaseUrl();
  const targetUrl = `${targetBaseUrl}${ACTIVITY_REWARD_SETTLEMENT_PATH}`;
  const timeoutMs = Math.max(300, Number(process.env.ACTIVITY_POINTS_HTTP_TIMEOUT_MS || 2500));
  const maxAttempts = resolveRetryCount();
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt += 1;
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
            activityId: Number(activityId || 0),
            activityTitle: String(activityTitle || activityId || ''),
            rewardPoints: Number(rewardPoints || 0),
            completionDate: String(completionDate || '').trim() || null,
          }),
        },
        timeoutMs,
      );
    } catch (error) {
      if (attempt < maxAttempts) {
        await wait(resolveRetryDelayMs());
        continue;
      }
      const upstreamUnavailable = new Error('ACTIVITY_POINTS_UPSTREAM_UNAVAILABLE');
      upstreamUnavailable.cause = error;
      throw upstreamUnavailable;
    }

    const payload = await parseJson(response);
    if (!response.ok) {
      const code = trimToNull(payload?.code);
      if (
        code === 'INVALID_ACTIVITY_REWARD_USER'
        || code === 'INVALID_ACTIVITY_REWARD_ACTIVITY_ID'
        || code === 'INVALID_ACTIVITY_REWARD_POINTS'
        || code === 'INVALID_ACTIVITY_REWARD_DATE'
        || code === 'ACTIVITY_REWARD_SETTLEMENT_FAILED'
      ) {
        throw new Error(code);
      }
      const contractRejected = new Error('ACTIVITY_POINTS_CONTRACT_REJECTED');
      contractRejected.upstreamStatus = response.status;
      contractRejected.upstreamCode = code;
      contractRejected.upstreamBody = payload;
      throw contractRejected;
    }

    return payload;
  }
  throw new Error('ACTIVITY_POINTS_UPSTREAM_UNAVAILABLE');
}
