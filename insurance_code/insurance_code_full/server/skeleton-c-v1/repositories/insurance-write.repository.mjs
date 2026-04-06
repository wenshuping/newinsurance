const ensurePolicies = (state) => {
  if (!Array.isArray(state.policies)) state.policies = [];
};

export const insertPolicy = ({ state, policy }) => {
  ensurePolicies(state);
  state.policies.push(policy);
  return policy;
};

export const updatePolicyById = ({ state, policyId, updater }) => {
  ensurePolicies(state);
  const index = state.policies.findIndex((item) => Number(item?.id) === Number(policyId));
  if (index < 0) return null;
  const current = state.policies[index];
  const next = typeof updater === 'function' ? updater(current) : current;
  state.policies[index] = next;
  return next;
};

export const removePolicyById = ({ state, policyId }) => {
  ensurePolicies(state);
  const index = state.policies.findIndex((item) => Number(item?.id) === Number(policyId));
  if (index < 0) return null;
  const [removed] = state.policies.splice(index, 1);
  return removed || null;
};
