import type { Activity, LearningCourse } from './api';
import { resolveRuntimeAssetUrl } from './runtime-asset-url';

function isImageAsset(value: unknown): boolean {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return false;
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(text);
}

function isVideoAsset(value: unknown): boolean {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return false;
  return /\.(mp4|mov|m4v|webm)(\?.*)?$/i.test(text);
}

function mediaToUrl(mediaItem: unknown): string {
  if (!mediaItem) return '';
  if (typeof mediaItem === 'string') return mediaItem;
  if (typeof mediaItem !== 'object') return '';
  const candidate = mediaItem as Record<string, unknown>;
  return String(candidate.preview || candidate.url || candidate.path || candidate.name || '');
}

function resolveMediaArrayFirstUrl(media: unknown, matcher?: (item: unknown, url: string) => boolean): string {
  if (!Array.isArray(media) || media.length === 0) return '';
  if (!matcher) return mediaToUrl(media[0]);
  for (const item of media) {
    const url = mediaToUrl(item);
    if (matcher(item, url)) return url;
  }
  return '';
}

export function resolveActivityCardImage(activity: Pick<Activity, 'media' | 'image' | 'cover'> | null | undefined): string {
  if (!activity) return '';
  return resolveRuntimeAssetUrl(
    resolveMediaArrayFirstUrl(activity.media) || String(activity.image || activity.cover || '')
  );
}

export function resolveLearningCardImage(
  item: Pick<LearningCourse, 'media' | 'image' | 'coverUrl' | 'videoChannelMeta'> | null | undefined
): string {
  if (!item) return '';
  const imageFromMedia = resolveMediaArrayFirstUrl(item.media, (mediaItem, url) => {
    if (typeof mediaItem === 'object' && mediaItem) {
      const candidate = mediaItem as Record<string, unknown>;
      const type = String(candidate.type || '').toLowerCase();
      if (type.startsWith('image/')) return true;
    }
    return isImageAsset(url);
  });
  const fallbackImage = [item.coverUrl, item.image, item.videoChannelMeta?.coverUrl].find((value) => isImageAsset(value)) || '';
  return resolveRuntimeAssetUrl(imageFromMedia || String(fallbackImage || ''));
}

export function resolveLearningCardVideoUrl(
  item: Pick<LearningCourse, 'media' | 'videoUrl'> | null | undefined
): string {
  if (!item) return '';
  const directVideo = isVideoAsset(item.videoUrl) ? String(item.videoUrl || '') : '';
  const videoFromMedia = resolveMediaArrayFirstUrl(item.media, (mediaItem, url) => {
    if (typeof mediaItem === 'object' && mediaItem) {
      const candidate = mediaItem as Record<string, unknown>;
      const type = String(candidate.type || '').toLowerCase();
      if (type.startsWith('video/')) return true;
    }
    return isVideoAsset(url);
  });
  return resolveRuntimeAssetUrl(directVideo || videoFromMedia || '');
}

export function pickHomeActivities(activities: Activity[]): Activity[] {
  const rows = Array.isArray(activities) ? activities : [];
  const isEffectiveActivity = (activity: Activity) => {
    const status = String(activity?.status || '').trim().toLowerCase();
    if (!status) return true;
    return !['draft', 'inactive', 'disabled', 'ended', 'expired', 'archived', 'deleted'].includes(status);
  };

  return rows
    .filter(isEffectiveActivity)
    .sort((a, b) => {
      const sortGap = Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
      if (sortGap !== 0) return sortGap;
      return Number(a.id || 0) - Number(b.id || 0);
    })
    .slice(0, 3);
}

export function buildAutoFlowTrackItems<T>(items: T[]): T[] {
  const rows = Array.isArray(items) ? items : [];
  return rows.length > 2 ? [...rows, ...rows] : rows;
}
