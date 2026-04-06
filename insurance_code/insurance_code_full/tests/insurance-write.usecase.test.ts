import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../server/skeleton-c-v1/common/state.mjs', () => ({
  runInStateTransaction: vi.fn(async (executor: () => Promise<unknown> | unknown) => executor()),
}));

const analysisMocks = vi.hoisted(() => ({
  analyzeInsurancePolicyResponsibilities: vi.fn(),
  mapAnalysisToPolicyResponsibilities: vi.fn(),
  sanitizeStoredPolicyAnalysis: vi.fn((value) => value),
}));

vi.mock('../server/skeleton-c-v1/services/policy-analysis.service.mjs', () => ({
  analyzeInsurancePolicyResponsibilities: analysisMocks.analyzeInsurancePolicyResponsibilities,
  mapAnalysisToPolicyResponsibilities: analysisMocks.mapAnalysisToPolicyResponsibilities,
  sanitizeStoredPolicyAnalysis: analysisMocks.sanitizeStoredPolicyAnalysis,
}));

import {
  executeCreateInsurancePolicy,
  executeUpdateInsurancePolicy,
} from '../server/skeleton-c-v1/usecases/insurance-write.usecase.mjs';

beforeEach(() => {
  vi.clearAllMocks();
});

function createBaseCommand(overrides: Record<string, unknown> = {}) {
  return {
    company: '中国平安保险',
    name: '享享人生（825）',
    applicant: '秦国英',
    applicantRelation: '配偶',
    insured: '杜金坤',
    insuredRelation: '本人',
    date: '2010-12-20',
    paymentPeriod: '10年交',
    coveragePeriod: '42年',
    amount: 120000,
    firstPremium: 12000,
    customerId: 9,
    userId: 8003,
    actorType: 'employee',
    tenantId: 2,
    nextId: (list: Array<{ id?: number }>) => (list.length ? Math.max(...list.map((item) => Number(item.id || 0))) + 1 : 1),
    persistPoliciesByIds: vi.fn(),
    persistState: vi.fn(),
    inferPolicyType: () => '保障',
    nextPaymentDate: () => '2011-12-20',
    calcPeriodEnd: () => '2052-12-19',
    defaultResponsibilities: () => [{ name: '默认责任', desc: 'fallback', limit: 120000 }],
    refreshInsuranceSummaryFromState: vi.fn(),
    ...overrides,
  };
}

