import React, { useEffect, useState } from 'react';
import { HelpCircle, ShoppingBag } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import ActivityDetail from '../components/activities/ActivityDetail';
import { api, type Activity } from '../lib/api';
import { resolveActivityCardImage } from '../lib/home-feature-cards';
import { trackCEvent } from '../lib/track';
import { showApiError } from '../lib/ui-error';

interface Props {
  requireAuth: (action: () => void) => void;
  onOpenMall: () => void;
  onGoHome: () => void;
  pointsBalance: number;
  onBalanceChange: (balance: number) => void;
  initialActivityId?: number | null;
  onActivityChange?: (activity: Activity | null) => void;
}

const categoryBadge: Record<string, { label: string; className: string }> = {
  sign: { label: '签到任务', className: 'text-emerald-600 bg-emerald-50' },
  competition: { label: '智力竞赛', className: 'text-blue-500 bg-blue-50' },
  task: { label: '资料完善', className: 'text-orange-500 bg-orange-50' },
  invite: { label: '有奖推荐', className: 'text-green-600 bg-green-50' },
};

function resolveActivityImage(activity: Activity): string {
  return resolveActivityCardImage(activity);
}

export default function Activities({
  requireAuth,
  onOpenMall,
  onGoHome,
  pointsBalance,
  onBalanceChange,
  initialActivityId = null,
  onActivityChange,
}: Props) {
  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const previousRouteActivityIdRef = React.useRef<number | null>(initialActivityId ?? null);

  const loadActivities = async () => {
    try {
      const res = await api.activities();
      setActivities(res.activities || []);
      trackCEvent('c_activities_load_success', {
        total: Number((res.activities || []).length),
      });
      if (typeof res.balance === 'number' && Number.isFinite(res.balance)) {
        onBalanceChange(res.balance);
      }
    } catch (e) {
      trackCEvent('c_activities_load_failed', {});
      console.error(e);
    }
  };

  useEffect(() => {
    loadActivities().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!initialActivityId && previousRouteActivityIdRef.current) {
      setSelectedActivity(null);
    }
    previousRouteActivityIdRef.current = initialActivityId ?? null;
    if (!initialActivityId || !activities.length) return;
    if (Number(selectedActivity?.id || 0) === Number(initialActivityId)) return;
    const matched = activities.find((activity) => Number(activity.id || 0) === Number(initialActivityId));
    if (!matched) return;
    setSelectedActivity({ ...matched, image: resolveActivityImage(matched) });
  }, [activities, initialActivityId, selectedActivity]);

  const sortedActivities = React.useMemo(
    () =>
      [...activities].sort((a, b) => {
        const sortGap = Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
        if (sortGap !== 0) return sortGap;
        return Number(a.id || 0) - Number(b.id || 0);
      }),
    [activities]
  );

  const featuredActivity = sortedActivities[0] || null;
  const hotActivities = sortedActivities.slice(1);

  const openActivityDetail = (activity: Activity) => {
    trackCEvent('c_activity_open_detail', { activityId: activity.id, category: activity.category });
    const nextActivity = { ...activity, image: resolveActivityImage(activity) };
    setSelectedActivity(nextActivity);
    onActivityChange?.(nextActivity);
  };

  const completeTask = (activity: Activity) => {
    requireAuth(async () => {
      try {
        if (activity.category === 'sign') {
          const res = await api.signIn();
          onBalanceChange(res.balance);
          trackCEvent('c_activity_complete_success', { activityId: activity.id, category: activity.category, reward: Number(res.reward || 0) });
          alert(`签到成功，获得${res.reward}积分！`);
        } else {
          const res = await api.completeActivity(activity.id);
          onBalanceChange(res.balance);
          trackCEvent('c_activity_complete_success', { activityId: activity.id, category: activity.category, reward: Number(res.reward || 0) });
          alert(`任务完成，获得${res.reward}积分！`);
        }
        await loadActivities();
      } catch (e: any) {
        trackCEvent('c_activity_complete_failed', { activityId: activity.id, category: activity.category, code: String(e?.code || 'UNKNOWN') });
        showApiError(e, '操作失败');
      }
    });
  };

  const renderFeaturedAction = (activity: Activity) => {
    const isSign = String(activity.category || '') === 'sign';
    if (isSign) {
      if (activity.completed) return '今日已签到';
      return '立即签到领奖';
    }
    if (activity.completed) return '查看活动详情';
    if (activity.canComplete) return '立即参与活动';
    return '查看活动详情';
  };

  const handleFeaturedPrimary = (activity: Activity) => {
    const isSign = String(activity.category || '') === 'sign';
    if (isSign && !activity.completed) {
      completeTask(activity);
      return;
    }
    openActivityDetail(activity);
  };

  const featuredImage = featuredActivity ? resolveActivityImage(featuredActivity) : '';

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen pb-24">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md px-4 py-4 flex items-center justify-between border-b border-slate-100">
        <div className="w-10"></div>
        <h1 className="text-xl font-bold tracking-tight">活动中心</h1>
        <button className="w-10 h-10 flex items-center justify-center text-slate-700">
          <HelpCircle size={24} />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto">
        <section className="p-4">
          {featuredActivity ? (
            <div
              role="button"
              tabIndex={0}
              onClick={() => openActivityDetail(featuredActivity)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openActivityDetail(featuredActivity);
                }
              }}
              className="relative w-full cursor-pointer overflow-hidden rounded-2xl bg-slate-900 text-left text-white shadow-lg transition-transform active:scale-[0.99] min-h-[240px]"
            >
              {featuredImage ? (
                <img
                  src={featuredImage}
                  alt={featuredActivity.title || '活动封面'}
                  className="absolute inset-0 h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-cyan-500 to-sky-600" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-900/40 to-slate-900/10" />
              <div className="relative z-10">
                <span className="inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wider backdrop-blur-sm">
                  {categoryBadge[featuredActivity.category]?.label || '精选活动'}
                </span>
                <div className="mt-24 md:mt-28" />
                <h2 className="text-[28px] font-bold leading-tight drop-shadow-sm">
                  {featuredActivity.title || '热门活动'}
                </h2>
                <p className="mt-2 text-sm font-medium text-white/90 line-clamp-2">
                  {featuredActivity.description || `${featuredActivity.participants || 0}人正在参与中`}
                </p>
                <div className="mt-5 flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-white/90">
                    {Number(featuredActivity.rewardPoints || 0) > 0
                      ? `完成可得 ${Number(featuredActivity.rewardPoints || 0)} 积分`
                      : `${featuredActivity.participants || 0} 人正在参与`}
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleFeaturedPrimary(featuredActivity);
                    }}
                    className="rounded-xl bg-white/95 px-5 py-3 text-sm font-bold text-slate-900 shadow-md transition-transform active:scale-95"
                  >
                    {renderFeaturedAction(featuredActivity)}
                  </button>
                </div>
              </div>
              <div className="absolute -right-8 -bottom-8 h-36 w-36 rounded-full bg-white/10 blur-3xl" />
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500 shadow-sm">
              暂无可展示的活动
            </div>
          )}
        </section>

        <section className="px-4 py-2">
          <div
            onClick={onOpenMall}
            className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 cursor-pointer active:scale-[0.99] transition-transform"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-slate-500 text-sm font-medium mb-1">我的积分</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-blue-500">{pointsBalance}</span>
                  <span className="text-xs text-slate-400 font-bold">分</span>
                </div>
              </div>
              <button
                onClick={onOpenMall}
                className="flex items-center gap-2 bg-blue-500 text-white px-5 py-2.5 rounded-full font-bold shadow-md shadow-blue-500/20 active:scale-95 transition-all"
              >
                <ShoppingBag size={18} />
                <span>积分商城</span>
              </button>
            </div>
          </div>
        </section>

        <section className="px-4 py-6">
          <h3 className="text-lg font-bold mb-4">热门活动</h3>
          <div className="grid grid-cols-1 gap-4">
            {hotActivities.map((activity) => {
              const badge = categoryBadge[activity.category] || categoryBadge.competition;
              const image = resolveActivityImage(activity);
              return (
                <div
                  key={activity.id}
                  onClick={() => {
                    openActivityDetail(activity);
                  }}
                  className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 flex h-32 cursor-pointer active:scale-[0.98] transition-transform"
                >
                  <div className="w-32 bg-slate-800 relative flex items-center justify-center">
                    {image ? (
                      <img
                        src={image}
                        alt={activity.title}
                        className="absolute inset-0 w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-slate-200" />
                    )}
                  </div>
                  <div className="flex-1 p-4 flex flex-col justify-between">
                    <div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${badge.className}`}>{badge.label}</span>
                      <h4 className="font-bold text-sm mt-1">{activity.title}</h4>
                      <p className="text-[10px] text-slate-500 mt-1">{activity.participants || 0}人正在参与中</p>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex -space-x-2">
                        <div className="w-6 h-6 rounded-full border-2 border-white bg-slate-200"></div>
                        <div className="w-6 h-6 rounded-full border-2 border-white bg-slate-300"></div>
                        <div className="w-6 h-6 rounded-full border-2 border-white bg-slate-400"></div>
                      </div>
                      <button className="text-blue-500 text-xs font-bold">查看详情 &gt;</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <AnimatePresence>
        {selectedActivity && (
          <ActivityDetail 
            activity={selectedActivity} 
            onClose={() => {
              setSelectedActivity(null);
              onActivityChange?.(null);
            }} 
            onGoHome={() => {
              setSelectedActivity(null);
              onActivityChange?.(null);
              onGoHome();
            }}
            requireAuth={requireAuth}
            onCompleted={(nextBalance) => {
              onBalanceChange(nextBalance);
              loadActivities().catch(() => undefined);
              onActivityChange?.(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
