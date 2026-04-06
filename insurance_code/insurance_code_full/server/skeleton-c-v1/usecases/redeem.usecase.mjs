import { getBalance, runInStateTransaction } from '../common/state.mjs';
import { createOrder, payOrderWithPoints } from '../services/commerce.service.mjs';

export const executeRedeem = async (command) => {
  if (!command?.isVerifiedBasic) throw new Error('NEED_BASIC_VERIFY');
  if (!Number.isFinite(Number(command?.itemId)) || Number(command.itemId) <= 0) throw new Error('INVALID_ITEM_ID');

  return runInStateTransaction(async () => {
    const createRes = await createOrder({
      tenantId: command.tenantId,
      customerId: command.customerId,
      productId: command.itemId,
      quantity: 1,
      idempotencyKey: command.idempotencyKey ? `mall-create:${command.idempotencyKey}` : undefined,
      actor: command.actor,
    });

    const payRes = await payOrderWithPoints({
      tenantId: command.tenantId,
      orderId: Number(createRes.order.id),
      customerId: command.customerId,
      idempotencyKey: command.idempotencyKey ? `mall-pay:${command.idempotencyKey}` : undefined,
      actor: command.actor,
    });

    return {
      order: createRes.order,
      redemption: payRes.redemption,
      balance: getBalance(command.customerId),
    };
  });
};
