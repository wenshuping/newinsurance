import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { settleActivityRewardViaPointsService } from '../server/skeleton-c-v1/services/activity-reward.service.mjs';

describe('settleActivityRewardViaPointsService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.ACTIVITY_POINTS_HTTP_RETRY_COUNT = '2';
    process.env.ACTIVITY_POINTS_HTTP_RETRY_DELAY_MS = '0';
  });

  afterEach(() => {
    delete process.env.ACTIVITY_POINTS_HTTP_RETRY_COUNT;
    delete process.env.ACTIVITY_POINTS_HTTP_RETRY_DELAY_MS;
  });

  it('retries once when the points upstream is temporarily unavailable', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('socket hang up'))
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            ok: true,
            duplicated: false,
            reward: 9,
            balance: 209,
            transactionId: 1735,
          }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const result = await settleActivityRewardViaPointsService({
      tenantId: 2,
      tenantCode: null,
      userId: 938,
      activityId: 70,
      activityTitle: '活动70',
      rewardPoints: 9,
      completionDate: '2026-04-02',
      traceId: 'trace-1',
      requestId: 'req-1',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      ok: true,
      reward: 9,
      balance: 209,
    });
  });
});
