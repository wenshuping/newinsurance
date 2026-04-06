import { decoratePlatformTemplateRow, preferActorTemplateRows } from './p-admin.shared.mjs';

function resolveMallProductSource(state) {
  const products = Array.isArray(state?.pProducts) ? state.pProducts : [];
  return products.length ? products : Array.isArray(state?.mallItems) ? state.mallItems : [];
}

function resolveMallActivitySource(state) {
  const mallActivities = Array.isArray(state?.mallActivities) ? state.mallActivities : [];
  return mallActivities.length ? mallActivities : Array.isArray(state?.bCustomerActivities) ? state.bCustomerActivities : [];
}

function resolveTemplateSource(decoratedRow = {}, row = {}) {
  if (decoratedRow?.isPlatformTemplate) return 'platform';
  return String(row?.creatorRole || '').trim().toLowerCase() === 'company_admin' ? 'company' : 'personal';
}

export function buildAdminMallProductList({ state, actor, canAccessTemplate, effectiveTemplateStatusForActor }) {
  const rows = preferActorTemplateRows(
    state,
    actor,
    resolveMallProductSource(state).filter((row) => canAccessTemplate(state, actor, row))
  );

  return rows
    .map((row, index) => {
      const decorated = decoratePlatformTemplateRow(state, row);
      const templateSource = resolveTemplateSource(decorated, row);
      return {
        id: Number(row.id || index + 1),
        title: String(row.title || row.name || '').trim(),
        points: Number(row.points ?? row.pointsCost ?? 0),
        stock: Number(row.stock ?? 0),
        sortOrder: Number(row.sortOrder ?? index + 1),
        category: String(row.category || '实物礼品 (Gift)'),
        description: String(row.description || row.desc || ''),
        limitPerUser: Boolean(row.limitPerUser),
        vipOnly: Boolean(row.vipOnly),
        enableCountdown: Boolean(row.enableCountdown),
        status: String(
          effectiveTemplateStatusForActor(state, actor, row, { inheritedStatus: 'inactive' })
          || row.status
          || (row.isActive ? 'active' : 'inactive')
          || 'inactive'
        ),
        updatedAt: row.updatedAt || row.createdAt || new Date().toISOString(),
        media: Array.isArray(row.media) ? row.media.slice(0, 6) : [],
        isPlatformTemplate: Boolean(decorated.isPlatformTemplate),
        templateSource,
        templateTag: String(
          decorated.templateTag
          || (templateSource === 'company' ? '公司模板' : templateSource === 'personal' ? '个人模板' : '')
        ),
      };
    })
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || Number(a.id || 0) - Number(b.id || 0));
}

export function buildAdminMallActivityList({ state, actor, canAccessTemplate, effectiveTemplateStatusForActor }) {
  const rows = preferActorTemplateRows(
    state,
    actor,
    resolveMallActivitySource(state).filter((row) => canAccessTemplate(state, actor, row))
  );

  return rows
    .map((row, index) => {
      const decorated = decoratePlatformTemplateRow(state, row);
      const templateSource = resolveTemplateSource(decorated, row);
      return {
        id: Number(row.id || index + 1),
        title: String(row.displayTitle || row.title || row.name || '').trim(),
        displayTitle: String(row.displayTitle || row.title || row.name || '').trim(),
        type: String(row.type || row.category || 'task'),
        rewardPoints: Number(row.rewardPoints ?? row.points ?? 0),
        sortOrder: Number(row.sortOrder ?? index + 1),
        description: String(row.description || row.desc || ''),
        status: String(
          effectiveTemplateStatusForActor(state, actor, row, { inheritedStatus: 'inactive' })
          || row.status
          || (row.isActive ? 'active' : 'inactive')
          || 'inactive'
        ),
        updatedAt: row.updatedAt || row.createdAt || new Date().toISOString(),
        media: Array.isArray(row.media) ? row.media.slice(0, 6) : [],
        isPlatformTemplate: Boolean(decorated.isPlatformTemplate),
        templateSource,
        templateTag: String(
          decorated.templateTag
          || (templateSource === 'company' ? '公司模板' : templateSource === 'personal' ? '个人模板' : '')
        ),
      };
    })
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || Number(a.id || 0) - Number(b.id || 0));
}
