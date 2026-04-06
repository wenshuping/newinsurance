import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../server/skeleton-c-v1/common/state.mjs', () => ({
  runInStateTransaction: vi.fn(async (executor: () => Promise<unknown> | unknown) => executor()),
  getBalance: vi.fn(() => 88),
  reloadStateFromStorage: vi.fn(async () => undefined),
}));

const repositoryMocks = vi.hoisted(() => ({
  findLearningCourseById: vi.fn(),
  findCourseCompletion: vi.fn(),
  createCourseCompletion: vi.fn(),
}));

vi.mock('../server/skeleton-c-v1/repositories/learning-write.repository.mjs', () => ({
  findLearningCourseById: repositoryMocks.findLearningCourseById,
  findCourseCompletion: repositoryMocks.findCourseCompletion,
  createCourseCompletion: repositoryMocks.createCourseCompletion,
}));

vi.mock('../server/skeleton-c-v1/common/template-visibility.mjs', () => ({
  canDeliverTemplateToActor: vi.fn(() => true),
}));

import {
  executeLearningComplete,
  LEARNING_ARTICLE_MIN_DWELL_SECONDS,
  LEARNING_VIDEO_COMPLETE_PROGRESS,
} from '../server/skeleton-c-v1/usecases/learning-complete.usecase.mjs';
import { reloadStateFromStorage } from '../server/skeleton-c-v1/common/state.mjs';
import { canDeliverTemplateToActor } from '../server/skeleton-c-v1/common/template-visibility.mjs';

beforeEach(() => {
  vi.clearAllMocks();
  repositoryMocks.findCourseCompletion.mockReturnValue(undefined);
  repositoryMocks.createCourseCompletion.mockReturnValue({
    id: 1,
    userId: 900,
    courseId: 5,
    pointsAwarded: 12,
  });
});

function createCommand(overrides: Record<string, unknown> = {}) {
  return {
    courseId: 5,
    userId: 900,
    actor: { tenantId: 2, actorId: 900, role: 'customer' },
    tenantCode: 'tenant-alpha',
    traceId: 'trace-1',
    requestId: 'req-1',
    ...overrides,
  };
}

