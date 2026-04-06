import { runInStateTransaction } from '../common/state.mjs';
import {
  findRedemptionForUser,
  findWrittenOffByToken,
  writeoffRedemptionAndOrder,
} from '../repositories/redemption-write.repository.mjs';
import {
  appendPointsAuditLog,
  appendPointsDomainEvent,
  recordOrderStatusTransition,
  setPointsRequestContext,
} from '../../microservices/points-service/observability.mjs';

export const executeRedemptionWriteoff = async (command) => {
  const redemptionId = String(command?.redemptionId || '').trim();
  const userId = Number(command?.userId || 0);
  setPointsRequestContext({
    user_id: userId,
    redemption_id: Number(redemptionId || 0),
  });
  if (!redemptionId) throw new Error('REDEMPTION_NOT_FOUND');
  if (!Number.isFinite(userId) || userId <= 0) throw new Error('UNAUTHORIZED');

  return runInStateTransaction(async () => {
    const { state, redemption } = findRedemptionForUser({ redemptionId, userId });
    if (!redemption) throw new Error('REDEMPTION_NOT_FOUND');
    if (redemption.status === 'written_off') throw new Error('ALREADY_WRITTEN_OFF');

    const token = String(command?.token || '').trim();
    if (token && token !== String(redemption.writeoffToken || '')) throw new Error('INVALID_TOKEN');

    const tokenToCheck = token || String(redemption.writeoffToken || '');
    const alreadySuccessByToken = tokenToCheck ? findWrittenOffByToken({ token: tokenToCheck }) : null;
    if (alreadySuccessByToken) throw new Error('ALREADY_WRITTEN_OFF');

    if (new Date(redemption.expiresAt).getTime() < Date.now()) throw new Error('TOKEN_EXPIRED');

    const previousOrderStatus = String(
      Array.isArray(state.orders)
        ? state.orders.find((row) => Number(row.id) === Number(redemption.orderId))?.status || ''
        : ''
    );
    const { order } = writeoffRedemptionAndOrder({ redemption });
    if (order) {
      recordOrderStatusTransition({
        orderId: Number(order.id || 0),
        fromStatus: previousOrderStatus || 'paid',
        toStatus: order.status,
      });
    }

    appendPointsDomainEvent(
      'redemption.written_off',
      {
        redemptionId: redemption.id,
        orderId: order?.id || redemption.orderId || null,
        userId,
      },
      { tenantId: Number(command?.tenantId || 1) }
    );
    appendPointsAuditLog({
      tenantId: Number(command?.tenantId || 1),
      actorType: 'customer',
      actorId: userId,
      action: 'redemption.writeoff',
      resourceType: 'redemption',
      resourceId: String(redemption.id),
      result: 'success',
      userId,
      orderId: Number(order?.id || redemption.orderId || 0),
      redemptionId: Number(redemption.id || 0),
    });

    return {
      ok: true,
      orderId: Number(order?.id || redemption.orderId || 0),
      redemptionId: Number(redemption.id || 0),
    };
  });
};
