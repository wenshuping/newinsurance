export type AppTab = 'home' | 'learning' | 'insurance' | 'activities' | 'profile';

export type AppRoute = {
  tab: AppTab;
  shareCode: string | null;
  activityId: number | null;
};

function toPositiveInt(value: string | null) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function parseAppRoute(input: Location | URL): AppRoute {
  const pathname = String(input.pathname || '/');
  const search = new URLSearchParams(String(input.search || ''));

  if (pathname.startsWith('/share/')) {
    return {
      tab: 'home',
      shareCode: decodeURIComponent(pathname.replace(/^\/share\//, '').trim()) || null,
      activityId: null,
    };
  }

  if (pathname === '/activities') {
    return {
      tab: 'activities',
      shareCode: String(search.get('shareCode') || '').trim() || null,
      activityId: toPositiveInt(search.get('activityId')),
    };
  }

  if (pathname === '/learning') {
    return { tab: 'learning', shareCode: null, activityId: null };
  }

  if (pathname === '/insurance') {
    return { tab: 'insurance', shareCode: null, activityId: null };
  }

  if (pathname === '/profile') {
    return { tab: 'profile', shareCode: null, activityId: null };
  }

  return { tab: 'home', shareCode: null, activityId: null };
}
