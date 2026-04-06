const ensurePTags = (state) => {
  if (!Array.isArray(state.pTags)) state.pTags = [];
};

export const findPTagByTenantAndId = ({ state, tenantId, id }) => {
  ensurePTags(state);
  return (
    state.pTags.find((row) => Number(row.id || 0) === Number(id || 0) && Number(row.tenantId || 1) === Number(tenantId || 0)) ||
    null
  );
};

export const hasPTagCodeConflict = ({ state, tenantId, tagCode, excludeId = 0 }) => {
  ensurePTags(state);
  return state.pTags.some((row) => {
    if (Number(row.tenantId || 1) !== Number(tenantId || 0)) return false;
    if (Number(row.id || 0) === Number(excludeId || 0)) return false;
    return String(row.tagCode || '') === String(tagCode || '');
  });
};

export const insertPTag = ({ state, row }) => {
  ensurePTags(state);
  state.pTags.push(row);
  return row;
};

export const removePTagByTenantAndId = ({ state, tenantId, id }) => {
  ensurePTags(state);
  const index = state.pTags.findIndex(
    (row) => Number(row.id || 0) === Number(id || 0) && Number(row.tenantId || 1) === Number(tenantId || 0)
  );
  if (index < 0) return false;
  state.pTags.splice(index, 1);
  return true;
};

export const isPTagInUseByRules = ({ state, tenantId, id }) =>
  (state.pTagRules || []).some((row) => {
    if (Number(row.tenantId || 1) !== Number(tenantId || 0)) return false;
    const ids = Array.isArray(row.targetTagIds) ? row.targetTagIds.map((x) => Number(x || 0)) : [Number(row.targetTagId || 0)];
    return ids.includes(Number(id || 0));
  });
