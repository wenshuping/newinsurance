export const VIDEO_CHANNEL_SOURCE_TYPE = 'video_channel';
export const DEFAULT_COURSE_SOURCE_TYPE = 'native';
export const VIDEO_CHANNEL_MEDIA_TYPE = 'application/vnd.insurance.video-channel+json';
const VIDEO_CHANNEL_MEDIA_NAME = '__video_channel_meta__';

const toTrimmedString = (value) => String(value ?? '').trim();

export function normalizeVideoChannelMeta(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const meta = {
    finderUserName: toTrimmedString(raw.finderUserName),
    feedToken: toTrimmedString(raw.feedToken),
    feedId: toTrimmedString(raw.feedId),
    nonceId: toTrimmedString(raw.nonceId),
    miniProgramAppId: toTrimmedString(raw.miniProgramAppId),
    miniProgramPath: toTrimmedString(raw.miniProgramPath),
    miniProgramEnvVersion: (() => {
      const value = toTrimmedString(raw.miniProgramEnvVersion || 'release').toLowerCase();
      return ['develop', 'trial', 'release'].includes(value) ? value : 'release';
    })(),
    coverUrl: toTrimmedString(raw.coverUrl),
  };
  const hasAnyValue = [
    meta.finderUserName,
    meta.feedToken,
    meta.feedId,
    meta.nonceId,
    meta.miniProgramAppId,
    meta.miniProgramPath,
    meta.coverUrl,
  ].some((value) => toTrimmedString(value));
  return hasAnyValue ? meta : null;
}

function isVideoChannelMediaItem(item) {
  if (!item || typeof item !== 'object') return false;
  return (
    toTrimmedString(item.type).toLowerCase() === VIDEO_CHANNEL_MEDIA_TYPE
    || toTrimmedString(item.name) === VIDEO_CHANNEL_MEDIA_NAME
  );
}

export function extractVideoChannelMetaFromMedia(media) {
  if (!Array.isArray(media)) return null;
  for (const item of media) {
    if (!isVideoChannelMediaItem(item)) continue;
    const direct = normalizeVideoChannelMeta(item.data || item.meta);
    if (direct) return direct;
    const text = toTrimmedString(item.preview || item.url || item.path);
    if (!text) return null;
    try {
      return normalizeVideoChannelMeta(JSON.parse(text));
    } catch {
      return null;
    }
  }
  return null;
}

export function stripVideoChannelMetaFromMedia(media) {
  if (!Array.isArray(media)) return [];
  return media.filter((item) => !isVideoChannelMediaItem(item));
}

export function mergeVideoChannelMetaIntoMedia(media, rawMeta) {
  const next = stripVideoChannelMetaFromMedia(media);
  const meta = normalizeVideoChannelMeta(rawMeta);
  if (!meta) return next;
  next.push({
    name: VIDEO_CHANNEL_MEDIA_NAME,
    type: VIDEO_CHANNEL_MEDIA_TYPE,
    preview: meta.coverUrl || '',
    url: '',
    path: '',
    data: meta,
  });
  return next;
}

export function resolveCourseSourceType(row, fallback = DEFAULT_COURSE_SOURCE_TYPE) {
  const raw = toTrimmedString(row?.sourceType).toLowerCase();
  if (raw === VIDEO_CHANNEL_SOURCE_TYPE) return VIDEO_CHANNEL_SOURCE_TYPE;
  if (normalizeVideoChannelMeta(row?.videoChannelMeta) || extractVideoChannelMetaFromMedia(row?.media)) {
    return VIDEO_CHANNEL_SOURCE_TYPE;
  }
  return raw || fallback;
}

export function resolveCourseVideoChannelMeta(row) {
  return normalizeVideoChannelMeta(row?.videoChannelMeta) || extractVideoChannelMetaFromMedia(row?.media);
}
