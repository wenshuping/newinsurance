import React, { useCallback, useEffect, useState } from 'react';
import { HelpCircle, ShoppingBag, Trophy, Shield, Users } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import ActivityDetail from '../components/activities/ActivityDetail';
import { api } from '../lib/api';
import { ERROR_COPY } from '../lib/errorCopy';
import { NOTICE_COPY } from '../lib/noticeCopy';
import { ACTION_COPY } from '../lib/uiCopy';

interface Props {
  requireAuth: (action: () => void) => void;
  onOpenMall: () => void;
  initialActivityId?: number | null;
  initialSharedActivity?: any | null;
}

export default function Activities({ requireAuth, onOpenMall, initialActivityId = null, initialSharedActivity = null }: Props) {
  const [points, setPoints] = useState(0);
  const [tasksCompleted, setTasksCompleted] = useState(0);
  const [tasksTotal, setTasksTotal] = useState(0);
  const [activityItems, setActivityItems] = useState<any[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [selectedActivity, setSelectedActivity] = useState<any>(null);

  const loadActivityData = useCallback(async () => {
    setLoadingActivities(true);
    try {
      const res = await api.activities();
      setActivityItems(Array.isArray((res as any).activities) ? (res as any).activities : []);
      setPoints(Number((res as any).balance || 0));
      setTasksCompleted(Number((res as any).taskProgress?.completed || 0));
      setTasksTotal(Number((res as any).taskProgress?.total || 0));
    } catch {
      setActivityItems([]);
      setTasksCompleted(0);
      setTasksTotal(0);
      api.pointsSummary().then((res) => setPoints(res.balance)).catch(() => undefined);
    } finally {
      setLoadingActivities(false);
    }
  }, []);

  useEffect(() => {
    void loadActivityData();
  }, [loadActivityData]);

  useEffect(() => {
    if (!initialActivityId || loadingActivities) return;
    const matched = activityItems.find((item) => Number(item?.id || 0) === Number(initialActivityId));
    if (!matched) return;
    setSelectedActivity((prev) => (Number(prev?.id || 0) === Number(matched.id || 0) ? prev : matched));
  }, [activityItems, initialActivityId, loadingActivities]);

  useEffect(() => {
    if (!initialSharedActivity) return;
    setSelectedActivity((prev) => (Number(prev?.id || 0) === Number(initialSharedActivity.id || 0) ? prev : initialSharedActivity));
  }, [initialSharedActivity]);

  const handleAction = (activity: any) => {
    const category = String(activity.category || 'task');
    if (category === 'sign') {
      requireAuth(async () => {
        try {
          const res = await api.signIn();
          alert(`${NOTICE_COPY.cSignInRewardPrefix}${res.reward}${NOTICE_COPY.cPointsSuffixBang}`);
          setPoints(Number(res.balance || 0));
          await loadActivityData();
        } catch (err: any) {
          alert(err?.message || ERROR_COPY.signInFailed);
        }
      });
      return;
    }

    if (activity.canComplete && !activity.completed && category !== 'competition') {
      requireAuth(async () => {
        try {
          const res = await api.completeActivity(Number(activity.id));
          alert(`${NOTICE_COPY.cTaskCompleteRewardPrefix}${res.reward}${NOTICE_COPY.cPointsSuffixBang}`);
          setPoints(Number(res.balance || 0));
          await loadActivityData();
        } catch (err: any) {
          alert(err?.message || ERROR_COPY.actionFailed);
        }
      });
      return;
    }

    setSelectedActivity(activity);
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen pb-24">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md px-4 py-4 flex items-center justify-between border-b border-slate-100">
        <div className="w-10"></div>
        <h1 className="text-xl font-bold tracking-tight">{ACTION_COPY.cActivitiesTitle}</h1>
        <button className="w-10 h-10 flex items-center justify-center text-slate-700">
          <HelpCircle size={24} />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto">
        <section className="px-4 py-2">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-slate-500 text-sm font-medium mb-1">{ACTION_COPY.cActivitiesMyPoints}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-blue-500">{points}</span>
                  <span className="text-xs text-slate-400 font-bold">{ACTION_COPY.cPointsUnit}</span>
                </div>
              </div>
              <button
                onClick={onOpenMall}
                className="flex items-center gap-2 bg-blue-500 text-white px-5 py-2.5 rounded-full font-bold shadow-md shadow-blue-500/20 active:scale-95 transition-all"
              >
                <ShoppingBag size={18} />
                <span>{ACTION_COPY.cMall}</span>
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-base font-bold">{ACTION_COPY.cTodayTaskProgress}</span>
                <span className="text-sm font-bold text-blue-500">
                  {tasksCompleted}/{tasksTotal || 0}{ACTION_COPY.cCompletedSuffix}
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-blue-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${(tasksCompleted / Math.max(tasksTotal || 1, 1)) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-6">
          <h3 className="text-lg font-bold mb-4">{ACTION_COPY.cHotActivitiesTitle}</h3>
          <div className="grid grid-cols-1 gap-4">
            {loadingActivities ? <div className="bg-white rounded-2xl p-4 border border-slate-100 text-sm text-slate-500">{ACTION_COPY.cActivitiesLoading}</div> : null}
            {!loadingActivities && activityItems.length === 0 ? (
              <div className="bg-white rounded-2xl p-4 border border-slate-100 text-sm text-slate-500">{ACTION_COPY.cNoActivities}</div>
            ) : null}
            {!loadingActivities &&
              activityItems.map((activity) => {
                const category = String(activity.category || 'task');
                const badge =
                  category === 'competition' ? ACTION_COPY.cBadgeCompetition : category === 'invite' ? ACTION_COPY.cBadgeInvite : category === 'sign' ? ACTION_COPY.cBadgeSignTask : ACTION_COPY.cBadgeProfileComplete;
                const Icon = category === 'competition' ? Trophy : category === 'invite' ? Users : Shield;
                const subtitle = String(activity.description || ACTION_COPY.cActivitySubtitleDefault);
                const actionText =
                  category === 'invite' ? ACTION_COPY.cActionInviteNow : category === 'competition' ? ACTION_COPY.cActionViewDetail : category === 'sign' ? ACTION_COPY.cActionSignNow : ACTION_COPY.cActionCompleteNow;

                return (
                  <div
                    key={Number(activity.id)}
                    onClick={() => setSelectedActivity(activity)}
                    className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 flex h-32 cursor-pointer active:scale-[0.98] transition-transform"
                  >
                    <div className="w-32 bg-blue-50 relative flex items-center justify-center overflow-hidden">
                      {String(activity.image || '').trim() ? (
                        <img src={String(activity.image)} alt={String(activity.title || '')} className="absolute inset-0 w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <Icon className="text-blue-500" size={40} />
                      )}
                    </div>
                    <div className="flex-1 p-4 flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded uppercase">{badge}</span>
                        <h4 className="font-bold text-sm mt-1">{String(activity.title || '')}</h4>
                        <p className="text-[10px] text-slate-500 mt-1">{subtitle}</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAction(activity);
                        }}
                        className="bg-blue-500 text-white py-1.5 rounded-lg text-xs font-bold w-full active:scale-95 transition-transform"
                      >
                        {activity.completed ? ACTION_COPY.cCompleted : actionText}
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      </main>

      <AnimatePresence>
        {selectedActivity && <ActivityDetail activity={selectedActivity} onClose={() => setSelectedActivity(null)} requireAuth={requireAuth} />}
      </AnimatePresence>
    </div>
  );
}
