import { runInStateTransaction } from '../common/state.mjs';
import {
  assignCustomerOwnerScope,
  batchAssignCustomerOwnerScope,
  findCustomerByMobile,
} from '../repositories/user-write.repository.mjs';

export const executeSystemAssignCustomers = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const tenantId = Number(command.tenantId || 0);
    const customerIds = new Set(
      (command.customerIds || []).map((item) => Number(item || 0)).filter((item) => Number.isFinite(item) && item > 0),
    );
    const assignedAt = new Date().toISOString();

    const selectedCustomers = (state.users || []).filter(
      (row) => Number(row.tenantId || 0) === tenantId && customerIds.has(Number(row.id || 0)),
    );

    const assigned = batchAssignCustomerOwnerScope(selectedCustomers, {
      tenantId: null,
      orgId: command.agent?.orgId,
      teamId: command.agent?.teamId,
      agentId: command.agent?.id,
      updatedAt: assignedAt,
    });

    command.appendAuditLog({
      tenantId,
      actorType: command.actor.actorType,
      actorId: command.actor.actorId,
      action: 'customer.system.assign',
      resourceType: 'customer',
      resourceId: `${assigned.length}`,
      result: 'success',
      meta: { agentId: Number(command.agent?.id || 0), assignedCount: assigned.length },
    });
    command.persistState();

    return {
      ok: true,
      assignedCount: assigned.length,
      agent: {
        id: Number(command.agent?.id || 0),
        name: String(command.agent?.name || command.agent?.email || ''),
        email: String(command.agent?.email || ''),
      },
      customers: assigned,
    };
  });

export const executeAssignCustomerByMobile = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const mobile = String(command.mobile || '').trim();
    const customer = findCustomerByMobile({ state, mobile });
    if (!customer) throw new Error('CUSTOMER_NOT_FOUND');

    const assignResult = assignCustomerOwnerScope(customer, {
      tenantId: command.agent?.tenantId,
      orgId: command.agent?.orgId,
      teamId: command.agent?.teamId,
      agentId: command.agent?.id,
      updatedAt: new Date().toISOString(),
    });
    if (!assignResult.ok) throw new Error(assignResult.code || 'AGENT_SCOPE_INVALID');

    const nextTenantId = Number(assignResult.customer.tenantId);
    command.appendAuditLog({
      tenantId: nextTenantId,
      actorType: command.actor.actorType,
      actorId: command.actor.actorId,
      action: 'customer.assign.by_mobile',
      resourceType: 'customer',
      resourceId: String(customer.id),
      result: 'success',
      meta: { mobile, agentId: Number(command.agent?.id || 0) },
    });
    command.persistState();

    return {
      ok: true,
      customer: {
        id: Number(customer.id),
        mobile: String(customer.mobile || ''),
        tenantId: nextTenantId,
        ownerUserId: Number(customer.ownerUserId || 0),
      },
      agent: {
        id: Number(command.agent?.id || 0),
        tenantId: nextTenantId,
      },
    };
  });
