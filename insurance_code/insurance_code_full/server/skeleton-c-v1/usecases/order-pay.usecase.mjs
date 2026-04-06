import { runInStateTransaction } from '../common/state.mjs';
import { payOrderWithPoints } from '../services/commerce.service.mjs';

export const executePayOrder = async (command) => {
  if (!Number.isFinite(Number(command?.orderId)) || Number(command.orderId) <= 0) {
    throw new Error('INVALID_ORDER_ID');
  }
  return runInStateTransaction(async () =>
    await payOrderWithPoints({
      tenantId: command.tenantId,
      orderId: command.orderId,
      customerId: command.customerId,
      idempotencyKey: command.idempotencyKey || undefined,
      actor: command.actor,
    })
  );
};
