const toTrimmedString = (value) => String(value ?? '').trim();

const toUploadedActivityMediaItem = (file, fallback = {}) => {
  const preview = toTrimmedString(file?.url || file?.preview || file?.path);
  return {
    name: toTrimmedString(file?.name || fallback?.name) || 'upload',
    type: toTrimmedString(file?.type || fallback?.type) || 'application/octet-stream',
    preview,
    url: toTrimmedString(file?.url || file?.preview) || preview,
    path: toTrimmedString(file?.path),
  };
};

export async function resolvePActivityMedia({ media = [], uploadItems = [], uploadFile, limit = 6 } = {}) {
  const resolvedMedia = Array.isArray(media) ? media.slice(0, limit) : [];
  const normalizedUploads = Array.isArray(uploadItems) ? uploadItems.filter(Boolean) : [];
  if (!normalizedUploads.length) return resolvedMedia;
  if (typeof uploadFile !== 'function') throw new Error('INLINE_UPLOAD_HANDLER_REQUIRED');

  const capacity = Math.max(0, Number(limit || 0) - resolvedMedia.length);
  if (!capacity) return resolvedMedia;

  const uploadedMedia = [];
  for (const item of normalizedUploads.slice(0, capacity)) {
    const uploaded = await uploadFile({
      name: toTrimmedString(item?.name) || 'upload',
      type: toTrimmedString(item?.type) || 'application/octet-stream',
      dataUrl: toTrimmedString(item?.dataUrl),
    });
    uploadedMedia.push(toUploadedActivityMediaItem(uploaded, item));
  }

  return [...resolvedMedia, ...uploadedMedia].slice(0, limit);
}
