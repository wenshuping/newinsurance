import {
  DEFAULT_COURSE_SOURCE_TYPE,
  resolveCourseSourceType,
  resolveCourseVideoChannelMeta,
  stripVideoChannelMetaFromMedia,
} from '../common/video-channel-course.mjs';

const toTrimmedString = (value) => String(value ?? '').trim();

const inferMediaType = (value) => {
  const text = toTrimmedString(value).toLowerCase();
  if (/\.(mp4|mov|m4v|webm)(\?.*)?$/.test(text)) return 'video/*';
  return 'image/*';
};

const normalizeMediaItem = (item) => {
  const preview = toTrimmedString(item?.preview || item?.url || item?.path);
  const url = toTrimmedString(item?.url || item?.preview || item?.path);
  const path = toTrimmedString(item?.path);
  const name = toTrimmedString(item?.name || path.split('/').pop() || url.split('/').pop() || 'media');
  const type = toTrimmedString(item?.type || inferMediaType(preview || url || path));
  if (!preview && !url && !path && !name) return null;
  return {
    name,
    type,
    preview: preview || url || path,
    url: url || preview || path,
    path,
  };
};

const buildFallbackCoverMedia = (coverUrl) => {
  const resolvedCover = toTrimmedString(coverUrl);
  if (!resolvedCover) return [];
  return [
    {
      name: 'cover',
      type: inferMediaType(resolvedCover),
      preview: resolvedCover,
      url: resolvedCover,
      path: /^\/uploads\//i.test(resolvedCover) ? resolvedCover : '',
    },
  ];
};

export function ensurePLearningCourseAdminMedia(row) {
  const normalized = stripVideoChannelMetaFromMedia(Array.isArray(row?.media) ? row.media : [])
    .map((item) => normalizeMediaItem(item))
    .filter(Boolean);
  if (normalized.length) return normalized;
  return buildFallbackCoverMedia(row?.coverUrl || row?.image || '');
}

export function toPLearningCourseAdminView({ row, status, isPlatformTemplate, templateTag = '' }) {
  const media = ensurePLearningCourseAdminMedia(row);
  const firstPreview = toTrimmedString(media[0]?.preview || media[0]?.url || media[0]?.path);
  const coverUrl = toTrimmedString(row?.coverUrl || row?.image || firstPreview);
  const sourceType = resolveCourseSourceType(row, DEFAULT_COURSE_SOURCE_TYPE);
  const videoChannelMeta = resolveCourseVideoChannelMeta(row);
  return {
    id: Number(row?.id || 0),
    title: toTrimmedString(row?.title),
    status: toTrimmedString(status || row?.status || 'published'),
    category: toTrimmedString(row?.category || '通用培训'),
    contentType: toTrimmedString(row?.contentType || row?.type || 'article'),
    sourceType,
    videoChannelMeta,
    rewardPoints: Number(row?.rewardPoints ?? row?.points ?? 0),
    points: Number(row?.points ?? row?.rewardPoints ?? 0),
    sortOrder: Number(row?.sortOrder || 0),
    content: String(row?.content || ''),
    coverUrl,
    image: coverUrl,
    media,
    createdAt: row?.createdAt || null,
    updatedAt: row?.updatedAt || row?.createdAt || new Date().toISOString(),
    isPlatformTemplate: Boolean(isPlatformTemplate),
    templateTag: templateTag || '',
  };
}
