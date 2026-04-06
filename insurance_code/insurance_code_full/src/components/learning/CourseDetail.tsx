import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, Share2, Award, CheckCircle2, FileText } from 'lucide-react';
import { motion } from 'motion/react';
import { api, resolveCurrentLearningShareContext } from '../../lib/api';
import { Course } from './InsuranceClass';
import {
  DEFERRED_LEARNING_REWARDS_FLUSHED_EVENT,
  getDeferredLearningReward,
  upsertDeferredLearningReward,
} from '../../lib/deferred-learning-rewards';
import { trackCEvent } from '../../lib/track';
import { showApiError } from '../../lib/ui-error';
import { resolveRuntimeAssetUrl } from '../../lib/runtime-asset-url';

interface Props {
  course: Course;
  onBack: () => void;
  requireAuth?: (action: () => void) => void;
  onCompleted?: (courseId: number, nextBalance: number) => void;
  isAuthenticated?: boolean;
}

export default function CourseDetail({ course, onBack, requireAuth, onCompleted, isAuthenticated = false }: Props) {
  const [courseData, setCourseData] = useState<Course>(course);
  const [submitting, setSubmitting] = useState(false);
  const [articleDwellSeconds, setArticleDwellSeconds] = useState(0);
  const [articleReachedEnd, setArticleReachedEnd] = useState(false);
  const [courseRewardClaimed, setCourseRewardClaimed] = useState(Number(course.progress || 0) >= 100);
  const [courseRewardDeferred, setCourseRewardDeferred] = useState(Boolean(getDeferredLearningReward(Number(course.id || 0))));
  const [rewardModal, setRewardModal] = useState<null | { duplicated: boolean; reward: number; balance: number; message: string }>(null);
  const [deferredPromptOpen, setDeferredPromptOpen] = useState(false);
  const [videoProgress, setVideoProgress] = useState(Math.max(0, Number(course.progress || 0)));
  const [videoEnded, setVideoEnded] = useState(false);
  const [coverLoadFailed, setCoverLoadFailed] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const autoCompleteTriggeredRef = useRef(false);
  const latestBrowseMetaRef = useRef({
    durationSeconds: 0,
    title: String(course.title || ''),
    category: String(course.category || ''),
  });
  const sourceType = String((courseData as any).sourceType || 'native');
  const isVideoChannelCourse = sourceType === 'video_channel';
  const isVideoCourse =
    String(courseData.type || 'article').toLowerCase() === 'video' || isVideoChannelCourse;
  const isNativeVideoCourse = isVideoCourse && !isVideoChannelCourse;
  const articleRemainingSeconds = Math.max(0, 30 - articleDwellSeconds);
  const canCompleteVideo = isNativeVideoCourse && (videoEnded || videoProgress >= 95);
  const canCompleteArticle = !courseRewardClaimed && articleReachedEnd && articleDwellSeconds >= 30;
  const canComplete = !courseRewardClaimed && !courseRewardDeferred && (canCompleteVideo || canCompleteArticle);
  const canPromptDeferredAgain = !courseRewardClaimed && courseRewardDeferred && (canCompleteVideo || canCompleteArticle);

  useEffect(() => {
    let mounted = true;
    trackCEvent('c_learning_view_course', {
      courseId: course.id,
      category: course.category,
      type: course.type,
    });
    api
      .learningCourseDetail(course.id)
      .then((resp) => {
        if (!mounted) return;
        setCourseData((prev) => ({ ...prev, ...resp.course }));
        const nextProgress = Math.max(0, Number(resp.course?.progress || 0));
        setCourseRewardClaimed(nextProgress >= 100);
        setVideoProgress(nextProgress);
        trackCEvent('c_learning_detail_load_success', { courseId: course.id });
      })
      .catch((err) => {
        trackCEvent('c_learning_detail_load_failed', { courseId: course.id });
        console.error(err);
      });
    return () => {
      mounted = false;
    };
  }, [course.id]);

  useEffect(() => {
    setArticleDwellSeconds(0);
    setArticleReachedEnd(false);
    setCourseRewardClaimed(Number(course.progress || 0) >= 100);
    setCourseRewardDeferred(Boolean(getDeferredLearningReward(Number(course.id || 0))));
    setRewardModal(null);
    setDeferredPromptOpen(false);
    setVideoProgress(Math.max(0, Number(course.progress || 0)));
    setVideoEnded(false);
    setCoverLoadFailed(false);
    autoCompleteTriggeredRef.current = false;
  }, [course.id]);

  useEffect(() => {
    const handleDeferredRewardsFlushed = (event: Event) => {
      const detail = (event as CustomEvent<{ settledCourseIds?: number[]; balance?: number | null; totalAwarded?: number }>).detail;
      const settledCourseIds = Array.isArray(detail?.settledCourseIds) ? detail.settledCourseIds : [];
      if (!settledCourseIds.includes(Number(course.id || 0))) return;
      setCourseRewardDeferred(false);
      setCourseRewardClaimed(true);
      setCourseData((prev) => ({ ...prev, progress: 100, action: '积分已领取' }));
      setVideoProgress(100);
      setDeferredPromptOpen(false);
      if (Number(detail?.totalAwarded || 0) > 0 && Number.isFinite(Number(detail?.balance))) {
        setRewardModal({
          duplicated: false,
          reward: Number(courseData.points || course.points || 0),
          balance: Number(detail?.balance || 0),
          message: `已为您补发《${String(courseData.title || course.title || '')}》学习积分`,
        });
      }
      if (Number.isFinite(Number(detail?.balance))) {
        onCompleted?.(Number(course.id || 0), Number(detail?.balance || 0));
      }
    };
    window.addEventListener(DEFERRED_LEARNING_REWARDS_FLUSHED_EVENT, handleDeferredRewardsFlushed as EventListener);
    return () => window.removeEventListener(DEFERRED_LEARNING_REWARDS_FLUSHED_EVENT, handleDeferredRewardsFlushed as EventListener);
  }, [course.id, course.points, course.title, courseData.points, courseData.title, onCompleted]);

  useEffect(() => {
    latestBrowseMetaRef.current = {
      durationSeconds: articleDwellSeconds,
      title: String(courseData.title || course.title || ''),
      category: String(courseData.category || course.category || ''),
    };
  }, [articleDwellSeconds, course.category, course.title, courseData.category, courseData.title]);

  useEffect(() => {
    return () => {
      const { durationSeconds, title, category } = latestBrowseMetaRef.current;
      if (durationSeconds < 1) return;
      trackCEvent('c_learning_browse_duration', {
        courseId: course.id,
        courseTitle: title || undefined,
        category: category || undefined,
        durationSeconds,
      });
    };
  }, [course.id]);

  useEffect(() => {
    if (courseRewardClaimed) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      setArticleDwellSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [course.id, courseRewardClaimed]);

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => {
      const node = mainRef.current;
      if (!node) return;
      if (!isNativeVideoCourse && node.scrollHeight <= node.clientHeight + 24) setArticleReachedEnd(true);
    });
    return () => window.cancelAnimationFrame(raf);
  }, [course.id, courseData.content, courseData.title, isNativeVideoCourse]);

  const handleArticleScroll = () => {
    const node = mainRef.current;
    if (!node) return;
    if (node.scrollTop + node.clientHeight >= node.scrollHeight - 48) {
      setArticleReachedEnd(true);
    }
  };
  const resolveVideoUrl = () => {
    if (isVideoChannelCourse) return '';
    const direct = resolveRuntimeAssetUrl(String((courseData as any).videoUrl || '').trim());
    if (direct) return direct;
    const media = Array.isArray((courseData as any).media) ? (courseData as any).media : [];
    const hit = media.find((m: any) => {
      if (typeof m === 'string') return /\.(mp4|mov|m4v|webm)$/i.test(m);
      const t = String(m?.type || '').toLowerCase();
      const n = String(m?.name || m?.url || m?.preview || '').toLowerCase();
      return t.startsWith('video/') || /\.(mp4|mov|m4v|webm)$/i.test(n);
    });
    if (!hit) return '';
    if (typeof hit === 'string') return resolveRuntimeAssetUrl(hit);
    return resolveRuntimeAssetUrl(String(hit.preview || hit.url || hit.path || hit.name || ''));
  };
  const resolveCourseImage = () => {
    const direct = resolveRuntimeAssetUrl(String(courseData.image || '').trim());
    if (direct) return direct;
    const media = Array.isArray((courseData as any).media) ? (courseData as any).media : [];
    const hit = media.find((m: any) => {
      if (typeof m === 'string') return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(m);
      const t = String(m?.type || '').toLowerCase();
      const n = String(m?.name || m?.url || m?.preview || '').toLowerCase();
      return t.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(n);
    });
    if (!hit) return '';
    if (typeof hit === 'string') return resolveRuntimeAssetUrl(hit);
    return resolveRuntimeAssetUrl(String(hit.preview || hit.url || hit.path || hit.name || ''));
  };
  const videoUrl = resolveVideoUrl();
  const resolvedCourseImage = coverLoadFailed ? '' : resolveCourseImage();

  const handleTimeUpdate = () => {
    if (!videoRef.current || !Number.isFinite(videoRef.current.duration) || videoRef.current.duration <= 0) return;
    const progress = (videoRef.current.currentTime / videoRef.current.duration) * 100;
    const normalized = Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : 0;
    setVideoProgress(normalized);
    if (normalized >= 95) setVideoEnded(true);
  };

  const handleComplete = async () => {
    if (submitting || !canComplete || courseRewardClaimed) return;
    if (!isAuthenticated) {
      upsertDeferredLearningReward({
        courseId: Number(course.id || 0),
        title: String(courseData.title || course.title || ''),
        points: Number(courseData.points || course.points || 0),
        shareContext: resolveCurrentLearningShareContext(Number(course.id || 0)),
        payload: canCompleteVideo && !canCompleteArticle
          ? {
              completionSource: 'video',
              videoProgressPercent: Math.round(videoEnded ? 100 : videoProgress),
              videoWatchedSeconds: Math.floor(Number(videoRef.current?.currentTime || 0)),
              videoDurationSeconds: Math.floor(Number(videoRef.current?.duration || 0)),
              videoEnded,
            }
          : {
              completionSource: 'article',
              articleDwellSeconds,
              articleReachedEnd,
            },
        createdAt: new Date().toISOString(),
      });
      setCourseRewardDeferred(true);
      setDeferredPromptOpen(true);
      setCourseData((prev) => ({ ...prev, progress: 100, action: '实名后补发积分' }));
      trackCEvent('c_learning_reward_deferred', {
        courseId: course.id,
        rewardPoints: Number(courseData.points || course.points || 0),
      });
      return;
    }
    const guard = requireAuth || ((action: () => void) => action());
    guard(async () => {
      setSubmitting(true);
      try {
        const completionPayload = canCompleteVideo && !canCompleteArticle
          ? {
              completionSource: 'video' as const,
              videoProgressPercent: Math.round(videoEnded ? 100 : videoProgress),
              videoWatchedSeconds: Math.floor(Number(videoRef.current?.currentTime || 0)),
              videoDurationSeconds: Math.floor(Number(videoRef.current?.duration || 0)),
              videoEnded,
            }
          : {
              completionSource: 'article' as const,
              articleDwellSeconds,
              articleReachedEnd,
            };
        const resp = await api.completeCourse(course.id, completionPayload);
        const msg = resp.duplicated ? resp.message || '课程积分已领取' : `恭喜完成学习，获得 ${resp.reward} 积分`;
        trackCEvent('c_learning_complete_success', {
          courseId: course.id,
          duplicated: Boolean(resp.duplicated),
          reward: Number(resp.reward || 0),
        });
        setCourseRewardClaimed(true);
        setCourseData((prev) => ({ ...prev, progress: 100, action: '积分已领取' }));
        setVideoProgress(100);
        setRewardModal({
          duplicated: Boolean(resp.duplicated),
          reward: Number(resp.reward || 0),
          balance: Number(resp.balance || 0),
          message: msg,
        });
        onCompleted?.(course.id, Number(resp.balance || 0));
      } catch (e: any) {
        trackCEvent('c_learning_complete_failed', { courseId: course.id, code: String(e?.code || 'UNKNOWN') });
        const normalizedError = String(e?.message || '').trim().toLowerCase() === 'failed to fetch'
          ? { ...e, message: '' }
          : e;
        showApiError(normalizedError, '网络异常，请稍后重试');
      } finally {
        setSubmitting(false);
      }
    });
  };

  const canAutoCompleteByArticle = canCompleteArticle && (!isNativeVideoCourse || !videoUrl);
  const canAutoComplete = canCompleteVideo || canAutoCompleteByArticle;

  useEffect(() => {
    if (!canAutoComplete || submitting || courseRewardClaimed || rewardModal || autoCompleteTriggeredRef.current) return;
    autoCompleteTriggeredRef.current = true;
    void handleComplete();
  }, [canAutoComplete, submitting, courseRewardClaimed, rewardModal]);

  useEffect(() => {
    if (isAuthenticated || !canPromptDeferredAgain || rewardModal || deferredPromptOpen) return;
    setDeferredPromptOpen(true);
  }, [isAuthenticated, canPromptDeferredAgain, rewardModal, deferredPromptOpen]);

  const completionHint = courseRewardClaimed
    ? '本课程积分已到账，可继续浏览内容或返回课程列表。'
    : courseRewardDeferred
      ? `已记录本次学习进度，完成实名后可补发 ${Number(courseData.points || 0)} 积分。`
    : canCompleteVideo
      ? '视频已观看完成，系统正在为您自动发放积分。'
      : articleReachedEnd
        ? articleRemainingSeconds > 0
          ? `文案已浏览完成，还需停留 ${articleRemainingSeconds} 秒后自动发放积分。`
          : '文案已浏览完成，系统正在为您发放积分。'
        : isNativeVideoCourse
          ? '视频播放完成后会自动发放积分。'
          : '请先把知识文案浏览到底部，再停留至少 30 秒即可获得积分。';

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-50 bg-white flex flex-col"
    >
      <header className="flex items-center justify-between p-4 border-b border-slate-100 bg-white shrink-0">
        <button onClick={onBack} className="p-2 -ml-2 text-slate-700 active:bg-slate-100 rounded-full transition-colors">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold">课程详情</h1>
        <button className="p-2 -mr-2 text-slate-700 active:bg-slate-100 rounded-full transition-colors">
          <Share2 size={24} />
        </button>
      </header>

      <main ref={mainRef} onScroll={handleArticleScroll} className="flex-1 overflow-y-auto pb-10">
        {isNativeVideoCourse && videoUrl ? (
          <div className="w-full bg-black relative">
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              preload="metadata"
              className="w-full aspect-video object-contain"
              poster={resolvedCourseImage || undefined}
              onTimeUpdate={handleTimeUpdate}
              onEnded={() => {
                setVideoProgress(100);
                setVideoEnded(true);
                videoRef.current?.pause();
              }}
            />
            <div className="bg-white px-5 pt-4 pb-2">
              <div className="flex justify-between text-xs text-slate-500 mb-1.5 font-medium">
                <span>当前视频进度</span>
                <span className="text-blue-500">{Math.round(videoProgress)}%</span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full rounded-full transition-all duration-300" style={{ width: `${videoProgress}%` }}></div>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full aspect-video relative">
            {resolvedCourseImage ? (
              <img
                src={resolvedCourseImage}
                alt={courseData.title}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={() => setCoverLoadFailed(true)}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 text-slate-400">
                <FileText size={30} />
              </div>
            )}
            {isVideoCourse ? (
              <div className="absolute left-4 bottom-4 rounded-full bg-slate-900/75 px-3 py-1.5 text-xs font-bold text-white backdrop-blur">
                {isVideoChannelCourse ? '视频号课程已切换为图文模式' : '视频封面'}
              </div>
            ) : null}
          </div>
        )}

        <div className="p-5 space-y-5">
          <div className="flex justify-between items-start gap-4">
            <h2 className="text-xl font-bold text-slate-900 leading-tight">{courseData.title}</h2>
          </div>

          <div className="flex items-center gap-2 text-orange-500 bg-orange-50 w-fit px-3 py-1.5 rounded-full">
            <Award size={18} />
            <span className="text-sm font-bold">
              {courseRewardClaimed
                ? `已获得 ${courseData.points} 积分`
                : courseRewardDeferred
                  ? `实名后可补发 ${courseData.points} 积分`
                  : `学习可得 ${courseData.points} 积分`}
            </span>
          </div>

          <section className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
            {completionHint}
          </section>

          {isVideoChannelCourse ? (
            <section className="rounded-2xl border border-blue-100 bg-blue-50/80 p-4 text-sm leading-6 text-blue-900">
              当前视频号课程按图文模式展示，不会再外跳或重复播放。完整阅读下方知识文案到底部，并停留 30 秒后，系统会自动为您发放学习积分。
            </section>
          ) : null}

          <div className="pt-5 border-t border-slate-100">
            <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
              <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
              知识文案
            </h3>
            <div className="text-slate-600 leading-relaxed space-y-4 text-sm">
              <p>{courseData.content}</p>
              <p>本课程将为您详细解读相关政策与条款，帮助您更好地理解保险产品，为您的家庭提供更全面的保障。</p>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mt-4">
                <h4 className="font-bold text-slate-800 mb-2">学习建议：</h4>
                <ul className="list-disc list-inside space-y-1 text-slate-600">
                  <li>建议在安静的环境下完整阅读当前知识文案</li>
                  <li>结合自身实际情况进行思考</li>
                  <li>如有疑问可随时联系您的专属顾问</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>

      {rewardModal ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-5">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 text-orange-500">
              {rewardModal.duplicated ? <CheckCircle2 size={30} /> : <Award size={30} />}
            </div>
            <h3 className="mt-4 text-2xl font-black text-slate-900">
              {rewardModal.duplicated ? '积分已到账' : '学习完成'}
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-500">{rewardModal.message}</p>
            {!rewardModal.duplicated ? (
              <div className="mt-5 rounded-3xl bg-orange-50 px-4 py-4">
                <p className="text-xs font-bold tracking-wide text-orange-500">本次学习获得</p>
                <p className="mt-1 text-4xl font-black text-orange-500">+{rewardModal.reward}</p>
              </div>
            ) : null}
            <div className="mt-5 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              当前总积分：<span className="font-black text-slate-900">{rewardModal.balance}</span>
            </div>
            <button
              type="button"
              onClick={() => setRewardModal(null)}
              className="mt-6 w-full rounded-full bg-blue-500 py-3 text-base font-bold text-white"
            >
              我知道了
            </button>
          </div>
        </div>
      ) : null}

      {deferredPromptOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-5">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-500">
              <Award size={30} />
            </div>
            <h3 className="mt-4 text-2xl font-black text-slate-900">实名后可领取积分</h3>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              当前课程已学习完成，我们已为您记录学习进度。完成实名后，可自动补发
              <span className="mx-1 font-black text-slate-900">{Number(courseData.points || 0)}</span>
              积分。
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDeferredPromptOpen(false)}
                className="rounded-full border border-slate-200 py-3 text-base font-bold text-slate-600"
              >
                稍后再说
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeferredPromptOpen(false);
                  (requireAuth || ((action: () => void) => action()))(() => undefined);
                }}
                className="rounded-full bg-blue-500 py-3 text-base font-bold text-white"
              >
                去实名领取
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </motion.div>
  );
}