async function waitForAssertion(assertion: () => void, retries = 20) {
  let lastError: unknown;
  for (let index = 0; index < retries; index += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  throw lastError;
}

describe('executeCreateInsurancePolicy', () => {
  it('stores provided analysis immediately and skips async re-analysis', async () => {
    const state = { policies: [] as Array<Record<string, unknown>> };
    const command = createBaseCommand({
      getState: () => state,
      analysis: {
        productOverview: '录入页已完成责任概述',
        coreFeature: '录入页已完成核心特点',
        coverageTable: [{ coverageType: '意外身故保险金', scenario: '意外身故', payout: '基本保额10倍', note: '录入页分析结果' }],
        exclusions: ['录入页免责提醒'],
        purchaseAdvice: '录入页投保建议',
        disclaimer: '录入页免责声明',
        model: 'deepseek-chat',
        generatedAt: '2026-03-25T01:00:00.000Z',
      },
      defaultResponsibilities: () => [{ name: '默认责任', desc: 'fallback', limit: 120000 }],
    });

    analysisMocks.mapAnalysisToPolicyResponsibilities.mockReturnValueOnce([
      { name: '意外身故保险金', desc: '意外身故；录入页分析结果', limit: 1200000 },
    ]);

    const result = await executeCreateInsurancePolicy(command as any);

    expect(analysisMocks.analyzeInsurancePolicyResponsibilities).not.toHaveBeenCalled();
    expect(analysisMocks.mapAnalysisToPolicyResponsibilities).toHaveBeenCalledWith(command.analysis, {
      amount: 120000,
      firstPremium: 12000,
    });
    expect(result.policy.analysis).toMatchObject({
      productOverview: '录入页已完成责任概述',
      coreFeature: '录入页已完成核心特点',
      generatedAt: '2026-03-25T01:00:00.000Z',
    });
    expect(result.policy.responsibilities).toEqual([{ name: '意外身故保险金', desc: '意外身故；录入页分析结果', limit: 1200000 }]);
    expect(state.policies[0]?.analysis).toMatchObject({
      productOverview: '录入页已完成责任概述',
      coreFeature: '录入页已完成核心特点',
    });
  });

  it('creates a policy immediately and backfills analyzed responsibilities asynchronously', async () => {
    const state = { policies: [] as Array<Record<string, unknown>> };
    const command = createBaseCommand({ getState: () => state });

    let resolveAnalysis: (value: unknown) => void = () => undefined;
    analysisMocks.analyzeInsurancePolicyResponsibilities.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveAnalysis = resolve;
      }),
    );
    analysisMocks.mapAnalysisToPolicyResponsibilities.mockReturnValueOnce([
      { name: '满期生存保险金', desc: '合同期满生存；测试', limit: 12000 },
    ]);

    const result = await Promise.race([
      executeCreateInsurancePolicy(command as any),
      new Promise((_, reject) => setTimeout(() => reject(new Error('create timed out')), 50)),
    ]);

    expect(result.policy.responsibilities).toEqual([{ name: '默认责任', desc: 'fallback', limit: 120000 }]);
    expect(state.policies[0]?.responsibilities).toEqual([{ name: '默认责任', desc: 'fallback', limit: 120000 }]);
    expect(analysisMocks.analyzeInsurancePolicyResponsibilities).toHaveBeenCalledWith({
      policy: {
        company: '中国平安保险',
        name: '享享人生（825）',
        date: '2010-12-20',
        amount: 120000,
        firstPremium: 12000,
      },
    });

    resolveAnalysis({
      productOverview: '这是一份测试概述',
      coreFeature: '这是一份测试特点',
      coverageTable: [
        {
          coverageType: '满期生存保险金',
          scenario: '合同期满生存',
          payout: '返还实际交纳的保费',
          note: '测试',
        },
      ],
      exclusions: ['测试免责'],
      purchaseAdvice: '测试建议',
      disclaimer: '测试提示',
      model: 'deepseek-chat',
      generatedAt: '2026-03-24T10:00:00.000Z',
    });

    await waitForAssertion(() => {
      expect(analysisMocks.mapAnalysisToPolicyResponsibilities).toHaveBeenCalledTimes(1);
      expect(state.policies[0]?.responsibilities).toEqual([{ name: '满期生存保险金', desc: '合同期满生存；测试', limit: 12000 }]);
      expect(state.policies[0]?.analysis).toMatchObject({
        productOverview: '这是一份测试概述',
        coreFeature: '这是一份测试特点',
        exclusions: ['测试免责'],
        purchaseAdvice: '测试建议',
        model: 'deepseek-chat',
        generatedAt: '2026-03-24T10:00:00.000Z',
      });
    });
  });

  it('requires customerId when an employee creates a policy', async () => {
    const state = { policies: [] as Array<Record<string, unknown>> };
    const command = createBaseCommand({
      customerId: 0,
      getState: () => state,
    });

    await expect(executeCreateInsurancePolicy(command as any)).rejects.toMatchObject({
      code: 'POLICY_CUSTOMER_REQUIRED',
    });
    expect(state.policies).toHaveLength(0);
  });

  it('stores tenantId and customerId when an employee creates a policy for a customer', async () => {
    const state = { policies: [] as Array<Record<string, unknown>> };
    const command = createBaseCommand({
      getState: () => state,
      defaultResponsibilities: () => [],
    });

    analysisMocks.analyzeInsurancePolicyResponsibilities.mockRejectedValueOnce(new Error('upstream failed'));

    const result = await executeCreateInsurancePolicy(command as any);

    expect(result).toMatchObject({
      ok: true,
      policy: {
        id: 1,
        tenantId: 2,
        customerId: 9,
        createdBy: 8003,
      },
    });
    expect(state.policies).toHaveLength(1);
  });
});

