export const callPRefundOrder = ({ command }) =>
  command.refundOrder({
    tenantId: command.tenantId,
    orderId: command.orderId,
    operatorId: command.operatorId,
    reason: command.reason,
    actor: command.actor,
  });

export const callPRebuildStats = ({ command }) => command.rebuildDailySnapshot(command.day);

export const callPRunReconciliation = ({ command }) => command.runReconciliation(command.day);
