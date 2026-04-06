import { describe, expect, it, vi } from 'vitest';
import { buildExchangeViewModels, pickLatestPendingExchange } from '../src/lib/exchange-view-model';

describe('exchange-view-model', () => {
  it('hydrates exchange rows from redemptions and orders consistently', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-03T10:00:00+08:00'));

    const exchanges = buildExchangeViewModels(
      [
        {
          id: 11,
          orderId: 101,
          itemName: '春日礼盒',
          pointsCost: 9,
          status: 'pending',
          writeoffToken: 'TK11',
          expiresAt: '2026-05-01T00:00:00+08:00',
          createdAt: '2026-03-30T09:30:00+08:00',
        },
      ],
      [
        {
          id: 101,
          orderNo: 'ACT-101',
          productName: '春日礼盒',
          pointsAmount: 9,
          paymentStatus: 'paid',
          createdAt: '2026-03-30T09:30:00+08:00',
        },
      ],
    );

    expect(exchanges).toHaveLength(1);
    expect(exchanges[0]).toMatchObject({
      id: 11,
      orderId: 101,
      name: '春日礼盒',
      points: 9,
      status: '待核销',
      orderStatus: '待核销',
      orderNo: 'ACT-101',
    });

    vi.useRealTimers();
  });

  it('picks the latest pending exchange for the profile preview', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-03T10:00:00+08:00'));

    const exchanges = buildExchangeViewModels(
      [
        {
          id: 12,
          orderId: 201,
          itemName: '旧兑换',
          status: 'pending',
          writeoffToken: 'TK12',
          expiresAt: '2026-05-01T00:00:00+08:00',
          createdAt: '2026-03-29T09:30:00+08:00',
        },
        {
          id: 13,
          orderId: 202,
          itemName: '新兑换',
          status: 'pending',
          writeoffToken: 'TK13',
          expiresAt: '2026-05-02T00:00:00+08:00',
          createdAt: '2026-03-30T09:30:00+08:00',
        },
      ],
      [],
    );

    expect(pickLatestPendingExchange(exchanges)?.name).toBe('新兑换');

    vi.useRealTimers();
  });
});
