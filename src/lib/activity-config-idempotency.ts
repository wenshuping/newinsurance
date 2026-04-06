function buildUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createBActivityConfigIdempotencyKey(buildId: () => string = buildUuid) {
  return `b-activity-config-create:${buildId()}`;
}

export function rotateBActivityConfigIdempotencyKey(
  currentKey: string,
  buildId: () => string = buildUuid,
) {
  let nextKey = createBActivityConfigIdempotencyKey(buildId);
  while (nextKey === currentKey) {
    nextKey = createBActivityConfigIdempotencyKey(buildId);
  }
  return nextKey;
}
