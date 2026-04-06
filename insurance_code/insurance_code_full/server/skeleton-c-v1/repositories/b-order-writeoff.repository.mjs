export const callOrderWriteoff = ({ command }) =>
  command.fulfillOrderWriteoff({
    tenantId: command.tenantId,
    orderId: command.orderId,
    operatorAgentId: command.operatorAgentId,
    token: String(command.token || ''),
    actor: command.actor,
  });
