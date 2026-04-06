import { runInStateTransaction } from '../common/state.mjs';
import {
  findBCustomerTagByTenantAndName,
  findCustomerById,
  hasBCustomerTagRelation,
  insertBCustomerTag,
  insertBCustomerTagRelation,
} from '../repositories/b-customer-tag-write.repository.mjs';

export const executeAddBCustomerTag = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const customerId = Number(command.customerId || 0);
    const customer = findCustomerById({ state, customerId });
    if (!customer || !command.dataScope?.canAccessCustomer?.(customer)) throw new Error('CUSTOMER_NOT_FOUND');

    const tagName = String(command.tagName || '').trim();
    if (!tagName) throw new Error('TAG_REQUIRED');

    const tenantId = Number(command.tenantContext?.tenantId || 0);
    let tag = findBCustomerTagByTenantAndName({ state, tenantId, name: tagName });
    if (!tag) {
      tag = insertBCustomerTag({
        state,
        row: {
          id: command.nextId(state.bCustomerTags || []),
          tenantId,
          name: tagName,
          createdBy: command.actor.actorId,
          createdAt: new Date().toISOString(),
        },
      });
    }

    if (!hasBCustomerTagRelation({ state, customerId, tagId: tag.id })) {
      insertBCustomerTagRelation({
        state,
        row: {
          id: command.nextId(state.bCustomerTagRels || []),
          tenantId,
          customerId,
          tagId: tag.id,
          createdBy: command.actor.actorId,
          createdAt: new Date().toISOString(),
        },
      });
    }

    command.appendAuditLog({
      tenantId,
      actorType: command.actor.actorType,
      actorId: command.actor.actorId,
      action: 'customer.tag.add',
      resourceType: 'customer',
      resourceId: String(customerId),
      result: 'success',
    });
    command.persistState();
    return { ok: true, tag };
  });

export const executeCreateBCustomTag = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const tenantId = Number(command.tenantContext?.tenantId || 0);
    const name = String(command.name || '').trim();
    if (!name) throw new Error('TAG_REQUIRED');
    if (name.length > 10) throw new Error('TAG_TOO_LONG');

    let tag = findBCustomerTagByTenantAndName({ state, tenantId, name });
    if (!tag) {
      tag = insertBCustomerTag({
        state,
        row: {
          id: command.nextId(state.bCustomerTags || []),
          tenantId,
          name,
          createdBy: command.actor.actorId,
          createdAt: new Date().toISOString(),
        },
      });
      command.persistState();
    }
    return { ok: true, tag };
  });
