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

export default function App() {
  const [currentTab, setCurrentTab] = useState('home');
  const [showMarketingPopup, setShowMarketingPopup] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showPointsMall, setShowPointsMall] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  useEffect(() => {
    // Show marketing popup after a short delay
    const timer = setTimeout(() => {
      setShowMarketingPopup(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const requireAuth = (action: () => void) => {
    if (isAuthenticated) {
      action();
    } else {
      setPendingAction(() => action);
      setShowAuthModal(true);
    }
  };

  const handleAuthSuccess = () => {
    setIsAuthenticated(true);
    setShowAuthModal(false);
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
      {currentTab === 'profile' && <Profile requireAuth={requireAuth} isAuthenticated={isAuthenticated} onOpenMall={openPointsMall} />}

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
          <PointsMall onClose={() => setShowPointsMall(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
