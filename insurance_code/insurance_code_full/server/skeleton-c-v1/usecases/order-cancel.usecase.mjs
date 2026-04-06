import { runInStateTransaction } from '../common/state.mjs';
import { cancelOrder } from '../services/commerce.service.mjs';

export const executeCancelOrder = async (command) => {
  if (!Number.isFinite(Number(command?.orderId)) || Number(command.orderId) <= 0) {
    throw new Error('INVALID_ORDER_ID');
  }
  return runInStateTransaction(async () =>
    cancelOrder({
      tenantId: command.tenantId,
      orderId: command.orderId,
      customerId: command.customerId,
      reason: command.reason,
      actor: command.actor,
    })
  );
};
