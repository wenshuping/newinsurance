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
import { api, clearToken, setToken, User } from './lib/api';

export default function App() {
  const [currentTab, setCurrentTab] = useState('home');
  const [showMarketingPopup, setShowMarketingPopup] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showPointsMall, setShowPointsMall] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [pointsBalance, setPointsBalance] = useState(0);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  useEffect(() => {
    // Show marketing popup after a short delay
    const timer = setTimeout(() => {
      setShowMarketingPopup(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    api.me()
      .then((res) => {
        setUser(res.user);
        setPointsBalance(res.balance);
      })
      .catch(() => {
        clearToken();
        setUser(null);
        setPointsBalance(0);
      });
  }, []);

  const requireAuth = (action: () => void) => {
    if (user?.is_verified_basic) {
      action();
    } else {
      setPendingAction(() => action);
      setShowAuthModal(true);
    }
  };

  const handleAuthSuccess = ({ token, user: nextUser }: { token: string; user: User }) => {
    setToken(token);
    setUser(nextUser);
    setShowAuthModal(false);
    api.pointsSummary().then((res) => setPointsBalance(res.balance)).catch(() => undefined);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  const openPointsMall = () => {
    requireAuth(() => setShowPointsMall(true));
  };

  return (
    <div className="bg-slate-50 min-h-screen flex flex-col font-sans text-slate-900">
      {currentTab === 'home' && <Home requireAuth={requireAuth} onOpenMall={openPointsMall} />}
      {currentTab === 'learning' && <Learning />}
      {currentTab === 'insurance' && <InsuranceManagement />}
      {currentTab === 'activities' && <Activities requireAuth={requireAuth} onOpenMall={openPointsMall} />}
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
            requireAuth(() => alert('签到成功，获得50积分！'));
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
