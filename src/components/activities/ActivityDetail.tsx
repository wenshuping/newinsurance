import React from 'react';
import { ChevronLeft, Share2, Star, HelpCircle, Gift, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { visibleStatusClass, visibleStatusLabel } from '../../lib/templateStatus';
import { NOTICE_COPY } from '../../lib/noticeCopy';
import { ACTION_COPY } from '../../lib/uiCopy';

interface Props {
  activity: any;
  onClose: () => void;
  requireAuth: (action: () => void) => void;
}

export default function ActivityDetail({ activity, onClose, requireAuth }: Props) {
  const statusText = visibleStatusLabel(activity?.status || 'active');
  const statusClass = visibleStatusClass(activity?.status || 'active');
  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-50 bg-slate-50 flex flex-col"
    >
      {/* Top Navigation Bar */}
      <div className="fixed top-0 left-0 right-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="flex items-center h-14 px-4">
          <button onClick={onClose} className="flex items-center justify-center w-10 h-10 -ml-2 text-slate-700 active:bg-slate-100 rounded-full transition-colors">
            <ChevronLeft size={24} />
          </button>
          <h2 className="flex-1 text-center text-lg font-bold tracking-tight">{ACTION_COPY.cActivityDetailTitle}</h2>
          <button className="w-10 h-10 -mr-2 flex items-center justify-center text-slate-700 active:bg-slate-100 rounded-full transition-colors">
            <Share2 size={24} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pt-14 pb-24">
        {/* Hero Section */}
        <div className="p-4">
          <div className="aspect-video w-full rounded-2xl overflow-hidden bg-slate-200 relative">
            <img 
              src={activity.image || "https://picsum.photos/seed/family/800/450"} 
              alt={activity.title} 
              className="absolute inset-0 w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
            <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
              <span className={`${statusClass} text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider`}>{statusText}</span>
            </div>
          </div>
        </div>

        {/* Activity Header */}
        <section className="px-4 py-2">
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600">
              {ACTION_COPY.cActivityTagHot}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600">
              {ACTION_COPY.cActivityTagKnowledge}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-600">
              {ACTION_COPY.cActivityTagReward}
            </span>
          </div>
          <h1 className="text-2xl font-bold leading-tight mb-4">{activity.title}</h1>
          
          {/* Points Requirement Card */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
                <Star size={20} className="fill-current" />
              </div>
              <div>
                <p className="text-xs text-slate-500">{ACTION_COPY.cActivityRequiredPoints}</p>
                <p className="text-lg font-bold text-blue-500">50 <span className="text-sm font-medium">{ACTION_COPY.cExchangePointSuffix.trim()}</span></p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">{ACTION_COPY.cActivitySeatsLeft}</p>
              <p className="text-sm font-bold text-slate-900">128{ACTION_COPY.cActivitySeatsUnit}</p>
            </div>
          </div>
        </section>

        <div className="h-2 bg-slate-100 my-4"></div>

        {/* Activity Description */}
        <section className="px-4 py-2 space-y-6">
          <div>
            <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
              <span className="w-1.5 h-5 bg-blue-500 rounded-full"></span>
              {ACTION_COPY.cActivityIntroTitle}
            </h3>
            <div className="text-slate-600 leading-relaxed space-y-4 text-sm">
              <p>
                {ACTION_COPY.cActivityIntroParagraph1Prefix}{activity.title}{ACTION_COPY.cActivityIntroParagraph1Suffix}
              </p>
              <p>
                {ACTION_COPY.cActivityIntroParagraph2}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 shrink-0">
                <HelpCircle size={18} />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 mb-1">{ACTION_COPY.cActivityQuizTitle}</h4>
                <p className="text-xs text-slate-500 leading-relaxed">{ACTION_COPY.cActivityQuizDesc}</p>
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center text-orange-500 shrink-0">
                <Gift size={18} />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 mb-1">{ACTION_COPY.cActivityRewardTitle}</h4>
                <p className="text-xs text-slate-500 leading-relaxed">{ACTION_COPY.cActivityRewardDesc}</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
              <span className="w-1.5 h-5 bg-blue-500 rounded-full"></span>
              {ACTION_COPY.cActivityRulesTitle}
            </h3>
            <ul className="space-y-3 text-sm text-slate-600">
              <li className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0 mt-0.5">1</span>
                <span className="leading-relaxed">{ACTION_COPY.cActivityRule1}</span>
              </li>
              <li className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0 mt-0.5">2</span>
                <span className="leading-relaxed">{ACTION_COPY.cActivityRule2}</span>
              </li>
              <li className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0 mt-0.5">3</span>
                <span className="leading-relaxed">{ACTION_COPY.cActivityRule3}</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Footer Decoration */}
        <div className="px-4 py-8 text-center opacity-40">
          <p className="text-xs font-medium tracking-widest">{ACTION_COPY.cActivityFooterSlogan}</p>
        </div>
      </main>

      {/* Fixed Bottom Action Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 p-4 pb-safe shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
        <div className="flex gap-4 items-center">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 font-medium">{ACTION_COPY.cActivityTotal}</span>
            <span className="text-xl font-bold text-blue-500">50 <span className="text-[10px]">{ACTION_COPY.cExchangePointSuffix.trim()}</span></span>
          </div>
          <button 
            onClick={() => requireAuth(() => {
              alert(NOTICE_COPY.cJoinDeductSuccess);
              onClose();
            })}
            className="flex-1 bg-blue-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          >
            <span>{ACTION_COPY.cActivityApplyNow}</span>
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
