const ensurePProducts = (state) => {
  if (!Array.isArray(state.pProducts)) state.pProducts = [];
};

const ensureMallItems = (state) => {
  if (!Array.isArray(state.mallItems)) state.mallItems = [];
};

const ensureMallActivities = (state) => {
  if (!Array.isArray(state.mallActivities)) state.mallActivities = [];
};

export const findPMallProductById = ({ state, id }) => {
  ensurePProducts(state);
  return state.pProducts.find((item) => Number(item.id || 0) === Number(id || 0)) || null;
};

export const insertPMallProduct = ({ state, row }) => {
  ensurePProducts(state);
  state.pProducts.push(row);
  return row;
};

export const insertMallItemMirror = ({ state, row }) => {
  ensureMallItems(state);
  state.mallItems.push(row);
  return row;
};

const ACTIVE_STATUSES = new Set(['active', 'online', 'published', 'on', 'running', '进行中', '生效']);

const isMirrorOfProduct = (item, productId) =>
  Number(item.sourceProductId || item.id || 0) === Number(productId || 0);

const toMirrorPatch = ({ product, previous = {} }) => {
  const status = String(product?.status || '').trim().toLowerCase();
  return {
    ...previous,
    id: Number(previous.id || product.id || 0),
    sourceProductId: Number(product.id || previous.sourceProductId || previous.id || 0),
    tenantId: Number(product.tenantId || previous.tenantId || 1),
    name: String(product.title || product.name || previous.name || ''),
    pointsCost: Number(product.points ?? product.pointsCost ?? previous.pointsCost ?? 0),
    stock: Number(product.stock ?? previous.stock ?? 0),
    description: String(product.description || product.desc || previous.description || ''),
    isActive: ACTIVE_STATUSES.has(status) || previous.isActive === true,
    sortOrder: Number(product.sortOrder ?? previous.sortOrder ?? 0),
    media: Array.isArray(product.media) ? product.media : Array.isArray(previous.media) ? previous.media : [],
    createdBy: Number(product.createdBy || previous.createdBy || 0) || null,
    creatorRole: String(product.creatorRole || previous.creatorRole || ''),
    templateScope: String(product.templateScope || previous.templateScope || 'tenant'),
    createdAt: previous.createdAt || product.createdAt || new Date().toISOString(),
    updatedAt: product.updatedAt || new Date().toISOString(),
  };
};

export const syncMallItemMirrorByProduct = ({ state, product }) => {
  ensureMallItems(state);
  const productId = Number(product?.id || 0);
  if (productId <= 0) return 0;

  let touched = 0;
  for (const item of state.mallItems) {
    if (!isMirrorOfProduct(item, productId)) continue;
    Object.assign(item, toMirrorPatch({ product, previous: item }));
    touched += 1;
  }

  if (touched === 0) {
    state.mallItems.push(
      toMirrorPatch({
        product,
        previous: {
          id: productId,
          sourceProductId: productId,
        },
      })
    );
    touched = 1;
  }

  return touched;
};

export const removeMallItemMirrorsByProductId = ({ state, productId }) => {
  ensureMallItems(state);
  const pid = Number(productId || 0);
  if (pid <= 0) return 0;
  const before = state.mallItems.length;
  state.mallItems = state.mallItems.filter((item) => !isMirrorOfProduct(item, pid));
  return before - state.mallItems.length;
};

export const findPMallProductIndexById = ({ state, id }) => {
  ensurePProducts(state);
  return state.pProducts.findIndex((item) => Number(item.id || 0) === Number(id || 0));
};

export const findPMallProductCompanyOverrideIndex = ({ state, tenantId, sourceTemplateId }) => {
  ensurePProducts(state);
  return state.pProducts.findIndex(
    (item) =>
      Number(item.tenantId || 1) === Number(tenantId || 0) &&
      Number(item.sourceTemplateId || 0) === Number(sourceTemplateId || 0) &&
      String(item.creatorRole || '') === 'company_admin'
  );
};

export const removePMallProductByIndex = ({ state, index }) => {
  ensurePProducts(state);
  if (index < 0 || index >= state.pProducts.length) return false;
  state.pProducts.splice(index, 1);
  return true;
};

export const findPMallActivityById = ({ state, id }) => {
  ensureMallActivities(state);
  return state.mallActivities.find((item) => Number(item.id || 0) === Number(id || 0)) || null;
};

export const insertPMallActivity = ({ state, row }) => {
  ensureMallActivities(state);
  state.mallActivities.push(row);
  return row;
};

export const findPMallActivityIndexById = ({ state, id }) => {
  ensureMallActivities(state);
  return state.mallActivities.findIndex((item) => Number(item.id || 0) === Number(id || 0));
};

export const findPMallActivityCompanyOverrideIndex = ({ state, tenantId, sourceTemplateId }) => {
  ensureMallActivities(state);
  return state.mallActivities.findIndex(
    (item) =>
      Number(item.tenantId || 1) === Number(tenantId || 0) &&
      Number(item.sourceTemplateId || 0) === Number(sourceTemplateId || 0) &&
      String(item.creatorRole || '') === 'company_admin'
  );
};

export const removePMallActivityByIndex = ({ state, index }) => {
  ensureMallActivities(state);
  if (index < 0 || index >= state.mallActivities.length) return false;
  state.mallActivities.splice(index, 1);
  return true;
};
