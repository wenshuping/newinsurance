import React, { useEffect, useRef, useState } from 'react';
import { Share2 } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import Home from './pages/Home';
import Learning from './pages/Learning';
import InsuranceManagement from './pages/InsuranceManagement';
import Activities from './pages/Activities';
import Profile from './pages/Profile';
import ShareLanding from './pages/ShareLanding';
import BottomNav from './components/BottomNav';
import FloatingAdvisorButton from './components/FloatingAdvisorButton';
import MarketingPopup from './components/MarketingPopup';
import RealNameAuthModal from './components/RealNameAuthModal';
import PointsMall from './components/mall/PointsMall';
import AdvisorDetail from './components/advisor/AdvisorDetail';
import { api, clearToken, getCsrfToken, getTenantId, getToken, onAuthInvalid, setCsrfToken, setToken, type AdvisorProfile, type User, type WechatIdentity } from './lib/api';
import { DEFAULT_ADVISOR_AVATAR, resolveAdvisorAvatarUrl } from './lib/advisor-avatar';
import { buildActivitiesPath, buildLearningPath, buildMallPath, buildTabPath, parseAppRoute } from './lib/appRoute';
import { flushDeferredLearningRewards, listDeferredLearningRewards } from './lib/deferred-learning-rewards';
import { resolveProtectedActionSessionMode } from './lib/protected-action-session';
import { buildSessionScopedStorageKey } from './lib/session-cache';
import { clearCachedSignedToday, readCachedSignedToday, resolveInitialSignPopupState, shouldAutoOpenSignInPopup, writeCachedSignedToday } from './lib/sign-in-popup-state';
import { trackCEvent } from './lib/track';
import { showApiError } from './lib/ui-error';

const USER_CACHE_KEY = 'insurance_user_cache';
const BALANCE_CACHE_KEY = 'insurance_balance_cache';
const WECHAT_IDENTITY_CACHE_KEY = 'insurance_wechat_identity_cache';

function isWechatBrowser() {
  if (typeof navigator === 'undefined') return false;
  return /micromessenger/i.test(String(navigator.userAgent || ''));
}

function resolveScopedStorageKey(baseKey: string, sessionToken?: string | null) {
  return buildSessionScopedStorageKey(baseKey, sessionToken);
}

function clearScopedStorage(baseKey: string, sessionToken?: string | null) {
  localStorage.removeItem(baseKey);
  localStorage.removeItem(resolveScopedStorageKey(baseKey, sessionToken));
}

