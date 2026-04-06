import { api, type LearningShareContext } from './api';

const STORAGE_KEY = 'insurance_deferred_learning_rewards_v1';
export const DEFERRED_LEARNING_REWARDS_FLUSHED_EVENT = 'insurance:deferred-learning-rewards-flushed';

export type DeferredLearningRewardPayload = {
  completionSource?: 'video' | 'article' | 'video_channel';
  videoProgressPercent?: number;
  videoWatchedSeconds?: number;
  videoDurationSeconds?: number;
  videoEnded?: boolean;
  videoChannelOpened?: boolean;
  articleDwellSeconds?: number;
  articleReachedEnd?: boolean;
};

export type DeferredLearningReward = {
  courseId: number;
  title: string;
  points: number;
  payload: DeferredLearningRewardPayload;
  shareContext?: LearningShareContext | null;
  createdAt: string;
};

type FlushSummary = {
  settledCourseIds: number[];
  totalAwarded: number;
  duplicatedCount: number;
  balance: number | null;
};

function getStorage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readQueue(): DeferredLearningReward[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        courseId: Number(item?.courseId || 0),
        title: String(item?.title || ''),
        points: Number(item?.points || 0),
        payload: typeof item?.payload === 'object' && item?.payload ? item.payload : {},
        shareContext: typeof item?.shareContext === 'object' && item?.shareContext ? item.shareContext : null,
        createdAt: String(item?.createdAt || ''),
      }))
      .filter((item) => Number.isFinite(item.courseId) && item.courseId > 0);
  } catch {
    return [];
  }
}

function writeQueue(list: DeferredLearningReward[]) {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function listDeferredLearningRewards() {
  return readQueue();
}

export function getDeferredLearningReward(courseId: number) {
  return readQueue().find((item) => Number(item.courseId) === Number(courseId)) || null;
}

export function upsertDeferredLearningReward(entry: DeferredLearningReward) {
  const next = readQueue();
  const index = next.findIndex((item) => Number(item.courseId) === Number(entry.courseId));
  if (index >= 0) {
    next[index] = entry;
  } else {
    next.push(entry);
  }
  writeQueue(next);
  return entry;
}

export function removeDeferredLearningReward(courseId: number) {
  const next = readQueue().filter((item) => Number(item.courseId) !== Number(courseId));
  writeQueue(next);
}

function shouldDropFailedDeferredReward(code: string) {
  return new Set([
    'COURSE_NOT_FOUND',
    'INVALID_COURSE_ID',
  ]).has(code);
}

export async function flushDeferredLearningRewards(): Promise<FlushSummary> {
  const queue = readQueue();
  if (!queue.length) {
    return {
      settledCourseIds: [],
      totalAwarded: 0,
      duplicatedCount: 0,
      balance: null,
    };
  }

  const settledCourseIds: number[] = [];
  let totalAwarded = 0;
  let duplicatedCount = 0;
  let balance: number | null = null;

  for (const item of queue) {
    try {
      const resp = await api.completeCourse(item.courseId, item.payload, item.shareContext);
      settledCourseIds.push(item.courseId);
      if (resp.duplicated) duplicatedCount += 1;
      else totalAwarded += Number(resp.reward || 0);
      if (Number.isFinite(Number(resp.balance))) {
        balance = Number(resp.balance);
      }
    } catch (error: any) {
      const code = String(error?.code || error?.message || '').trim();
      if (code === 'UNAUTHORIZED' || code === 'NEED_BASIC_VERIFY') {
        break;
      }
      if (shouldDropFailedDeferredReward(code)) {
        settledCourseIds.push(item.courseId);
        continue;
      }
    }
  }

  if (settledCourseIds.length) {
    const pending = readQueue().filter((item) => !settledCourseIds.includes(Number(item.courseId)));
    writeQueue(pending);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(DEFERRED_LEARNING_REWARDS_FLUSHED_EVENT, {
          detail: {
            settledCourseIds,
            totalAwarded,
            duplicatedCount,
            balance,
          },
        })
      );
    }
  }

  return {
    settledCourseIds,
    totalAwarded,
    duplicatedCount,
    balance,
  };
}