describe('executeLearningComplete', () => {
  it('rejects video rewards before the watch threshold is reached', async () => {
    repositoryMocks.findLearningCourseById.mockReturnValue({
      state: {},
      course: { id: 5, title: '视频课', points: 12, type: 'video', contentType: 'video', sourceType: 'native' },
    });

    await expect(
      executeLearningComplete(createCommand({ completionSource: 'video', videoProgressPercent: LEARNING_VIDEO_COMPLETE_PROGRESS - 1 }), {
        settleReward: vi.fn(),
      }) as any,
    ).rejects.toThrow('COURSE_VIDEO_NOT_COMPLETED');

    expect(repositoryMocks.createCourseCompletion).not.toHaveBeenCalled();
  });

  it('rejects article rewards before dwell time reaches 30 seconds', async () => {
    repositoryMocks.findLearningCourseById.mockReturnValue({
      state: {},
      course: { id: 5, title: '文案课', points: 20, type: 'article', contentType: 'article' },
    });

    await expect(
      executeLearningComplete(
        createCommand({
          completionSource: 'article',
          articleReachedEnd: true,
          articleDwellSeconds: LEARNING_ARTICLE_MIN_DWELL_SECONDS - 1,
        }),
        { settleReward: vi.fn() },
      ) as any,
    ).rejects.toThrow('COURSE_ARTICLE_DWELL_TOO_SHORT');

    expect(repositoryMocks.createCourseCompletion).not.toHaveBeenCalled();
  });

  it('rejects article rewards when the article has not been fully browsed', async () => {
    repositoryMocks.findLearningCourseById.mockReturnValue({
      state: {},
      course: { id: 5, title: '文案课', points: 20, type: 'article', contentType: 'article' },
    });

    await expect(
      executeLearningComplete(
        createCommand({
          completionSource: 'article',
          articleReachedEnd: false,
          articleDwellSeconds: LEARNING_ARTICLE_MIN_DWELL_SECONDS,
        }),
        { settleReward: vi.fn() },
      ) as any,
    ).rejects.toThrow('COURSE_ARTICLE_NOT_FINISHED');
  });

  it('awards points after a video is completed', async () => {
    const settleReward = vi.fn(async () => ({ balance: 128 }));
    repositoryMocks.findLearningCourseById.mockReturnValue({
      state: {},
      course: { id: 5, title: '视频课', points: 12, type: 'video', contentType: 'video', sourceType: 'native' },
    });

    const result = await executeLearningComplete(
      createCommand({
        completionSource: 'video',
        videoProgressPercent: LEARNING_VIDEO_COMPLETE_PROGRESS,
        videoWatchedSeconds: 301,
        videoDurationSeconds: 302,
        videoEnded: true,
      }),
      { settleReward },
    );

    expect(repositoryMocks.createCourseCompletion).toHaveBeenCalledWith({
      userId: 900,
      courseId: 5,
      pointsAwarded: 12,
    });
    expect(settleReward).toHaveBeenCalledTimes(1);
    expect(reloadStateFromStorage).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      duplicated: false,
      reward: 12,
      balance: 128,
    });
  });

  it('allows completing a shared course even when the customer does not directly own the template', async () => {
    const settleReward = vi.fn(async () => ({ balance: 138 }));
    vi.mocked(canDeliverTemplateToActor).mockReturnValueOnce(false);
    repositoryMocks.findLearningCourseById.mockReturnValue({
      state: {},
      course: { id: 5, title: '分享视频课', points: 12, type: 'video', contentType: 'video', sourceType: 'native' },
    });

    const result = await executeLearningComplete(
      createCommand({
        shareCode: 'share-abc',
        completionSource: 'video',
        videoProgressPercent: LEARNING_VIDEO_COMPLETE_PROGRESS,
        videoWatchedSeconds: 180,
        videoDurationSeconds: 180,
        videoEnded: true,
      }),
      {
        settleReward,
        resolveSharedCourseByShare: vi.fn(() => ({ id: 5 })),
      },
    );

    expect(settleReward).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      duplicated: false,
      reward: 12,
      balance: 138,
    });
  });

  it('awards points after an article is fully read for 30 seconds', async () => {
    const settleReward = vi.fn(async () => ({ balance: 256 }));
    repositoryMocks.findLearningCourseById.mockReturnValue({
      state: {},
      course: { id: 5, title: '文案课', points: 20, type: 'article', contentType: 'article' },
    });

    const result = await executeLearningComplete(
      createCommand({
        completionSource: 'article',
        articleReachedEnd: true,
        articleDwellSeconds: LEARNING_ARTICLE_MIN_DWELL_SECONDS,
      }),
      { settleReward },
    );

    expect(repositoryMocks.createCourseCompletion).toHaveBeenCalledWith({
      userId: 900,
      courseId: 5,
      pointsAwarded: 20,
    });
    expect(result).toMatchObject({
      duplicated: false,
      reward: 20,
      balance: 256,
    });
  });

  it('allows video courses to be completed via article reading evidence', async () => {
    const settleReward = vi.fn(async () => ({ balance: 168 }));
    repositoryMocks.findLearningCourseById.mockReturnValue({
      state: {},
      course: { id: 5, title: '视频课', points: 12, type: 'video', contentType: 'video', sourceType: 'native' },
    });

    const result = await executeLearningComplete(
      createCommand({
        completionSource: 'article',
        articleReachedEnd: true,
        articleDwellSeconds: LEARNING_ARTICLE_MIN_DWELL_SECONDS,
      }),
      { settleReward },
    );

    expect(repositoryMocks.createCourseCompletion).toHaveBeenCalledWith({
      userId: 900,
      courseId: 5,
      pointsAwarded: 12,
    });
    expect(result).toMatchObject({
      duplicated: false,
      reward: 12,
      balance: 168,
    });
  });

  it('treats uploaded video media as video even when stale rows still say article', async () => {
    const settleReward = vi.fn(async () => ({ balance: 188 }));
    repositoryMocks.findLearningCourseById.mockReturnValue({
      state: {},
      course: {
        id: 5,
        title: '2024年人寿保险最新理赔指南',
        points: 50,
        type: 'article',
        contentType: 'article',
        sourceType: 'native',
        media: [
          {
            name: 'claim-guide.mp4',
            type: 'video/mp4',
            preview: 'http://127.0.0.1:4000/uploads/tenant_2/claim-guide.mp4',
          },
        ],
      },
    });

    const result = await executeLearningComplete(
      createCommand({
        completionSource: 'video',
        videoProgressPercent: LEARNING_VIDEO_COMPLETE_PROGRESS,
        videoWatchedSeconds: 35,
        videoDurationSeconds: 35,
        videoEnded: true,
      }),
      { settleReward },
    );

    expect(result).toMatchObject({
      duplicated: false,
      reward: 50,
      balance: 188,
    });
  });

  it('repairs missing learning reward when completion exists but points transaction is absent', async () => {
    const settleReward = vi.fn(async () => ({ balance: 245 }));
    repositoryMocks.findLearningCourseById.mockReturnValue({
      state: {
        pointTransactions: [],
      },
      course: { id: 5, title: '补发课程', points: 7, type: 'article', contentType: 'article' },
    });
    repositoryMocks.findCourseCompletion.mockReturnValue({
      id: 99,
      userId: 900,
      courseId: 5,
      pointsAwarded: 7,
    });

    const result = await executeLearningComplete(
      createCommand({
        completionSource: 'article',
        articleReachedEnd: true,
        articleDwellSeconds: LEARNING_ARTICLE_MIN_DWELL_SECONDS,
      }),
      { settleReward },
    );

    expect(repositoryMocks.createCourseCompletion).not.toHaveBeenCalled();
    expect(settleReward).toHaveBeenCalledTimes(1);
    expect(reloadStateFromStorage).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      duplicated: false,
      reward: 7,
      balance: 245,
    });
  });

  it('does not settle reward again when completion and learning points transaction already exist', async () => {
    const settleReward = vi.fn(async () => ({ balance: 999 }));
    repositoryMocks.findLearningCourseById.mockReturnValue({
      state: {
        pointTransactions: [
          {
            id: 1,
            idempotencyKey: 'learning-reward:2:900:5',
            userId: 900,
            source: 'course_complete',
          },
        ],
      },
      course: { id: 5, title: '已领奖课程', points: 7, type: 'article', contentType: 'article' },
    });
    repositoryMocks.findCourseCompletion.mockReturnValue({
      id: 100,
      userId: 900,
      courseId: 5,
      pointsAwarded: 7,
    });

    const result = await executeLearningComplete(
      createCommand({
        completionSource: 'article',
        articleReachedEnd: true,
        articleDwellSeconds: LEARNING_ARTICLE_MIN_DWELL_SECONDS,
      }),
      { settleReward },
    );

    expect(repositoryMocks.createCourseCompletion).not.toHaveBeenCalled();
    expect(settleReward).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      duplicated: true,
      reward: 0,
      balance: 88,
    });
  });
});
