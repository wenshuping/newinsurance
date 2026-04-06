import React from 'react';
import { Play } from 'lucide-react';
import { api, type LearningCourse } from '../lib/api';
import { buildAutoFlowTrackItems, resolveLearningCardImage, resolveLearningCardVideoUrl } from '../lib/home-feature-cards';

interface Props {
  onOpenCourse: (courseId: number) => void;
  onViewAll: () => void;
}

export default function LatestNews({ onOpenCourse, onViewAll }: Props) {
  const [courses, setCourses] = React.useState<LearningCourse[]>([]);
  const trackRef = React.useRef<HTMLDivElement | null>(null);
  const pausedRef = React.useRef(false);

  React.useEffect(() => {
    let mounted = true;
    api.learningCourses()
      .then((res) => {
        if (!mounted) return;
        setCourses(res.courses || []);
      })
      .catch(() => {
        if (!mounted) return;
        setCourses([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const sourceItems = React.useMemo(() => courses.slice(0, 8), [courses]);
  const items = React.useMemo(() => buildAutoFlowTrackItems(sourceItems), [sourceItems]);

  React.useEffect(() => {
    const container = trackRef.current;
    if (!container || sourceItems.length <= 2 || typeof window === 'undefined') return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;

    let rafId = 0;
    let previousTs = 0;
    const pixelsPerMs = 0.022;

    container.scrollLeft = 0;

    const step = (ts: number) => {
      if (!container.isConnected) return;
      if (!previousTs) previousTs = ts;
      const delta = ts - previousTs;
      previousTs = ts;
      const loopWidth = container.scrollWidth / 2;

      if (!pausedRef.current && loopWidth > container.clientWidth + 8) {
        container.scrollLeft += delta * pixelsPerMs;
        if (container.scrollLeft >= loopWidth) {
          container.scrollLeft -= loopWidth;
        }
      }

      rafId = window.requestAnimationFrame(step);
    };

    rafId = window.requestAnimationFrame(step);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [sourceItems]);

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-600/70">Latest Insight</p>
          <h2 className="mt-1 text-lg font-bold text-slate-900">最新资讯</h2>
        </div>
        <button
          type="button"
          onClick={onViewAll}
          className="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
        >
          查看全部
        </button>
      </div>
      <div
        ref={trackRef}
        className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 scrollbar-hide"
        onMouseEnter={() => {
          pausedRef.current = true;
        }}
        onMouseLeave={() => {
          pausedRef.current = false;
        }}
        onTouchStart={() => {
          pausedRef.current = true;
        }}
        onTouchEnd={() => {
          pausedRef.current = false;
        }}
      >
        {items.map((item, index) => {
          const cover = resolveLearningCardImage(item);
          const videoPreview = !cover ? resolveLearningCardVideoUrl(item) : '';
          const subtitle = [item.category, item.desc].filter(Boolean).join('  ');
          return (
            <button
              key={`${item.id}-${index}`}
              type="button"
              onClick={() => onOpenCourse(Number(item.id))}
              className="group flex w-[44vw] min-w-[44vw] max-w-[44vw] flex-none flex-col text-left cursor-pointer"
            >
              <div className="relative aspect-[3/4] overflow-hidden rounded-[26px] bg-gradient-to-br from-sky-100 via-white to-cyan-100 shadow-sm shadow-slate-200/60">
                {cover ? (
                  <img
                    src={cover}
                    alt={item.title || '最新资讯'}
                    className="h-full w-full object-cover transition-transform duration-300 group-active:scale-[1.02]"
                    referrerPolicy="no-referrer"
                  />
                ) : videoPreview ? (
                  <video
                    src={videoPreview}
                    className="h-full w-full object-cover"
                    muted
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-sky-100 via-cyan-50 to-blue-100 text-sky-600">
                    <Play size={34} />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-slate-950/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between px-3 pb-3 text-white">
                  <span className="text-[13px] font-semibold tracking-tight">{item.typeLabel || '最新内容'}</span>
                  {Number(item.points || 0) > 0 ? <span className="text-[13px] font-semibold">{Number(item.points)}积分</span> : null}
                </div>
              </div>
              <div className="px-1 pb-1 pt-3">
                <h3 className="line-clamp-2 text-[18px] font-semibold leading-7 text-slate-900">{item.title || '暂无最新资讯'}</h3>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">
                  {subtitle || '知识学习内容更新中'}
                </p>
              </div>
            </button>
          );
        })}
        {items.length === 0 ? (
          <div className="w-full min-w-full rounded-[24px] border border-dashed border-sky-200 bg-white px-5 py-6 text-sm leading-6 text-slate-500 shadow-sm">
            当前环境还没有可展示的真实资讯内容。
          </div>
        ) : null}
      </div>
    </section>
  );
}
