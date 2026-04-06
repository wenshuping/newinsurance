import type { LearningCourse } from './api';

function mediaItemToUrl(item: any) {
  if (!item) return '';
  if (typeof item === 'string') return String(item).trim();
  return String(item.preview || item.url || item.path || item.name || '').trim();
}

export function isImageLikeUrl(value: string) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return false;
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(text);
}

export function isVideoLikeUrl(value: string) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return false;
  return /\.(mp4|mov|m4v|webm)(\?.*)?$/i.test(text);
}

export function resolveLearningCoursePreview(course: Pick<LearningCourse, 'image' | 'coverUrl' | 'videoUrl' | 'media' | 'type'>) {
  const mediaList = Array.isArray(course?.media) ? course.media : [];
  const mediaUrls = mediaList.map((item) => mediaItemToUrl(item)).filter(Boolean);
  const imageUrl =
    mediaUrls.find((url) => isImageLikeUrl(url))
    || [course?.image, course?.coverUrl].map((value) => String(value || '').trim()).find((url) => isImageLikeUrl(url))
    || '';
  const videoUrl =
    mediaUrls.find((url) => isVideoLikeUrl(url))
    || [course?.videoUrl, course?.image, course?.coverUrl].map((value) => String(value || '').trim()).find((url) => isVideoLikeUrl(url))
    || '';

  return {
    kind: imageUrl ? 'image' : videoUrl ? 'video' : 'placeholder',
    imageUrl,
    videoUrl,
  } as const;
}
