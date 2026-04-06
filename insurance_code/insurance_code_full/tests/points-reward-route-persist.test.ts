import { beforeEach, describe, expect, it, vi } from 'vitest';

const learningContractMocks = vi.hoisted(() => ({
  settleLearningCourseReward: vi.fn(),
}));

const activityContractMocks = vi.hoisted(() => ({
  settleActivityReward: vi.fn(),
}));

const stateMocks = vi.hoisted(() => ({
  reloadStateFromStorage: vi.fn(async () => undefined),
  persistPointTransactionsByIds: vi.fn(async () => undefined),
}));

vi.mock('../server/microservices/points-service/learning-reward.contract.mjs', () => ({
  settleLearningCourseReward: learningContractMocks.settleLearningCourseReward,
}));

vi.mock('../server/microservices/points-service/activity-reward.contract.mjs', () => ({
  settleActivityReward: activityContractMocks.settleActivityReward,
}));

vi.mock('../server/skeleton-c-v1/common/state.mjs', () => ({
  reloadStateFromStorage: stateMocks.reloadStateFromStorage,
  persistPointTransactionsByIds: stateMocks.persistPointTransactionsByIds,
}));

import { registerLearningRewardContractRoute } from '../server/microservices/points-service/learning-reward.route.mjs';
import { registerActivityRewardContractRoute } from '../server/microservices/points-service/activity-reward.route.mjs';

function createRouterHarness() {
  const routes = new Map();
  return {
    routes,
    post(path: string, ...handlers: Array<(req: any, res: any, next?: () => void) => unknown>) {
      routes.set(path, handlers);
    },
  };
}

async function invokeRoute(handlers: Array<(req: any, res: any, next?: () => void) => unknown>, req: any) {
  const res = {
    statusCode: 200,
    body: null as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };

  let index = 0;
  const run = async () => {
    const handler = handlers[index++];
    if (!handler) return;
    await handler(req, res, () => run());
  };
  await run();
  return res;
}

describe('points reward contract routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persists learning reward state after successful settlement', async () => {
    learningContractMocks.settleLearningCourseReward.mockReturnValue({
      ok: true,
      duplicated: false,
      reward: 50,
      balance: 245,
      transactionId: 1703,
    });

    const router = createRouterHarness();
    registerLearningRewardContractRoute(router as any);

    const res = await invokeRoute(
      router.routes.get('/internal/points-service/learning-rewards/settle'),
      {
        tenantContext: { tenantId: 2 },
        body: { tenantId: 2, userId: 9, courseId: 124, courseTitle: '测试课程', rewardPoints: 50 },
        headers: { 'x-internal-service': 'learning-service' },
      },
    );

    expect(learningContractMocks.settleLearningCourseReward).toHaveBeenCalledTimes(1);
    expect(stateMocks.reloadStateFromStorage).toHaveBeenCalledTimes(1);
    expect(stateMocks.persistPointTransactionsByIds).toHaveBeenCalledWith([1703]);
    expect(res.statusCode).toBe(200);
  });

  it('persists activity reward state after successful settlement', async () => {
    activityContractMocks.settleActivityReward.mockReturnValue({
      ok: true,
      duplicated: false,
      reward: 10,
      balance: 210,
      transactionId: 1704,
    });

    const router = createRouterHarness();
    registerActivityRewardContractRoute(router as any);

    const res = await invokeRoute(
      router.routes.get('/internal/points-service/activity-rewards/settle'),
      {
        tenantContext: { tenantId: 2 },
        body: { tenantId: 2, userId: 9, activityId: 70, activityTitle: '测试活动', rewardPoints: 10 },
        headers: { 'x-internal-service': 'activity-service' },
      },
    );

    expect(activityContractMocks.settleActivityReward).toHaveBeenCalledTimes(1);
    expect(stateMocks.reloadStateFromStorage).toHaveBeenCalledTimes(1);
    expect(stateMocks.persistPointTransactionsByIds).toHaveBeenCalledWith([1704]);
    expect(res.statusCode).toBe(200);
  });
});
