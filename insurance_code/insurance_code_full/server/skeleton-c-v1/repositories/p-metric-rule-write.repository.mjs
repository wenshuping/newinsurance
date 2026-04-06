const ensureMetricRules = (state) => {
  if (!Array.isArray(state.metricRules)) state.metricRules = [];
};

export const findMetricRuleByTenantAndId = ({ state, tenantId, id }) => {
  ensureMetricRules(state);
  return (
    state.metricRules.find((row) => Number(row.id || 0) === Number(id || 0) && Number(row.tenantId || 1) === Number(tenantId || 0)) ||
    null
  );
};

export const hasMetricRuleDuplicate = ({ state, tenantId, key, excludeId = 0, metricRuleKey }) => {
  ensureMetricRules(state);
  return state.metricRules.some((row) => {
    if (Number(row.tenantId || 1) !== Number(tenantId)) return false;
    if (Number(row.id || 0) === Number(excludeId || 0)) return false;
    return metricRuleKey(row.end, row.name) === key;
  });
};

export const insertMetricRule = ({ state, row }) => {
  ensureMetricRules(state);
  state.metricRules.push(row);
  return row;
};

export const removeMetricRuleByTenantAndId = ({ state, tenantId, id }) => {
  ensureMetricRules(state);
  const index = state.metricRules.findIndex(
    (row) => Number(row.id || 0) === Number(id || 0) && Number(row.tenantId || 1) === Number(tenantId || 0)
  );
  if (index < 0) return false;
  state.metricRules.splice(index, 1);
  return true;
};
