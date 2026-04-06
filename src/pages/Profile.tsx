import React, { useState } from 'react';
import { Settings, Camera, ShieldCheck, Edit3, Coins, ShoppingBag, ChevronRight, BookOpen, Heart, Users, FileText, Calendar, Phone } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import MyExchanges from '../components/profile/MyExchanges';
import { User } from '../lib/api';
import { ACTION_COPY } from '../lib/uiCopy';

interface Props {
  requireAuth: (action: () => void) => void;
  isAuthenticated: boolean;
  user: User | null;
  pointsBalance: number;
  onOpenMall: () => void;
}

export default function Profile({ requireAuth, isAuthenticated, user, pointsBalance, onOpenMall }: Props) {
  const [showMyExchanges, setShowMyExchanges] = useState(false);

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen pb-24">
      {/* Header Section */}
      <header className="bg-white px-6 pt-10 pb-8 rounded-b-3xl shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold tracking-tight">{ACTION_COPY.cProfileTitle}</h1>
          <button className="p-2 rounded-full bg-slate-100 text-slate-600 active:bg-slate-200 transition-colors">
            <Settings size={24} />
          </button>
        </div>
        
        <div className="flex items-center gap-5">
          <div className="relative">
            <img 
              src="https://picsum.photos/seed/avatar/200/200" 
              alt="User Profile" 
              className="w-24 h-24 rounded-full border-4 border-blue-50 object-cover shadow-md"
              referrerPolicy="no-referrer"
            />
            <button className="absolute bottom-0 right-0 bg-blue-500 p-2 rounded-full border-2 border-white shadow-sm text-white active:scale-95 transition-transform">
              <Camera size={14} />
            </button>
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-2">{user?.name || ACTION_COPY.cWechatNicknameFallback}</h2>
            {user?.mobile ? (
              <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                  <Phone size={13} />
                </div>
                <span className="font-medium tracking-wide">{user.mobile}</span>
              </div>
            ) : null}
            {!isAuthenticated ? (
              <button 
                onClick={() => requireAuth(() => {})}
                className="flex items-center gap-1 px-4 py-2 bg-rose-500 text-white rounded-xl text-sm font-bold shadow-md mb-2 active:scale-95 transition-transform"
              >
                <ShieldCheck size={18} />
                {ACTION_COPY.cGoVerify}
                <ChevronRight size={16} />
              </button>
            ) : (
              <div className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-600 rounded-lg text-xs font-bold mb-2 w-fit">
                <ShieldCheck size={14} />
                {ACTION_COPY.cVerified}
              </div>
            )}
            <button className="flex items-center gap-1 px-4 py-1.5 bg-blue-50 text-blue-600 rounded-full text-xs font-bold border border-blue-100 active:bg-blue-100 transition-colors">
              <Edit3 size={14} />
              {ACTION_COPY.cEditProfile}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        {/* Asset Section */}
        <section className="px-4 mt-6">
          <div className="bg-white p-5 rounded-2xl shadow-sm flex items-center justify-between border border-slate-100">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-orange-50 flex items-center justify-center shrink-0 text-orange-500">
                <Coins size={32} />
              </div>
              <div>
                <p className="text-slate-500 text-sm mb-0.5 font-medium">{ACTION_COPY.cMyPoints}</p>
                <p className="text-3xl font-bold text-slate-900">{pointsBalance}</p>
              </div>
            </div>
            <button 
              onClick={onOpenMall}
              className="bg-gradient-to-r from-orange-400 to-orange-500 text-white px-6 py-3 rounded-full font-bold shadow-lg shadow-orange-200 active:scale-95 transition-transform"
            >
              {ACTION_COPY.cGoRedeem}
            </button>
          </div>
        </section>

        {/* Points Exchange & Mall Section */}
        <section className="px-4 mt-6">
          <div className="bg-white rounded-2xl shadow-sm p-5 border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <h3 
                onClick={() => setShowMyExchanges(true)}
                className="text-lg font-bold flex items-center gap-2 cursor-pointer active:opacity-70"
              >
                <ShoppingBag className="text-blue-500" size={20} />
                {ACTION_COPY.cMyExchanges}
              </h3>
              <button 
                onClick={onOpenMall}
                className="text-blue-500 font-bold flex items-center text-sm active:opacity-70"
              >
                {ACTION_COPY.cMall}
                <ChevronRight size={16} />
              </button>
            </div>
            
            <div 
              onClick={() => setShowMyExchanges(true)}
              className="bg-blue-50/50 rounded-xl p-4 flex items-center gap-4 border border-blue-100/50 cursor-pointer active:scale-[0.98] transition-transform"
            >
              <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center shrink-0 border border-slate-100 overflow-hidden">
                <img src="https://picsum.photos/seed/cooker/200/200" alt="Product" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-base leading-tight mb-1">{ACTION_COPY.cDemoRedeemProductName}</h4>
                <p className="text-xs text-slate-500">{ACTION_COPY.cDemoRedeemDatePrefix}2023-10-24</p>
              </div>
              <button className="bg-gradient-to-r from-orange-400 to-orange-500 text-white px-5 py-2.5 rounded-full font-bold text-sm shadow-md shadow-orange-200 pointer-events-none">
                {ACTION_COPY.cWriteoffNow}
              </button>
            </div>
          </div>
        </section>

        {/* Functional List Section */}
        <section className="px-4 mt-6 space-y-4">
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100">
            <button className="w-full flex items-center px-5 py-4 border-b border-slate-50 active:bg-slate-50 transition-colors">
              <BookOpen className="text-blue-500 mr-4" size={24} />
              <span className="text-base font-medium flex-1 text-left">{ACTION_COPY.cStudyRecord}</span>
              <ChevronRight className="text-slate-300" size={20} />
            </button>
            
            <button className="w-full flex items-center px-5 py-4 border-b border-slate-50 active:bg-slate-50 transition-colors">
              <Heart className="text-rose-500 mr-4" size={24} />
              <span className="text-base font-medium flex-1 text-left">{ACTION_COPY.cMyFavorites}</span>
              <ChevronRight className="text-slate-300" size={20} />
            </button>
            
            <button className="w-full flex items-center px-5 py-4 border-b border-slate-50 active:bg-slate-50 transition-colors">
              <Users className="text-green-500 mr-4" size={24} />
              <div className="flex-1 text-left">
                <span className="text-base font-medium block">{ACTION_COPY.cFamilyManagement}</span>
                <span className="text-[10px] text-slate-400">{ACTION_COPY.cFamilyMembersAddedPrefix}2{ACTION_COPY.cFamilyMembersAddedSuffix}</span>
              </div>
              <ChevronRight className="text-slate-300" size={20} />
            </button>
            
            <button className="w-full flex items-center px-5 py-4 border-b border-slate-50 active:bg-slate-50 transition-colors">
              <FileText className="text-amber-500 mr-4" size={24} />
              <span className="text-base font-medium flex-1 text-left">{ACTION_COPY.cMyPolicies}</span>
              <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full mr-2">1{ACTION_COPY.cPolicyPendingPaySuffix}</span>
              <ChevronRight className="text-slate-300" size={20} />
            </button>
            
            <button className="w-full flex items-center px-5 py-4 border-b border-slate-50 active:bg-slate-50 transition-colors">
              <Calendar className="text-orange-400 mr-4" size={24} />
              <span className="text-base font-medium flex-1 text-left">{ACTION_COPY.cMyActivities}</span>
              <ChevronRight className="text-slate-300" size={20} />
            </button>

            <button className="w-full flex items-center px-5 py-4 border-b border-slate-50 active:bg-slate-50 transition-colors">
              <div className="relative mr-4 shrink-0">
                <img src="https://picsum.photos/seed/advisor/100/100" alt="Consultant" className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer" />
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></div>
              </div>
              <div className="flex-1 text-left">
                <span className="text-base font-medium block">{ACTION_COPY.cMyAdvisor}</span>
                <span className="text-[10px] text-blue-500 font-bold">{ACTION_COPY.cAdvisorOnline}</span>
              </div>
              <ChevronRight className="text-slate-300" size={20} />
            </button>
            
            <button className="w-full flex items-center px-5 py-4 active:bg-slate-50 transition-colors">
              <Settings className="text-slate-500 mr-4" size={24} />
              <span className="text-base font-medium flex-1 text-left">{ACTION_COPY.cSettings}</span>
              <ChevronRight className="text-slate-300" size={20} />
            </button>
          </div>
        </section>

        {/* Help Banner */}
        <section className="px-4 mt-6 mb-8">
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 flex items-center justify-between">
            <div>
              <h4 className="text-blue-600 font-bold text-lg mb-1">{ACTION_COPY.cNeedHelp}</h4>
              <p className="text-slate-500 text-sm">{ACTION_COPY.cServiceHotlineHint}</p>
            </div>
            <button className="w-12 h-12 bg-blue-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-blue-500/30 active:scale-90 transition-transform">
              <Phone size={24} />
            </button>
          </div>
        </section>
      </main>

      {/* My Exchanges Overlay */}
      <AnimatePresence>
        {showMyExchanges && (
          <MyExchanges onClose={() => setShowMyExchanges(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
