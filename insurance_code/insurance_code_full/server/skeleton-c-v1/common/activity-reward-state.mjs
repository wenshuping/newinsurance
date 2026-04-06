export function buildActivityRewardIdempotencyKey({ tenantId, userId, activityId, completionDate }) {
  return `activity-reward:${Number(tenantId || 1)}:${Number(userId || 0)}:${Number(activityId || 0)}:${String(completionDate || '').trim()}`;
}

export function hasActivityRewardTransaction(state, { tenantId, userId, activityId, completionDate }) {
  const expectedKey = buildActivityRewardIdempotencyKey({ tenantId, userId, activityId, completionDate });
  return Array.isArray(state?.pointTransactions)
    && state.pointTransactions.some((row) => String(row?.idempotencyKey || '') === expectedKey);
}
