function normalizeContentType(value, fallback = 'article') {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'video' || normalized === 'comic' || normalized === 'article') return normalized;
  return fallback;
}

export function hasVideoMedia(media) {
  const list = Array.isArray(media) ? media : [];
  return list.some((item) => {
    if (typeof item === 'string') return /\.(mp4|mov|m4v|webm)(\?.*)?$/i.test(item);
    const type = String(item?.type || '').trim().toLowerCase();
    const candidates = [
      item?.name,
      item?.url,
      item?.preview,
      item?.path,
    ]
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean);
    return type.startsWith('video/') || candidates.some((value) => /\.(mp4|mov|m4v|webm)(\?.*)?$/i.test(value));
  });
}

export function resolveLearningCourseContentType(course = {}, fallback = 'article') {
  const explicit = normalizeContentType(course?.contentType ?? course?.type, fallback);
  if (explicit !== 'article') return explicit;
  if (hasVideoMedia(course?.media)) return 'video';
  return explicit;
}

export function resolveLearningWriteContentType({ contentType, media } = {}, fallback = 'article') {
  const explicit = normalizeContentType(contentType, fallback);
  if (explicit !== 'article') return explicit;
  if (hasVideoMedia(media)) return 'video';
  return explicit;
}
