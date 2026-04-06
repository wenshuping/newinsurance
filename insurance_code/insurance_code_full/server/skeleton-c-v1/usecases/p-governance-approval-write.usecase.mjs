import { runInStateTransaction } from '../common/state.mjs';
import { findApprovalById, insertApproval } from '../repositories/p-governance-approval-write.repository.mjs';

export const executeCreateApproval = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const row = {
      id: command.nextId(state.approvals || []),
      tenantId: Number(command.tenantContext?.tenantId || 0),
      requestType: String(command.requestType || 'customer_detail_view'),
      requesterUserType: String(command.requesterUserType || 'employee'),
      requesterUserId: Number(command.requesterUserId || command.actor?.actorId || 0),
      reason: String(command.reason || ''),
      scope: command.scope || {},
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    insertApproval({ state, approval: row });
    command.persistState();
    return { ok: true, approval: row };
  });

export const executeApproveApproval = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const id = Number(command.approvalId || 0);
    const row = findApprovalById({ state, id });
    if (!row) throw new Error('APPROVAL_NOT_FOUND');
    row.status = 'approved';
    row.approvedBy = Number(command.actor?.actorId || 0);
    row.approvedAt = new Date().toISOString();
    row.expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    command.appendAuditLog({
      tenantId: Number(command.tenantContext?.tenantId || 0),
      actorType: command.actor?.actorType,
      actorId: Number(command.actor?.actorId || 0),
      action: 'approval.approve',
      resourceType: 'approval',
      resourceId: String(row.id),
      result: 'success',
    });
    command.persistState();
    return { ok: true, approval: row };
  });
