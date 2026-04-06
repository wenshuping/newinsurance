import React from 'react';
import { api, type Activity } from '../lib/api';
import { pickHomeActivities, resolveActivityCardImage } from '../lib/home-feature-cards';

interface Props {
  requireAuth: (action: () => void) => void;
  onOpenActivities: () => void;
  onOpenActivity: (activityId: number) => void;
}

export default function Activities({ requireAuth, onOpenActivities, onOpenActivity }: Props) {
  const [items, setItems] = React.useState<Activity[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    api.activities()
      .then((res) => {
        if (!mounted) return;
        setItems(pickHomeActivities(res.activities || []));
      })
      .catch(() => {
        if (!mounted) return;
        setItems([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-600/70">Activity Picks</p>
          <h2 className="mt-1 text-lg font-bold text-slate-900">进行中活动</h2>
        </div>
        <button onClick={onOpenActivities} className="text-xs font-medium text-sky-700">
          查看全部
        </button>
      </div>
      <div className="space-y-4">
        {items.map((item, idx) => {
          const image = resolveActivityCardImage(item);
          return (
            <button
              key={item.id || idx}
              type="button"
              onClick={() => {
                const activityId = Number(item.id || 0);
                if (!activityId) {
                  onOpenActivities();
                  return;
                }
                if (String(item.category || '') === 'sign') {
                  requireAuth(() => onOpenActivity(activityId));
                  return;
                }
                onOpenActivity(activityId);
              }}
              className="group flex w-full flex-col text-left cursor-pointer"
            >
              <div className="relative aspect-[16/9] overflow-hidden rounded-[26px] bg-slate-950 shadow-sm shadow-slate-200/60">
                {image ? (
                  <img
                    src={image}
                    alt={item.title || '活动封面'}
                    className="h-full w-full object-cover transition-transform duration-300 group-active:scale-[1.02]"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div
                    className={`h-full w-full bg-gradient-to-br ${
                      idx % 2 === 0 ? 'from-orange-500 via-amber-500 to-orange-300' : 'from-sky-600 via-cyan-500 to-teal-300'
                    }`}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/62 via-slate-950/10 to-transparent" />
                <div className="absolute inset-x-0 top-0 flex items-start justify-between px-3 pt-3 text-white">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur ${
                      String(item.category || '') === 'sign'
                        ? 'bg-emerald-500/18 text-emerald-50 ring-1 ring-emerald-200/35'
                        : 'bg-sky-500/18 text-sky-50 ring-1 ring-sky-200/35'
                    }`}
                  >
                    {String(item.category || '') === 'sign' ? '签到活动' : '热门活动'}
                  </span>
                  <span className="text-[13px] font-semibold">
                    {Number(item.rewardPoints || 0) > 0 ? `${Number(item.rewardPoints)}积分` : '查看活动'}
                  </span>
                </div>
                <div className="absolute inset-x-0 bottom-0 px-3 pb-3 text-white">
                  <span className="text-[13px] font-medium">{item.participants || 0} 人参与中</span>
                </div>
              </div>
              <div className="px-1 pb-1 pt-3">
                <h3 className="line-clamp-2 text-[20px] font-semibold leading-7 text-slate-900">{item.title || '未命名活动'}</h3>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">
                  {item.description || '当前活动暂无简介'}
                </p>
              </div>
            </button>
          );
        })}
        {!loading && items.length === 0 ? (
          <div className="rounded-[26px] border border-dashed border-sky-200 bg-white px-5 py-6 text-sm leading-6 text-slate-500 shadow-sm">
            暂无可展示的真实活动
          </div>
        ) : null}
        {loading
          ? Array.from({ length: 3 }).map((_, idx) => (
              <div key={`skeleton-${idx}`} className="space-y-3">
                <div className="aspect-[16/9] animate-pulse rounded-[26px] bg-slate-100" />
                <div className="h-6 w-2/3 rounded bg-slate-100" />
                <div className="h-4 w-3/4 rounded bg-slate-100" />
              </div>
            ))
          : null}
      </div>
    </section>
  );
}
