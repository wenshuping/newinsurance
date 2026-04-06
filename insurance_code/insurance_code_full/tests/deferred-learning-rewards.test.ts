import { beforeEach, describe, expect, it, vi } from 'vitest';

class MemoryStorage {
  private map = new Map<string, string>();

  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key)! : null;
  }

  setItem(key: string, value: string) {
    this.map.set(key, value);
  }

  removeItem(key: string) {
    this.map.delete(key);
  }

  clear() {
    this.map.clear();
  }
}

const completeCourseMock = vi.fn();

vi.mock('../src/lib/api', () => ({
  api: {
    completeCourse: (...args: any[]) => completeCourseMock(...args),
  },
}));

describe('deferred learning rewards', () => {
  beforeEach(() => {
    const localStorage = new MemoryStorage();
    Object.defineProperty(global, 'window', {
      configurable: true,
      value: {
        localStorage,
        location: {
          href: 'http://127.0.0.1:3003/learning?shareCode=share-now&fromShare=1&courseId=124',
          pathname: '/learning',
          search: '?shareCode=share-now&fromShare=1&courseId=124',
        },
        dispatchEvent: vi.fn(),
      },
    });
    Object.defineProperty(global, 'localStorage', {
      configurable: true,
      value: localStorage,
    });
    Object.defineProperty(global, 'CustomEvent', {
      configurable: true,
      value: class CustomEvent {
        type: string;
        detail: any;
        constructor(type: string, init?: any) {
          this.type = type;
          this.detail = init?.detail;
        }
      },
    });
    completeCourseMock.mockReset();
  });

  it('passes the stored share context when flushing deferred rewards', async () => {
    const { flushDeferredLearningRewards, upsertDeferredLearningReward } = await import('../src/lib/deferred-learning-rewards');

    upsertDeferredLearningReward({
      courseId: 124,
      title: '分享课程',
      points: 50,
      shareContext: {
        shareCode: 'share-124',
        fromShare: '1',
        courseId: 124,
      },
      payload: {
        completionSource: 'video',
        videoProgressPercent: 100,
        videoEnded: true,
      },
      createdAt: new Date().toISOString(),
    });

    completeCourseMock.mockResolvedValueOnce({
      duplicated: false,
      reward: 50,
      balance: 250,
    });

    await flushDeferredLearningRewards();

    expect(completeCourseMock).toHaveBeenCalledWith(
      124,
      expect.objectContaining({
        completionSource: 'video',
        videoProgressPercent: 100,
        videoEnded: true,
      }),
      expect.objectContaining({
        shareCode: 'share-124',
        fromShare: '1',
        courseId: 124,
      }),
    );
  });

  it('keeps deferred rewards queued when course access is temporarily unavailable', async () => {
    const {
      flushDeferredLearningRewards,
      getDeferredLearningReward,
      upsertDeferredLearningReward,
    } = await import('../src/lib/deferred-learning-rewards');

    upsertDeferredLearningReward({
      courseId: 124,
      title: '分享课程',
      points: 50,
      shareContext: {
        shareCode: 'share-124',
        fromShare: '1',
        courseId: 124,
      },
      payload: {
        completionSource: 'video',
        videoProgressPercent: 100,
        videoEnded: true,
      },
      createdAt: new Date().toISOString(),
    });

    completeCourseMock.mockRejectedValueOnce({ code: 'COURSE_NOT_AVAILABLE' });

    const summary = await flushDeferredLearningRewards();

    expect(summary.settledCourseIds).toEqual([]);
    expect(getDeferredLearningReward(124)).toBeTruthy();
  });
});
