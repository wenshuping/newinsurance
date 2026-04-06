export type AppTab = 'home' | 'learning' | 'insurance' | 'activities' | 'profile' | 'advisor';

export type AppRoute = {
  tab: AppTab;
  shareCode: string | null;
  learningTab: 'class' | 'games' | 'tools';
  courseId: number | null;
  activityId: number | null;
  mallItemId: number | null;
  mallActivityId: number | null;
  openMall: boolean;
};

function toPositiveInt(value: string | null) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function parseAppRoute(input: Location | URL): AppRoute {
  const pathname = String(input.pathname || '/');
  const search = new URLSearchParams(String(input.search || ''));
  const route: AppRoute = {
    tab: 'home',
    shareCode: null,
    learningTab: 'class',
    courseId: toPositiveInt(search.get('courseId')),
    activityId: toPositiveInt(search.get('activityId')),
    mallItemId: toPositiveInt(search.get('itemId')),
    mallActivityId: toPositiveInt(search.get('activityId')),
    openMall: false,
  };

  if (pathname.startsWith('/share/')) {
    route.shareCode = decodeURIComponent(pathname.replace(/^\/share\//, '').trim());
    return route;
  }

  if (pathname === '/learning') {
    route.tab = 'learning';
    const tab = String(search.get('tab') || '').trim();
    if (tab === 'games' || tab === 'tools' || tab === 'class') {
      route.learningTab = tab;
    }
    return route;
  }

  if (pathname === '/activities') {
    route.tab = 'activities';
    return route;
  }

  if (pathname === '/mall') {
    route.tab = 'home';
    route.openMall = true;
    return route;
  }

  if (pathname === '/insurance') {
    route.tab = 'insurance';
    return route;
  }

  if (pathname === '/profile') {
    route.tab = 'profile';
    return route;
  }

  if (pathname === '/advisor') {
    route.tab = 'advisor';
    return route;
  }

  return route;
}

function setParam(params: URLSearchParams, key: string, value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return;
  params.set(key, String(value));
}

function copyForwardParams() {
  if (typeof window === 'undefined') return new URLSearchParams();
  const current = new URLSearchParams(window.location.search || '');
  const next = new URLSearchParams();
  const tenantId = String(current.get('tenantId') || '').trim();
  const tenantCode = String(current.get('tenantCode') || '').trim();
  const shareCode = String(current.get('shareCode') || '').trim();
  const fromShare = String(current.get('fromShare') || '').trim();
  if (tenantId) next.set('tenantId', tenantId);
  if (tenantCode) next.set('tenantCode', tenantCode);
  if (shareCode) next.set('shareCode', shareCode);
  if (fromShare) next.set('fromShare', fromShare);
  return next;
}

function withSearch(pathname: string, params: URLSearchParams) {
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function buildTabPath(tab: AppTab) {
  const params = copyForwardParams();
  if (tab === 'learning') return withSearch('/learning', params);
  if (tab === 'activities') return withSearch('/activities', params);
  if (tab === 'insurance') return withSearch('/insurance', params);
  if (tab === 'profile') return withSearch('/profile', params);
  if (tab === 'advisor') return withSearch('/advisor', params);
  return withSearch('/', params);
}

export function buildLearningPath(options: { tab?: 'class' | 'games' | 'tools'; courseId?: number | null } = {}) {
  const params = copyForwardParams();
  if (options.tab && options.tab !== 'class') params.set('tab', options.tab);
  setParam(params, 'courseId', options.courseId ?? null);
  return withSearch('/learning', params);
}

export function buildActivitiesPath(options: { activityId?: number | null } = {}) {
  const params = copyForwardParams();
  setParam(params, 'activityId', options.activityId ?? null);
  return withSearch('/activities', params);
}

export function buildMallPath(options: { itemId?: number | null; activityId?: number | null } = {}) {
  const params = copyForwardParams();
  setParam(params, 'itemId', options.itemId ?? null);
  setParam(params, 'activityId', options.activityId ?? null);
  return withSearch('/mall', params);
}
