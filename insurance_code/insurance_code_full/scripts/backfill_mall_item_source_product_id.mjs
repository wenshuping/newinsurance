#!/usr/bin/env node

if (!process.env.STORAGE_BACKEND && !process.env.DATABASE_URL) {
  process.env.STORAGE_BACKEND = 'dbjson';
}

let closeState = null;
let getState = null;
let nextId = null;
let runInStateTransaction = null;

async function ensureStateModule() {
  if (closeState && getState && nextId && runInStateTransaction) return;
  const stateModule = await import('../server/skeleton-c-v1/common/state.mjs');
  closeState = stateModule.closeState;
  getState = stateModule.getState;
  nextId = stateModule.nextId;
  runInStateTransaction = stateModule.runInStateTransaction;
}

function toText(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function normalizedProductName(row) {
  return toText(row?.name || row?.title);
}

function normalizedItemName(row) {
  return toText(row?.name || row?.title);
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeTenantId(value, fallback = 1) {
  const tenantId = toNumber(value, 0);
  return tenantId > 0 ? tenantId : fallback;
}

function pickByNameAndPoints(products, item, tenantId = null) {
  const itemName = normalizedItemName(item);
  const itemPoints = toNumber(item?.pointsCost || item?.points);
  const scoped = Number(tenantId || 0) > 0 ? products.filter((row) => normalizeTenantId(row?.tenantId, 0) === Number(tenantId)) : products;
  const byName = scoped.filter((row) => normalizedProductName(row) === itemName);
  if (byName.length === 1) return byName[0];
  const byNameAndPoints = byName.filter((row) => toNumber(row.pointsCost || row.points) === itemPoints);
  if (byNameAndPoints.length === 1) return byNameAndPoints[0];
  return null;
}

function ensureProductFromMallItem(state, item, tenantId, stats) {
  if (!Array.isArray(state.pProducts)) state.pProducts = [];
  const id = nextId(state.pProducts);
  const shelfStatus = item?.isActive === false ? 'off' : 'on';
  const row = {
    id,
    tenantId: normalizeTenantId(tenantId, 1),
    name: String(item?.name || item?.title || `商品_${id}`),
    description: String(item?.description || ''),
    pointsCost: Math.max(1, toNumber(item?.pointsCost || item?.points, 1)),
    stock: Math.max(0, toNumber(item?.stock, 0)),
    shelfStatus,
    status: shelfStatus,
    sortOrder: toNumber(item?.sortOrder, 0),
    media: Array.isArray(item?.media) ? item.media : [],
    createdBy: toNumber(item?.createdBy, 0) || null,
    createdAt: new Date().toISOString(),
  };
  state.pProducts.push(row);
  stats.createdProducts += 1;
  return row;
}

async function run() {
  await ensureStateModule();
  const stats = await runInStateTransaction(async () => {
    const state = getState();
    const mallItems = Array.isArray(state.mallItems) ? state.mallItems : [];
    if (!Array.isArray(state.pProducts)) state.pProducts = [];
    const pProducts = state.pProducts;

    const stats = {
      totalMallItems: mallItems.length,
      alreadyMapped: 0,
      fixedTenant: 0,
      fixedById: 0,
      fixedByNameAndPoints: 0,
      fixedByCrossTenantNameAndPoints: 0,
      fixedSource: 0,
      createdProducts: 0,
      unresolved: 0,
      touched: 0,
      unresolvedSamples: [],
    };

    for (const item of mallItems) {
      const sourceProductId = toNumber(item.sourceProductId, 0);
      let tenantId = normalizeTenantId(item.tenantId, 0);
      let sourceProduct = sourceProductId > 0 ? pProducts.find((row) => Number(row.id || 0) === sourceProductId) || null : null;

      if (tenantId <= 0 && sourceProduct) {
        tenantId = normalizeTenantId(sourceProduct.tenantId, 0);
      }
      if (tenantId <= 0) {
        const byId = pProducts.find((row) => Number(row.id || 0) === Number(item.id || 0));
        if (byId) tenantId = normalizeTenantId(byId.tenantId, 0);
      }
      if (tenantId <= 0) {
        const guessedTenant = pickByNameAndPoints(pProducts, item, null);
        if (guessedTenant) tenantId = normalizeTenantId(guessedTenant.tenantId, 0);
      }
      if (tenantId <= 0) tenantId = 1;

      if (normalizeTenantId(item.tenantId, 0) !== tenantId) {
        item.tenantId = tenantId;
        stats.fixedTenant += 1;
        stats.touched += 1;
      }

      if (sourceProduct && normalizeTenantId(sourceProduct.tenantId, tenantId) !== tenantId) {
        sourceProduct = null;
      }
      if (!sourceProduct) {
        const direct = pProducts.find(
          (row) =>
            Number(row.id || 0) === Number(item.id || 0) &&
            normalizeTenantId(row.tenantId, 0) === tenantId
        );
        if (direct) {
          sourceProduct = direct;
          stats.fixedById += 1;
        }
      }
      if (!sourceProduct) {
        const guessedScoped = pickByNameAndPoints(pProducts, item, tenantId);
        if (guessedScoped) {
          sourceProduct = guessedScoped;
          stats.fixedByNameAndPoints += 1;
        }
      }
      if (!sourceProduct) {
        const guessedGlobal = pickByNameAndPoints(pProducts, item, null);
        if (guessedGlobal) {
          sourceProduct = guessedGlobal;
          const guessedTenantId = normalizeTenantId(guessedGlobal.tenantId, tenantId);
          if (guessedTenantId !== tenantId) {
            tenantId = guessedTenantId;
            if (normalizeTenantId(item.tenantId, 0) !== tenantId) {
              item.tenantId = tenantId;
              stats.fixedTenant += 1;
              stats.touched += 1;
            }
          }
          stats.fixedByCrossTenantNameAndPoints += 1;
        }
      }
      if (!sourceProduct) {
        sourceProduct = ensureProductFromMallItem(state, item, tenantId, stats);
        stats.touched += 1;
      }

      const resolvedSource = toNumber(sourceProduct.id, 0);
      if (resolvedSource > 0 && sourceProductId !== resolvedSource) {
        item.sourceProductId = resolvedSource;
        stats.fixedSource += 1;
        stats.touched += 1;
      }

      if (toNumber(item.sourceProductId, 0) > 0) {
        stats.alreadyMapped += 1;
        continue;
      }

      stats.unresolved += 1;
      if (stats.unresolvedSamples.length < 20) {
        stats.unresolvedSamples.push({
          id: Number(item.id || 0),
          tenantId: Number(item.tenantId || 0),
          name: String(item.name || item.title || ''),
          pointsCost: toNumber(item.pointsCost || item.points),
        });
      }
    }

    return stats;
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        persisted: stats.touched > 0,
        stats,
      },
      null,
      2
    )
  );
  await closeState();
}

run().catch(async (err) => {
  console.error(err?.message || err);
  await closeState().catch(() => undefined);
  process.exit(1);
});
