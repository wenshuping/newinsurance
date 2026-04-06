import { getState, persistState } from '../common/state.mjs';
import {
  createReconciliationReport,
  listStatsSnapshots,
  upsertStatsSnapshot,
} from '../repositories/analytics.repository.mjs';

function dateKey(input = new Date()) {
  const d = input instanceof Date ? input : new Date(input);
  return d.toISOString().slice(0, 10);
}

export function rebuildDailySnapshot(day = new Date()) {
  const state = getState();

  const key = dateKey(day);
  const customers = (state.users || []).length;
  const activeCustomers = new Set((state.signIns || []).filter((row) => String(row.signDate || '').startsWith(key)).map((row) => row.userId)).size;
  const createdOrders = (state.orders || []).filter((row) => String(row.createdAt || '').startsWith(key));
  const paidOrders = createdOrders.filter((row) => row.paymentStatus === 'paid');
  const refundedOrders = (state.orderRefunds || []).filter((row) => String(row.createdAt || '').startsWith(key)).length;

  const pointsIn = (state.pointTransactions || [])
    .filter((row) => String(row.createdAt || '').startsWith(key))
    .filter((row) => row.type === 'earn' || row.direction === 'in')
    .reduce((sum, row) => sum + Math.abs(Number(row.amount) || 0), 0);
  const pointsOut = (state.pointTransactions || [])
    .filter((row) => String(row.createdAt || '').startsWith(key))
    .filter((row) => row.type === 'consume' || row.direction === 'out')
    .reduce((sum, row) => sum + Math.abs(Number(row.amount) || 0), 0);

  const snapshot = upsertStatsSnapshot(state, {
    day: key,
    metrics: {
      customers,
      activeCustomers,
      createdOrders: createdOrders.length,
      paidOrders: paidOrders.length,
      refundedOrders,
      pointsIn,
      pointsOut,
    },
    createdAt: new Date().toISOString(),
  });

  persistState();
  return snapshot;
}

export function latestSnapshot() {
  const state = getState();
  const list = listStatsSnapshots(state);
  if (!list.length) return null;
  return [...list].sort((a, b) => String(b.day).localeCompare(String(a.day)))[0];
}

export function listSnapshots(limit = 14) {
  const state = getState();
  const list = listStatsSnapshots(state);
  return [...list].sort((a, b) => String(b.day).localeCompare(String(a.day))).slice(0, Math.max(1, Number(limit) || 14));
}

export function runReconciliation(day = new Date()) {
  const state = getState();

  const key = dateKey(day);
  const balanceMap = new Map();
  (state.pointTransactions || []).forEach((row) => {
    const userId = Number(row.userId);
    const amount = Math.abs(Number(row.amount) || 0);
    const dir = row.type === 'consume' || row.direction === 'out' ? -1 : 1;
    balanceMap.set(userId, (balanceMap.get(userId) || 0) + amount * dir);
  });
  const mismatches = [];
  (state.pointAccounts || []).forEach((acc) => {
    const expected = balanceMap.get(Number(acc.userId)) || 0;
    const actual = Number(acc.balance) || 0;
    if (expected !== actual) {
      mismatches.push({ userId: Number(acc.userId), expected, actual });
    }
  });

  const report = createReconciliationReport(state, {
    day: key,
    status: mismatches.length ? 'mismatch' : 'ok',
    mismatches,
    checkedAt: new Date().toISOString(),
  });
  persistState();
  return report;
}
