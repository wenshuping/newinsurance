function toTimestamp(value) {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function toSortableId(value) {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  const parsed = Number.parseInt(String(value || '').replace(/\D+/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function resolveEffectiveTimeMs(row = {}) {
  return (
    toTimestamp(row?.effectiveAt)
    || toTimestamp(row?.effectiveStartAt)
    || toTimestamp(row?.updatedAt)
    || toTimestamp(row?.createdAt)
  );
}

export function sortRowsByEffectiveTimeDesc(rows = []) {
  return [...(Array.isArray(rows) ? rows : [])].sort((a, b) => {
    const effectiveTimeDiff = resolveEffectiveTimeMs(b) - resolveEffectiveTimeMs(a);
    if (effectiveTimeDiff !== 0) return effectiveTimeDiff;
    return toSortableId(b?.id) - toSortableId(a?.id);
  });
}
