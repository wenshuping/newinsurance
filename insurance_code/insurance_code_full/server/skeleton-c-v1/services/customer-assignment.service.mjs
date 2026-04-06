import { appendAuditLog, getState, persistState } from '../common/state.mjs';
import { executeAssignCustomerByMobile, executeSystemAssignCustomers } from '../usecases/customer-assignment-write.usecase.mjs';

export function systemAssignCustomers({ tenantId, actor, agent, customers }) {
  return executeSystemAssignCustomers({
    tenantId,
    actor,
    agent,
    customerIds: (customers || []).map((row) => Number(row?.id || 0)).filter((row) => Number.isFinite(row) && row > 0),
    getState,
    appendAuditLog,
    persistState,
  });
}

export function assignCustomerByMobile({ actor, mobile, agent }) {
  return executeAssignCustomerByMobile({
    actor,
    mobile,
    agent,
    getState,
    appendAuditLog,
    persistState,
  });
}
