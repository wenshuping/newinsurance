import { beforeEach, describe, expect, it, vi } from 'vitest';

let mockState = {
  pProducts: [],
  mallActivities: [],
  bCustomerActivities: [],
  activityCompletions: [],
};

vi.mock('../server/skeleton-c-v1/common/state.mjs', () => ({
  getState: () => mockState,
}));

vi.mock('../server/skeleton-c-v1/common/template-visibility.mjs', () => ({
  canDeliverTemplateToActor: () => true,
}));

import { listMallActivities, listMallItems } from '../server/skeleton-c-v1/usecases/mall-query.usecase.mjs';

const req = {
  protocol: 'http',
  get: () => '127.0.0.1:4100',
  user: null,
};

describe('mall query sort', () => {
  beforeEach(() => {
    mockState = {
      pProducts: [
        {
          id: 12,
          title: '旧商品',
          status: 'active',
          updatedAt: '2026-03-19T08:00:00.000Z',
          createdAt: '2026-03-18T08:00:00.000Z',
        },
        {
          id: 11,
          title: '新商品',
          status: 'active',
          updatedAt: '2026-03-20T08:00:00.000Z',
          createdAt: '2026-03-18T08:00:00.000Z',
        },
      ],
      mallActivities: [
        {
          id: 22,
          title: '旧商城活动',
          status: 'active',
          updatedAt: '2026-03-19T08:00:00.000Z',
          createdAt: '2026-03-18T08:00:00.000Z',
        },
        {
          id: 21,
          title: '新商城活动',
          status: 'active',
          updatedAt: '2026-03-20T08:00:00.000Z',
          createdAt: '2026-03-18T08:00:00.000Z',
        },
      ],
      bCustomerActivities: [],
      activityCompletions: [],
    };
  });

  it('returns mall items sorted by effective time descending', () => {
    const payload = listMallItems({
      actor: { actorType: 'customer', actorId: 1, tenantId: 2 },
      req,
    });

    expect(payload.items.map((item) => item.id)).toEqual([11, 12]);
  });

  it('returns mall activities sorted by effective time descending', () => {
    const payload = listMallActivities({
      actor: { actorType: 'customer', actorId: 1, tenantId: 2 },
      req,
    });

    expect(payload.list.map((item) => item.id)).toEqual([21, 22]);
  });
});
