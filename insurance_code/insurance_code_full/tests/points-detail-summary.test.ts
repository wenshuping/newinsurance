import { describe, expect, it } from 'vitest';
import { createPointDetailContext, normalizeTransaction } from '../server/skeleton-c-v1/routes/points.routes.mjs';

describe('points detail transaction summary', () => {
  const context = createPointDetailContext({
    learningCourses: [{ id: 122, title: '家庭保单诊断入门' }],
    activities: [{ id: 57, title: '实名资料完善' }],
    mallActivities: [{ id: 91, title: '春日抽奖活动' }],
    pProducts: [{ id: 410, name: '高端体检套餐' }],
    orders: [{ id: 314, productId: 410, productName: '' }],
  });

  it('formats onboarding reward as clear income source', () => {
    expect(
      normalizeTransaction(
        {
          id: 1,
          source: 'onboard',
          type: 'earn',
          amount: 200,
          createdAt: '2026-03-30T21:18:00.000Z',
        },
        context,
      ),
    ).toMatchObject({
      title: '新用户实名奖励',
      detail: '收入来源：完成基础身份确认',
      direction: 'in',
    });
  });

  it('formats share reward as clear income source', () => {
    expect(
      normalizeTransaction(
        {
          id: 2,
          source: 'customer_share_identify',
          type: 'earn',
          amount: 10,
          createdAt: '2026-03-30T21:19:00.000Z',
        },
        context,
      ),
    ).toMatchObject({
      title: '分享好友实名奖励',
      detail: '收入来源：好友通过你的分享完成实名',
      direction: 'in',
    });
  });

  it('formats course reward with the concrete title', () => {
    expect(
      normalizeTransaction(
        {
          id: 3,
          source: 'course_complete',
          sourceId: '122',
          type: 'earn',
          amount: 20,
          createdAt: '2026-03-30T21:20:00.000Z',
        },
        context,
      ),
    ).toMatchObject({
      title: '知识学习奖励',
      detail: '收入来源：完成《家庭保单诊断入门》',
      direction: 'in',
    });
  });

  it('formats activity reward with the concrete title', () => {
    expect(
      normalizeTransaction(
        {
          id: 4,
          source: 'activity_task',
          sourceId: '57',
          type: 'earn',
          amount: 30,
          createdAt: '2026-03-30T21:21:00.000Z',
        },
        context,
      ),
    ).toMatchObject({
      title: '活动奖励',
      detail: '收入来源：完成《实名资料完善》',
      direction: 'in',
    });
  });

  it('formats mall redeem as clear expense source', () => {
    expect(
      normalizeTransaction(
        {
          id: 5,
          source: 'order_pay',
          sourceId: '314',
          type: 'consume',
          amount: 99,
          createdAt: '2026-03-30T21:22:00.000Z',
        },
        context,
      ),
    ).toMatchObject({
      title: '商品兑换',
      detail: '支出来源：兑换《高端体检套餐》',
      direction: 'out',
    });
  });

  it('formats mall refund as clear income source', () => {
    expect(
      normalizeTransaction(
        {
          id: 6,
          source: 'order_refund',
          sourceId: '314',
          type: 'earn',
          amount: 99,
          createdAt: '2026-03-30T21:23:00.000Z',
        },
        context,
      ),
    ).toMatchObject({
      title: '退款积分返还',
      detail: '收入来源：《高端体检套餐》退款返还',
      direction: 'in',
    });
  });
});
