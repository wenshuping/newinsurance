import { runInStateTransaction } from '../common/state.mjs';
import { createOrder } from '../services/commerce.service.mjs';

export const executeCreateOrder = async (command) => {
  if (!Number.isFinite(Number(command?.productId)) || Number(command.productId) <= 0) {
    throw new Error('INVALID_PRODUCT_ID');
  }

  return runInStateTransaction(async () =>
    await createOrder({
      tenantId: command.tenantId,
      customerId: command.customerId,
      productId: command.productId,
      quantity: command.quantity,
      idempotencyKey: command.idempotencyKey || undefined,
      actor: command.actor,
    })
  );
};
