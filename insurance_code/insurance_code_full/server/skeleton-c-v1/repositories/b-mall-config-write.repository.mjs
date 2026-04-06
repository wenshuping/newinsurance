const ensureProductArrays = (state) => {
  if (!Array.isArray(state.pProducts)) state.pProducts = [];
  if (!Array.isArray(state.mallItems)) state.mallItems = [];
};

const ensureActivityArrays = (state) => {
  if (!Array.isArray(state.mallActivities)) state.mallActivities = [];
  if (!Array.isArray(state.bCustomerActivities)) state.bCustomerActivities = [];
};

export const findMallProductById = ({ state, id }) => {
  ensureProductArrays(state);
  return state.pProducts.find((row) => Number(row.id) === Number(id)) || null;
};

export const insertMallProductAndItem = ({ state, product, item }) => {
  ensureProductArrays(state);
  state.pProducts.push(product);
  state.mallItems.push(item);
  return { product, item };
};

export const updateMallProductAndItems = ({ state, id, productPatch, itemPatch }) => {
  ensureProductArrays(state);
  const product = state.pProducts.find((row) => Number(row.id) === Number(id));
  if (!product) return null;
  Object.assign(product, productPatch);
  for (const item of state.mallItems) {
    if (Number(item.sourceProductId || item.id || 0) !== Number(id)) continue;
    Object.assign(item, itemPatch);
  }
  return product;
};

export const findMallActivityById = ({ state, id }) => {
  ensureActivityArrays(state);
  return state.mallActivities.find((row) => Number(row.id) === Number(id)) || null;
};

export const insertMallActivityAndCustomerActivity = ({ state, mallActivity, customerActivity }) => {
  ensureActivityArrays(state);
  state.mallActivities.push(mallActivity);
  state.bCustomerActivities.push(customerActivity);
  return { mallActivity, customerActivity };
};

export const updateMallActivityAndCustomerActivities = ({ state, id, patch }) => {
  ensureActivityArrays(state);
  const activity = state.mallActivities.find((row) => Number(row.id) === Number(id));
  if (!activity) return null;
  Object.assign(activity, patch);
  for (const row of state.bCustomerActivities) {
    if (Number(row.sourceMallActivityId || row.id || 0) !== Number(id)) continue;
    Object.assign(row, patch);
  }
  return activity;
};
