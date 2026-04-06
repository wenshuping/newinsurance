import { runInStateTransaction } from '../common/state.mjs';
import { refundOrder } from '../services/commerce.service.mjs';

export const executeRefundOrder = async (command) => {
  if (!Number.isFinite(Number(command?.orderId)) || Number(command.orderId) <= 0) {
    throw new Error('INVALID_ORDER_ID');
  }
  return runInStateTransaction(async () =>
    refundOrder({
      tenantId: command.tenantId,
      orderId: command.orderId,
      operatorId: command.operatorId,
      reason: command.reason,
      actor: command.actor,
    })
  );
};
