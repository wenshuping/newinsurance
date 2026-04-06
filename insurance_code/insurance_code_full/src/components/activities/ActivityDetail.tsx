import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, Share2, Star, ArrowRight, House } from 'lucide-react';
import { motion } from 'motion/react';
import { trackCEvent } from '../../lib/track';
import { showApiError } from '../../lib/ui-error';
import { api } from '../../lib/api';
import { runningStatusLabel, runningStatusPillClass } from '../../lib/templateStatus';

interface Props {
  activity: any;
  onClose: () => void;
  onGoHome?: () => void;
  requireAuth: (action: () => void) => void;
  onCompleted?: (nextBalance: number) => void;
}

export default function ActivityDetail({ activity, onClose, onGoHome, requireAuth, onCompleted }: Props) {
  const [completing, setCompleting] = useState(false);
  const [browseSeconds, setBrowseSeconds] = useState(0);
  const latestBrowseMetaRef = useRef({
    durationSeconds: 0,
    title: String(activity?.title || ''),
    category: String(activity?.category || ''),
  });
  const rewardPoints = Number(activity?.rewardPoints || 0);
  const participants = Number(activity?.participants || 0);
  const statusLabel = runningStatusLabel(activity?.status);
  const statusClass = runningStatusPillClass(activity?.status);
  const description = String(activity?.description || activity?.content || '').trim();
  const isCompleted = Boolean(activity?.completed);
  useEffect(() => {
    trackCEvent('c_activity_detail_view', { activityId: Number(activity?.id || 0), category: String(activity?.category || '') });
  }, [activity?.id, activity?.category]);

  useEffect(() => {
    setBrowseSeconds(0);
  }, [activity?.id]);

  useEffect(() => {
    latestBrowseMetaRef.current = {
      durationSeconds: browseSeconds,
      title: String(activity?.title || ''),
      category: String(activity?.category || ''),
    };
  }, [activity?.category, activity?.title, browseSeconds]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      setBrowseSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activity?.id]);

  useEffect(() => {
    return () => {
      const { durationSeconds, title, category } = latestBrowseMetaRef.current;
      if (durationSeconds < 1) return;
      trackCEvent('c_activity_browse_duration', {
        activityId: Number(activity?.id || 0),
        activityTitle: title || undefined,
        category: category || undefined,
        durationSeconds,
      });
    };
  }, [activity?.id]);

  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-[10050] bg-slate-50 flex flex-col"
    >
      {/* Top Navigation Bar */}
      <div className="fixed top-0 left-0 right-0 z-[10060] bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="flex items-center h-14 px-4">
          <button onClick={onClose} className="flex items-center justify-center w-10 h-10 -ml-2 text-slate-700 active:bg-slate-100 rounded-full transition-colors">
            <ChevronLeft size={24} />
          </button>
          <h2 className="flex-1 text-center text-lg font-bold tracking-tight">活动详情</h2>
          <button className="w-10 h-10 -mr-2 flex items-center justify-center text-slate-700 active:bg-slate-100 rounded-full transition-colors">
            <Share2 size={24} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pt-14 pb-24">
        {/* Hero Section */}
        <div className="p-4">
          <div className="w-full overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            {activity.image ? (
              <img
                src={activity.image}
                alt={activity.title}
                className="block w-full h-auto max-h-[70vh] object-contain bg-white"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-56 items-center justify-center bg-gradient-to-br from-slate-200 via-slate-100 to-white text-sm font-medium text-slate-400">
                暂无活动图片
              </div>
            )}
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
              <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${statusClass}`}>{statusLabel}</span>
              <span className="text-xs font-medium text-slate-400">活动封面</span>
            </div>
          </div>
        </div>

        {/* Activity Header */}
        <section className="px-4 py-2">
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600">
              热门活动
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600">
              保险知识
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-600">
              高额奖励
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
                <p className="text-xs text-slate-500">报名所需积分</p>
                <p className="text-lg font-bold text-blue-500">{rewardPoints} <span className="text-sm font-medium">积分</span></p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">当前剩余名额</p>
              <p className="text-sm font-bold text-slate-900">{participants || 0} 位</p>
            </div>
          </div>
        </section>

        <div className="h-2 bg-slate-100 my-4"></div>

        {/* Activity Description */}
        <section className="px-4 py-2 space-y-6">
          <div>
            <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
              <span className="w-1.5 h-5 bg-blue-500 rounded-full"></span>
              活动简介
            </h3>
            <div className="rounded-2xl bg-white border border-slate-100 px-4 py-4 shadow-sm">
              <div className="whitespace-pre-line text-sm leading-7 text-slate-600">
                {description || '当前活动还没有配置活动描述。'}
              </div>
            </div>
          </div>
        </section>

        {/* Footer Decoration */}
        <div className="px-4 py-8 text-center opacity-40">
          <p className="text-xs font-medium tracking-widest">—— 保险让生活更美好 ——</p>
        </div>
      </main>

      {/* Fixed Bottom Action Button */}
      <div className="fixed bottom-0 left-0 right-0 z-[10060] bg-white border-t border-slate-100 p-4 pb-safe shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
        <div className="flex gap-4 items-center">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 font-medium">合计</span>
            <span className="text-xl font-bold text-blue-500">{rewardPoints} <span className="text-[10px]">积分</span></span>
          </div>
          {isCompleted ? (
            <div className="flex flex-1 gap-3">
              <button
                type="button"
                onClick={() => {
                  trackCEvent('c_activity_completed_go_home_click', { activityId: Number(activity?.id || 0) });
                  onGoHome?.();
                }}
                className="flex-1 bg-gradient-to-r from-sky-500 to-blue-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              >
                <House size={18} />
                <span>返回首页</span>
              </button>
              <button
                type="button"
                disabled
                className="min-w-[118px] bg-slate-200 text-slate-500 font-bold py-3.5 px-4 rounded-xl border border-slate-200 flex items-center justify-center gap-2 cursor-not-allowed disabled:opacity-100"
              >
                <span>已兑换</span>
                <ArrowRight size={18} />
              </button>
            </div>
          ) : (
            <button
              onClick={() =>
                requireAuth(async () => {
                  if (completing) return;
                  setCompleting(true);
                  try {
                    trackCEvent('c_activity_join_click', { activityId: Number(activity?.id || 0), reward: rewardPoints });
                    const res = await api.completeActivity(Number(activity?.id || 0));
                    onCompleted?.(Number(res.balance || 0));
                    alert(`兑换成功，获得${Number(res.reward || 0)}积分`);
                    onClose();
                  } catch (e: any) {
                    showApiError(e, '兑换失败');
                  } finally {
                    setCompleting(false);
                  }
                })
              }
              disabled={completing}
              className="flex-1 bg-blue-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              <span>{completing ? '兑换中...' : '立即兑换活动'}</span>
              <ArrowRight size={18} />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
