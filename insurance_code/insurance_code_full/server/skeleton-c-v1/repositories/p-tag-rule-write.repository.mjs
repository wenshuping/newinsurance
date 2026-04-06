const ensurePTagRules = (state) => {
  if (!Array.isArray(state.pTagRules)) state.pTagRules = [];
};

export const findPTagRuleByTenantAndId = ({ state, tenantId, id }) => {
  ensurePTagRules(state);
  return (
    state.pTagRules.find(
      (row) => Number(row.id || 0) === Number(id || 0) && Number(row.tenantId || 1) === Number(tenantId || 0)
    ) || null
  );
};

export const hasPTagRuleCodeConflict = ({ state, tenantId, ruleCode, excludeId = 0 }) => {
  ensurePTagRules(state);
  return state.pTagRules.some((row) => {
    if (Number(row.tenantId || 1) !== Number(tenantId || 0)) return false;
    if (Number(row.id || 0) === Number(excludeId || 0)) return false;
    return String(row.ruleCode || '') === String(ruleCode || '');
  });
};

export const insertPTagRule = ({ state, row }) => {
  ensurePTagRules(state);
  state.pTagRules.push(row);
  return row;
};

export const removePTagRuleByTenantAndId = ({ state, tenantId, id }) => {
  ensurePTagRules(state);
  const index = state.pTagRules.findIndex(
    (row) => Number(row.id || 0) === Number(id || 0) && Number(row.tenantId || 1) === Number(tenantId || 0)
  );
  if (index < 0) return false;
  state.pTagRules.splice(index, 1);
  return true;
};
