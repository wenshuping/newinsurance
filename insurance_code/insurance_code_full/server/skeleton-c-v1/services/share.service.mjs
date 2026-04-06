import crypto from 'node:crypto';
import { getState, resolveUserFromBearer } from '../common/state.mjs';
import { canAccessTemplate, isPlatformTemplate } from '../common/template-visibility.mjs';
import { isVisibleTemplateStatus } from '../common/status-policy.mjs';
import { assignCustomerOwnerScope, findCustomerById } from '../repositories/user-write.repository.mjs';
import { buildMallItemLookup, summarizeBehaviorEvent } from '../routes/b-admin.shared.mjs';

const SUPPORTED_SHARE_TYPES = new Set(['activity', 'learning_course', 'mall_item', 'mall_activity', 'mall_home', 'home_route']);
const DEFAULT_SHARE_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const DEFAULT_SHARE_BASE_URL = 'http://127.0.0.1:3003';
const SHARE_LINK_VERSION = '20260316c';
const LOOPBACK_C_PORT_BY_ORIGIN_PORT = new Map([
  ['3002', '3000'],
  ['3004', '3003'],
  ['3005', '3003'],
  ['3015', '3000'],
  ['3016', '3000'],
]);
const SHARE_CREATE_EVENT = 'share_link_created';
const SHARE_VIEW_EVENT = 'share_h5_view';
const SHARE_CLICK_EVENT = 'share_h5_click_cta';
const SHARE_IDENTIFY_EVENT = 'share_customer_identified';
const SHARE_AUTH_VERIFIED_EVENT = 'c_auth_verified';
const SHARE_DELIVERY_EVENT = 'b_tools_share_success';
const RECENT_SHARE_CONTEXT_TTL_MS = 1000 * 60 * 10;
const recentShareContextByClient = new Map();

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toTrimmed(value) {
  return String(value ?? '').trim();
}

function createStableDigest(value, length = 32) {
  return crypto.createHash('sha1').update(String(value || '')).digest('hex').slice(0, Math.max(8, Number(length || 32)));
}

function buildShareIdentifyRewardFingerprint({ tenantId, shareCode, customerId }) {
  return createStableDigest(`${Number(tenantId || 0)}:${toTrimmed(shareCode)}:${Number(customerId || 0)}`, 32);
}

function buildShareIdentifyRewardSourceId({ tenantId, shareCode, customerId }) {
  return `share:${buildShareIdentifyRewardFingerprint({ tenantId, shareCode, customerId })}`;
}

function buildShareIdentifyRewardIdempotencyKey({ tenantId, shareCode, customerId }) {
  return `customer_share_identify:${Number(tenantId || 0)}:${buildShareIdentifyRewardFingerprint({ tenantId, shareCode, customerId })}`;
}

