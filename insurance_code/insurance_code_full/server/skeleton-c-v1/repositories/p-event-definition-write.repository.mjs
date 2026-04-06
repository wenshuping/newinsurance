const ensureEventDefinitions = (state) => {
  if (!Array.isArray(state.eventDefinitions)) state.eventDefinitions = [];
};

export const findEventDefinitionByTenantAndLookup = ({ state, tenantId, eventId, id }) => {
  ensureEventDefinitions(state);
  return (
    state.eventDefinitions.find(
      (row) =>
        Number(row.tenantId || 1) === Number(tenantId) &&
        (Number(row.eventId || 0) === Number(eventId || 0) || Number(row.id || 0) === Number(id || 0))
    ) || null
  );
};

export const hasEventDefinitionIdConflict = ({ state, tenantId, eventId }) => {
  ensureEventDefinitions(state);
  return state.eventDefinitions.some(
    (row) => Number(row.tenantId || 1) === Number(tenantId) && Number(row.eventId || 0) === Number(eventId || 0)
  );
};

export const insertEventDefinition = ({ state, row }) => {
  ensureEventDefinitions(state);
  state.eventDefinitions.push(row);
  return row;
};

export const findEventDefinitionByTenantAndId = ({ state, tenantId, id }) => {
  ensureEventDefinitions(state);
  return (
    state.eventDefinitions.find(
      (row) => Number(row.id || 0) === Number(id || 0) && Number(row.tenantId || 1) === Number(tenantId || 0)
    ) || null
  );
};

export const removeEventDefinitionByTenantAndId = ({ state, tenantId, id }) => {
  ensureEventDefinitions(state);
  const index = state.eventDefinitions.findIndex(
    (row) => Number(row.id || 0) === Number(id || 0) && Number(row.tenantId || 1) === Number(tenantId || 0)
  );
  if (index < 0) return false;
  state.eventDefinitions.splice(index, 1);
  return true;
};
