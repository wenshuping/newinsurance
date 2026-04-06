import React, { useState, useEffect } from 'react';
import Home from './pages/Home';
import Learning from './pages/Learning';
import InsuranceManagement from './pages/InsuranceManagement';
import Activities from './pages/Activities';
import Profile from './pages/Profile';
import BottomNav from './components/BottomNav';
import MarketingPopup from './components/MarketingPopup';
import RealNameAuthModal from './components/RealNameAuthModal';
import PointsMall from './components/mall/PointsMall';
import { AnimatePresence } from 'motion/react';
import { api, clearToken, getCachedUser, setCachedUser, setTenantId, setToken, User } from './lib/api';
import { parseAppRoute } from './lib/appRoute';
import { NOTICE_COPY } from './lib/noticeCopy';

function resolveActiveShareCode(routeShareCode: string | null) {
  if (routeShareCode) return routeShareCode;
  if (typeof window === 'undefined') return '';
  const search = new URLSearchParams(window.location.search || '');
  const shareCode = String(search.get('shareCode') || '').trim();
  const fromShare = String(search.get('fromShare') || '').trim();
  if (!shareCode || fromShare !== '1') return '';
  return shareCode;
}

export default function App() {
  const initialRoute = typeof window === 'undefined' ? { tab: 'home', shareCode: null, activityId: null } : parseAppRoute(window.location);
  const [currentTab, setCurrentTab] = useState(initialRoute.tab);
  const [activityIdFromRoute, setActivityIdFromRoute] = useState<number | null>(initialRoute.activityId);
  const [showMarketingPopup, setShowMarketingPopup] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showPointsMall, setShowPointsMall] = useState(false);
  const [user, setUser] = useState<User | null>(() => getCachedUser());
  const [pointsBalance, setPointsBalance] = useState(0);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [resolvingShare, setResolvingShare] = useState(Boolean(initialRoute.shareCode));
  const [sharedActivity, setSharedActivity] = useState<any | null>(null);

  useEffect(() => {
    if (resolvingShare) return;
    // Show marketing popup after a short delay
    const timer = setTimeout(() => {
      setShowMarketingPopup(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, [resolvingShare]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const applyRoute = (input: Location | URL) => {
      const route = parseAppRoute(input);
      setCurrentTab(route.tab);
      setActivityIdFromRoute(route.activityId);
      if (route.tab !== 'activities') setSharedActivity(null);
      return route;
    };

    const resolveSharedEntry = async (shareCode: string) => {
      setResolvingShare(true);
      try {
        const detail = await api.shareDetail(shareCode);
        setTenantId(detail.tenantId);
        setSharedActivity({
          id: Number(detail.targetId || 0) || null,
          title: String(detail.previewPayload?.title || detail.targetTitle || '活动详情'),
          image: String(detail.previewPayload?.cover || ''),
          description: String(detail.previewPayload?.subtitle || ''),
          rewardPoints: Number(detail.previewPayload?.pointsHint || 0),
          status: 'online',
          category: 'task',
          canComplete: false,
          completed: false,
        });
        await api.shareView(shareCode).catch(() => undefined);
        await api.shareClick(shareCode).catch(() => undefined);
        const targetUrl = new URL(detail.targetCPath || '/activities', window.location.origin);
        window.history.replaceState({}, '', `${targetUrl.pathname}${targetUrl.search}`);
        applyRoute(targetUrl);
      } catch {
        setSharedActivity(null);
        window.history.replaceState({}, '', '/activities');
        applyRoute(new URL('/activities', window.location.origin));
      } finally {
        setResolvingShare(false);
      }
    };

    const route = applyRoute(window.location);
    if (route.shareCode) {
      void resolveSharedEntry(route.shareCode);
    }

    const handlePopState = () => {
      const nextRoute = applyRoute(window.location);
      if (nextRoute.shareCode) {
        void resolveSharedEntry(nextRoute.shareCode);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    api.me()
      .then((res) => {
        setUser(res.user);
        setCachedUser(res.user);
        setPointsBalance(res.balance);
      })
      .catch(() => {
        clearToken();
        setUser(null);
        setCachedUser(null);
        setPointsBalance(0);
      });
  }, []);

  useEffect(() => {
    if (resolvingShare) return;
    if (!user?.is_verified_basic) return;
    const activeShareCode = resolveActiveShareCode(parseAppRoute(window.location).shareCode);
    if (!activeShareCode) return;
    void api.shareIdentify(activeShareCode, {
      id: user.id,
      name: user.name,
      mobile: user.mobile,
    }).catch(() => undefined);
  }, [resolvingShare, user?.id, user?.is_verified_basic, user?.mobile, user?.name]);

  const requireAuth = (action: () => void) => {
    if (user?.is_verified_basic) {
      action();
    } else {
      setPendingAction(() => action);
      setShowAuthModal(true);
    }
  };

  const handleAuthSuccess = async ({ token, user: nextUser }: { token: string; user: User }) => {
    setToken(token);
    setUser(nextUser);
    setCachedUser(nextUser);
    setShowAuthModal(false);
    api.pointsSummary().then((res) => setPointsBalance(res.balance)).catch(() => undefined);
    const activeShareCode = resolveActiveShareCode(parseAppRoute(window.location).shareCode);
    if (activeShareCode) {
      await api
        .shareIdentify(activeShareCode, {
          id: nextUser.id,
          name: nextUser.name,
          mobile: nextUser.mobile,
        })
        .catch(() => undefined);
    }
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  const openPointsMall = () => {
    requireAuth(() => setShowPointsMall(true));
  };

  if (resolvingShare) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6 text-slate-900">
        <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-sm border border-slate-100 text-center">
          <p className="text-sm font-semibold text-slate-500">正在打开分享活动</p>
          <h1 className="mt-2 text-xl font-bold">正在为您跳转到对应活动</h1>
          <p className="mt-3 text-sm text-slate-500">请稍候，系统会自动打开顾问分享的活动内容。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen flex flex-col font-sans text-slate-900">
      {currentTab === 'home' && <Home requireAuth={requireAuth} onOpenMall={openPointsMall} user={user} />}
      {currentTab === 'learning' && <Learning />}
      {currentTab === 'insurance' && <InsuranceManagement />}
      {currentTab === 'activities' && (
        <Activities
          requireAuth={requireAuth}
          onOpenMall={openPointsMall}
          initialActivityId={activityIdFromRoute}
          initialSharedActivity={sharedActivity}
        />
      )}
      {currentTab === 'profile' && (
        <Profile
          requireAuth={requireAuth}
          isAuthenticated={Boolean(user?.is_verified_basic)}
          user={user}
          pointsBalance={pointsBalance}
          onOpenMall={openPointsMall}
        />
      )}

      <BottomNav currentTab={currentTab} onChange={setCurrentTab} />

      {showMarketingPopup && (
        <MarketingPopup 
          onClose={() => setShowMarketingPopup(false)} 
          onAction={() => {
            setShowMarketingPopup(false);
            requireAuth(() => alert(`${NOTICE_COPY.cSignInRewardPrefix}50${NOTICE_COPY.cPointsSuffixBang}`));
          }} 
        />
      )}

      {showAuthModal && (
        <RealNameAuthModal 
          onClose={() => {
            setShowAuthModal(false);
            setPendingAction(null);
          }}
          onSuccess={handleAuthSuccess}
        />
      )}

      <AnimatePresence>
      {showPointsMall && (
          <PointsMall
            onClose={() => setShowPointsMall(false)}
            onBalanceChange={setPointsBalance}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
