import type { BPagePermissionResponse } from './api';

export const B_NAV_ORDER = ['home', 'customers', 'tools', 'analytics', 'profile'] as const;

export type BNavTabId = (typeof B_NAV_ORDER)[number];

export type BPermissionAccess = {
  allowedViews: Set<string>;
  learning: boolean;
  activity: boolean;
  shop: boolean;
  stats: boolean;
  tags: boolean;
  tools: boolean;
  analytics: boolean;
};

export function buildBPermissionAccess(pagePermissions: BPagePermissionResponse | null): BPermissionAccess {
  const allowedViews = new Set((pagePermissions?.allowedViews || []).map((item) => String(item || '')));
  const learning = allowedViews.has('learning');
  const activity = allowedViews.has('activity');
  const shop = allowedViews.has('shop');
  const stats = allowedViews.has('stats');
  const tags = allowedViews.has('tag-list') || allowedViews.has('tags');
  return {
    allowedViews,
    learning,
    activity,
    shop,
    stats,
    tags,
    tools: learning || activity || shop,
    analytics: stats,
  };
}

export function canAccessBNavTab(tabId: BNavTabId, access: BPermissionAccess) {
  if (tabId === 'tools') return access.tools;
  if (tabId === 'analytics') return access.analytics;
  return true;
}

export function getVisibleBNavIds(access: BPermissionAccess) {
  void access;
  return [...B_NAV_ORDER];
}
