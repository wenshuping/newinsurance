type DashboardCustomerActivityRowLike = {
  occurredAt?: string | null;
};

function toTimestamp(value?: string | null) {
  const timestamp = new Date(String(value || '')).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function getDashboardCustomerActivityFullRows<T extends DashboardCustomerActivityRowLike>(rows: readonly T[]) {
  return [...rows].sort((a, b) => toTimestamp(b.occurredAt) - toTimestamp(a.occurredAt));
}

export function getDashboardCustomerActivityPreviewRows<T extends DashboardCustomerActivityRowLike>(rows: readonly T[], limit = 8) {
  return getDashboardCustomerActivityFullRows(rows).slice(0, Math.max(1, Number(limit || 8)));
}
