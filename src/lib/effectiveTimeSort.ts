type EffectiveTimeSortable = {
  id?: number | string | null;
  effectiveAt?: string | null;
  effectiveStartAt?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
};

const toTimestamp = (raw: unknown) => {
  const parsed = Date.parse(String(raw || ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const toSortId = (raw: unknown) => {
  const numeric = Number(raw);
  if (Number.isFinite(numeric)) return numeric;
  const parsed = Number.parseInt(String(raw || '').replace(/\D+/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function resolveEffectiveTimeMs(item: EffectiveTimeSortable) {
  return (
    toTimestamp(item?.effectiveAt) ||
    toTimestamp(item?.effectiveStartAt) ||
    toTimestamp(item?.updatedAt) ||
    toTimestamp(item?.createdAt)
  );
}

export function sortByEffectiveTimeDesc<T extends EffectiveTimeSortable>(items: readonly T[]) {
  return [...items].sort((a, b) => {
    const byEffectiveTime = resolveEffectiveTimeMs(b) - resolveEffectiveTimeMs(a);
    if (byEffectiveTime !== 0) return byEffectiveTime;
    return toSortId(b?.id) - toSortId(a?.id);
  });
}
