import React, { useEffect, useState } from 'react';
import { ChevronLeft, Search, ChevronRight, Info } from 'lucide-react';
import { motion } from 'motion/react';
import { api } from '../../lib/api';
import { ERROR_COPY } from '../../lib/errorCopy';
import { NOTICE_COPY } from '../../lib/noticeCopy';
import { ACTION_COPY } from '../../lib/uiCopy';

interface Props {
  onClose: () => void;
  onBalanceChange?: (balance: number) => void;
}

export default function PointsMall({ onClose, onBalanceChange }: Props) {
  const [balance, setBalance] = useState(0);
  const [items, setItems] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [summary, mall, mallActivities] = await Promise.all([
        api.pointsSummary(),
        api.mallItems(),
        api.mallActivities(),
      ]);
      setBalance(summary.balance);
      onBalanceChange?.(summary.balance);
      setItems(mall.items);
      setActivities(Array.isArray(mallActivities.list) ? mallActivities.list : []);
    } catch (e: any) {
      setError(e?.message || ERROR_COPY.mallLoadFailed);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRedeem = async (itemId: number) => {
    try {
      const res = await api.redeem(itemId);
      setBalance(res.balance);
      onBalanceChange?.(res.balance);
      await loadData();
      alert(NOTICE_COPY.cRedeemSuccessWriteoffHint);
    } catch (e: any) {
      alert(e?.message || ERROR_COPY.redeemFailed);
    }
  };

  const handleJoinActivity = async (activityId: number) => {
    try {
      const res = await api.joinMallActivity(activityId);
      setBalance(res.balance);
      onBalanceChange?.(res.balance);
      await loadData();
      alert(res.duplicated ? NOTICE_COPY.cActivityJoinedDuplicated : `${NOTICE_COPY.cActivityJoinRewardPrefix}${res.reward}${NOTICE_COPY.cPointsSuffixBang}`);
    } catch (e: any) {
      alert(e?.message || ERROR_COPY.joinFailed);
    }
  };

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-50 bg-slate-50 flex flex-col"
    >
      <header className="bg-white sticky top-0 z-10 px-4 py-4 flex items-center justify-between border-b border-slate-100">
        <button onClick={onClose} className="p-2 -ml-2 text-slate-700 active:bg-slate-100 rounded-full transition-colors">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold">{ACTION_COPY.cMallTitle}</h1>
        <button className="p-2 -mr-2 text-slate-700 active:bg-slate-100 rounded-full transition-colors">
          <Search size={24} />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto pb-safe">
        <div className="p-4">
          <div className="bg-blue-500 rounded-2xl p-6 shadow-lg shadow-blue-500/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
            <div className="flex justify-between items-start relative z-10">
              <div>
                <p className="text-white/80 text-sm font-medium">{ACTION_COPY.cMallBalanceTitle}</p>
                <h2 className="text-white text-4xl font-bold mt-1">{balance}</h2>
              </div>
              <button className="bg-white/20 backdrop-blur-md border border-white/30 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 text-xs font-bold">
                {ACTION_COPY.cPointsDetail}
                <ChevronRight size={14} />
              </button>
            </div>
            <div className="mt-6 flex items-center gap-1.5 text-white/90 text-xs bg-black/10 w-fit px-2.5 py-1 rounded-full">
              <Info size={14} />
              <span>{ACTION_COPY.cMallRealtimeSync}</span>
            </div>
          </div>
        </div>

        <div className="px-4 mb-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-blue-500 rounded-full" />
            {ACTION_COPY.cMallProductListTitle}
          </h3>
          {loading && <p className="text-sm text-slate-500">{ACTION_COPY.cLoading}</p>}
          {error && <p className="text-sm text-rose-500">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            {items.map((item: any) => (
              <div key={item.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100">
                <div className="aspect-square w-full relative bg-slate-50">
                  <img src={String(item.image || `https://picsum.photos/seed/item${item.id}/400/400`)} alt={item.name} className="w-full h-full object-cover" />
                </div>
                <div className="p-3">
                  <h5 className="text-sm font-bold line-clamp-2 leading-tight h-10 mb-2">{item.name}</h5>
                  <p className="text-blue-500 text-base font-bold">
                    {item.pointsCost} <span className="text-[10px]">{ACTION_COPY.cExchangePointSuffix.trim()}</span>
                  </p>
                  <p className="text-slate-400 text-[10px]">{ACTION_COPY.cMallInventoryPrefix}{item.stock}</p>
                  <button
                    onClick={() => handleRedeem(item.id)}
                    className="mt-2 w-full bg-blue-500 text-white text-xs rounded-lg py-1.5 font-bold disabled:opacity-50"
                    disabled={item.stock <= 0 || balance < item.pointsCost}
                  >
                    {item.stock <= 0 ? ACTION_COPY.cSoldOut : balance < item.pointsCost ? ACTION_COPY.cPointsInsufficient : ACTION_COPY.cRedeemNow}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-4 mb-8">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-blue-500 rounded-full" />
            {ACTION_COPY.cMallActivityListTitle}
          </h3>
          {!loading && activities.length === 0 ? <p className="text-sm text-slate-500">{ACTION_COPY.cNoActivities}</p> : null}
          <div className="space-y-3">
            {activities.map((activity: any) => (
              <div key={activity.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100">
                <div className="aspect-[16/7] w-full relative bg-slate-100">
                  <img
                    src={String(activity.image || `https://picsum.photos/seed/mall-activity-${activity.id}/960/420`)}
                    alt={String(activity.title || ACTION_COPY.cMallActivityFallbackAlt)}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="p-3">
                  <p className="text-sm font-bold text-slate-900">{String(activity.title || '')}</p>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{String(activity.subtitle || '')}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-blue-500 text-sm font-bold">{ACTION_COPY.cMallRewardPrefix}{Number(activity.rewardPoints || 0)}{ACTION_COPY.cExchangePointSuffix}</p>
                    <button
                      onClick={() => handleJoinActivity(Number(activity.id))}
                      className="bg-blue-500 text-white text-xs rounded-lg px-4 py-1.5 font-bold disabled:opacity-50"
                    >
                      {ACTION_COPY.cJoinNow}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </motion.div>
  );
}
