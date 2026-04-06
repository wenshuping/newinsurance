const ensureActivities = (state) => {
  if (!Array.isArray(state.activities)) state.activities = [];
};

const ensurePActivities = (state) => {
  if (!Array.isArray(state.pActivities)) state.pActivities = [];
};

export const findPActivityById = ({ state, id }) => {
  ensureActivities(state);
  return state.activities.find((row) => Number(row.id || 0) === Number(id || 0)) || null;
};

export const insertPActivity = ({ state, row }) => {
  ensureActivities(state);
  ensurePActivities(state);
  state.activities.push(row);
  if (state.pActivities !== state.activities) state.pActivities.push(row);
  return row;
};

export const findPActivityIndexById = ({ state, id }) => {
  ensureActivities(state);
  return state.activities.findIndex((item) => Number(item.id || 0) === Number(id || 0));
};

export const findPCompanyOverrideActivityIndex = ({ state, tenantId, sourceTemplateId }) => {
  ensureActivities(state);
  return state.activities.findIndex(
    (item) =>
      Number(item.tenantId || 1) === Number(tenantId || 0) &&
      Number(item.sourceTemplateId || 0) === Number(sourceTemplateId || 0) &&
      String(item.creatorRole || '') === 'company_admin'
  );
};

export const removePActivityByIndex = ({ state, index }) => {
  ensureActivities(state);
  ensurePActivities(state);
  if (index < 0 || index >= state.activities.length) return false;
  const [removed] = state.activities.splice(index, 1);
  if (removed && state.pActivities !== state.activities) {
    const writeIndex = state.pActivities.findIndex((item) => Number(item.id || 0) === Number(removed.id || 0));
    if (writeIndex >= 0) state.pActivities.splice(writeIndex, 1);
  }
  return true;
};
