export const ACTIVITY_ORDER_ID_BASE = 9_000_000_000_000;

export function toActivityOrderId(completionId) {
  const id = Number(completionId || 0);
  if (!Number.isFinite(id) || id <= 0) return 0;
  return ACTIVITY_ORDER_ID_BASE + id;
}

export function parseActivityOrderId(orderId) {
  const id = Number(orderId || 0);
  if (!Number.isFinite(id) || id <= ACTIVITY_ORDER_ID_BASE) return 0;
  return id - ACTIVITY_ORDER_ID_BASE;
}

export function buildActivityWriteoffToken(completion = {}) {
  const existing = String(completion?.writeoffToken || '').trim();
  if (existing) return existing;
  const tenantId = Number(completion?.tenantId || 1);
  const userId = Number(completion?.userId || 0);
  const activityId = Number(completion?.activityId || 0);
  const id = Number(completion?.id || 0);
  return `ACT-${tenantId}-${userId}-${activityId}-${id}`;
}

export function isActivityCompletionWrittenOff(completion = {}) {
  return Boolean(String(completion?.writtenOffAt || '').trim());
}
