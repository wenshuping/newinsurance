function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase();
}

export function isPublishedLikeStatus(value) {
  const s = normalizeStatus(value);
  return ['active', 'online', 'published', 'ongoing', 'on', '进行中', '已发布', '生效'].includes(s);
}

export function isDraftLikeStatus(value) {
  const s = normalizeStatus(value);
  return ['draft', '草稿', '未发布'].includes(s);
}

export function isInactiveLikeStatus(value) {
  const s = normalizeStatus(value);
  return ['inactive', 'offline', 'off', 'ended', 'expired', '失效', '已下线'].includes(s);
}

// 最终投放口径：
// 1. 只有进行中/生效/已发布模板才可继续向下一级展示。
// 2. 继承得到的“失效”模板只用于上级模板管理视图，不用于最终投放视图。
export function isVisibleTemplateStatus(value) {
  return isPublishedLikeStatus(value);
}
