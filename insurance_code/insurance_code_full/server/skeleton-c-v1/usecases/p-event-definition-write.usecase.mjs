import { runInStateTransaction } from '../common/state.mjs';
import {
  findEventDefinitionByTenantAndId,
  findEventDefinitionByTenantAndLookup,
  hasEventDefinitionIdConflict,
  insertEventDefinition,
  removeEventDefinitionByTenantAndId,
} from '../repositories/p-event-definition-write.repository.mjs';

const toItem = (row, normalizeEventType, normalizeCollectMethod, normalizeEventStatus, toEventStatusCode) => ({
  id: Number(row.id),
  eventId: Number(row.eventId),
  eventName: String(row.eventName),
  eventType: normalizeEventType(row.eventType),
  description: String(row.description || ''),
  collectMethod: normalizeCollectMethod(row.collectMethod),
  status: normalizeEventStatus(row.status),
  statusCode: toEventStatusCode(row.status),
  schema: row.schema || {},
  definitionVersion: Number(row.definitionVersion || 1),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const executeSaveEventDefinition = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const tenantId = Number(command.tenantContext?.tenantId || 0);
    const eventId = Number(command.eventId || 0);
    const eventName = String(command.eventName || '').trim();
    if (!Number.isFinite(eventId) || eventId <= 0) throw new Error('EVENT_ID_REQUIRED');
    if (!eventName) throw new Error('EVENT_NAME_REQUIRED');

    const type = command.normalizeEventType(command.eventType);
    const method = command.normalizeCollectMethod(command.collectMethod);
    const status = command.normalizeEventStatus(command.status);
    const syncSchemaWithEvent = Boolean(command.syncSchemaWithEvent);
    let schema = command.schema && typeof command.schema === 'object' ? command.schema : {};
    const templateSchema = command.eventSchemaTemplateById(eventId);
    if ((syncSchemaWithEvent || !Object.keys(schema || {}).length) && templateSchema) schema = templateSchema;

    const now = new Date().toISOString();
    let row = findEventDefinitionByTenantAndLookup({
      state,
      tenantId,
      eventId,
      id: command.id,
    });

    if (row) {
      const beforeSignature = JSON.stringify({
        eventId: Number(row.eventId || 0),
        eventName: String(row.eventName || ''),
        eventType: command.normalizeEventType(row.eventType),
        description: String(row.description || ''),
        collectMethod: command.normalizeCollectMethod(row.collectMethod),
        schema: row.schema || {},
      });
      if (row.eventType === 'system') {
        const oldEventId = Number(row.eventId || 0);
        row.eventName = eventName;
        row.description = String(command.description || row.description || '');
        row.collectMethod = method;
        row.status = status;
        row.eventId = eventId;
        if (Number(oldEventId) !== Number(eventId) && templateSchema) row.schema = templateSchema;
        else row.schema = schema;
        row.schema = syncSchemaWithEvent && templateSchema ? templateSchema : row.schema;
        row.updatedAt = now;
      } else {
        const oldEventId = Number(row.eventId || 0);
        row.eventId = eventId;
        row.eventName = eventName;
        row.eventType = type;
        row.description = String(command.description || '');
        row.collectMethod = method;
        row.status = status;
        row.schema = Number(oldEventId) !== Number(eventId) && templateSchema ? templateSchema : schema;
        if (syncSchemaWithEvent && templateSchema) row.schema = templateSchema;
        row.updatedAt = now;
      }
      const afterSignature = JSON.stringify({
        eventId: Number(row.eventId || 0),
        eventName: String(row.eventName || ''),
        eventType: command.normalizeEventType(row.eventType),
        description: String(row.description || ''),
        collectMethod: command.normalizeCollectMethod(row.collectMethod),
        schema: row.schema || {},
      });
      const currentVersion =
        typeof command.normalizeDefinitionVersion === 'function'
          ? command.normalizeDefinitionVersion(row.definitionVersion)
          : Math.max(1, Number(row.definitionVersion || 1));
      row.definitionVersion = beforeSignature !== afterSignature ? currentVersion + 1 : currentVersion;
    } else {
      if (hasEventDefinitionIdConflict({ state, tenantId, eventId })) throw new Error('EVENT_ID_CONFLICT');
      row = insertEventDefinition({
        state,
        row: {
          id: command.nextId(state.eventDefinitions || []),
          tenantId,
          eventId,
          eventName,
          eventType: type,
          description: String(command.description || ''),
          collectMethod: method,
          status,
          schema,
          definitionVersion: 1,
          createdBy: Number(command.actor?.actorId || 0) || null,
          createdAt: now,
          updatedAt: now,
        },
      });
    }

    command.appendAuditLog({
      tenantId,
      actorType: command.actor.actorType,
      actorId: command.actor.actorId,
      action: 'event_definition.save',
      resourceType: 'event_definition',
      resourceId: String(row.id),
      result: 'success',
      meta: { eventId: row.eventId, eventName: row.eventName, status: row.status, definitionVersion: row.definitionVersion || 1 },
    });
    command.persistState();
    return {
      ok: true,
      item: toItem(
        row,
        command.normalizeEventType,
        command.normalizeCollectMethod,
        command.normalizeEventStatus,
        command.toEventStatusCode
      ),
    };
  });

export const executeUpdateEventDefinitionStatus = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const tenantId = Number(command.tenantContext?.tenantId || 0);
    const id = Number(command.id || 0);
    const row = findEventDefinitionByTenantAndId({ state, tenantId, id });
    if (!row) throw new Error('EVENT_NOT_FOUND');
    row.definitionVersion =
      typeof command.normalizeDefinitionVersion === 'function'
        ? command.normalizeDefinitionVersion(row.definitionVersion)
        : Math.max(1, Number(row.definitionVersion || 1));
    row.status = command.normalizeEventStatus(command.status);
    row.updatedAt = new Date().toISOString();
    command.persistState();
    return { ok: true };
  });

export const executeDeleteEventDefinition = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const tenantId = Number(command.tenantContext?.tenantId || 0);
    const id = Number(command.id || 0);
    const row = findEventDefinitionByTenantAndId({ state, tenantId, id });
    if (!row) throw new Error('EVENT_NOT_FOUND');
    if (command.normalizeEventType(row.eventType) === 'system') throw new Error('SYSTEM_EVENT_CANNOT_DELETE');
    const removed = removeEventDefinitionByTenantAndId({ state, tenantId, id });
    if (!removed) throw new Error('EVENT_NOT_FOUND');
    command.persistState();
    return { ok: true };
  });
