import { nextId } from '../common/state.mjs';

export function ensurePointsArrays(state) {
  if (!Array.isArray(state.pointAccounts)) state.pointAccounts = [];
  if (!Array.isArray(state.pointTransactions)) state.pointTransactions = [];
}

export function findPointAccount(state, userId) {
  ensurePointsArrays(state);
  return state.pointAccounts.find((row) => Number(row.userId) === Number(userId)) || null;
}

export function ensurePointAccountRow(state, { userId, balance, updatedAt }) {
  ensurePointsArrays(state);
  let account = findPointAccount(state, userId);
  if (!account) {
    account = {
      userId: Number(userId),
      balance: Number(balance || 0),
      updatedAt: updatedAt || new Date().toISOString(),
    };
    state.pointAccounts.push(account);
  }
  return account;
}

export function findPointTransactionByIdempotency(state, idempotencyKey) {
  ensurePointsArrays(state);
  if (!idempotencyKey) return null;
  return state.pointTransactions.find((row) => row.idempotencyKey === idempotencyKey) || null;
}

export function createPointTransaction(state, payload) {
  ensurePointsArrays(state);
  const transaction = {
    id: nextId(state.pointTransactions),
    tenantId: Number(payload.tenantId || 1),
    userId: Number(payload.userId),
    type: payload.type,
    amount: Number(payload.amount || 0),
    source: payload.source,
    sourceId: payload.sourceId,
    idempotencyKey: payload.idempotencyKey,
    balance: Number(payload.balance || 0),
    description: payload.description,
    createdAt: payload.createdAt || new Date().toISOString(),
  };
  state.pointTransactions.push(transaction);
  return transaction;
}
