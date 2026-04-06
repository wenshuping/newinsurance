import { getBalance, getState } from '../common/state.mjs';
import {
  createPointTransaction,
  ensurePointAccountRow,
  findPointTransactionByIdempotency,
} from '../repositories/points.repository.mjs';
import { recordPointsMovement, setPointsRequestContext } from '../../microservices/points-service/observability.mjs';

export function ensurePointAccount(userId) {
  const state = getState();
  return ensurePointAccountRow(state, {
    userId: Number(userId),
    balance: getBalance(userId),
    updatedAt: new Date().toISOString(),
  });
}

export function recordPoints({ tenantId, userId, direction, amount, sourceType, sourceId, idempotencyKey, description }) {
  const state = getState();
  const exists = findPointTransactionByIdempotency(state, idempotencyKey);
  if (exists) {
    ensurePointAccount(userId);
    setPointsRequestContext({
      user_id: Number(userId),
      order_id: String(sourceType || '').startsWith('order_') ? Number(sourceId || 0) : null,
    });
    return {
      duplicated: true,
      transaction: exists,
      balance: exists.balance,
    };
  }

  const account = ensurePointAccount(userId);
  const delta = direction === 'in' ? amount : -amount;
  const nextBalance = Number(account.balance || 0) + delta;
  if (nextBalance < 0) {
    throw new Error('POINTS_BALANCE_NEGATIVE');
  }

  account.balance = nextBalance;
  account.updatedAt = new Date().toISOString();

  const transaction = createPointTransaction(state, {
    tenantId: Number(tenantId || 1),
    userId,
    type: direction === 'in' ? 'earn' : 'consume',
    amount,
    source: sourceType,
    sourceId,
    idempotencyKey,
    balance: nextBalance,
    description,
    createdAt: new Date().toISOString(),
  });

  const orderId = String(sourceType || '').startsWith('order_') ? Number(sourceId || 0) : null;
  recordPointsMovement({
    direction,
    userId: Number(userId),
    orderId,
  });

  return {
    duplicated: false,
    transaction,
    balance: nextBalance,
  };
}
