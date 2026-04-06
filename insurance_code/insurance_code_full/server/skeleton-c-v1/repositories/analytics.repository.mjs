import { nextId } from '../common/state.mjs';

export function ensureAnalyticsArrays(state) {
  if (!Array.isArray(state.statsWarehouse)) state.statsWarehouse = [];
  if (!Array.isArray(state.reconciliationReports)) state.reconciliationReports = [];
}

export function upsertStatsSnapshot(state, { day, metrics, createdAt }) {
  ensureAnalyticsArrays(state);
  const snapshot = {
    id: nextId(state.statsWarehouse),
    day: String(day),
    metrics,
    createdAt: createdAt || new Date().toISOString(),
  };
  const existedIndex = state.statsWarehouse.findIndex((row) => String(row.day) === String(day));
  if (existedIndex >= 0) state.statsWarehouse[existedIndex] = snapshot;
  else state.statsWarehouse.push(snapshot);
  return snapshot;
}

export function listStatsSnapshots(state) {
  ensureAnalyticsArrays(state);
  return state.statsWarehouse;
}

export function createReconciliationReport(state, { day, status, mismatches, checkedAt }) {
  ensureAnalyticsArrays(state);
  const report = {
    id: nextId(state.reconciliationReports),
    day: String(day),
    status,
    mismatches: Array.isArray(mismatches) ? mismatches : [],
    checkedAt: checkedAt || new Date().toISOString(),
  };
  state.reconciliationReports.push(report);
  return report;
}
