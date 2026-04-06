import { getState } from '../common/state.mjs';
import { resolveLearningCourseContentType } from '../common/learning-course-content-type.mjs';
import { sortRowsByEffectiveTimeDesc } from '../common/effective-time-sort.mjs';
import { canDeliverTemplateToActor } from '../common/template-visibility.mjs';
import { resolveSharedLearningCourseByShare } from '../services/share.service.mjs';
import {
  DEFAULT_COURSE_SOURCE_TYPE,
  VIDEO_CHANNEL_SOURCE_TYPE,
  resolveCourseSourceType,
  resolveCourseVideoChannelMeta,
  stripVideoChannelMetaFromMedia,
} from '../common/video-channel-course.mjs';

function mediaToUrl(mediaItem) {
  if (!mediaItem) return '';
  if (typeof mediaItem === 'string') return mediaItem;
  return String(mediaItem.preview || mediaItem.url || mediaItem.path || mediaItem.name || '');
}

function isImageUrl(raw) {
  const text = String(raw || '').trim().toLowerCase();
  if (!text) return false;
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(text);
}

function isVideoUrl(raw) {
  const text = String(raw || '').trim().toLowerCase();
  if (!text) return false;
  return /\.(mp4|mov|m4v|webm)(\?.*)?$/i.test(text);
}

function extractMediaUrl(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';
  if (/^https?:\/\//i.test(text) || /^\/uploads\//i.test(text)) return text;
  if (text.startsWith('[') || text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text);
      const first = Array.isArray(parsed) ? parsed[0] : parsed;
      if (typeof first === 'string') return first;
      if (first && typeof first === 'object') return String(first.preview || first.url || first.path || first.name || '');
    } catch {
      return '';
    }
  }
  return '';
}

function toAbsoluteUrl(req, url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (!raw.startsWith('/')) return raw;
  return `${req.protocol}://${req.get('host')}${raw}`;
}

function looksLikeMediaUrl(text) {
  const raw = String(text || '').trim();
  if (!raw) return false;
  return (
    /^\/uploads\//i.test(raw) ||
    /^https?:\/\/.+\.(png|jpe?g|gif|webp|bmp|svg|mp4|mov|m4v|webm)(\?.*)?$/i.test(raw) ||
    /\.(png|jpe?g|gif|webp|bmp|svg|mp4|mov|m4v|webm)$/i.test(raw)
  );
}

function resolveActorCourseCompletion(state, actor, course) {
  const actorType = String(actor?.actorType || '').trim().toLowerCase();
  const actorId = Number(actor?.actorId || actor?.userId || actor?.id || 0);
  if (actorType !== 'customer' || actorId <= 0) return null;
  return (state.courseCompletions || []).find(
    (row) => Number(row?.userId || 0) === actorId && Number(row?.courseId || 0) === Number(course?.id || 0)
  ) || null;
}

function resolveSharedCourseFromRequest(req, courseId = 0) {
  const shareCode = String(req?.query?.shareCode || '').trim();
  const resolvedCourseId = Number(courseId || req?.query?.courseId || 0);
  if (!shareCode || !resolvedCourseId) return null;
  return resolveSharedLearningCourseByShare({ req, shareCode, courseId: resolvedCourseId });
}