function extractShareCodeFromTrack(row) {
  const fromProps = toTrimmed(row?.properties?.shareCode);
  if (fromProps) return fromProps;
  const path = toTrimmed(row?.path);
  if (!path) return '';
  try {
    const parsed = new URL(path, 'http://local.invalid');
    const sharePathMatch = String(parsed.pathname || '').match(/^\/share\/([^/?#]+)/);
    if (sharePathMatch?.[1]) return decodeURIComponent(sharePathMatch[1]);
    return toTrimmed(parsed.searchParams.get('shareCode'));
  } catch {
    return '';
  }
}

function resolveClientKeys(req) {
  const forwardedFor = toTrimmed(req?.headers?.['x-forwarded-for'] || '').split(',')[0]?.trim() || '';
  const remoteAddress = toTrimmed(req?.ip || req?.socket?.remoteAddress || '');
  const userAgent = toTrimmed(req?.headers?.['user-agent'] || '');
  const origin = toTrimmed(req?.headers?.origin || '');
  const ipPart = forwardedFor || remoteAddress || 'unknown';
  const uaPart = userAgent || 'unknown';
  const keys = new Set([`${ipPart}|${uaPart}`]);
  if (origin) keys.add(`${ipPart}|${uaPart}|${origin}`);
  return Array.from(keys);
}

function pruneRecentShareContext() {
  const now = Date.now();
  for (const [key, value] of recentShareContextByClient.entries()) {
    if (!value || Number(value.touchedAt || 0) + RECENT_SHARE_CONTEXT_TTL_MS < now) {
      recentShareContextByClient.delete(key);
    }
  }
}

function asDate(value) {
  const raw = value instanceof Date ? value : new Date(String(value || ''));
  return Number.isNaN(raw.getTime()) ? null : raw;
}

function startOfLocalDay(value = new Date()) {
  const dt = value instanceof Date ? new Date(value) : new Date(String(value || ''));
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function addDays(value, delta) {
  const dt = new Date(value);
  dt.setDate(dt.getDate() + Number(delta || 0));
  return dt;
}

function inDateRange(value, start, end) {
  const dt = asDate(value);
  if (!dt) return false;
  return dt >= start && dt < end;
}

function toLocalDayKey(value) {
  const dt = asDate(value);
  if (!dt) return '';
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toLocalDayLabel(value) {
  const dt = asDate(value);
  if (!dt) return '-';
  return `${dt.getMonth() + 1}/${dt.getDate()}`;
}

function normalizeShareType(value) {
  const normalized = toTrimmed(value).toLowerCase();
  return SUPPORTED_SHARE_TYPES.has(normalized) ? normalized : '';
}

function normalizeShareChannel(value) {
  return toTrimmed(value).toLowerCase();
}

function ensureShareType(value) {
  const normalized = normalizeShareType(value);
  if (!normalized) throw new Error('INVALID_SHARE_TYPE');
  return normalized;
}

function mediaToUrl(mediaItem) {
  if (!mediaItem) return '';
  if (typeof mediaItem === 'string') return mediaItem;
  return String(mediaItem.preview || mediaItem.url || mediaItem.path || mediaItem.name || '');
}

function toAbsoluteUrl(req, url) {
  const raw = toTrimmed(url);
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (!raw.startsWith('/')) return raw;
  return `${req.protocol}://${req.get('host')}${raw}`;
}

function encodePayload(payload) {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function decodePayload(raw) {
  return JSON.parse(Buffer.from(String(raw || ''), 'base64url').toString('utf8'));
}

function shareSecret() {
  return process.env.SHARE_CODE_SECRET || process.env.SHARE_SECRET || 'share-code-dev-secret';
}

function signPayload(rawPayload) {
  return crypto.createHmac('sha256', shareSecret()).update(rawPayload).digest('base64url');
}

function buildShareCode(payload) {
  const rawPayload = encodePayload(payload);
  const signature = signPayload(rawPayload);
  return `sh1.${rawPayload}.${signature}`;
}

function verifySignature(rawPayload, signature) {
  const expected = signPayload(rawPayload);
  const left = Buffer.from(String(signature || ''));
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function ensureShareCode(code) {
  const text = toTrimmed(code);
  const [version, rawPayload, signature] = text.split('.');
  if (version !== 'sh1' || !rawPayload || !signature) throw new Error('SHARE_CODE_INVALID');
  if (!verifySignature(rawPayload, signature)) throw new Error('SHARE_CODE_INVALID');
  const payload = decodePayload(rawPayload);
  if (!payload || typeof payload !== 'object') throw new Error('SHARE_CODE_INVALID');
  const expiresAt = toNumber(payload.exp, 0);
  if (!expiresAt || expiresAt < Date.now()) throw new Error('SHARE_CODE_EXPIRED');
  return payload;
}

export function resolveTenantIdFromShareCode(shareCode) {
  const payload = ensureShareCode(shareCode);
  const tenantId = toNumber(payload?.tenantId, 0);
  return tenantId > 0 ? tenantId : null;
}

export function noteRecentShareRequestContext({ req, shareCode }) {
  const tenantId = resolveTenantIdFromShareCode(shareCode);
  const keys = resolveClientKeys(req);
  if (!keys.length || !tenantId) return;
  pruneRecentShareContext();
  const value = {
    shareCode: toTrimmed(shareCode),
    tenantId: Number(tenantId),
    touchedAt: Date.now(),
  };
  for (const key of keys) {
    recentShareContextByClient.set(key, value);
  }
}

export function resolveTenantIdFromRecentShareRequest(req) {
  const keys = resolveClientKeys(req);
  if (!keys.length) return null;
  pruneRecentShareContext();
  for (const key of keys) {
    const recent = recentShareContextByClient.get(key);
    if (recent && Number(recent.tenantId || 0) > 0) {
      return Number(recent.tenantId);
    }
  }
  return null;
}

function resolveShareBaseUrl(req, explicitBaseUrl = '') {
  const explicit = toTrimmed(explicitBaseUrl);
  if (explicit) {
    try {
      const parsed = new URL(explicit);
      const mappedPort = LOOPBACK_C_PORT_BY_ORIGIN_PORT.get(parsed.port || '');
      if (mappedPort) {
        return `${parsed.protocol}//${parsed.hostname}:${mappedPort}`;
      }
    } catch {
      // keep explicit value if it is not a valid absolute URL
    }
    return explicit.replace(/\/+$/, '');
  }
  const envBase = toTrimmed(process.env.SHARE_PUBLIC_BASE_URL || process.env.C_SHARE_BASE_URL);
  if (envBase) return envBase.replace(/\/+$/, '');
  const origin = toTrimmed(req.headers.origin);
  if (origin) {
    try {
      const parsed = new URL(origin);
      const mappedPort = LOOPBACK_C_PORT_BY_ORIGIN_PORT.get(parsed.port || '');
      if (mappedPort) {
        return `${parsed.protocol}//${parsed.hostname}:${mappedPort}`;
      }
    } catch {
      // ignore invalid origin and continue falling back
    }
  }
  if (origin) return origin.replace(/\/+$/, '');
  return DEFAULT_SHARE_BASE_URL;
}

function isSameTenantRow(row, tenantId) {
  return Number(row?.tenantId || 0) === Number(tenantId || 0);
}

function ensureShareableStatus(row) {
  if (!isVisibleTemplateStatus(row?.status)) throw new Error('SHARE_TARGET_UNAVAILABLE');
}

function normalizeCourse(req, course = {}) {
  const media = Array.isArray(course.media) ? course.media : [];
  const firstMedia = mediaToUrl(media[0]);
  const image = toAbsoluteUrl(req, firstMedia || course.image || '');
  return {
    id: Number(course.id || 0),
    title: String(course.title || ''),
    subtitle: String(course.desc || course.description || '').trim() || '保险知识学习',
    cover: image,
    pointsHint: Number(course.points || course.rewardPoints || 0),
    contentType: String(course.contentType || course.type || 'article').toLowerCase(),
    media,
  };
}

function normalizeActivity(req, activity = {}) {
  const media = Array.isArray(activity.media) ? activity.media : [];
  const cover = toAbsoluteUrl(req, mediaToUrl(media[0]) || activity.image || activity.cover || '');
  const sourceDomain = String(activity.sourceDomain || activity.source_domain || 'activity').trim().toLowerCase() || 'activity';
  return {
    id: Number(activity.id || 0),
    title: String(activity.title || ''),
    subtitle: String(activity.content || activity.description || activity.desc || '').trim() || '活动详情',
    cover,
    rewardPoints: Number(activity.rewardPoints || 0),
    sourceDomain,
    media,
  };
}

function normalizeProduct(req, item = {}) {
  const media = Array.isArray(item.media) ? item.media : [];
  const cover = toAbsoluteUrl(req, mediaToUrl(media[0]) || item.image || '');
  return {
    id: Number(item.id || 0),
    title: String(item.title || item.name || ''),
    subtitle: String(item.description || item.desc || '').trim() || '积分商城商品',
    cover,
    pointsHint: Number(item.pointsCost || item.points || 0),
    stock: Number(item.stock || 0),
    media,
  };
}

function normalizeMallActivity(req, item = {}) {
  const media = Array.isArray(item.media) ? item.media : [];
  const cover = toAbsoluteUrl(req, mediaToUrl(media[0]) || item.image || '');
  return {
    id: Number(item.id || 0),
    title: String(item.displayTitle || item.title || ''),
    subtitle: String(item.description || item.desc || '').trim() || '积分商城活动',
    cover,
    rewardPoints: Number(item.rewardPoints || 0),
    media,
  };
}

function getLearningCourseForCreate({ state, actor, targetId }) {
  const course = (state.learningCourses || []).find((row) => Number(row.id || 0) === Number(targetId || 0));
  if (!course) throw new Error('SHARE_TARGET_NOT_FOUND');
  if (isPlatformTemplate(state, course)) throw new Error('SHARE_TARGET_UNAVAILABLE');
  if (!canAccessTemplate(state, actor, course)) throw new Error('SHARE_TARGET_FORBIDDEN');
  ensureShareableStatus(course);
  return course;
}

function getActivityForCreate({ state, actor, targetId }) {
  const item = (state.activities || []).find((row) => Number(row.id || 0) === Number(targetId || 0));
  if (!item) throw new Error('SHARE_TARGET_NOT_FOUND');
  if (String(item.sourceDomain || item.source_domain || 'activity').trim().toLowerCase() !== 'activity') {
    throw new Error('SHARE_TARGET_UNAVAILABLE');
  }
  if (isPlatformTemplate(state, item)) throw new Error('SHARE_TARGET_UNAVAILABLE');
  if (!canAccessTemplate(state, actor, item)) throw new Error('SHARE_TARGET_FORBIDDEN');
  ensureShareableStatus(item);
  return item;
}

function getMallItemForCreate({ state, actor, targetId }) {
  const item = (state.pProducts || []).find((row) => Number(row.id || 0) === Number(targetId || 0));
  if (!item) throw new Error('SHARE_TARGET_NOT_FOUND');
  if (isPlatformTemplate(state, item)) throw new Error('SHARE_TARGET_UNAVAILABLE');
  if (!canAccessTemplate(state, actor, item)) throw new Error('SHARE_TARGET_FORBIDDEN');
  ensureShareableStatus(item);
  return item;
}

function getMallActivityForCreate({ state, actor, targetId }) {
  const source = Array.isArray(state.mallActivities) && state.mallActivities.length ? state.mallActivities : state.bCustomerActivities || [];
  const item = source.find((row) => Number(row.id || 0) === Number(targetId || 0));
  if (!item) throw new Error('SHARE_TARGET_NOT_FOUND');
  if (isPlatformTemplate(state, item)) throw new Error('SHARE_TARGET_UNAVAILABLE');
  if (!canAccessTemplate(state, actor, item)) throw new Error('SHARE_TARGET_FORBIDDEN');
  ensureShareableStatus(item);
  return item;
}

function ensureTenantMatch(item, tenantId) {
  if (!tenantId) return;
  if (!isSameTenantRow(item, tenantId)) throw new Error('SHARE_TARGET_FORBIDDEN');
}

function buildTargetPath({ shareType, targetId, tenantId, shareCode }) {
  const params = new URLSearchParams();
  if (tenantId) params.set('tenantId', String(tenantId));
  if (shareCode) params.set('shareCode', String(shareCode));
  params.set('fromShare', '1');
  if (shareType === 'activity' && targetId) params.set('activityId', String(targetId));
  if (shareType === 'learning_course' && targetId) params.set('courseId', String(targetId));
  if (shareType === 'mall_item' && targetId) params.set('itemId', String(targetId));
  if (shareType === 'mall_activity' && targetId) params.set('activityId', String(targetId));
  if (shareType === 'learning_course') return `/learning?${params.toString()}`;
  if (shareType === 'activity') return `/activities?${params.toString()}`;
  if (shareType === 'mall_item' || shareType === 'mall_activity' || shareType === 'mall_home') return `/mall?${params.toString()}`;
  if (shareType === 'home_route') return params.toString() ? `/?${params.toString()}` : '/';
  return `/?${params.toString()}`;
}

function buildFallbackPath({ shareType, tenantId }) {
  const params = new URLSearchParams();
  if (tenantId) params.set('tenantId', String(tenantId));
  if (shareType === 'learning_course') return `/learning?${params.toString()}`;
  if (shareType === 'activity') return `/activities?${params.toString()}`;
  if (shareType === 'mall_item' || shareType === 'mall_activity' || shareType === 'mall_home') return `/mall?${params.toString()}`;
  if (shareType === 'home_route') return params.toString() ? `/?${params.toString()}` : '/';
  return params.toString() ? `/?${params.toString()}` : '/';
}

function buildPreviewFromShareType({ req, shareType, entity }) {
  if (shareType === 'learning_course') {
    const course = normalizeCourse(req, entity);
    return {
      targetTitle: course.title,
      previewPayload: {
        title: course.title,
        subtitle: course.subtitle,
        cover: course.cover,
        tag: '知识学习',
        pointsHint: course.pointsHint,
        ctaText: '去学习',
      },
    };
  }

  if (shareType === 'activity') {
    const activity = normalizeActivity(req, entity);
    return {
      targetTitle: activity.title,
      previewPayload: {
        title: activity.title,
        subtitle: activity.subtitle,
        cover: activity.cover,
        tag: '活动中心',
        pointsHint: activity.rewardPoints,
        ctaText: '去参与',
      },
    };
  }

  if (shareType === 'mall_item') {
    const item = normalizeProduct(req, entity);
    return {
      targetTitle: item.title,
      previewPayload: {
        title: item.title,
        subtitle: item.subtitle,
        cover: item.cover,
        tag: '积分商城',
        pointsHint: item.pointsHint,
        ctaText: '去兑换',
      },
    };
  }

  if (shareType === 'mall_activity') {
    const item = normalizeMallActivity(req, entity);
    return {
      targetTitle: item.title,
      previewPayload: {
        title: item.title,
        subtitle: item.subtitle,
        cover: item.cover,
        tag: '商城活动',
        pointsHint: item.rewardPoints,
        ctaText: '去参与',
      },
    };
  }

  if (shareType === 'home_route') {
    return {
      targetTitle: '保险助手首页',
      previewPayload: {
        title: '保险助手首页',
        subtitle: '查看首页内容、知识学习、活动中心与积分商城入口',
        cover: '',
        tag: '首页',
        ctaText: '去首页',
      },
    };
  }

  return {
    targetTitle: '积分商城',
    previewPayload: {
      title: '积分商城',
      subtitle: '浏览积分好物与限时活动',
      cover: '',
      tag: '积分商城',
      ctaText: '去商城',
    },
  };
}

function isLoginRequiredForShare({ shareType, channel }) {
  void shareType;
  void channel;
  return false;
}

function resolveEntityForCreate({ state, actor, shareType, targetId, tenantId }) {
  if (shareType === 'mall_home' || shareType === 'home_route') return null;
  if (!targetId) throw new Error('INVALID_SHARE_TARGET_ID');
  if (shareType === 'learning_course') {
    const course = getLearningCourseForCreate({ state, actor, targetId });
    ensureTenantMatch(course, tenantId);
    return course;
  }
  if (shareType === 'activity') {
    const item = getActivityForCreate({ state, actor, targetId });
    ensureTenantMatch(item, tenantId);
    return item;
  }
  if (shareType === 'mall_item') {
    const item = getMallItemForCreate({ state, actor, targetId });
    ensureTenantMatch(item, tenantId);
    return item;
  }
  if (shareType === 'mall_activity') {
    const item = getMallActivityForCreate({ state, actor, targetId });
    ensureTenantMatch(item, tenantId);
    return item;
  }
  throw new Error('INVALID_SHARE_TYPE');
}

function resolveEntityForRead({ state, shareType, targetId, tenantId }) {
  if (shareType === 'mall_home' || shareType === 'home_route') return null;
  if (shareType === 'learning_course') {
    const course = (state.learningCourses || []).find((row) => Number(row.id || 0) === Number(targetId || 0));
    if (!course || !isSameTenantRow(course, tenantId) || !isVisibleTemplateStatus(course.status)) throw new Error('SHARE_TARGET_UNAVAILABLE');
    return course;
  }
  if (shareType === 'activity') {
    const item = (state.activities || []).find((row) => Number(row.id || 0) === Number(targetId || 0));
    const domain = String(item?.sourceDomain || item?.source_domain || 'activity').trim().toLowerCase();
    if (!item || !isSameTenantRow(item, tenantId) || domain !== 'activity' || !isVisibleTemplateStatus(item.status)) {
      throw new Error('SHARE_TARGET_UNAVAILABLE');
    }
    return item;
  }
  if (shareType === 'mall_item') {
    const item = (state.pProducts || []).find((row) => Number(row.id || 0) === Number(targetId || 0));
    if (!item || !isSameTenantRow(item, tenantId) || !isVisibleTemplateStatus(item.status)) throw new Error('SHARE_TARGET_UNAVAILABLE');
    return item;
  }
  if (shareType === 'mall_activity') {
    const source = Array.isArray(state.mallActivities) && state.mallActivities.length ? state.mallActivities : state.bCustomerActivities || [];
    const item = source.find((row) => Number(row.id || 0) === Number(targetId || 0));
    if (!item || !isSameTenantRow(item, tenantId) || !isVisibleTemplateStatus(item.status)) throw new Error('SHARE_TARGET_UNAVAILABLE');
    return item;
  }
  throw new Error('INVALID_SHARE_TYPE');
}

export function resolveSharedLearningCourseByShare({ req, shareCode, courseId }) {
  const normalizedShareCode = toTrimmed(shareCode);
  const normalizedCourseId = Number(courseId || 0);
  if (!normalizedShareCode || !normalizedCourseId) return null;

  try {
    const detail = resolveShareDetail({ req, shareCode: normalizedShareCode });
    if (detail.shareType !== 'learning_course') return null;
    if (Number(detail.targetId || 0) !== normalizedCourseId) return null;
    const state = getState();
    const course = resolveEntityForRead({
      state,
      shareType: 'learning_course',
      targetId: normalizedCourseId,
      tenantId: Number(detail.tenantId || 0),
    });
    return course && Number(course.id || 0) === normalizedCourseId ? course : null;
  } catch {
    return null;
  }
}

export function resolveSharedActivityByShare({ req, shareCode, activityId }) {
  const normalizedShareCode = toTrimmed(shareCode);
  const normalizedActivityId = Number(activityId || 0);
  if (!normalizedShareCode || !normalizedActivityId) return null;

  try {
    const detail = resolveShareDetail({ req, shareCode: normalizedShareCode });
    if (detail.shareType !== 'activity') return null;
    if (Number(detail.targetId || 0) !== normalizedActivityId) return null;
    const state = getState();
    const activity = resolveEntityForRead({
      state,
      shareType: 'activity',
      targetId: normalizedActivityId,
      tenantId: Number(detail.tenantId || 0),
    });
    return activity && Number(activity.id || 0) === normalizedActivityId ? activity : null;
  } catch {
    return null;
  }
}

function resolveShareSalesId({ state, actor }) {
  const actorType = String(actor?.actorType || '').trim().toLowerCase();
  const actorId = Number(actor?.actorId || 0);
  if (!actorId) return null;
  if (actorType !== 'customer') return actorId;
  const explicitOwnerUserId = Number(actor?.ownerUserId || 0);
  if (explicitOwnerUserId > 0) return explicitOwnerUserId;
  const customer = findCustomerById({ state, customerId: actorId });
  const ownerUserId = Number(customer?.ownerUserId || 0);
  return ownerUserId > 0 ? ownerUserId : null;
}

export function createShareLink({ req, actor, body }) {
  const state = getState();
  const shareType = ensureShareType(body?.shareType);
  const targetId = toNumber(body?.targetId, 0);
  const tenantId = Number(actor?.tenantId || body?.tenantId || 0);
  if (!tenantId) throw new Error('TENANT_CONTEXT_REQUIRED');
  const entity = resolveEntityForCreate({ state, actor, shareType, targetId, tenantId });
  const ttlMs = Math.max(1000 * 60, toNumber(body?.ttlMs, DEFAULT_SHARE_TTL_MS));
  const expiresAtTs = Date.now() + ttlMs;
  const channel = toTrimmed(body?.channel) || null;
  const payload = {
    v: 1,
    shareType,
    targetId: targetId || null,
    tenantId,
    salesId: resolveShareSalesId({ state, actor }),
    channel,
    sharePath: toTrimmed(body?.sharePath) || null,
    exp: expiresAtTs,
  };
  const shareCode = buildShareCode(payload);
  const baseUrl = resolveShareBaseUrl(req, body?.shareBaseUrl);
  const targetCPath = buildTargetPath({ shareType, targetId, tenantId, shareCode });
  const fallbackCPath = buildFallbackPath({ shareType, tenantId });
  const { targetTitle, previewPayload } = buildPreviewFromShareType({ req, shareType, entity });
  const query = new URLSearchParams();
  query.set('tenantId', String(tenantId));
  query.set('v', SHARE_LINK_VERSION);
  const loginRequired = isLoginRequiredForShare({ shareType, channel });
  return {
    ok: true,
    shareCode,
    shareType,
    targetId: targetId || null,
    targetTitle,
    shareUrl: `${baseUrl}/share/${encodeURIComponent(shareCode)}?${query.toString()}`,
    targetCPath,
    fallbackCPath,
    loginRequired,
    expiresAt: new Date(expiresAtTs).toISOString(),
    previewPayload,
  };
}

export function buildShareCreateTrackContext({ req, actor, body, share }) {
  return {
    event: SHARE_CREATE_EVENT,
    properties: {
      shareCode: share.shareCode,
      shareType: share.shareType,
      sharePath: toTrimmed(body?.sharePath),
      channel: toTrimmed(body?.channel),
      targetId: share.targetId,
      targetTitle: share.targetTitle,
      shareUrl: share.shareUrl,
      targetCPath: share.targetCPath,
      fallbackCPath: share.fallbackCPath,
      loginRequired: Boolean(share.loginRequired),
      expiresAt: share.expiresAt,
      previewPayload: share.previewPayload || {},
    },
    actorType: String(actor?.actorType || 'anonymous'),
    actorId: Number(actor?.actorId || 0),
    tenantId: Number(actor?.tenantId || 0),
    orgId: Number(actor?.orgId || 0) || null,
    teamId: Number(actor?.teamId || 0) || null,
    path: String(req.path || ''),
    source: String(req.headers['x-client-source'] || 'b-web'),
    userAgent: String(req.headers['user-agent'] || ''),
  };
}

function findCustomerShareCreateTrack({ state, shareCode, tenantId }) {
  const normalizedShareCode = toTrimmed(shareCode);
  if (!normalizedShareCode) return null;
  return (
    (Array.isArray(state.trackEvents) ? state.trackEvents : [])
      .filter(
        (row) =>
          String(row?.event || '').trim().toLowerCase() === SHARE_CREATE_EVENT &&
          String(row?.actorType || '').trim().toLowerCase() === 'customer' &&
          Number(row?.actorId || 0) > 0 &&
          Number(row?.tenantId || 0) === Number(tenantId || 0) &&
          String(row?.properties?.shareCode || '').trim() === normalizedShareCode
      )
      .sort((left, right) => Number(left?.id || 0) - Number(right?.id || 0))[0] || null
  );
}

function resolveCustomerReferrerFromTrack(state, customer) {
  const customerId = Number(customer?.id || 0);
  const tenantId = Number(customer?.tenantId || 0);
  if (customerId <= 0 || tenantId <= 0) return null;

  const identifyRows = (Array.isArray(state.trackEvents) ? state.trackEvents : [])
    .filter(
      (row) =>
        [SHARE_IDENTIFY_EVENT, SHARE_AUTH_VERIFIED_EVENT].includes(String(row?.event || '').trim().toLowerCase()) &&
        String(row?.actorType || '').trim().toLowerCase() === 'customer' &&
        Number(row?.actorId || 0) === customerId &&
        Number(row?.tenantId || 0) === tenantId
    )
    .sort((left, right) => new Date(String(left?.createdAt || 0)).getTime() - new Date(String(right?.createdAt || 0)).getTime());

  for (const row of identifyRows) {
    const shareCode = extractShareCodeFromTrack(row);
    if (!shareCode) continue;
    const createdTrack = findCustomerShareCreateTrack({ state, shareCode, tenantId });
    const referrerCustomerId = Number(createdTrack?.actorId || 0);
    if (referrerCustomerId > 0 && referrerCustomerId !== customerId) {
      return {
        referrerCustomerId,
        referrerShareCode: shareCode,
        referredAt: row?.createdAt ? new Date(String(row.createdAt)).toISOString() : null,
      };
    }
  }

  return null;
}

function resolveCustomerReferrer(state, customer) {
  const explicitReferrerCustomerId = Number(customer?.referrerCustomerId || 0);
  if (explicitReferrerCustomerId > 0) {
    return {
      referrerCustomerId: explicitReferrerCustomerId,
      referrerShareCode: toTrimmed(customer?.referrerShareCode) || null,
      referredAt: customer?.referredAt ? new Date(String(customer.referredAt)).toISOString() : null,
    };
  }
  return resolveCustomerReferrerFromTrack(state, customer);
}

function toShareFriendRow(customer, override = {}) {
  return {
    id: Number(customer?.id || 0),
    name: String(customer?.name || ''),
    mobile: String(customer?.mobile || ''),
    ownerUserId: Number(customer?.ownerUserId || 0) || 0,
    verifiedAt: customer?.verifiedAt ? new Date(String(customer.verifiedAt)).toISOString() : null,
    referredAt: override.referredAt || (customer?.referredAt ? new Date(String(customer.referredAt)).toISOString() : null),
    shareCode: override.shareCode || toTrimmed(customer?.referrerShareCode) || null,
  };
}

export function getCustomerShareNetwork({ customerId, tenantId, visibleCustomerIds = null }) {
  const state = getState();
  const currentCustomerId = Number(customerId || 0);
  const currentTenantId = Number(tenantId || 0);
  if (currentCustomerId <= 0 || currentTenantId <= 0) {
    return {
      upstream: null,
      invitedFriends: [],
      stats: { invitedCount: 0, verifiedCount: 0 },
    };
  }

  const isVisible = (id) => {
    if (!(visibleCustomerIds instanceof Set)) return true;
    return visibleCustomerIds.has(Number(id || 0));
  };

  const currentCustomer = findCustomerById({ state, customerId: currentCustomerId });
  if (!currentCustomer || Number(currentCustomer.tenantId || 0) !== currentTenantId || !isVisible(currentCustomerId)) {
    return {
      upstream: null,
      invitedFriends: [],
      stats: { invitedCount: 0, verifiedCount: 0 },
    };
  }

  const upstreamMeta = resolveCustomerReferrer(state, currentCustomer);
  const upstreamCustomer =
    Number(upstreamMeta?.referrerCustomerId || 0) > 0
      ? findCustomerById({ state, customerId: Number(upstreamMeta.referrerCustomerId) })
      : null;
  const upstream =
    upstreamCustomer &&
    Number(upstreamCustomer.tenantId || 0) === currentTenantId &&
    isVisible(upstreamCustomer.id)
      ? {
          ...toShareFriendRow(upstreamCustomer, {
            referredAt: upstreamMeta?.referredAt || null,
            shareCode: upstreamMeta?.referrerShareCode || null,
          }),
          label: '上游分享人',
        }
      : null;

  const invitedMap = new Map();
  for (const row of Array.isArray(state.users) ? state.users : []) {
    if (Number(row?.tenantId || 0) !== currentTenantId) continue;
    if (Number(row?.id || 0) === currentCustomerId) continue;
    if (!Boolean(row?.isVerifiedBasic)) continue;
    if (Number(row?.referrerCustomerId || 0) !== currentCustomerId) continue;
    if (!isVisible(row.id)) continue;
    invitedMap.set(Number(row.id), toShareFriendRow(row));
  }

  const identifyRows = (Array.isArray(state.trackEvents) ? state.trackEvents : [])
    .filter(
      (row) =>
        [SHARE_IDENTIFY_EVENT, SHARE_AUTH_VERIFIED_EVENT].includes(String(row?.event || '').trim().toLowerCase()) &&
        String(row?.actorType || '').trim().toLowerCase() === 'customer' &&
        Number(row?.tenantId || 0) === currentTenantId
    )
    .sort((left, right) => new Date(String(right?.createdAt || 0)).getTime() - new Date(String(left?.createdAt || 0)).getTime());

  for (const row of identifyRows) {
    const friendId = Number(row?.actorId || 0);
    if (friendId <= 0 || friendId === currentCustomerId || invitedMap.has(friendId) || !isVisible(friendId)) continue;
    const shareCode = extractShareCodeFromTrack(row);
    if (!shareCode) continue;
    const createdTrack = findCustomerShareCreateTrack({ state, shareCode, tenantId: currentTenantId });
    if (Number(createdTrack?.actorId || 0) !== currentCustomerId) continue;
    const friend = findCustomerById({ state, customerId: friendId });
    if (!friend || Number(friend.tenantId || 0) !== currentTenantId || !Boolean(friend.isVerifiedBasic)) continue;
    invitedMap.set(
      friendId,
      toShareFriendRow(friend, {
        referredAt: row?.createdAt ? new Date(String(row.createdAt)).toISOString() : null,
        shareCode,
      })
    );
  }

  const invitedFriends = [...invitedMap.values()].sort(
    (left, right) => new Date(String(right?.referredAt || right?.verifiedAt || 0)).getTime() - new Date(String(left?.referredAt || left?.verifiedAt || 0)).getTime()
  );

  return {
    upstream,
    invitedFriends,
    stats: {
      invitedCount: invitedFriends.length,
      verifiedCount: invitedFriends.filter((row) => Boolean(row.verifiedAt)).length,
    },
  };
}

export function resolveShareDetail({ req, shareCode }) {
  const payload = ensureShareCode(shareCode);
  const state = getState();
  const shareType = ensureShareType(payload.shareType);
  const tenantId = toNumber(payload.tenantId, 0);
  const targetId = toNumber(payload.targetId, 0);
  const channel = toTrimmed(payload.channel) || null;
  const entity = resolveEntityForRead({ state, shareType, targetId, tenantId });
  const { targetTitle, previewPayload } = buildPreviewFromShareType({ req, shareType, entity });
  return {
    ok: true,
    valid: true,
    shareCode: toTrimmed(shareCode),
    shareType,
    targetId: targetId || null,
    tenantId,
    salesId: toNumber(payload.salesId, 0) || null,
    targetTitle,
    targetCPath: buildTargetPath({ shareType, targetId, tenantId, shareCode }),
    fallbackCPath: buildFallbackPath({ shareType, tenantId }),
    loginRequired: isLoginRequiredForShare({ shareType, channel }),
    expiresAt: new Date(toNumber(payload.exp, Date.now())).toISOString(),
    previewPayload,
  };
}

export function resolveShareTrackingContext({ shareCode, eventName, actor, req }) {
  const detail = resolveShareDetail({ req, shareCode });
  const rawVisitor = req?.body?.visitor && typeof req.body.visitor === 'object' ? req.body.visitor : {};
  const visitorId = Number(rawVisitor?.id || 0);
  const visitorName = String(rawVisitor?.name || '').trim();
  const visitorMobile = String(rawVisitor?.mobile || '').trim();
  const headerUser = resolveUserFromBearer(req?.headers?.authorization);
  const user = req?.user || headerUser || null;
  const actorIdFromContext = Number(actor?.actorId || 0);
  const actorTypeFromContext = String(actor?.actorType || '').trim().toLowerCase();
  const resolvedActorType =
    actorIdFromContext > 0 && actorTypeFromContext && actorTypeFromContext !== 'anonymous'
      ? actorTypeFromContext
      : String(user?.actorType || (user || visitorId || visitorMobile ? 'customer' : 'anonymous'));
  const resolvedActorId = actorIdFromContext > 0 ? actorIdFromContext : Number(user?.id || visitorId || 0);
  const resolvedTenantId = Number(detail.tenantId || actor?.tenantId || user?.tenantId || 0);
  const resolvedOrgId = Number(actor?.orgId || user?.orgId || 0) || null;
  const resolvedTeamId = Number(actor?.teamId || user?.teamId || 0) || null;
  return {
    event: eventName,
    properties: {
      shareCode: detail.shareCode,
      shareType: detail.shareType,
      targetId: detail.targetId,
      salesId: detail.salesId || null,
      targetTitle: detail.targetTitle,
      targetCPath: detail.targetCPath,
      fallbackCPath: detail.fallbackCPath,
      visitorName,
      visitorMobile,
    },
    actorType: resolvedActorType,
    actorId: resolvedActorId,
    tenantId: resolvedTenantId,
    orgId: resolvedOrgId,
    teamId: resolvedTeamId,
    path: String(req.path || ''),
    source: String(req.headers['x-client-source'] || 'share-h5'),
    userAgent: String(req.headers['user-agent'] || ''),
  };
}

export function assignSharedCustomerOwner({ req, shareCode }) {
  const detail = resolveShareDetail({ req, shareCode });
  const tenantId = Number(detail.tenantId || 0);
  if (tenantId <= 0) return null;

  const user = req?.user || resolveUserFromBearer(req?.headers?.authorization) || null;
  const customerId = Number(user?.id || 0);
  if (customerId <= 0) return null;

  const state = getState();
  const customer = findCustomerById({ state, customerId });
  if (!customer || Number(customer.tenantId || 0) !== tenantId) return null;
  let touched = false;

  const createdTrack = findCustomerShareCreateTrack({
    state,
    shareCode: detail.shareCode,
    tenantId,
  });
  const referrerCustomerId = Number(createdTrack?.actorId || 0);
  const referrerCustomer =
    referrerCustomerId > 0 && referrerCustomerId !== customerId
      ? findCustomerById({ state, customerId: referrerCustomerId })
      : null;
  if (referrerCustomerId > 0 && referrerCustomerId !== customerId) {
    const currentReferrerCustomerId = Number(customer.referrerCustomerId || 0);
    if (currentReferrerCustomerId <= 0 || currentReferrerCustomerId === referrerCustomerId) {
      customer.referrerCustomerId = referrerCustomerId;
      customer.referrerShareCode = detail.shareCode;
      customer.referredAt = customer.referredAt || new Date().toISOString();
      touched = true;
    }
  }

  const candidateSalesIds = [
    Number(referrerCustomer?.ownerUserId || 0),
    Number(detail.salesId || 0),
  ].filter((value, index, array) => value > 0 && array.indexOf(value) === index);

  const agent = candidateSalesIds
    .map((candidateId) => ({
      candidateId,
      agent: (Array.isArray(state.agents) ? state.agents : []).find(
        (row) => Number(row?.id || 0) === candidateId && Number(row?.tenantId || 0) === tenantId
      ),
    }))
    .find((entry) => entry.agent);

  const effectiveSalesId = Number(agent?.candidateId || 0);
  if (effectiveSalesId <= 0 || !agent?.agent) {
    if (touched) {
      customer.updatedAt = new Date().toISOString();
      return customer;
    }
    return null;
  }

  if (Number(customer.ownerUserId || 0) > 0 && Number(customer.ownerUserId || 0) !== effectiveSalesId) {
    customer.updatedAt = new Date().toISOString();
    return customer;
  }

  assignCustomerOwnerScope(customer, {
    tenantId,
    orgId: Number(agent.agent.orgId || 0) || null,
    teamId: Number(agent.agent.teamId || 0) || null,
    agentId: effectiveSalesId,
    updatedAt: new Date().toISOString(),
  });
  customer.updatedAt = new Date().toISOString();

  return customer;
}

export function settleCustomerShareIdentifyReward({ req, shareCode, identifiedCustomerId, rewardPoints, recordPoints }) {
  const amount = Math.max(0, Number(rewardPoints || 0));
  const customerId = Number(identifiedCustomerId || 0);
  if (amount <= 0 || customerId <= 0 || typeof recordPoints !== 'function') {
    return { rewarded: false, duplicated: false, reason: 'disabled' };
  }

  const detail = resolveShareDetail({ req, shareCode });
  const state = getState();
  const identifiedCustomer = findCustomerById({ state, customerId });
  const createdTrack = findCustomerShareCreateTrack({
    state,
    shareCode: detail.shareCode,
    tenantId: Number(detail.tenantId || 0),
  });
  const fallbackReferrerCustomerId =
    !createdTrack &&
    identifiedCustomer &&
    Number(identifiedCustomer.referrerCustomerId || 0) > 0 &&
    (!toTrimmed(identifiedCustomer.referrerShareCode) ||
      toTrimmed(identifiedCustomer.referrerShareCode) === toTrimmed(detail.shareCode))
      ? Number(identifiedCustomer.referrerCustomerId || 0)
      : 0;
  const sharerCustomerId = Number(createdTrack?.actorId || fallbackReferrerCustomerId || 0);
  if (sharerCustomerId <= 0) {
    return { rewarded: false, duplicated: false, reason: 'not_customer_share' };
  }
  if (sharerCustomerId === customerId) {
    return { rewarded: false, duplicated: false, reason: 'self_identify', sharerCustomerId };
  }

  const result = recordPoints({
    tenantId: Number(detail.tenantId || 1),
    userId: sharerCustomerId,
    direction: 'in',
    amount,
    sourceType: 'customer_share_identify',
    sourceId: buildShareIdentifyRewardSourceId({
      tenantId: detail.tenantId,
      shareCode: detail.shareCode,
      customerId,
    }),
    idempotencyKey: buildShareIdentifyRewardIdempotencyKey({
      tenantId: detail.tenantId,
      shareCode: detail.shareCode,
      customerId,
    }),
    description: '客户分享 H5 带来实名奖励',
  });

  return {
    rewarded: !Boolean(result?.duplicated),
    duplicated: Boolean(result?.duplicated),
    reason: Boolean(result?.duplicated) ? 'duplicated' : 'granted',
    sharerCustomerId,
    amount,
    result,
  };
}

function toShareMetricBucket() {
  return {
    views: 0,
    clicks: 0,
    deliveries: 0,
  };
}

function toRatio(numerator, denominator) {
  const top = Number(numerator || 0);
  const bottom = Number(denominator || 0);
  if (bottom <= 0) return 0;
  return Number((top / bottom).toFixed(4));
}

function resolveShareEventLabel(event) {
  if (event === SHARE_CREATE_EVENT) return '生成分享链接';
  if (event === SHARE_DELIVERY_EVENT) return '业务员执行分享';
  if (event === SHARE_VIEW_EVENT) return '客户打开 H5';
  if (event === SHARE_CLICK_EVENT) return '客户点击跳转';
  if (event === SHARE_IDENTIFY_EVENT) return '客户完成身份确认';
  return String(event || '未知事件');
}

function resolveShareEventSourceLabel(source) {
  const raw = String(source || '').trim().toLowerCase();
  if (raw === 'b-web') return 'B端';
  if (raw === 'share-h5') return '分享 H5';
  if (!raw) return '未知来源';
  return raw;
}

function resolveShareActorProfile(state, actorType, actorId) {
  const type = String(actorType || '').trim().toLowerCase();
  const id = Number(actorId || 0);
  if (!id || type === 'anonymous') {
    return {
      actorName: '匿名访客',
      actorLabel: '匿名访客',
      actorMobile: '',
    };
  }

  if (type === 'employee' || type === 'agent') {
    const agent = (state.agents || []).find((row) => Number(row?.id || 0) === id);
    const name = String(agent?.name || agent?.account || `员工#${id}`);
    return {
      actorName: name,
      actorLabel: `员工 · ${name}`,
      actorMobile: String(agent?.mobile || agent?.phone || ''),
    };
  }

  if (type === 'customer' || type === 'user') {
    const user = (state.users || []).find((row) => Number(row?.id || 0) === id);
    const name = String(user?.name || user?.nickName || user?.mobile || `客户#${id}`);
    return {
      actorName: name,
      actorLabel: `客户 · ${name}`,
      actorMobile: String(user?.mobile || user?.phone || ''),
    };
  }

  return {
    actorName: `${type || 'actor'}#${id}`,
    actorLabel: `${type || 'actor'}#${id}`,
    actorMobile: '',
  };
}

function mapShareMetricsByCode(trackEvents, tenantId) {
  const metrics = new Map();
  trackEvents
    .filter((row) => Number(row?.tenantId || 0) === Number(tenantId || 0))
    .forEach((row) => {
      const shareCode = toTrimmed(row?.properties?.shareCode);
      if (!shareCode) return;
      if (!metrics.has(shareCode)) metrics.set(shareCode, toShareMetricBucket());
      const bucket = metrics.get(shareCode);
      const event = String(row?.event || '');
      if (event === SHARE_VIEW_EVENT) bucket.views += 1;
      else if (event === SHARE_CLICK_EVENT) bucket.clicks += 1;
      else if (event === SHARE_DELIVERY_EVENT) bucket.deliveries += 1;
    });
  return metrics;
}

function resolveShareAnalyticsScope(state, actor = {}, user = null) {
  const safeActor = {
    actorId: Number(actor?.actorId || user?.id || 0),
    actorType: String(actor?.actorType || user?.actorType || '').trim().toLowerCase(),
    tenantId: Number(actor?.tenantId || user?.tenantId || 0),
    teamId: Number(actor?.teamId || user?.teamId || 0),
  };
  const roleIds = (state.userRoles || [])
    .filter(
      (row) =>
        Number(row?.tenantId || 0) === Number(safeActor.tenantId || 0) &&
        String(row?.userType || '').trim().toLowerCase() === String(safeActor.actorType || '').trim().toLowerCase() &&
        Number(row?.userId || 0) === Number(safeActor.actorId || 0)
    )
    .map((row) => Number(row?.roleId || 0))
    .filter((id) => id > 0);
  const roleKeys = new Set(
    (state.roles || [])
      .filter((row) => roleIds.includes(Number(row?.id || 0)))
      .map((row) => String(row?.key || '').trim().toLowerCase())
      .filter(Boolean)
  );
  const permissionIds = (state.rolePermissions || [])
    .filter((row) => roleIds.includes(Number(row?.roleId || 0)))
    .map((row) => Number(row?.permissionId || 0))
    .filter((id) => id > 0);
  const permissionKeys = new Set(
    (state.permissions || [])
      .filter((row) => permissionIds.includes(Number(row?.id || 0)))
      .map((row) => String(row?.key || '').trim().toLowerCase())
      .filter(Boolean)
  );

  const actorAgentRow = (state.agents || []).find(
    (row) =>
      Number(row?.id || 0) === Number(safeActor.actorId || 0) &&
      Number(row?.tenantId || 0) === Number(safeActor.tenantId || 0)
  );
  const rawRole = String(user?.role || actorAgentRow?.role || '').trim().toLowerCase();
  const isPlatformAdmin =
    roleKeys.has('platform_admin') ||
    rawRole === 'platform_admin' ||
    (safeActor.actorType === 'employee' && Number(safeActor.actorId || 0) === 9001);
  const isCompanyAdmin =
    !isPlatformAdmin && (roleKeys.has('company_admin') || permissionKeys.has('scope:tenant:all') || rawRole === 'manager');
  const isTeamLead =
    !isPlatformAdmin &&
    !isCompanyAdmin &&
    (roleKeys.has('team_lead') || permissionKeys.has('scope:team:all') || rawRole === 'support' || rawRole === 'team_lead');

  let scopeType = 'self';
  if (isPlatformAdmin) scopeType = 'platform';
  else if (isCompanyAdmin) scopeType = 'company';
  else if (isTeamLead) scopeType = 'team';

  const scopeTenantId = Number(safeActor.tenantId || 0);
  const scopeTeamId = Number(actorAgentRow?.teamId || safeActor.teamId || 0);
  const agents = Array.isArray(state.agents) ? state.agents : [];
  const users = Array.isArray(state.users) ? state.users : [];
  const canSeeTenant = (tenantId) => {
    if (scopeType === 'platform') return true;
    return Number(tenantId || 0) === Number(scopeTenantId || 0);
  };
  const visibleAgents = agents.filter((row) => {
    if (!canSeeTenant(row?.tenantId)) return false;
    if (scopeType === 'platform' || scopeType === 'company') return true;
    if (scopeType === 'team') return Number(row?.teamId || 0) === Number(scopeTeamId || 0);
    return Number(row?.id || 0) === Number(safeActor.actorId || 0);
  });
  const agentIds = new Set(visibleAgents.map((row) => Number(row?.id || 0)).filter((id) => id > 0));
  if (scopeType === 'self' && Number(safeActor.actorId || 0) > 0) {
    agentIds.add(Number(safeActor.actorId || 0));
  }
  const customerIds = new Set(
    users
      .filter((row) => {
        if (!canSeeTenant(row?.tenantId)) return false;
        if (scopeType === 'platform' || scopeType === 'company') return true;
        if (scopeType === 'team') {
          return Number(row?.teamId || 0) === Number(scopeTeamId || 0) || agentIds.has(Number(row?.ownerUserId || 0));
        }
        return Number(row?.ownerUserId || 0) === Number(safeActor.actorId || 0);
      })
      .map((row) => Number(row?.id || 0))
      .filter((id) => id > 0)
  );

  const label =
    scopeType === 'platform'
      ? '平台总览'
      : scopeType === 'company'
        ? '公司数据'
        : scopeType === 'team'
          ? '团队数据'
          : '我的数据';

  return {
    ...safeActor,
    scopeType,
    scopeTenantId,
    scopeTeamId,
    label,
    agentIds,
    customerIds,
    canSeeTenant,
    canSeeCreatedShareRow(row) {
      if (String(row?.event || '') !== SHARE_CREATE_EVENT) return false;
      if (!this.canSeeTenant(row?.tenantId)) return false;
      if (scopeType === 'platform' || scopeType === 'company') return true;
      if (scopeType === 'team') {
        return Number(row?.teamId || 0) === Number(scopeTeamId || 0) || agentIds.has(Number(row?.actorId || 0));
      }
      return Number(row?.actorId || 0) === Number(safeActor.actorId || 0);
    },
  };
}

function mapShareMetricsByVisibleCodes(trackEvents, shareCodes) {
  const metrics = new Map();
  if (!shareCodes.size) return metrics;
  trackEvents.forEach((row) => {
    const shareCode = toTrimmed(row?.properties?.shareCode);
    if (!shareCode || !shareCodes.has(shareCode)) return;
    if (!metrics.has(shareCode)) metrics.set(shareCode, toShareMetricBucket());
    const bucket = metrics.get(shareCode);
    const event = String(row?.event || '');
    if (event === SHARE_VIEW_EVENT) bucket.views += 1;
    else if (event === SHARE_CLICK_EVENT) bucket.clicks += 1;
    else if (event === SHARE_DELIVERY_EVENT) bucket.deliveries += 1;
  });
  return metrics;
}

function isCustomerActorType(actorType) {
  const normalized = String(actorType || '').trim().toLowerCase();
  return normalized === 'customer' || normalized === 'user';
}

function buildVisibleShareCreateRows(createdRows, shareType, targetIdFilter = 0) {
  return createdRows
    .filter((row) => ensureShareType(row?.properties?.shareType || 'mall_home') === shareType)
    .filter((row) => {
      if (targetIdFilter <= 0) return true;
      return Number(row?.properties?.targetId || 0) === targetIdFilter;
    });
}

function buildShareTargetCatalog({ state, scope, shareType, targetIdFilter = 0 }) {
  if (shareType === 'activity') {
    return new Map(
      (state.activities || [])
        .filter((row) => {
          const domain = String(row?.sourceDomain || row?.source_domain || 'activity').trim().toLowerCase();
          if (domain !== 'activity') return false;
          if (!scope.canSeeTenant(row?.tenantId)) return false;
          if (targetIdFilter > 0 && Number(row?.id || 0) !== targetIdFilter) return false;
          if (isPlatformTemplate(state, row)) return false;
          return true;
        })
        .map((row) => [Number(row?.id || 0), row])
    );
  }

  if (shareType === 'learning_course') {
    return new Map(
      (state.learningCourses || [])
        .filter((row) => {
          if (!scope.canSeeTenant(row?.tenantId)) return false;
          if (targetIdFilter > 0 && Number(row?.id || 0) !== targetIdFilter) return false;
          return true;
        })
        .map((row) => [Number(row?.id || 0), row])
    );
  }

  return new Map();
}

function buildShareCompletionRows({ state, scope, shareType, targetCatalog }) {
  if (shareType === 'activity') {
    return (Array.isArray(state.activityCompletions) ? state.activityCompletions : []).filter((row) => {
      const targetId = Number(row?.activityId || 0);
      const userId = Number(row?.userId || 0);
      return targetCatalog.has(targetId) && scope.customerIds.has(userId);
    });
  }

  if (shareType === 'learning_course') {
    return (Array.isArray(state.courseCompletions) ? state.courseCompletions : []).filter((row) => {
      const targetId = Number(row?.courseId || 0);
      const userId = Number(row?.userId || 0);
      return targetCatalog.has(targetId) && scope.customerIds.has(userId);
    });
  }

  return [];
}

function mapCompletionTargetId(shareType, row) {
  if (shareType === 'activity') return Number(row?.activityId || 0);
  if (shareType === 'learning_course') return Number(row?.courseId || 0);
  return 0;
}

export function collectShareParticipants({ state, scope, createdRows, trackEvents, shareType, targetId = 0 }) {
  const targetIdFilter = toNumber(targetId, 0);
  const shareCreateRows = buildVisibleShareCreateRows(createdRows, shareType, targetIdFilter);
  const shareMetaByCode = new Map(
    shareCreateRows
      .map((row) => {
        const shareCode = toTrimmed(row?.properties?.shareCode);
        if (!shareCode) return null;
        return [
          shareCode,
          {
            targetId: Number(row?.properties?.targetId || 0),
            targetTitle: String(row?.properties?.targetTitle || ''),
          },
        ];
      })
      .filter(Boolean)
  );
  const targetCatalog = buildShareTargetCatalog({ state, scope, shareType, targetIdFilter });
  const usersById = new Map((Array.isArray(state.users) ? state.users : []).map((row) => [Number(row?.id || 0), row]));
  const participantMap = new Map();

  const upsertParticipant = (row) => {
    const participantKey = toTrimmed(row?.participantKey);
    if (!participantKey) return;
    const nextOccurredAt = String(row?.occurredAt || '');
    const existing = participantMap.get(participantKey);
    if (!existing) {
      participantMap.set(participantKey, row);
      return;
    }
    const nextTime = new Date(nextOccurredAt || 0).getTime();
    const prevTime = new Date(String(existing?.occurredAt || 0)).getTime();
    if (nextTime >= prevTime) participantMap.set(participantKey, row);
  };

  trackEvents.forEach((row) => {
    const event = String(row?.event || '');
    if (event !== SHARE_IDENTIFY_EVENT && event !== SHARE_CLICK_EVENT) return;
    const shareCode = toTrimmed(row?.properties?.shareCode);
    const shareMeta = shareMetaByCode.get(shareCode);
    if (!shareMeta) return;

    const actorType = String(row?.actorType || '').trim().toLowerCase();
    const actorId = Number(row?.actorId || 0);
    const props = row?.properties && typeof row.properties === 'object' ? row.properties : {};
    const profile = actorId > 0 ? resolveShareActorProfile(state, actorType, actorId) : null;

    let participantKey = '';
    let userId = 0;
    let mobile = toTrimmed(props?.visitorMobile) || String(profile?.actorMobile || '').trim();
    let name = toTrimmed(props?.visitorName) || String(profile?.actorName || '').trim();

    if (isCustomerActorType(actorType) && actorId > 0) {
      participantKey = `user:${actorId}`;
      userId = actorId;
    } else if (mobile) {
      participantKey = `mobile:${mobile}`;
    }

    if (!participantKey) return;

    if (!name) {
      if (userId > 0) {
        const user = usersById.get(userId);
        name = String(user?.name || user?.nickName || '').trim() || `客户${userId}`;
      } else {
        name = '未识别客户';
      }
    }

    upsertParticipant({
      participantKey,
      userId: userId || null,
      name,
      mobile,
      shareType,
      targetId: Number(shareMeta.targetId || 0) || null,
      targetTitle: String(shareMeta.targetTitle || targetCatalog.get(Number(shareMeta.targetId || 0))?.title || ''),
      occurredAt: String(row?.createdAt || ''),
      sourceEvent: event,
    });
  });

  buildShareCompletionRows({ state, scope, shareType, targetCatalog }).forEach((row) => {
    const resolvedTargetId = mapCompletionTargetId(shareType, row);
    if (!targetCatalog.has(resolvedTargetId)) return;
    const userId = Number(row?.userId || 0);
    if (!userId) return;
    if (!scope.customerIds.has(userId)) return;
    const user = usersById.get(userId);
    if (!user) return;
    upsertParticipant({
      participantKey: `user:${userId}`,
      userId,
      name: String(user?.name || user?.nickName || `客户${userId}`),
      mobile: String(user?.mobile || ''),
      shareType,
      targetId: resolvedTargetId,
      targetTitle: String(targetCatalog.get(resolvedTargetId)?.title || row?.courseTitle || ''),
      occurredAt: String(row?.createdAt || row?.completedAt || ''),
      sourceEvent: shareType === 'learning_course' ? 'course_completion' : 'activity_completion',
    });
  });

  const list = Array.from(participantMap.values()).sort(
    (a, b) => new Date(String(b?.occurredAt || 0)).getTime() - new Date(String(a?.occurredAt || 0)).getTime()
  );

  return {
    total: list.length,
    list: list.map((row) => ({
      userId: row.userId || null,
      name: String(row.name || ''),
      mobile: String(row.mobile || ''),
      shareType: String(row.shareType || shareType),
      targetId: row.targetId || null,
      targetTitle: String(row.targetTitle || ''),
      occurredAt: String(row.occurredAt || ''),
    })),
  };
}

export function collectActivitySignupParticipants({ state, scope, createdRows, trackEvents, targetId = 0 }) {
  const summary = collectShareParticipants({ state, scope, createdRows, trackEvents, shareType: 'activity', targetId });
  return {
    total: summary.total,
    list: summary.list.map((row) => ({
      userId: row.userId,
      name: row.name,
      mobile: row.mobile,
      activityId: row.targetId,
      activityTitle: row.targetTitle,
      occurredAt: row.occurredAt,
    })),
  };
}

export function collectActivityAttendedParticipants({ state, scope, targetId = 0 }) {
  const targetIdFilter = toNumber(targetId, 0);
  const targetCatalog = buildShareTargetCatalog({ state, scope, shareType: 'activity', targetIdFilter });
  const usersById = new Map((Array.isArray(state.users) ? state.users : []).map((row) => [Number(row?.id || 0), row]));
  const participantMap = new Map();

  (Array.isArray(state.activityCompletions) ? state.activityCompletions : []).forEach((row) => {
    const activityId = Number(row?.activityId || 0);
    const userId = Number(row?.userId || 0);
    if (activityId <= 0 || userId <= 0) return;
    if (!targetCatalog.has(activityId)) return;
    if (!scope.customerIds.has(userId)) return;
    const user = usersById.get(userId);
    if (!user) return;

    const nextRow = {
      userId,
      name: String(user?.name || user?.nickName || `客户${userId}`),
      mobile: String(user?.mobile || ''),
      shareType: 'activity',
      targetId: activityId,
      targetTitle: String(targetCatalog.get(activityId)?.title || ''),
      occurredAt: String(row?.completedAt || row?.createdAt || ''),
    };
    const existing = participantMap.get(userId);
    if (!existing) {
      participantMap.set(userId, nextRow);
      return;
    }
    const nextTime = new Date(String(nextRow.occurredAt || 0)).getTime();
    const prevTime = new Date(String(existing.occurredAt || 0)).getTime();
    if (nextTime >= prevTime) participantMap.set(userId, nextRow);
  });

  const list = Array.from(participantMap.values()).sort(
    (a, b) => new Date(String(b?.occurredAt || 0)).getTime() - new Date(String(a?.occurredAt || 0)).getTime()
  );

  return {
    total: list.length,
    list,
  };
}

function collectRecentActivityParticipants({ state, scope, days = 7, now = new Date() }) {
  const trackEvents = Array.isArray(state.trackEvents) ? state.trackEvents : [];
  const createdRows = trackEvents
    .filter((row) => String(row?.event || '') === SHARE_CREATE_EVENT)
    .filter((row) => scope.canSeeCreatedShareRow(row));
  const all = collectActivitySignupParticipants({ state, scope, createdRows, trackEvents, targetId: 0 }).list;
  const dayStart = startOfLocalDay(now);
  const currentStart = addDays(dayStart, -(Math.max(1, Number(days || 7)) - 1));
  const nextDayStart = addDays(dayStart, 1);
  const previousStart = addDays(currentStart, -Math.max(1, Number(days || 7)));

  const current = all.filter((row) => inDateRange(row?.occurredAt, currentStart, nextDayStart));
  const previous = all.filter((row) => inDateRange(row?.occurredAt, previousStart, currentStart));

  return {
    currentStart,
    nextDayStart,
    previousStart,
    current: current.sort((a, b) => new Date(String(b?.occurredAt || 0)).getTime() - new Date(String(a?.occurredAt || 0)).getTime()),
    previous,
  };
}

export function collectDashboardMetrics({ actor, days = 7 }) {
  const state = getState();
  const scope = resolveShareAnalyticsScope(state, actor, actor?.user || null);
  const recentDays = Math.max(1, Number(days || 7));
  const todayStart = startOfLocalDay(new Date());
  const tomorrowStart = addDays(todayStart, 1);
  const yesterdayStart = addDays(todayStart, -1);
  const recentWindowStart = addDays(todayStart, -(recentDays - 1));
  const previousWindowStart = addDays(recentWindowStart, -recentDays);

  const users = (Array.isArray(state.users) ? state.users : []).filter((row) => scope.customerIds.has(Number(row?.id || 0)));
  const signIns = Array.isArray(state.signIns) ? state.signIns : [];
  const activityCompletions = Array.isArray(state.activityCompletions) ? state.activityCompletions : [];
  const courseCompletions = Array.isArray(state.courseCompletions) ? state.courseCompletions : [];
  const redemptions = Array.isArray(state.redemptions) ? state.redemptions : [];
  const trackEvents = (Array.isArray(state.trackEvents) ? state.trackEvents : []).filter((row) => scope.canSeeTenant(row?.tenantId));

  const dayFrames = Array.from({ length: recentDays }).map((_, index) => {
    const date = addDays(recentWindowStart, index);
    return {
      key: toLocalDayKey(date),
      label: toLocalDayLabel(date),
      start: date,
      end: addDays(date, 1),
      users: new Set(),
    };
  });

  const previousFrames = Array.from({ length: recentDays }).map((_, index) => {
    const date = addDays(previousWindowStart, index);
    return {
      start: date,
      end: addDays(date, 1),
      users: new Set(),
    };
  });

  const addUserToFrames = (frames, userId, occurredAt) => {
    const uid = Number(userId || 0);
    if (!uid || !scope.customerIds.has(uid)) return;
    const dt = asDate(occurredAt);
    if (!dt) return;
    frames.forEach((frame) => {
      if (dt >= frame.start && dt < frame.end) frame.users.add(uid);
    });
  };

  trackEvents.forEach((row) => {
    const actorType = String(row?.actorType || '').trim().toLowerCase();
    const actorId = Number(row?.actorId || 0);
    if (!isCustomerActorType(actorType) || actorId <= 0) return;
    addUserToFrames(dayFrames, actorId, row?.createdAt);
    addUserToFrames(previousFrames, actorId, row?.createdAt);
  });
  signIns.forEach((row) => {
    addUserToFrames(dayFrames, row?.userId, row?.createdAt || (row?.signDate ? `${row.signDate}T00:00:00` : ''));
    addUserToFrames(previousFrames, row?.userId, row?.createdAt || (row?.signDate ? `${row.signDate}T00:00:00` : ''));
  });
  activityCompletions.forEach((row) => {
    addUserToFrames(dayFrames, row?.userId, row?.completedAt || row?.createdAt);
    addUserToFrames(previousFrames, row?.userId, row?.completedAt || row?.createdAt);
  });
  courseCompletions.forEach((row) => {
    addUserToFrames(dayFrames, row?.userId, row?.completedAt || row?.createdAt);
    addUserToFrames(previousFrames, row?.userId, row?.completedAt || row?.createdAt);
  });
  redemptions.forEach((row) => {
    addUserToFrames(dayFrames, row?.userId, row?.createdAt);
    addUserToFrames(previousFrames, row?.userId, row?.createdAt);
  });

  const dailyActiveSeries = dayFrames.map((frame) => ({
    key: frame.key,
    label: frame.label,
    count: frame.users.size,
  }));
  const dailyActive7dTotal = dailyActiveSeries.reduce((sum, row) => sum + Number(row.count || 0), 0);
  const dailyActive7dPrevTotal = previousFrames.reduce((sum, frame) => sum + frame.users.size, 0);

  const newCustomersToday = users.filter((row) => inDateRange(row?.createdAt, todayStart, tomorrowStart)).length;
  const newCustomersPrev = users.filter((row) => inDateRange(row?.createdAt, yesterdayStart, todayStart)).length;

  const todaySignInUsers = new Set(
    signIns
      .filter((row) => inDateRange(row?.createdAt || (row?.signDate ? `${row.signDate}T00:00:00` : ''), todayStart, tomorrowStart))
      .map((row) => Number(row?.userId || 0))
      .filter((id) => id > 0 && scope.customerIds.has(id))
  );
  const prevSignInUsers = new Set(
    signIns
      .filter((row) => inDateRange(row?.createdAt || (row?.signDate ? `${row.signDate}T00:00:00` : ''), yesterdayStart, todayStart))
      .map((row) => Number(row?.userId || 0))
      .filter((id) => id > 0 && scope.customerIds.has(id))
  );

  const recentParticipants = collectRecentActivityParticipants({ state, scope, days: recentDays });

  return {
    ok: true,
    scope: {
      scopeType: scope.scopeType,
      label: scope.label,
      tenantId: scope.scopeTenantId || null,
      teamId: scope.scopeTeamId || null,
    },
    customerTotal: users.length,
    dailyActive7dTotal,
    dailyActive7dPrevTotal,
    dailyActiveSeries,
    activityParticipants7d: recentParticipants.current.length,
    activityParticipants7dPrev: recentParticipants.previous.length,
    newCustomersToday,
    newCustomersPrev,
    signInCustomersToday: todaySignInUsers.size,
    signInCustomersPrev: prevSignInUsers.size,
  };
}

export function getDashboardActivityParticipantList({ actor, query }) {
  const state = getState();
  const scope = resolveShareAnalyticsScope(state, actor, actor?.user || null);
  const recentDays = Math.max(1, Number(query?.days || 7));
  const recentParticipants = collectRecentActivityParticipants({ state, scope, days: recentDays });
  return {
    ok: true,
    scope: {
      scopeType: scope.scopeType,
      label: scope.label,
      tenantId: scope.scopeTenantId || null,
      teamId: scope.scopeTeamId || null,
    },
    total: recentParticipants.current.length,
    rangeLabel: `近${recentDays}日`,
    list: recentParticipants.current.map((row) => ({
      userId: row.userId || null,
      name: row.name,
      mobile: row.mobile,
      activityId: row.activityId || null,
      activityTitle: row.activityTitle,
      occurredAt: row.occurredAt,
    })),
  };
}

function mapDashboardCustomerRow(user, detail = {}) {
  return {
    userId: Number(user?.id || 0) || null,
    name: String(user?.name || user?.nickName || user?.mobile || `客户#${Number(user?.id || 0)}`),
    mobile: String(user?.mobile || user?.phone || ''),
    subtitle: String(detail.subtitle || ''),
    occurredAt: detail.occurredAt || user?.updatedAt || user?.createdAt || '',
  };
}

function mapDashboardCustomerActivityRow(user, detail = {}) {
  return {
    id: String(detail.id || ''),
    userId: Number(user?.id || 0) || null,
    name: String(user?.name || user?.nickName || user?.mobile || `客户#${Number(user?.id || 0)}`),
    mobile: String(user?.mobile || user?.phone || ''),
    category: String(detail.category || 'page_view'),
    event: String(detail.event || ''),
    detail: String(detail.detail || ''),
    occurredAt: detail.occurredAt || user?.updatedAt || user?.createdAt || '',
  };
}

function resolveDashboardCustomerActivityCategory(event = '') {
  const normalized = String(event || '').trim().toLowerCase();
  if (!normalized) return 'page_view';
  if (normalized === 'c_auth_verified') return 'verify';
  if (normalized.startsWith('share_') || normalized.startsWith('c_share_')) return 'share';
  if (normalized.startsWith('c_learning_')) return 'learning';
  if (normalized.startsWith('c_activity_') || normalized.startsWith('c_activities_')) return 'activity';
  if (normalized.startsWith('c_mall_redeem')) return 'redeem';
  if (normalized.startsWith('c_mall_')) return 'page_view';
  if (normalized === 'c_page_view') return 'page_view';
  return 'page_view';
}

function isDashboardCustomerTrackEventAllowed(event = '') {
  const normalized = String(event || '').trim().toLowerCase();
  return (
    normalized === 'c_page_view' ||
    normalized === 'c_auth_verified' ||
    normalized === 'c_share_success' ||
    normalized === 'share_h5_view' ||
    normalized === 'share_h5_click_cta' ||
    normalized === 'share_customer_identified' ||
    normalized === 'c_learning_browse_duration' ||
    normalized === 'c_activity_browse_duration' ||
    normalized === 'c_mall_open_product_detail' ||
    normalized === 'c_mall_open_activity_detail'
  );
}

export function getDashboardCustomerList({ actor, query }) {
  const state = getState();
  const scope = resolveShareAnalyticsScope(state, actor, actor?.user || null);
  const metric = String(query?.metric || 'activity_participants_7d').trim().toLowerCase();
  const recentDays = Math.max(1, Number(query?.days || 7));
  const todayStart = startOfLocalDay(new Date());
  const tomorrowStart = addDays(todayStart, 1);
  const users = (Array.isArray(state.users) ? state.users : []).filter((row) => scope.customerIds.has(Number(row?.id || 0)));
  const usersById = new Map(users.map((row) => [Number(row?.id || 0), row]));
  const signIns = Array.isArray(state.signIns) ? state.signIns : [];

  let title = '客户列表';
  let rangeLabel = scope.label;
  let list = [];

  if (metric === 'customer_total') {
    title = '客户总数';
    list = users
      .map((row) =>
        mapDashboardCustomerRow(row, {
          subtitle: `归属团队：${Number(row?.teamId || 0) || '-'}`,
          occurredAt: row?.createdAt || row?.updatedAt || '',
        })
      )
      .sort((a, b) => new Date(String(b.occurredAt || 0)).getTime() - new Date(String(a.occurredAt || 0)).getTime());
  } else if (metric === 'new_customers_today') {
    title = '今日新客户数';
    rangeLabel = '今日';
    list = users
      .filter((row) => inDateRange(row?.createdAt, todayStart, tomorrowStart))
      .map((row) =>
        mapDashboardCustomerRow(row, {
          subtitle: '今日新增客户',
          occurredAt: row?.createdAt || row?.updatedAt || '',
        })
      )
      .sort((a, b) => new Date(String(b.occurredAt || 0)).getTime() - new Date(String(a.occurredAt || 0)).getTime());
  } else if (metric === 'signin_customers_today') {
    title = '今日签到客户数';
    rangeLabel = '今日';
    const signInMap = new Map();
    signIns.forEach((row) => {
      const userId = Number(row?.userId || 0);
      if (!userId || !scope.customerIds.has(userId)) return;
      const occurredAt = row?.createdAt || (row?.signDate ? `${row.signDate}T00:00:00` : '');
      if (!inDateRange(occurredAt, todayStart, tomorrowStart)) return;
      const customer = usersById.get(userId);
      if (!customer) return;
      const existing = signInMap.get(userId);
      if (!existing || new Date(String(occurredAt || 0)).getTime() > new Date(String(existing.occurredAt || 0)).getTime()) {
        signInMap.set(
          userId,
          mapDashboardCustomerRow(customer, {
            subtitle: '今日已签到',
            occurredAt,
          })
        );
      }
    });
    list = Array.from(signInMap.values()).sort(
      (a, b) => new Date(String(b.occurredAt || 0)).getTime() - new Date(String(a.occurredAt || 0)).getTime()
    );
  } else {
    title = `近${recentDays}日活动参与人数`;
    rangeLabel = `近${recentDays}日`;
    const recentParticipants = collectRecentActivityParticipants({ state, scope, days: recentDays });
    list = recentParticipants.current
      .map((row) => ({
        userId: row.userId || null,
        name: row.name,
        mobile: row.mobile,
        subtitle: row.activityTitle || '活动参与',
        occurredAt: row.occurredAt,
      }))
      .sort((a, b) => new Date(String(b.occurredAt || 0)).getTime() - new Date(String(a.occurredAt || 0)).getTime());
  }

  return {
    ok: true,
    metric,
    title,
    scope: {
      scopeType: scope.scopeType,
      label: scope.label,
      tenantId: scope.scopeTenantId || null,
      teamId: scope.scopeTeamId || null,
    },
    total: list.length,
    rangeLabel,
    list,
  };
}

export function getDashboardCustomerActivityFeed({ actor, query }) {
  const state = getState();
  const scope = resolveShareAnalyticsScope(state, actor, actor?.user || null);
  const rawLimit = String(query?.limit || '').trim().toLowerCase();
  const includeAll = rawLimit === 'all';
  const limit = includeAll ? Number.MAX_SAFE_INTEGER : Math.min(100, Math.max(1, toNumber(query?.limit, 30) || 30));
  const todayStart = startOfLocalDay(new Date());
  const tomorrowStart = addDays(todayStart, 1);
  const users = (Array.isArray(state.users) ? state.users : []).filter((row) => scope.customerIds.has(Number(row?.id || 0)));
  const usersById = new Map(users.map((row) => [Number(row?.id || 0), row]));
  const courseById = new Map((state.learningCourses || []).map((row) => [Number(row?.id || 0), row]));
  const itemById = buildMallItemLookup(state);
  const activityById = new Map(
    [...(state.activities || []), ...(state.mallActivities || []), ...(state.bCustomerActivities || [])].map((row) => [Number(row?.id || 0), row]),
  );
  const orderById = new Map((state.orders || []).map((row) => [Number(row?.id || 0), row]));
  const trackEvents = (Array.isArray(state.trackEvents) ? state.trackEvents : []).filter((row) => scope.canSeeTenant(row?.tenantId));
  const signIns = Array.isArray(state.signIns) ? state.signIns : [];
  const activityCompletions = Array.isArray(state.activityCompletions) ? state.activityCompletions : [];
  const courseCompletions = Array.isArray(state.courseCompletions) ? state.courseCompletions : [];
  const redemptions = Array.isArray(state.redemptions) ? state.redemptions : [];
  const sessions = Array.isArray(state.sessions) ? state.sessions : [];

  const list = [];
  const seen = new Set();

  const pushRow = (key, userId, payload) => {
    const customerId = Number(userId || 0);
    if (customerId <= 0 || !scope.customerIds.has(customerId)) return;
    const user = usersById.get(customerId);
    if (!user) return;
    const occurredAt = String(payload?.occurredAt || '').trim();
    if (!inDateRange(occurredAt, todayStart, tomorrowStart)) return;
    const dedupeKey = String(key || `${String(payload?.category || 'page_view')}:${customerId}:${occurredAt}:${String(payload?.event || '')}`);
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    list.push(
      mapDashboardCustomerActivityRow(user, {
        id: dedupeKey,
        category: String(payload?.category || 'page_view'),
        event: String(payload?.event || ''),
        detail: String(payload?.detail || ''),
        occurredAt,
      }),
    );
  };

  sessions.forEach((row) => {
    const customerId = Number(row?.userId || 0);
    const occurredAt = row?.createdAt || '';
    pushRow(`login:${customerId}:${String(occurredAt)}`, customerId, {
      category: 'login',
      event: '登录 C 端',
      detail: '进入客户端并建立会话',
      occurredAt,
    });
  });

  trackEvents.forEach((row, index) => {
    const event = String(row?.event || '').trim().toLowerCase();
    const actorId = Number(row?.actorId || 0);
    if (!isCustomerActorType(row?.actorType) || actorId <= 0) return;
    if (!isDashboardCustomerTrackEventAllowed(event)) return;

    if (event === 'c_auth_verified') {
      pushRow(`track:${event}:${actorId}:${String(row?.createdAt || '')}:${index}`, actorId, {
        category: 'verify',
        event: '完成实名认证',
        detail: '客户已完成实名校验',
        occurredAt: row?.createdAt || '',
      });
      return;
    }

    if (event === 'c_share_success') {
      const props = row?.properties && typeof row.properties === 'object' ? row.properties : {};
      const shareTabMap = {
        home: '首页',
        activities: '活动中心',
        learning: '知识学习',
        profile: '个人中心',
        mall: '积分商城',
      };
      const tab = String(props.tab || '').trim().toLowerCase();
      pushRow(`track:${event}:${actorId}:${String(row?.createdAt || '')}:${index}`, actorId, {
        category: 'share',
        event: '分享成功',
        detail: `来源：${shareTabMap[tab] || tab || 'C端页面'}`,
        occurredAt: row?.createdAt || '',
      });
      return;
    }

    const summary = summarizeBehaviorEvent(state, row, { courseById, itemById, activityById, orderById });
    if (event === 'c_page_view' && (summary.title === '进入知识学习' || summary.title === '进入活动中心')) {
      return;
    }
    pushRow(`track:${event}:${actorId}:${String(row?.createdAt || '')}:${index}`, actorId, {
      category: resolveDashboardCustomerActivityCategory(event),
      event: summary.title,
      detail: summary.detail,
      occurredAt: row?.createdAt || '',
    });
  });

  const verifiedTodayCustomerIds = new Set(
    list.filter((row) => row.category === 'verify').map((row) => Number(row.userId || 0)).filter((id) => id > 0),
  );
  users.forEach((user) => {
    const customerId = Number(user?.id || 0);
    if (!customerId || verifiedTodayCustomerIds.has(customerId)) return;
    const occurredAt = String(user?.verifiedAt || '').trim();
    if (!inDateRange(occurredAt, todayStart, tomorrowStart)) return;
    pushRow(`verified:${customerId}:${occurredAt}`, customerId, {
      category: 'verify',
      event: '完成实名认证',
      detail: '客户已完成实名校验',
      occurredAt,
    });
  });

  signIns.forEach((row) => {
    const customerId = Number(row?.userId || 0);
    const occurredAt = row?.createdAt || (row?.signDate ? `${row.signDate}T00:00:00` : '');
    pushRow(`signin:${Number(row?.id || 0)}:${String(occurredAt)}`, customerId, {
      category: 'sign_in',
      event: '每日签到',
      detail: `签到奖励 +${Number(row?.pointsAwarded || 10)} 积分`,
      occurredAt,
    });
  });

  courseCompletions.forEach((row) => {
    const customerId = Number(row?.userId || 0);
    const course = courseById.get(Number(row?.courseId || 0));
    const occurredAt = row?.completedAt || row?.createdAt || '';
    pushRow(`course-complete:${Number(row?.id || 0)}:${String(occurredAt)}`, customerId, {
      category: 'learning',
      event: `完成学习：${String(row?.courseTitle || course?.title || `课程#${row?.courseId || '-'}`)}`,
      detail: `奖励积分 +${Number(row?.pointsAwarded || 0)} 积分`,
      occurredAt,
    });
  });

  activityCompletions.forEach((row) => {
    const customerId = Number(row?.userId || 0);
    const activity = activityById.get(Number(row?.activityId || 0));
    const isMallActivity = String(activity?.sourceDomain || '').toLowerCase() === 'mall';
    const occurredAt = row?.completedAt || row?.createdAt || '';
    pushRow(`activity-complete:${Number(row?.id || 0)}:${String(occurredAt)}`, customerId, {
      category: 'activity',
      event: `${isMallActivity ? '参与商城活动' : '参与活动'}：${String(activity?.title || activity?.displayTitle || `活动#${row?.activityId || '-'}`)}`,
      detail: `奖励积分 +${Number(row?.pointsAwarded || activity?.rewardPoints || 0)} 积分`,
      occurredAt,
    });
  });

  redemptions.forEach((row) => {
    const customerId = Number(row?.userId || 0);
    const order = orderById.get(Number(row?.orderId || 0));
    const item = itemById.get(Number(row?.itemId || order?.productId || 0));
    const orderType = String(order?.orderType || '').toLowerCase();
    const activity = activityById.get(Number(order?.activityId || 0));
    const redeemName =
      orderType === 'activity'
        ? String(activity?.title || activity?.displayTitle || order?.productName || `活动#${order?.activityId || '-'}`)
        : String(item?.name || order?.productName || `商品#${row?.itemId || '-'}`);
    const occurredAt = row?.createdAt || '';
    pushRow(`redeem:${Number(row?.id || 0)}:${String(occurredAt)}`, customerId, {
      category: 'redeem',
      event: `${orderType === 'activity' ? '积分兑换活动' : '积分兑换商品'}：${redeemName}`,
      detail: `订单号 #${String(row?.orderId || row?.id || '-')}`,
      occurredAt,
    });
  });

  const sorted = list.sort((a, b) => new Date(String(b.occurredAt || 0)).getTime() - new Date(String(a.occurredAt || 0)).getTime());
  const visible = includeAll ? sorted : sorted.slice(0, limit);

  return {
    ok: true,
    scope: {
      scopeType: scope.scopeType,
      label: scope.label,
      tenantId: scope.scopeTenantId || null,
      teamId: scope.scopeTeamId || null,
    },
    total: sorted.length,
    rangeLabel: '今日',
    list: visible,
  };
}

function computeShareEffectSummary(state, scope, createdRows, trackEvents, options = {}) {
  const shareType = ensureShareType(options?.shareType || 'activity');
  const targetIdFilter = toNumber(options?.targetId, 0);
  const shareCreateRows = buildVisibleShareCreateRows(createdRows, shareType, targetIdFilter);
  const shareCodes = new Set(
    shareCreateRows.map((row) => toTrimmed(row?.properties?.shareCode)).filter(Boolean)
  );
  const totalShares = shareCreateRows.length;
  const totalViews = trackEvents.filter((row) => {
    const shareCode = toTrimmed(row?.properties?.shareCode);
    return shareCode && shareCodes.has(shareCode) && String(row?.event || '') === SHARE_VIEW_EVENT;
  }).length;
  const targetCatalog = buildShareTargetCatalog({ state, scope, shareType, targetIdFilter });
  const completedRows = buildShareCompletionRows({ state, scope, shareType, targetCatalog });
  const completedTargetIds = new Set(completedRows.map((row) => mapCompletionTargetId(shareType, row)).filter((id) => id > 0));
  const sharedTargetIds = new Set(
    shareCreateRows.map((row) => Number(row?.properties?.targetId || 0)).filter((id) => id > 0)
  );
  const totalItems = new Set([...sharedTargetIds, ...completedTargetIds]).size;
  const participantSummary = collectShareParticipants({
    state,
    scope,
    createdRows,
    trackEvents,
    shareType,
    targetId: targetIdFilter,
  });

  return {
    totalItems,
    totalShares,
    totalViews,
    totalParticipants: Number(participantSummary.total || 0),
  };
}

function computeActivityEffectSummary(state, scope, createdRows, trackEvents, options = {}) {
  const summary = computeShareEffectSummary(state, scope, createdRows, trackEvents, { ...options, shareType: 'activity' });
  const signupSummary = collectActivitySignupParticipants({
    state,
    scope,
    createdRows,
    trackEvents,
    targetId: Number(options?.targetId || 0),
  });
  const attendedSummary = collectActivityAttendedParticipants({
    state,
    scope,
    targetId: Number(options?.targetId || 0),
  });
  return {
    totalActivities: Number(summary.totalItems || 0),
    totalShares: Number(summary.totalShares || 0),
    totalViews: Number(summary.totalViews || 0),
    totalParticipants: Number(signupSummary.total || 0),
    totalAttendees: Number(attendedSummary.total || 0),
  };
}

function computeLearningEffectSummary(state, scope, createdRows, trackEvents, options = {}) {
  const summary = computeShareEffectSummary(state, scope, createdRows, trackEvents, { ...options, shareType: 'learning_course' });
  return {
    totalCourses: Number(summary.totalItems || 0),
    totalShares: Number(summary.totalShares || 0),
    totalViews: Number(summary.totalViews || 0),
    totalParticipants: Number(summary.totalParticipants || 0),
  };
}

export function listShareRecords({ actor, query }) {
  const state = getState();
  const limit = Math.min(50, Math.max(1, toNumber(query?.limit, 20) || 20));
  const shareTypeFilter = normalizeShareType(query?.shareType || '');
  const targetIdFilter = toNumber(query?.targetId, 0);
  const channelFilter = normalizeShareChannel(query?.channel || '');
  const trackEvents = Array.isArray(state.trackEvents) ? state.trackEvents : [];
  const scope = resolveShareAnalyticsScope(state, actor, actor?.user || null);
  const allCreatedRows = trackEvents
    .filter((row) => String(row?.event || '') === SHARE_CREATE_EVENT)
    .filter((row) => scope.canSeeCreatedShareRow(row));
  const visibleCreatedRows = allCreatedRows.filter(
    (row) => !channelFilter || normalizeShareChannel(row?.properties?.channel || '') === channelFilter,
  );

  const createdRows = visibleCreatedRows
    .filter((row) => !shareTypeFilter || normalizeShareType(row?.properties?.shareType || '') === shareTypeFilter)
    .filter((row) => !targetIdFilter || Number(row?.properties?.targetId || 0) === targetIdFilter)
    .sort((a, b) => new Date(String(b?.createdAt || 0)).getTime() - new Date(String(a?.createdAt || 0)).getTime());

  const visibleShareCodes = new Set(createdRows.map((row) => toTrimmed(row?.properties?.shareCode)).filter(Boolean));
  const metricsByCode = mapShareMetricsByVisibleCodes(trackEvents, visibleShareCodes);
  const byTypeMap = new Map();
  const targetStatsMap = new Map();
  const activityEffect = computeActivityEffectSummary(
    state,
    scope,
    visibleCreatedRows,
    trackEvents,
    { targetId: shareTypeFilter === 'activity' ? targetIdFilter : 0 }
  );
  const learningEffect = computeLearningEffectSummary(
    state,
    scope,
    visibleCreatedRows,
    trackEvents,
    { targetId: shareTypeFilter === 'learning_course' ? targetIdFilter : 0 }
  );
  const filteredTargetTitle =
    targetIdFilter > 0
      ? String(
          createdRows.find((row) => Number(row?.properties?.targetId || 0) === targetIdFilter)?.properties?.targetTitle ||
            (shareTypeFilter === 'learning_course'
              ? (state.learningCourses || []).find((row) => Number(row?.id || 0) === targetIdFilter)?.title
              : (state.activities || []).find((row) => Number(row?.id || 0) === targetIdFilter)?.title) ||
            ''
        )
      : '';

  createdRows.forEach((row) => {
    const properties = row?.properties && typeof row.properties === 'object' ? row.properties : {};
    const shareCode = toTrimmed(properties.shareCode);
    const shareType = ensureShareType(properties.shareType || 'mall_home');
    const metrics = metricsByCode.get(shareCode) || toShareMetricBucket();
    const targetId = toNumber(properties.targetId, 0) || null;
    const typeKey = shareType;
    const targetKey = `${shareType}:${targetId || 0}`;

    if (!byTypeMap.has(typeKey)) {
      byTypeMap.set(typeKey, { shareType, totalLinks: 0, totalViews: 0, totalClicks: 0, totalDeliveries: 0 });
    }
    const typeBucket = byTypeMap.get(typeKey);
    typeBucket.totalLinks += 1;
    typeBucket.totalViews += Number(metrics.views || 0);
    typeBucket.totalClicks += Number(metrics.clicks || 0);
    typeBucket.totalDeliveries += Number(metrics.deliveries || 0);

    if (!targetStatsMap.has(targetKey)) {
      targetStatsMap.set(targetKey, {
        shareType,
        targetId,
        targetTitle: String(properties.targetTitle || ''),
        totalLinks: 0,
        totalViews: 0,
        totalClicks: 0,
        totalParticipants: 0,
        totalAttendees: 0,
      });
    }
    const targetBucket = targetStatsMap.get(targetKey);
    targetBucket.totalLinks += 1;
    targetBucket.totalViews += Number(metrics.views || 0);
    targetBucket.totalClicks += Number(metrics.clicks || 0);
  });

  for (const [key, bucket] of targetStatsMap.entries()) {
    const bucketShareType = String(bucket?.shareType || '');
    if (
      bucketShareType !== 'activity' &&
      bucketShareType !== 'learning_course' &&
      bucketShareType !== 'mall_item' &&
      bucketShareType !== 'mall_activity'
    ) continue;
    const targetId = Number(bucket?.targetId || 0);
    if (targetId <= 0) continue;
    const participantSummary =
      bucketShareType === 'activity'
        ? collectActivitySignupParticipants({
            state,
            scope,
            createdRows: visibleCreatedRows,
            trackEvents,
            targetId,
          })
        : collectShareParticipants({
            state,
            scope,
            createdRows: visibleCreatedRows,
            trackEvents,
            shareType: bucketShareType,
            targetId,
          });
    targetStatsMap.set(key, {
      ...bucket,
      totalParticipants: Number(participantSummary.total || 0),
      totalAttendees:
        bucketShareType === 'activity'
          ? Number(
              collectActivityAttendedParticipants({
                state,
                scope,
                targetId,
              }).total || 0
            )
          : 0,
    });
  }

  const list = createdRows.slice(0, limit).map((row) => {
    const properties = row?.properties && typeof row.properties === 'object' ? row.properties : {};
    const shareCode = toTrimmed(properties.shareCode);
    const shareType = ensureShareType(properties.shareType || 'mall_home');
    const metrics = metricsByCode.get(shareCode) || toShareMetricBucket();
    const targetId = toNumber(properties.targetId, 0) || null;

    return {
      shareCode,
      shareType,
      sharePath: String(properties.sharePath || ''),
      channel: String(properties.channel || ''),
      targetId,
      targetTitle: String(properties.targetTitle || ''),
      shareUrl: String(properties.shareUrl || ''),
      targetCPath: String(properties.targetCPath || ''),
      fallbackCPath: String(properties.fallbackCPath || ''),
      loginRequired: Boolean(properties.loginRequired),
      expiresAt: String(properties.expiresAt || ''),
      previewPayload: properties.previewPayload && typeof properties.previewPayload === 'object' ? properties.previewPayload : {},
      createdAt: String(row?.createdAt || ''),
      metrics: {
        views: Number(metrics.views || 0),
        clicks: Number(metrics.clicks || 0),
        deliveries: Number(metrics.deliveries || 0),
        clickThroughRate: toRatio(metrics.clicks, metrics.views),
      },
    };
  });

  const summary = createdRows.reduce(
    (acc, row) => {
      const properties = row?.properties && typeof row.properties === 'object' ? row.properties : {};
      const shareCode = toTrimmed(properties.shareCode);
      const metrics = metricsByCode.get(shareCode) || toShareMetricBucket();
      acc.totalLinks += 1;
      acc.totalViews += Number(metrics.views || 0);
      acc.totalClicks += Number(metrics.clicks || 0);
      acc.totalDeliveries += Number(metrics.deliveries || 0);
      return acc;
    },
    { totalLinks: 0, totalViews: 0, totalClicks: 0, totalDeliveries: 0 },
  );

  return {
    ok: true,
    scope: {
      scopeType: scope.scopeType,
      label: scope.label,
      tenantId: scope.scopeTenantId || null,
      teamId: scope.scopeTeamId || null,
    },
    filter:
      targetIdFilter > 0
        ? {
            shareType: shareTypeFilter || 'activity',
            targetId: targetIdFilter,
            targetTitle: filteredTargetTitle,
          }
        : null,
    activityEffect,
    learningEffect,
    summary: {
      ...summary,
      clickThroughRate: toRatio(summary.totalClicks, summary.totalViews),
    },
    byType: Array.from(byTypeMap.values()).map((row) => ({
      ...row,
      clickThroughRate: toRatio(row.totalClicks, row.totalViews),
    })),
    targetStats: Array.from(targetStatsMap.values()).map((row) => ({
      ...row,
      totalParticipants: Number(row.totalParticipants || 0),
      totalAttendees: Number(row.totalAttendees || 0),
      clickThroughRate: toRatio(row.totalClicks, row.totalViews),
    })),
    list,
  };
}

export function getShareParticipantList({ actor, query }) {
  const state = getState();
  const scope = resolveShareAnalyticsScope(state, actor, actor?.user || null);
  const targetIdFilter = toNumber(query?.targetId, 0);
  const shareTypeFilter = ensureShareType(query?.shareType || 'activity');
  const metric = String(query?.metric || 'signup').trim().toLowerCase();
  const trackEvents = Array.isArray(state.trackEvents) ? state.trackEvents : [];
  const createdRows = trackEvents
    .filter((row) => String(row?.event || '') === SHARE_CREATE_EVENT)
    .filter((row) => scope.canSeeCreatedShareRow(row));
  const participantSummary =
    shareTypeFilter === 'activity' && metric === 'attended'
      ? collectActivityAttendedParticipants({
          state,
          scope,
          targetId: targetIdFilter,
        })
      : shareTypeFilter === 'activity'
        ? collectActivitySignupParticipants({
            state,
            scope,
            createdRows,
            trackEvents,
            targetId: targetIdFilter,
          })
        : collectShareParticipants({
            state,
            scope,
            createdRows,
            trackEvents,
            shareType: shareTypeFilter,
            targetId: targetIdFilter,
          });
  const { list } = participantSummary;
  const targetCatalog = buildShareTargetCatalog({ state, scope, shareType: shareTypeFilter, targetIdFilter });

  return {
    ok: true,
    scope: {
      scopeType: scope.scopeType,
      label: scope.label,
      tenantId: scope.scopeTenantId || null,
      teamId: scope.scopeTeamId || null,
    },
    filter:
      targetIdFilter > 0
        ? {
            shareType: shareTypeFilter,
            targetId: targetIdFilter,
            targetTitle: String(targetCatalog.get(targetIdFilter)?.title || ''),
          }
        : null,
    metric,
    total: list.length,
    list,
  };
}

export function getActivityParticipantList({ actor, query }) {
  return getShareParticipantList({ actor, query: { ...(query || {}), shareType: 'activity' } });
}

export function getShareRecordDetail({ actor, shareCode }) {
  const state = getState();
  const trackEvents = Array.isArray(state.trackEvents) ? state.trackEvents : [];
  const scope = resolveShareAnalyticsScope(state, actor, actor?.user || null);
  const shareRows = trackEvents
    .filter((row) => String(row?.properties?.shareCode || '') === String(shareCode || ''))
    .sort((a, b) => new Date(String(b?.createdAt || 0)).getTime() - new Date(String(a?.createdAt || 0)).getTime());

  const createdRow = shareRows.find((row) => String(row?.event || '') === SHARE_CREATE_EVENT);
  if (!createdRow) {
    throw new Error('SHARE_RECORD_NOT_FOUND');
  }
  if (!scope.canSeeCreatedShareRow(createdRow)) {
    throw new Error('SHARE_RECORD_NOT_FOUND');
  }
  const metricsByCode = mapShareMetricsByVisibleCodes(trackEvents, new Set([toTrimmed(createdRow?.properties?.shareCode)]));

  const properties = createdRow?.properties && typeof createdRow.properties === 'object' ? createdRow.properties : {};
  const normalizedShareType = ensureShareType(properties.shareType || 'mall_home');
  const normalizedShareCode = toTrimmed(properties.shareCode);
  const metrics = metricsByCode.get(normalizedShareCode) || toShareMetricBucket();

  const record = {
    shareCode: normalizedShareCode,
    shareType: normalizedShareType,
    sharePath: String(properties.sharePath || ''),
    channel: String(properties.channel || ''),
    targetId: toNumber(properties.targetId, 0) || null,
    targetTitle: String(properties.targetTitle || ''),
    shareUrl: String(properties.shareUrl || ''),
    targetCPath: String(properties.targetCPath || ''),
    fallbackCPath: String(properties.fallbackCPath || ''),
    loginRequired: Boolean(properties.loginRequired),
    expiresAt: String(properties.expiresAt || ''),
    previewPayload: properties.previewPayload && typeof properties.previewPayload === 'object' ? properties.previewPayload : {},
    createdAt: String(createdRow?.createdAt || ''),
    metrics: {
      views: Number(metrics.views || 0),
      clicks: Number(metrics.clicks || 0),
      deliveries: Number(metrics.deliveries || 0),
      clickThroughRate: toRatio(metrics.clicks, metrics.views),
    },
  };

  const events = shareRows.map((row) => {
    const event = String(row?.event || '');
    const actorType = String(row?.actorType || 'anonymous');
    const actorId = Number(row?.actorId || 0);
    const actorProfile = resolveShareActorProfile(state, actorType, actorId);
    const eventProperties = row?.properties && typeof row.properties === 'object' ? row.properties : {};
    const fallbackVisitorName = String(eventProperties.visitorName || '').trim();
    const fallbackVisitorMobile = String(eventProperties.visitorMobile || '').trim();
    const actorName = actorProfile.actorName === '匿名访客' && fallbackVisitorName ? fallbackVisitorName : actorProfile.actorName;
    const actorLabel = actorProfile.actorLabel === '匿名访客' && fallbackVisitorName ? `客户 · ${fallbackVisitorName}` : actorProfile.actorLabel;
    return {
      id: Number(row?.id || 0),
      event,
      actionLabel: resolveShareEventLabel(event),
      actorType,
      actorId: actorId || null,
      actorName,
      actorLabel,
      actorMobile: actorProfile.actorMobile || fallbackVisitorMobile,
      occurredAt: String(row?.createdAt || ''),
      source: String(row?.source || ''),
      sourceLabel: resolveShareEventSourceLabel(row?.source),
      path: String(row?.path || ''),
      userAgent: String(row?.userAgent || ''),
      properties: eventProperties,
    };
  });

  return {
    ok: true,
    record,
    events,
  };
}
