import { describe, expect, it } from 'vitest';
import { summarizeBehaviorEvent } from '../server/skeleton-c-v1/routes/b-admin.shared.mjs';

describe('summarizeBehaviorEvent', () => {
  it('formats learning page views with the concrete course title', () => {
    const state = {
      learningCourses: [{ id: 122, title: '家庭保单诊断入门', category: '家庭保障' }],
      mallItems: [],
      activities: [],
      mallActivities: [],
      bCustomerActivities: [],
      orders: [],
    };

    const result = summarizeBehaviorEvent(state, {
      event: 'c_page_view',
      source: 'c-web',
      path: '/learning?courseId=122&tab=learning',
      properties: { tab: 'learning', authed: true },
    });

    expect(result).toEqual({
      title: '查看知识学习：家庭保单诊断入门',
      detail: '栏目：课程学习',
    });
  });

  it('formats learning enter events without exposing raw tracking parameters', () => {
    const result = summarizeBehaviorEvent(
      {
        learningCourses: [],
        mallItems: [],
        activities: [],
        mallActivities: [],
        bCustomerActivities: [],
        orders: [],
      },
      {
        event: 'c_learning_enter',
        source: 'c-web',
        path: '/learning?tab=games',
        properties: { tab: 'games', authed: true },
      },
    );

    expect(result).toEqual({
      title: '进入知识学习 · 趣味游戏',
      detail: '知识学习页',
    });
  });

  it('formats learning enter events with the concrete course title when courseId is present', () => {
    const state = {
      learningCourses: [{ id: 122, title: '家庭保单诊断入门', category: '家庭保障' }],
      mallItems: [],
      activities: [],
      mallActivities: [],
      bCustomerActivities: [],
      orders: [],
    };

    const result = summarizeBehaviorEvent(state, {
      event: 'c_learning_enter',
      source: 'c-web',
      path: '/learning?courseId=122&tab=learning',
      properties: { tab: 'learning', courseId: 122, authed: true },
    });

    expect(result).toEqual({
      title: '进入知识学习：家庭保单诊断入门',
      detail: '分类：家庭保障',
    });
  });

  it('formats activity detail views with the concrete activity title', () => {
    const state = {
      learningCourses: [],
      mallItems: [],
      activities: [{ id: 57, title: '实名调试_1773235381866' }],
      mallActivities: [],
      bCustomerActivities: [],
      orders: [],
    };

    const result = summarizeBehaviorEvent(state, {
      event: 'c_activity_detail_view',
      source: 'c-web',
      path: '/activities?activityId=57',
      properties: { activityId: 57, category: 'task' },
    });

    expect(result).toEqual({
      title: '查看活动详情：实名调试_1773235381866',
      detail: '活动中心页',
    });
  });

  it('formats mall product detail events with the concrete product title', () => {
    const state = {
      learningCourses: [],
      mallItems: [{ id: 410, sourceProductId: 410, name: '高端体检套餐' }],
      activities: [],
      mallActivities: [],
      bCustomerActivities: [],
      orders: [],
    };

    const result = summarizeBehaviorEvent(state, {
      event: 'c_mall_open_product_detail',
      source: 'c-web',
      path: '/mall',
      properties: { itemId: 410, authed: true },
    });

    expect(result).toEqual({
      title: '查看商品详情：高端体检套餐',
      detail: '积分商城页',
    });
  });

  it('formats mall page views with itemId as concrete product detail views', () => {
    const state = {
      learningCourses: [],
      mallItems: [{ id: 410, sourceProductId: 410, name: '高端体检套餐' }],
      activities: [],
      mallActivities: [],
      bCustomerActivities: [],
      orders: [],
    };

    const result = summarizeBehaviorEvent(state, {
      event: 'c_page_view',
      source: 'c-web',
      path: '/mall?itemId=410',
      properties: { tab: 'mall', authed: true },
    });

    expect(result).toEqual({
      title: '查看商品详情：高端体检套餐',
      detail: '积分商城页',
    });
  });

  it('formats mall product detail events with concrete product title from pProducts', () => {
    const state = {
      learningCourses: [],
      mallItems: [],
      pProducts: [{ id: 911, name: '限量咖啡礼盒' }],
      activities: [],
      mallActivities: [],
      bCustomerActivities: [],
      orders: [],
    };

    const result = summarizeBehaviorEvent(state, {
      event: 'c_mall_open_product_detail',
      source: 'c-web',
      path: '/mall?itemId=911',
      properties: { itemId: 911, authed: true },
    });

    expect(result).toEqual({
      title: '查看商品详情：限量咖啡礼盒',
      detail: '积分商城页',
    });
  });

  it('formats mall redeem events with concrete product title from pProducts', () => {
    const state = {
      learningCourses: [],
      mallItems: [],
      pProducts: [{ id: 911, name: '限量咖啡礼盒' }],
      activities: [],
      mallActivities: [],
      bCustomerActivities: [],
      orders: [{ id: 314, productId: 911, productName: '' }],
    };

    const result = summarizeBehaviorEvent(state, {
      event: 'c_mall_redeem_success',
      source: 'c-web',
      path: '/mall',
      properties: { itemId: 911, orderId: 314, authed: true },
    });

    expect(result).toEqual({
      title: '兑换商品成功',
      detail: '来源:c-web | 页面:积分商城页 | 商品:限量咖啡礼盒 | itemId=911 · orderId=314 · authed=true',
    });
  });

  it('formats learning browse duration events with the concrete title and stay length', () => {
    const state = {
      learningCourses: [{ id: 122, title: '视频测试', category: '通用培训' }],
      mallItems: [],
      activities: [],
      mallActivities: [],
      bCustomerActivities: [],
      orders: [],
    };

    const result = summarizeBehaviorEvent(state, {
      event: 'c_learning_browse_duration',
      source: 'c-web',
      path: '/learning?courseId=122',
      properties: { courseId: 122, courseTitle: '视频测试', category: '通用培训', durationSeconds: 95 },
    });

    expect(result).toEqual({
      title: '查看知识学习：视频测试',
      detail: '学习时长：1分35秒',
    });
  });

  it('formats activity browse duration events with the concrete title and stay length', () => {
    const state = {
      learningCourses: [],
      mallItems: [],
      activities: [{ id: 57, title: '实名调试_1773235381866' }],
      mallActivities: [],
      bCustomerActivities: [],
      orders: [],
    };

    const result = summarizeBehaviorEvent(state, {
      event: 'c_activity_browse_duration',
      source: 'c-web',
      path: '/activities?activityId=57',
      properties: { activityId: 57, activityTitle: '实名调试_1773235381866', durationSeconds: 72 },
    });

    expect(result).toEqual({
      title: '浏览活动：实名调试_1773235381866',
      detail: '浏览时长：1分12秒',
    });
  });
});