function normalizeCourse(req, course = {}, options = {}) {
  const completion = options.completion || null;
  const rewardClaimed = Boolean(completion);
  const media = stripVideoChannelMetaFromMedia(Array.isArray(course.media) ? course.media : []);
  const sourceType = resolveCourseSourceType(course, DEFAULT_COURSE_SOURCE_TYPE);
  const rawVideoChannelMeta = resolveCourseVideoChannelMeta(course);
  const videoChannelMeta = rawVideoChannelMeta
    ? {
        ...rawVideoChannelMeta,
        coverUrl: toAbsoluteUrl(req, rawVideoChannelMeta.coverUrl || ''),
      }
    : null;
  const hasActivityLaunchMeta =
    sourceType === VIDEO_CHANNEL_SOURCE_TYPE
    && Boolean(String(videoChannelMeta?.finderUserName || '').trim())
    && Boolean(String(videoChannelMeta?.feedId || '').trim());
  const usesEmbeddedMiniProgram =
    sourceType === VIDEO_CHANNEL_SOURCE_TYPE
    && Boolean(String(videoChannelMeta?.feedToken || '').trim())
    && !hasActivityLaunchMeta;
  const imageMedia = media.find((m) => {
    const raw = mediaToUrl(m);
    if (typeof m === 'string') return isImageUrl(raw);
    const t = String(m?.type || '').toLowerCase();
    return isImageUrl(raw) || (t.startsWith('image/') && !isVideoUrl(raw));
  });
  const imageRaw =
    mediaToUrl(imageMedia)
    || (isImageUrl(course.coverUrl) ? extractMediaUrl(course.coverUrl) : '')
    || (isImageUrl(course.image) ? extractMediaUrl(course.image) : '');
  const image = toAbsoluteUrl(req, imageRaw || videoChannelMeta?.coverUrl || '');
  const contentType = resolveLearningCourseContentType(course);
  const type = contentType === 'video' ? 'video' : contentType === 'comic' ? 'comic' : 'article';
  const typeLabel =
    sourceType === VIDEO_CHANNEL_SOURCE_TYPE ? '视频号' : type === 'video' ? '视频' : type === 'comic' ? '图文' : '文章';
  const videoMedia = media.find((m) => {
    if (typeof m === 'string') return /\.(mp4|mov|m4v|webm)$/i.test(m);
    const t = String(m?.type || '').toLowerCase();
    const n = String(m?.name || m?.url || m?.preview || '').toLowerCase();
    return t.startsWith('video/') || /\.(mp4|mov|m4v|webm)$/i.test(n);
  });
  const videoRaw =
    mediaToUrl(videoMedia)
    || (isVideoUrl(course.coverUrl) ? extractMediaUrl(course.coverUrl) : '')
    || (isVideoUrl(course.image) ? extractMediaUrl(course.image) : '');
  return {
    ...course,
    desc:
      String(course.desc || course.description || '').trim() ||
      (looksLikeMediaUrl(course.content) ? '' : String(course.content || '').slice(0, 56)),
    type,
    typeLabel,
    sourceType,
    videoChannelMeta,
    progress: rewardClaimed ? 100 : Number(course.progress || 0),
    timeLeft: String(
      rewardClaimed
        ? '已完成'
        : course.timeLeft || (
          sourceType === VIDEO_CHANNEL_SOURCE_TYPE
            ? (usesEmbeddedMiniProgram ? '小程序内观看' : '微信内观看')
            : type === 'video'
              ? '约 10 分钟'
              : '约 5 分钟'
        )
    ),
    action: String(
      rewardClaimed
        ? '积分已领取'
        : course.action || (
          sourceType === VIDEO_CHANNEL_SOURCE_TYPE
            ? (usesEmbeddedMiniProgram ? '进入小程序观看' : '去视频号观看')
            : '开始学习'
        )
    ),
    color: String(course.color || 'bg-blue-500/90'),
    btnColor: String(
      course.btnColor || (sourceType === VIDEO_CHANNEL_SOURCE_TYPE ? 'bg-emerald-500 text-white' : 'bg-blue-500 text-white')
    ),
    coverUrl: image || '',
    image: image || '',
    media: media.map((m) => {
      if (typeof m === 'string') return toAbsoluteUrl(req, m);
      if (!m || typeof m !== 'object') return m;
      return {
        ...m,
        preview: toAbsoluteUrl(req, m.preview || ''),
        url: toAbsoluteUrl(req, m.url || ''),
        path: toAbsoluteUrl(req, m.path || ''),
      };
    }),
    videoUrl: sourceType === VIDEO_CHANNEL_SOURCE_TYPE ? '' : toAbsoluteUrl(req, videoRaw),
    points: Number(course.points || 0),
    content: String(course.content || ''),
  };
}

export const listLearningCourses = ({ actor, req }) => {
  const state = getState();
  const visibleCourseMap = new Map(
    (state.learningCourses || [])
    .filter((course) => canDeliverTemplateToActor(state, actor, course))
    .map((course) => ({
      ...normalizeCourse(req, course, {
        completion: resolveActorCourseCompletion(state, actor, course),
      }),
      status: String(course.status || 'published'),
      isPlatformTemplate: Boolean(
        course.platformTemplate || Number(course.sourceTemplateId || 0) > 0 || String(course.creatorRole || '') === 'platform_admin'
      ),
      templateTag:
        course.platformTemplate || Number(course.sourceTemplateId || 0) > 0 || String(course.creatorRole || '') === 'platform_admin'
          ? '平台模板'
          : '',
    }))
    .map((course) => [Number(course.id || 0), course])
  );

  const sharedCourse = resolveSharedCourseFromRequest(req);
  if (sharedCourse) {
    visibleCourseMap.set(Number(sharedCourse.id || 0), {
      ...normalizeCourse(req, sharedCourse, {
        completion: resolveActorCourseCompletion(state, actor, sharedCourse),
      }),
      status: String(sharedCourse.status || 'published'),
      isPlatformTemplate: Boolean(
        sharedCourse.platformTemplate
        || Number(sharedCourse.sourceTemplateId || 0) > 0
        || String(sharedCourse.creatorRole || '') === 'platform_admin'
      ),
      templateTag:
        sharedCourse.platformTemplate
        || Number(sharedCourse.sourceTemplateId || 0) > 0
        || String(sharedCourse.creatorRole || '') === 'platform_admin'
          ? '平台模板'
          : '',
    });
  }

  const visibleCourses = Array.from(visibleCourseMap.values());
  const categories = new Set(['全部', ...visibleCourses.map((c) => c.category)]);
  return {
    categories: [...categories],
    courses: sortRowsByEffectiveTimeDesc(visibleCourses),
  };
};

export const getLearningCourseById = ({ courseId, actor, req }) => {
  const state = getState();
  const source = state.learningCourses.find(
    (c) => Number(c.id) === Number(courseId) && canDeliverTemplateToActor(state, actor, c)
  ) || resolveSharedCourseFromRequest(req, courseId);
  if (!source) throw new Error('COURSE_NOT_FOUND');
  return {
    course: normalizeCourse(req, source, {
      completion: resolveActorCourseCompletion(state, actor, source),
    }),
  };
};

export const listLearningGames = () => {
  const state = getState();
  return { games: [...(state.learningGames || [])].sort((a, b) => Number(a.id || 0) - Number(b.id || 0)) };
};

export const listLearningTools = () => {
  const state = getState();
  return { tools: [...(state.learningTools || [])].sort((a, b) => Number(a.id || 0) - Number(b.id || 0)) };
};