function readCachedUser(): User | null {
  const token = getToken();
  if (!token) return null;
  try {
    const raw = localStorage.getItem(resolveScopedStorageKey(USER_CACHE_KEY, token));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as User;
    if (!parsed || typeof parsed.id !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

function clearCachedUser(sessionToken?: string | null) {
  clearScopedStorage(USER_CACHE_KEY, sessionToken);
}

function writeCachedUser(user: User, sessionToken = getToken()) {
  if (!sessionToken) {
    clearCachedUser();
    return;
  }
  localStorage.removeItem(USER_CACHE_KEY);
  localStorage.setItem(resolveScopedStorageKey(USER_CACHE_KEY, sessionToken), JSON.stringify(user));
}

function readCachedBalance(): number {
  const token = getToken();
  if (!token) return 0;
  const raw = localStorage.getItem(resolveScopedStorageKey(BALANCE_CACHE_KEY, token));
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clearCachedBalance(sessionToken?: string | null) {
  clearScopedStorage(BALANCE_CACHE_KEY, sessionToken);
}

function writeCachedBalance(balance: number, sessionToken = getToken()) {
  if (!sessionToken) {
    clearCachedBalance();
    return;
  }
  localStorage.removeItem(BALANCE_CACHE_KEY);
  localStorage.setItem(resolveScopedStorageKey(BALANCE_CACHE_KEY, sessionToken), String(balance));
}

function readCachedWechatIdentity(): WechatIdentity | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(WECHAT_IDENTITY_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WechatIdentity;
    if (!parsed?.appType) return null;
    if (!parsed.openId && !parsed.unionId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCachedWechatIdentity(identity: WechatIdentity | null) {
  if (typeof window === 'undefined') return;
  if (!identity || (!identity.openId && !identity.unionId)) {
    localStorage.removeItem(WECHAT_IDENTITY_CACHE_KEY);
    return;
  }
  localStorage.setItem(WECHAT_IDENTITY_CACHE_KEY, JSON.stringify(identity));
}

function readWechatOauthCode() {
  if (typeof window === 'undefined') return '';
  const search = new URLSearchParams(window.location.search || '');
  return String(search.get('code') || '').trim();
}

function stripWechatOauthParamsFromUrl() {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.delete('code');
  url.searchParams.delete('state');
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, '', next);
}

function currentPath() {
  return `${window.location.pathname}${window.location.search}`;
}

function resolveActiveShareCode(routeShareCode: string | null) {
  if (routeShareCode) return routeShareCode;
  if (typeof window === 'undefined') return '';
  const search = new URLSearchParams(window.location.search || '');
  const fromShare = String(search.get('fromShare') || '').trim();
  const shareCode = String(search.get('shareCode') || '').trim();
  if (!shareCode) return '';
  if (fromShare === '1') return shareCode;
  return '';
}

function resolveCustomerShareTarget(route: ReturnType<typeof parseAppRoute>) {
  if (route.openMall) {
    if (route.mallItemId) {
      return { shareType: 'mall_item' as const, targetId: route.mallItemId, label: '积分商品' };
    }
    if (route.mallActivityId) {
      return { shareType: 'mall_activity' as const, targetId: route.mallActivityId, label: '商城活动' };
    }
    return { shareType: 'mall_home' as const, targetId: null, label: '积分商城' };
  }
  if (route.tab === 'activities' && route.activityId) {
    return { shareType: 'activity' as const, targetId: route.activityId, label: '活动' };
  }
  if (route.tab === 'learning' && route.courseId) {
    return { shareType: 'learning_course' as const, targetId: route.courseId, label: '课程' };
  }
  return null;
}

async function copyTextWithFallback(text: string) {
  const content = String(text || '').trim();
  if (!content || typeof document === 'undefined') return false;

  const textarea = document.createElement('textarea');
  textarea.value = content;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '-9999px';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  try {
    if (document.execCommand('copy')) {
      return true;
    }
  } catch {
    // Fall through to navigator clipboard.
  } finally {
    document.body.removeChild(textarea);
  }

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(content);
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

export default function App() {
  const initialCachedUser = readCachedUser();
  const initialSignPopupState = resolveInitialSignPopupState(getToken(), initialCachedUser);
  const [route, setRoute] = useState(() => parseAppRoute(window.location));
  const [showMarketingPopup, setShowMarketingPopup] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [hasSignedToday, setHasSignedToday] = useState(() => initialSignPopupState.hasSignedToday);
  const [signStatusReady, setSignStatusReady] = useState(() => initialSignPopupState.signStatusReady);
  const [shareSheet, setShareSheet] = useState<null | {
    shareTitle: string;
    shareUrl: string;
    targetTitle: string;
    label: string;
    shareType: string;
  }>(null);
  const [user, setUser] = useState<User | null>(() => initialCachedUser);
  const [advisorProfile, setAdvisorProfile] = useState<AdvisorProfile | null>(null);
  const [shareAuthRestoring, setShareAuthRestoring] = useState(false);
  const [wechatIdentity, setWechatIdentity] = useState<WechatIdentity | null>(() => readCachedWechatIdentity());
  const [wechatAuthProcessing, setWechatAuthProcessing] = useState(false);
  const [pointsBalance, setPointsBalance] = useState(() => readCachedBalance());
  const [pendingAction, setPendingAction] = useState<((nextUser?: User) => void) | null>(null);
  const lastNonOverlayPathRef = useRef<string>(buildTabPath('home'));
  const processedWechatCodeRef = useRef('');
  const deferredLearningFlushRef = useRef<Promise<void> | null>(null);
  const currentTab = route.tab;
  const isSharePage = Boolean(route.shareCode);
  const showFloatingAdvisorButton = !isSharePage && currentTab !== 'advisor';
  const formalShareTarget = resolveCustomerShareTarget(route);

  const applyBalance = (balance: number, options: { sessionToken?: string | null; clear?: boolean } = {}) => {
    setPointsBalance(balance);
    if (options.clear) {
      clearCachedBalance(options.sessionToken);
      return;
    }
    writeCachedBalance(balance, options.sessionToken);
  };

  const flushDeferredLearningRewardsIfNeeded = async (
    verifiedUser?: User | null,
    options: { baseBalance?: number } = {},
  ) => {
    if (deferredLearningFlushRef.current) {
      await deferredLearningFlushRef.current;
      return;
    }
    const effectiveUser = verifiedUser || user;
    if (!getToken() || !effectiveUser?.is_verified_basic) return;
    if (!listDeferredLearningRewards().length) return;
    deferredLearningFlushRef.current = (async () => {
      try {
        const summary = await flushDeferredLearningRewards();
        const settledBalance = Number(summary.balance);
        const baseBalance = Number(options.baseBalance);
        const fallbackBalance =
          Number.isFinite(baseBalance) && Number(summary.totalAwarded || 0) > 0
            ? baseBalance + Number(summary.totalAwarded || 0)
            : NaN;
        if (Number.isFinite(settledBalance)) {
          const nextBalance = Number.isFinite(fallbackBalance)
            ? Math.max(settledBalance, fallbackBalance)
            : settledBalance;
          applyBalance(nextBalance);
        } else if (Number.isFinite(fallbackBalance)) {
          applyBalance(fallbackBalance);
        }
        if (Number(summary.totalAwarded || 0) > 0) {
          alert(`实名成功，已补发 ${Number(summary.totalAwarded || 0)} 积分`);
        }
      } catch {
        // Keep deferred rewards queued for a later retry.
      } finally {
        deferredLearningFlushRef.current = null;
      }
    })();
    await deferredLearningFlushRef.current;
  };

  useEffect(() => {
    writeCachedWechatIdentity(wechatIdentity);
  }, [wechatIdentity]);

  useEffect(() => {
    const identityFromUser =
      user?.wechat_open_id || user?.wechat_union_id
        ? {
            openId: String(user?.wechat_open_id || '').trim() || undefined,
            unionId: String(user?.wechat_union_id || '').trim() || undefined,
            appType: (String(user?.wechat_app_type || 'h5').trim() || 'h5') as WechatIdentity['appType'],
          }
        : null;
    if (!identityFromUser) return;
    setWechatIdentity(identityFromUser);
  }, [user?.wechat_open_id, user?.wechat_union_id, user?.wechat_app_type]);

  const navigate = (path: string, options: { replace?: boolean } = {}) => {
    const method = options.replace ? 'replaceState' : 'pushState';
    window.history[method]({}, '', path);
    setRoute(parseAppRoute(window.location));
  };

  const syncMe = () => {
    const sessionToken = getToken();
    if (!sessionToken) {
      setUser(null);
      applyBalance(0, { clear: true });
      clearCachedUser();
      return;
    }
    api
      .me()
      .then((res) => {
        if (getToken() !== sessionToken) return;
        setUser(res.user);
        applyBalance(res.balance, { sessionToken });
        writeCachedUser(res.user, sessionToken);
      })
      .catch((e: any) => {
        if (getToken() !== sessionToken) return;
        if (e?.code === 'UNAUTHORIZED') {
          clearToken();
          setUser(null);
          applyBalance(0, { sessionToken, clear: true });
          clearCachedUser(sessionToken);
          clearCachedSignedToday(sessionToken);
        }
      });
  };

  useEffect(() => {
    const onPopState = () => setRoute(parseAppRoute(window.location));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (!route.openMall && !route.shareCode) {
      lastNonOverlayPathRef.current = currentPath();
    }
  }, [route]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.querySelectorAll<HTMLElement>('.overflow-y-auto').forEach((node) => {
        node.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [currentTab, route.openMall, route.courseId, route.activityId, route.mallItemId, route.mallActivityId]);

  useEffect(() => {
    if (
      !shouldAutoOpenSignInPopup({
        isSharePage,
        openMall: route.openMall,
        currentTab,
        showAuthModal,
        signStatusReady,
        hasSignedToday,
        isVerifiedBasic: Boolean(user?.is_verified_basic),
      })
    ) {
      if (user?.is_verified_basic) setShowMarketingPopup(false);
      return;
    }
    const timer = setTimeout(() => {
      setShowMarketingPopup(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, [currentTab, showAuthModal, isSharePage, route.openMall, signStatusReady, hasSignedToday, user?.is_verified_basic]);

  useEffect(() => {
    if (!isSharePage) {
      trackCEvent('c_page_view', {
        tab: currentTab,
        authed: Boolean(user?.is_verified_basic),
        learningTab: currentTab === 'learning' ? route.learningTab : undefined,
        courseId: currentTab === 'learning' ? route.courseId : undefined,
      });
    }
  }, [currentTab, isSharePage, route.courseId, route.learningTab, user?.is_verified_basic]);

  useEffect(() => {
    return onAuthInvalid(() => {
      const sessionToken = getToken();
      clearToken();
      setUser(null);
      setAdvisorProfile(null);
      applyBalance(0, { sessionToken, clear: true });
      clearCachedUser(sessionToken);
      clearCachedSignedToday(sessionToken);
    });
  }, []);

  useEffect(() => {
    if (isSharePage) return;
    syncMe();

    const timer = window.setInterval(() => {
      syncMe();
    }, 15000);
    const onFocus = () => syncMe();
    window.addEventListener('focus', onFocus);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [isSharePage]);

  useEffect(() => {
    let mounted = true;
    if (!user?.is_verified_basic) {
      setAdvisorProfile(null);
      return () => {
        mounted = false;
      };
    }

    api
      .advisorProfile()
      .then((res) => {
        if (!mounted) return;
        setAdvisorProfile(res.advisor || null);
      })
      .catch(() => {
        if (!mounted) return;
        setAdvisorProfile(null);
      });

    return () => {
      mounted = false;
    };
  }, [user?.id, user?.is_verified_basic]);

  useEffect(() => {
    if (!user?.is_verified_basic) return;
    void flushDeferredLearningRewardsIfNeeded();
  }, [user?.id, user?.is_verified_basic]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isWechatBrowser()) {
      setWechatAuthProcessing(false);
      return;
    }

    const oauthCode = readWechatOauthCode();
    const hasToken = Boolean(getToken());
    const userHasWechatIdentity = Boolean(user?.wechat_open_id || user?.wechat_union_id);
    const shouldAutoLoginByWechat = !hasToken && !user?.is_verified_basic;
    const shouldBindWechatIdentity = Boolean(user?.is_verified_basic && !userHasWechatIdentity);

    if (!oauthCode) {
      if (!shouldAutoLoginByWechat && !shouldBindWechatIdentity) {
        setWechatAuthProcessing(false);
        return;
      }

      if (shouldAutoLoginByWechat && wechatIdentity && (wechatIdentity.openId || wechatIdentity.unionId)) {
        let cancelled = false;
        setWechatAuthProcessing(true);
        api
          .wechatH5ResolveSession({ identity: wechatIdentity })
          .then((resp) => {
            if (cancelled) return;
            if (resp.token && resp.user?.is_verified_basic) {
              setToken(resp.token);
              setCsrfToken(resp.csrfToken || '');
              setUser(resp.user);
              writeCachedUser(resp.user, resp.token);
            }
          })
          .catch(() => undefined)
          .finally(() => {
            if (!cancelled) setWechatAuthProcessing(false);
          });
        return () => {
          cancelled = true;
        };
      }

      let cancelled = false;
      setWechatAuthProcessing(true);
      api
        .wechatH5OauthUrl(window.location.href)
        .then((resp) => {
          if (cancelled) return;
          if (!resp.enabled || !resp.authorizeUrl) {
            setWechatAuthProcessing(false);
            return;
          }
          window.location.replace(resp.authorizeUrl);
        })
        .catch(() => {
          if (!cancelled) setWechatAuthProcessing(false);
        });
      return () => {
        cancelled = true;
      };
    }

    if (processedWechatCodeRef.current === oauthCode) return;
    processedWechatCodeRef.current = oauthCode;
    let cancelled = false;
    setWechatAuthProcessing(true);
    api
      .wechatH5ResolveSession({ code: oauthCode })
      .then(async (resp) => {
        if (cancelled) return;
        const identity: WechatIdentity = {
          openId: String(resp.identity?.openId || '').trim() || undefined,
          unionId: String(resp.identity?.unionId || '').trim() || undefined,
          appType: 'h5',
        };
        if (identity.openId || identity.unionId) {
          setWechatIdentity(identity);
        }

        if (resp.token && resp.user?.is_verified_basic) {
          setToken(resp.token);
          setCsrfToken(resp.csrfToken || '');
          setUser(resp.user);
          writeCachedUser(resp.user, resp.token);
          return;
        }

        if (user?.is_verified_basic && (identity.openId || identity.unionId) && !userHasWechatIdentity) {
          await api.bindWechatIdentity(identity).catch(() => undefined);
          syncMe();
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          stripWechatOauthParamsFromUrl();
          setWechatAuthProcessing(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.is_verified_basic, user?.wechat_open_id, user?.wechat_union_id, wechatIdentity]);

  useEffect(() => {
    if (!isSharePage) {
      setShareAuthRestoring(false);
      return;
    }
    if (!getToken()) {
      setShareAuthRestoring(false);
      return;
    }

    let cancelled = false;
    setShareAuthRestoring(true);
    const sessionToken = getToken();
    api
      .me()
      .then((res) => {
        if (cancelled) return;
        if (getToken() !== sessionToken) return;
        setUser(res.user);
        applyBalance(res.balance, { sessionToken });
        writeCachedUser(res.user, sessionToken);
      })
      .catch((e: any) => {
        if (cancelled) return;
        if (getToken() !== sessionToken) return;
        if (e?.code === 'UNAUTHORIZED') {
          clearToken();
          setUser(null);
          applyBalance(0, { sessionToken, clear: true });
          clearCachedUser(sessionToken);
          clearCachedSignedToday(sessionToken);
        }
      })
      .finally(() => {
        if (!cancelled) setShareAuthRestoring(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isSharePage]);

  useEffect(() => {
    if (isSharePage) return;
    const sessionToken = getToken();
    const cachedSignedToday = readCachedSignedToday(sessionToken);

    if (!sessionToken) {
      setHasSignedToday(false);
      setSignStatusReady(true);
      return;
    }

    if (!user) {
      setHasSignedToday(cachedSignedToday);
      setSignStatusReady(cachedSignedToday);
      if (cachedSignedToday) setShowMarketingPopup(false);
      return;
    }

    if (!user.is_verified_basic) {
      setHasSignedToday(false);
      setSignStatusReady(true);
      clearCachedSignedToday(sessionToken);
      return;
    }

    if (cachedSignedToday) {
      setHasSignedToday(true);
      setSignStatusReady(true);
      setShowMarketingPopup(false);
      return;
    }

    let cancelled = false;
    setSignStatusReady(false);
    api
      .activities()
      .then((res) => {
        if (cancelled) return;
        const signed = (res.activities || []).some(
          (item) => String(item.category || '').toLowerCase() === 'sign' && Boolean(item.completed)
        );
        setHasSignedToday(signed);
        if (signed) {
          writeCachedSignedToday(sessionToken);
        } else {
          clearCachedSignedToday(sessionToken);
        }
        setSignStatusReady(true);
        if (signed) setShowMarketingPopup(false);
      })
      .catch(() => {
        if (cancelled) return;
        const fallbackSigned = readCachedSignedToday(sessionToken);
        setHasSignedToday(fallbackSigned);
        setSignStatusReady(fallbackSigned);
        if (fallbackSigned) setShowMarketingPopup(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isSharePage, user?.id, user?.is_verified_basic]);

  const promptAuthForAction = (action: (nextUser?: User) => void) => {
    setShowMarketingPopup(false);
    setPendingAction(() => action);
    setShowAuthModal(true);
  };

  const requireAuth = (action: (nextUser?: User) => void) => {
    const mode = resolveProtectedActionSessionMode({
      token: getToken(),
      csrfToken: getCsrfToken(),
      user,
    });

    if (mode === 'direct') {
      action(user || undefined);
      return;
    }

    if (mode === 'restore') {
      setShowMarketingPopup(false);
      const sessionToken = getToken();
      if (!sessionToken) {
        promptAuthForAction(action);
        return;
      }

      setShareAuthRestoring(true);
      api
        .me()
        .then((res) => {
          const latestToken = getToken();
          if (latestToken && latestToken !== sessionToken) return;

          const nextCsrfToken = String(res.csrfToken || getCsrfToken() || '').trim();
          if (!res.user?.is_verified_basic || !nextCsrfToken) {
            promptAuthForAction(action);
            return;
          }

          setCsrfToken(nextCsrfToken);
          setUser(res.user);
          applyBalance(res.balance, { sessionToken });
          writeCachedUser(res.user, sessionToken);
          action(res.user);
        })
        .catch(() => {
          const latestToken = getToken();
          if (latestToken && latestToken !== sessionToken) return;
          promptAuthForAction(action);
        })
        .finally(() => {
          setShareAuthRestoring(false);
        });
      return;
    }

    promptAuthForAction(action);
  };

  const handleAuthSuccess = async ({
    token,
    user: nextUser,
    csrfToken,
    isNewlyVerified,
    balance,
  }: {
    token: string;
    user: User;
    csrfToken?: string;
    isNewlyVerified?: boolean;
    balance?: number;
  }) => {
    setToken(token);
    setCsrfToken(csrfToken || '');
    setUser(nextUser);
    if (Number.isFinite(Number(balance))) {
      applyBalance(Number(balance || 0));
    }
    writeCachedUser(nextUser, token);
    setShowAuthModal(false);
    trackCEvent('c_auth_verified', { userId: nextUser.id });

    const action = pendingAction;
    setPendingAction(null);
    const activeShareCode = resolveActiveShareCode(route.shareCode);
    if (activeShareCode && !isNewlyVerified) {
      await api
        .shareIdentify(activeShareCode, {
          id: nextUser.id,
          name: nextUser.name,
          mobile: nextUser.mobile,
        })
        .catch(() => undefined);
    }
    await flushDeferredLearningRewardsIfNeeded(nextUser, {
      baseBalance: Number.isFinite(Number(balance)) ? Number(balance || 0) : undefined,
    });
    if (action) action(nextUser);
  };

  const openPointsMall = (options: { itemId?: number | null; activityId?: number | null } = {}) => {
    trackCEvent('c_click_points_mall', { fromTab: currentTab });
    lastNonOverlayPathRef.current = currentPath();
    navigate(buildMallPath(options));
  };

  const openAdvisorDetail = () => {
    trackCEvent('c_click_advisor_detail', { fromTab: currentTab });
    navigate(buildTabPath('advisor'));
  };

  const handleSignIn = async () => {
    try {
      const res = await api.signIn();
      applyBalance(Number(res.balance || 0));
      setHasSignedToday(true);
      setSignStatusReady(true);
      setShowMarketingPopup(false);
      writeCachedSignedToday();
      trackCEvent('c_sign_in_success', { reward: Number(res.reward || 0), balance: Number(res.balance || 0) });
      alert(`签到成功，获得${res.reward}积分！`);
    } catch (e: any) {
      if (e?.code === 'ALREADY_SIGNED') {
        setHasSignedToday(true);
        setSignStatusReady(true);
        setShowMarketingPopup(false);
        writeCachedSignedToday();
        trackCEvent('c_sign_in_repeat', {});
        alert('今日已签到');
        return;
      }
      trackCEvent('c_sign_in_failed', { code: String(e?.code || 'UNKNOWN') });
      showApiError(e, '签到失败');
    }
  };

  const handleLogout = () => {
    const sessionToken = getToken();
    clearToken();
    setUser(null);
    setAdvisorProfile(null);
    applyBalance(0, { sessionToken, clear: true });
    clearCachedUser(sessionToken);
    clearCachedSignedToday(sessionToken);
    setShowAuthModal(false);
    navigate(buildTabPath('home'), { replace: true });
    alert('已退出登录');
  };

  const copyShareLink = async (shareUrl: string, shareType: string) => {
    try {
      const copied = await copyTextWithFallback(shareUrl);
      if (!copied) throw new Error('COPY_LINK_FAILED');
      trackCEvent('c_share_success', {
        tab: currentTab,
        method: 'clipboard',
        shareUrl,
        shareType,
      });
      alert('分享链接已复制，其他客户可打开 H5 查看并实名');
      return;
    } catch (clipboardError: any) {
      trackCEvent('c_share_manual_fallback', {
        tab: currentTab,
        shareUrl,
        shareType,
        message: String(clipboardError?.message || 'CLIPBOARD_FAILED'),
      });
      window.prompt('请复制这条分享链接发给其他客户', shareUrl);
    }
  };

  const handleShare = async () => {
    const shareTitleByTab: Record<string, string> = {
      home: '保险助手-首页',
      learning: '保险助手-知识学习',
      activities: '保险助手-活动中心',
      insurance: '保险助手-保障管理',
      profile: '保险助手-我的',
      advisor: '保险助手-专属顾问',
    };
    const title = shareTitleByTab[currentTab] || '保险助手';
    trackCEvent('c_share_click', {
      tab: currentTab,
      hasWebShare: Boolean((navigator as any).share),
      formalShareType: formalShareTarget?.shareType || '',
      formalTargetId: Number(formalShareTarget?.targetId || 0),
    });
    try {
      if (!formalShareTarget) {
        if (!user?.is_verified_basic) {
          requireAuth(() => {
            handleShare().catch(() => undefined);
          });
          return;
        }
        const share = await api.createCustomerShare({
          shareType: 'home_route',
          targetId: null,
          channel: 'customer_forward',
          sharePath: currentPath(),
        });
        setShareSheet({
          shareTitle: shareTitleByTab.home,
          shareUrl: share.shareUrl,
          targetTitle: share.targetTitle,
          label: '首页',
          shareType: 'home_route',
        });
        trackCEvent('c_share_success', {
          tab: currentTab,
          method: 'share_link_created',
          shareUrl: share.shareUrl,
          shareType: 'home_route',
        });
        return;
      }
      if (formalShareTarget && !user?.is_verified_basic) {
        requireAuth(() => {
          handleShare().catch(() => undefined);
        });
        return;
      }
      const share = await api.createCustomerShare({
        shareType: formalShareTarget.shareType,
        targetId: formalShareTarget.targetId,
        channel: 'customer_forward',
        sharePath: currentPath(),
      });
      setShareSheet({
        shareTitle: title,
        shareUrl: share.shareUrl,
        targetTitle: share.targetTitle,
        label: formalShareTarget.label,
        shareType: formalShareTarget.shareType,
      });
      trackCEvent('c_share_success', {
        tab: currentTab,
        method: 'share_link_created',
        shareUrl: share.shareUrl,
        shareType: formalShareTarget.shareType,
      });
      return;
    } catch (err: any) {
      const isAbort = String(err?.name || '') === 'AbortError';
      if (isAbort) {
        trackCEvent('c_share_cancel', { tab: currentTab });
        return;
      }
      const message = String(err?.message || err?.code || 'UNKNOWN');
      trackCEvent('c_share_failed', { tab: currentTab, message });
      alert(`分享失败：${message}`);
    }
  };

  return (
    <div className={isSharePage ? 'font-sans text-slate-900' : 'bg-slate-50 min-h-screen flex flex-col font-sans text-slate-900'}>
      {!isSharePage && (
        <button
          type="button"
          onClick={handleShare}
          className="fixed right-4 top-4 z-[10070] inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow"
          aria-label="分享当前页面"
        >
          <Share2 size={18} />
        </button>
      )}
      {route.shareCode ? (
        <ShareLanding
          shareCode={route.shareCode}
          isAuthenticated={Boolean(user?.is_verified_basic)}
          viewerUser={user}
          authLoading={shareAuthRestoring || wechatAuthProcessing}
          requireAuth={requireAuth}
          onNavigate={navigate}
        />
      ) : (
        <>
          {currentTab === 'home' && (
            <Home
              requireAuth={requireAuth}
              onOpenInsurance={() => navigate(buildTabPath('insurance'))}
              onOpenLearning={() => navigate(buildLearningPath({ tab: 'class' }))}
              onOpenMall={() => openPointsMall()}
              onOpenActivities={() => navigate(buildTabPath('activities'))}
              onOpenActivity={(activityId) => navigate(buildActivitiesPath({ activityId }))}
              onOpenCourse={(courseId) => navigate(buildLearningPath({ tab: 'class', courseId }))}
              onOpenAllCourses={() => navigate(buildLearningPath({ tab: 'class' }))}
              onSignIn={handleSignIn}
              user={user}
            />
          )}
          {currentTab === 'learning' && (
            <Learning
              requireAuth={requireAuth}
              isAuthenticated={Boolean(user?.is_verified_basic)}
              initialTab={route.learningTab}
              initialCourseId={route.courseId}
              onBalanceChange={applyBalance}
              onCourseChange={(course) => navigate(buildLearningPath({ tab: route.learningTab, courseId: course?.id || null }))}
            />
          )}
          {currentTab === 'insurance' && <InsuranceManagement />}
          {currentTab === 'activities' && (
            <Activities
              requireAuth={requireAuth}
              onOpenMall={() => openPointsMall()}
              onGoHome={() => navigate(buildTabPath('home'))}
              pointsBalance={pointsBalance}
              onBalanceChange={applyBalance}
              initialActivityId={route.activityId}
              onActivityChange={(activity) => navigate(buildActivitiesPath({ activityId: activity?.id || null }))}
            />
          )}
          {currentTab === 'profile' && (
            <Profile
              requireAuth={requireAuth}
              isAuthenticated={Boolean(user?.is_verified_basic)}
              user={user}
              pointsBalance={pointsBalance}
              onOpenMall={() => openPointsMall()}
              onGoInsurance={() => navigate(buildTabPath('insurance'))}
              onLogout={handleLogout}
            />
          )}
          {currentTab === 'advisor' && (
            <AdvisorDetail
              onClose={() => navigate(buildTabPath('home'))}
              isAuthenticated={Boolean(user?.is_verified_basic)}
              requireAuth={(action) => requireAuth(() => action())}
            />
          )}

          <BottomNav currentTab={currentTab} onChange={(next) => navigate(buildTabPath(next as any))} />

          {showMarketingPopup && !showAuthModal && currentTab === 'home' && !hasSignedToday && !user?.is_verified_basic && (
            <MarketingPopup
              onClose={() => setShowMarketingPopup(false)}
              onAction={() => {
                setShowMarketingPopup(false);
                requireAuth(handleSignIn);
              }}
            />
          )}

          <AnimatePresence>
            {route.openMall && (
              <PointsMall
                onClose={() => navigate(lastNonOverlayPathRef.current || buildTabPath('home'), { replace: true })}
                requireAuth={requireAuth}
                balance={pointsBalance}
                onBalanceChange={applyBalance}
                initialItemId={route.mallItemId}
                initialActivityId={route.mallActivityId}
                onItemChange={(itemId) => navigate(buildMallPath({ itemId, activityId: null }))}
                onActivityChange={(activityId) => navigate(buildMallPath({ activityId, itemId: null }))}
              />
            )}
          </AnimatePresence>
        </>
      )}

      {showFloatingAdvisorButton ? (
        <FloatingAdvisorButton avatarUrl={resolveAdvisorAvatarUrl(advisorProfile) || DEFAULT_ADVISOR_AVATAR} onOpen={openAdvisorDetail} />
      ) : null}

      {showAuthModal && (
        <RealNameAuthModal
          onClose={() => {
            setShowAuthModal(false);
            setPendingAction(null);
          }}
          onSuccess={handleAuthSuccess}
          wechatIdentity={wechatIdentity}
        />
      )}

      {shareSheet && (
        <div className="fixed inset-0 z-[10120] flex items-end justify-center bg-slate-950/45 px-4 pb-6 pt-12">
          <div className="w-full max-w-md rounded-[28px] bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Share H5</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-900">已生成{shareSheet.label}分享链接</h3>
                <p className="mt-1 text-sm text-slate-500">{shareSheet.targetTitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setShareSheet(null)}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500"
              >
                关闭
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-medium text-slate-500">分享链接</p>
              <p className="mt-2 break-all text-sm leading-6 text-slate-800">{shareSheet.shareUrl}</p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  window.open(shareSheet.shareUrl, '_blank', 'noopener,noreferrer');
                  trackCEvent('c_share_preview', {
                    tab: currentTab,
                    shareUrl: shareSheet.shareUrl,
                    shareType: shareSheet.shareType,
                  });
                }}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
              >
                预览 H5
              </button>
              <button
                type="button"
                onClick={() => copyShareLink(shareSheet.shareUrl, shareSheet.shareType)}
                className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm"
              >
                复制链接
              </button>
            </div>

            {Boolean((navigator as any).share) && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await (navigator as any).share({
                      title: shareSheet.shareTitle,
                      text: `把这个${shareSheet.label}分享给你，打开后可直接查看并实名参与。`,
                      url: shareSheet.shareUrl,
                    });
                    trackCEvent('c_share_success', {
                      tab: currentTab,
                      method: 'web_share',
                      shareUrl: shareSheet.shareUrl,
                      shareType: shareSheet.shareType,
                    });
                  } catch (err: any) {
                    if (String(err?.name || '') === 'AbortError') return;
                    await copyShareLink(shareSheet.shareUrl, shareSheet.shareType);
                  }
                }}
                className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700"
              >
                系统分享
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
