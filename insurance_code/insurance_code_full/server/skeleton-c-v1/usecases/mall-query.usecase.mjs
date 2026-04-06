import { getState } from '../common/state.mjs';
import { sortRowsByEffectiveTimeDesc } from '../common/effective-time-sort.mjs';
import { canDeliverTemplateToActor } from '../common/template-visibility.mjs';
import { isVisibleTemplateStatus } from '../common/status-policy.mjs';

function mediaToUrl(mediaItem) {
  if (!mediaItem) return '';
  if (typeof mediaItem === 'string') return mediaItem;
  return String(mediaItem.preview || mediaItem.url || mediaItem.path || mediaItem.name || '');
}

function toAbsoluteUrl(req, url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (!raw.startsWith('/')) return raw;
  return `${req.protocol}://${req.get('host')}${raw}`;
}

export const listMallItems = ({ actor, req }) => {
  const state = getState();
  const source = Array.isArray(state.pProducts) ? state.pProducts : [];
  const sortedSource = sortRowsByEffectiveTimeDesc(source);
  const items = sortedSource
    .filter((item) => {
      const activeByFlag = typeof item.isActive === 'boolean' ? item.isActive : null;
      const activeByStatus = isVisibleTemplateStatus(item.status);
      const isOn = activeByFlag === null ? activeByStatus : activeByFlag || activeByStatus;
      return isOn && canDeliverTemplateToActor(state, actor, item);
    })
    .map((item) => {
      const media = Array.isArray(item.media) ? item.media : [];
      const image = toAbsoluteUrl(req, mediaToUrl(media[0]) || String(item.image || ''));
      return {
        ...item,
        name: String(item.name || item.title || ''),
        pointsCost: Number(item.pointsCost || item.points || 0),
        stock: Number(item.stock || 0),
        image: image || '',
        media,
        description: String(item.description || item.desc || ''),
      };
    });
  return { items };
};

export const listMallActivities = ({ actor, req }) => {
  const state = getState();
  const source =
    Array.isArray(state.mallActivities) && state.mallActivities.length
      ? state.mallActivities
      : Array.isArray(state.bCustomerActivities)
        ? state.bCustomerActivities
        : [];
  const seen = new Set();
  const uniqueSource = sortRowsByEffectiveTimeDesc(source)
    .filter((row) => {
      const key = `${Number(row.id || 0)}:${String(row.title || row.displayTitle || '')}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  const list = uniqueSource
    .filter((row) => canDeliverTemplateToActor(state, actor, row))
    .map((row, idx) => {
      const activityId = Number(row.id || idx + 1);
      const media = Array.isArray(row.media) ? row.media : [];
      const image = toAbsoluteUrl(req, mediaToUrl(media[0]) || String(row.image || ''));
      const joined = req.user
        ? (Array.isArray(state.activityCompletions) ? state.activityCompletions : []).some(
            (item) =>
              Number(item?.userId || 0) === Number(req.user?.id || 0) &&
              Number(item?.activityId || 0) === activityId
          )
        : false;
      return {
        id: activityId,
        title: String(row.displayTitle || row.title || `商城活动${idx + 1}`),
        subtitle: String(row.description || row.desc || '参与活动可赢积分奖励'),
        badge: '商城活动',
        rewardPoints: Number(row.rewardPoints || 0),
        status: String(row.status || 'active'),
        joined,
        image: image || '',
        media,
      };
    });
  return { list };
};

export const assertRedeemableProduct = ({ itemId, actor }) => {
  const state = getState();
  const productTemplate = (Array.isArray(state.pProducts) ? state.pProducts : []).find((row) => Number(row.id) === Number(itemId));
  if (!productTemplate || !canDeliverTemplateToActor(state, actor, productTemplate)) {
    throw new Error('ITEM_NOT_AVAILABLE');
  }
  return productTemplate;
};

export const getMallActivityForJoin = ({ activityId, actor }) => {
  const state = getState();
  const source =
    Array.isArray(state.mallActivities) && state.mallActivities.length
      ? state.mallActivities
      : Array.isArray(state.bCustomerActivities)
        ? state.bCustomerActivities
        : [];
  const activity = source.find((row) => Number(row.id) === Number(activityId));
  if (!activity) throw new Error('MALL_ACTIVITY_NOT_FOUND');
  if (!canDeliverTemplateToActor(state, actor, activity)) throw new Error('MALL_ACTIVITY_NOT_AVAILABLE');
  return activity;
};
