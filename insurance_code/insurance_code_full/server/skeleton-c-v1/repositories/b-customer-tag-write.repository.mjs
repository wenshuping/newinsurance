const ensureBCustomerTags = (state) => {
  if (!Array.isArray(state.bCustomerTags)) state.bCustomerTags = [];
};

const ensureBCustomerTagRels = (state) => {
  if (!Array.isArray(state.bCustomerTagRels)) state.bCustomerTagRels = [];
};

export const findCustomerById = ({ state, customerId }) =>
  (state.users || []).find((row) => Number(row.id || 0) === Number(customerId || 0)) || null;

export const findBCustomerTagByTenantAndName = ({ state, tenantId, name }) => {
  ensureBCustomerTags(state);
  return (
    state.bCustomerTags.find((row) => Number(row.tenantId || 0) === Number(tenantId || 0) && String(row.name || '') === String(name || '')) ||
    null
  );
};

export const insertBCustomerTag = ({ state, row }) => {
  ensureBCustomerTags(state);
  state.bCustomerTags.push(row);
  return row;
};

export const hasBCustomerTagRelation = ({ state, customerId, tagId }) => {
  ensureBCustomerTagRels(state);
  return state.bCustomerTagRels.some((row) => Number(row.customerId || 0) === Number(customerId || 0) && Number(row.tagId || 0) === Number(tagId || 0));
};

export const insertBCustomerTagRelation = ({ state, row }) => {
  ensureBCustomerTagRels(state);
  state.bCustomerTagRels.push(row);
  return row;
};