describe('executeUpdateInsurancePolicy', () => {
  it('stores provided analysis immediately on update and skips async re-analysis', async () => {
    const state = {
      policies: [
        {
          id: 11,
          tenantId: 2,
          customerId: 9,
          company: '新华保险',
          name: '旧产品',
          type: '保障',
          amount: 120000,
          nextPayment: '2025-01-01',
          status: '保障中',
          applicant: '秦国英',
          applicantRelation: '配偶',
          insured: '杜金坤',
          insuredRelation: '本人',
          periodStart: '2024-01-01',
          periodEnd: '终身',
          annualPremium: 12000,
          paymentPeriod: '10年',
          coveragePeriod: '终身',
          responsibilities: [{ name: '旧责任', desc: 'old', limit: 1 }],
          analysis: null,
          paymentHistory: [],
          createdBy: 8003,
          createdAt: '2026-03-24T00:00:00.000Z',
        },
      ],
    };
    const command = createBaseCommand({
      getState: () => state,
      policyId: 11,
      company: '新华保险',
      name: '畅行万里臻享版两全保险',
      date: '2024-02-02',
      amount: 100000,
      firstPremium: 3000,
      paymentPeriod: '5年',
      coveragePeriod: '终身',
      analysis: {
        productOverview: '更新页已完成责任概述',
        coreFeature: '更新页已完成核心特点',
        coverageTable: [{ coverageType: '满期生存保险金', scenario: '保险期满生存', payout: '返还已交保费', note: '更新页分析结果' }],
        exclusions: ['更新页免责提醒'],
        purchaseAdvice: '更新页投保建议',
        disclaimer: '更新页免责声明',
        model: 'deepseek-chat',
        generatedAt: '2026-03-25T01:05:00.000Z',
      },
    });

    analysisMocks.mapAnalysisToPolicyResponsibilities.mockReturnValueOnce([
      { name: '满期生存保险金', desc: '保险期满生存；更新页分析结果', limit: 3000 },
    ]);

    const result = await executeUpdateInsurancePolicy(command as any);

    expect(analysisMocks.analyzeInsurancePolicyResponsibilities).not.toHaveBeenCalled();
    expect(result.policy.analysis).toMatchObject({
      productOverview: '更新页已完成责任概述',
      coreFeature: '更新页已完成核心特点',
      generatedAt: '2026-03-25T01:05:00.000Z',
    });
    expect(result.policy.responsibilities).toEqual([{ name: '满期生存保险金', desc: '保险期满生存；更新页分析结果', limit: 3000 }]);
    expect(state.policies[0]?.analysis).toMatchObject({
      productOverview: '更新页已完成责任概述',
      coreFeature: '更新页已完成核心特点',
    });
  });

  it('returns updated policy before re-analysis completes and backfills later', async () => {
    const state = {
      policies: [
        {
          id: 11,
          tenantId: 2,
          customerId: 9,
          company: '新华保险',
          name: '旧产品',
          type: '保障',
          amount: 120000,
          nextPayment: '2025-01-01',
          status: '保障中',
          applicant: '秦国英',
          applicantRelation: '配偶',
          insured: '杜金坤',
          insuredRelation: '本人',
          periodStart: '2024-01-01',
          periodEnd: '终身',
          annualPremium: 12000,
          paymentPeriod: '10年',
          coveragePeriod: '终身',
          responsibilities: [{ name: '旧责任', desc: 'old', limit: 1 }],
          paymentHistory: [],
          createdBy: 8003,
          createdAt: '2026-03-24T00:00:00.000Z',
        },
      ],
    };
    const command = createBaseCommand({
      getState: () => state,
      policyId: 11,
      company: '新华保险',
      name: '新产品',
      date: '2024-02-02',
      amount: 100000,
      firstPremium: 3000,
      paymentPeriod: '5年',
      coveragePeriod: '终身',
      defaultResponsibilities: () => [{ name: 'fallback', desc: 'fallback', limit: 100000 }],
    });

    let resolveAnalysis: (value: unknown) => void = () => undefined;
    analysisMocks.analyzeInsurancePolicyResponsibilities.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveAnalysis = resolve;
      }),
    );
    analysisMocks.mapAnalysisToPolicyResponsibilities.mockReturnValueOnce([{ name: '身故保险金', desc: '被保险人身故；测试', limit: 0 }]);

    const result = await Promise.race([
      executeUpdateInsurancePolicy(command as any),
      new Promise((_, reject) => setTimeout(() => reject(new Error('update timed out')), 50)),
    ]);

    expect(result.policy.responsibilities).toEqual([{ name: '旧责任', desc: 'old', limit: 1 }]);
    expect(state.policies[0]?.responsibilities).toEqual([{ name: '旧责任', desc: 'old', limit: 1 }]);
    expect(analysisMocks.analyzeInsurancePolicyResponsibilities).toHaveBeenCalledWith({
      policy: {
        company: '新华保险',
        name: '新产品',
        date: '2024-02-02',
        amount: 100000,
        firstPremium: 3000,
      },
    });

    resolveAnalysis({
      productOverview: '新的产品概述',
      coreFeature: '新的产品特点',
      coverageTable: [{ coverageType: '身故保险金', scenario: '被保险人身故', payout: '按约定金额给付', note: '测试' }],
      exclusions: ['新的免责提醒'],
      purchaseAdvice: '新的建议',
      disclaimer: '新的提示',
      model: 'deepseek-chat',
      generatedAt: '2026-03-24T11:00:00.000Z',
    });

    await waitForAssertion(() => {
      expect(state.policies[0]?.responsibilities).toEqual([{ name: '身故保险金', desc: '被保险人身故；测试', limit: 0 }]);
      expect(state.policies[0]?.analysis).toMatchObject({
        productOverview: '新的产品概述',
        coreFeature: '新的产品特点',
        exclusions: ['新的免责提醒'],
        purchaseAdvice: '新的建议',
        model: 'deepseek-chat',
        generatedAt: '2026-03-24T11:00:00.000Z',
      });
    });
  });
});
