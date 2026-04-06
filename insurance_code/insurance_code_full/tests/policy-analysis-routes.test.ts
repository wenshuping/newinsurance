import { beforeEach, describe, expect, it, vi } from 'vitest';

const stateMocks = vi.hoisted(() => ({
  getState: vi.fn(),
  nextId: vi.fn(),
  persistPoliciesByIds: vi.fn(),
  persistPolicyAnalysisSnapshot: vi.fn(),
  persistState: vi.fn(),
}));

const analysisMocks = vi.hoisted(() => ({
  analyzeInsurancePolicyResponsibilities: vi.fn(),
  mapAnalysisToPolicyResponsibilities: vi.fn(),
  sanitizeStoredPolicyAnalysis: vi.fn((value) => value),
}));

vi.mock('../server/skeleton-c-v1/common/state.mjs', () => ({
  getState: stateMocks.getState,
  nextId: stateMocks.nextId,
  persistPoliciesByIds: stateMocks.persistPoliciesByIds,
  persistPolicyAnalysisSnapshot: stateMocks.persistPolicyAnalysisSnapshot,
  persistState: stateMocks.persistState,
}));

vi.mock('../server/skeleton-c-v1/services/policy-analysis.service.mjs', () => ({
  analyzeInsurancePolicyResponsibilities: analysisMocks.analyzeInsurancePolicyResponsibilities,
  mapAnalysisToPolicyResponsibilities: analysisMocks.mapAnalysisToPolicyResponsibilities,
  sanitizeStoredPolicyAnalysis: analysisMocks.sanitizeStoredPolicyAnalysis,
}));

import { registerInsuranceRoutes } from '../server/skeleton-c-v1/routes/insurance.routes.mjs';
import { registerBAdminCustomerRoutes } from '../server/skeleton-c-v1/routes/b-admin-customers.routes.mjs';

function createFakeApp() {
  const routes = {
    get: new Map(),
    post: new Map(),
    put: new Map(),
    delete: new Map(),
  };
  return {
    routes,
    get(path, ...handlers) {
      routes.get.set(path, handlers);
    },
    post(path, ...handlers) {
      routes.post.set(path, handlers);
    },
    put(path, ...handlers) {
      routes.put.set(path, handlers);
    },
    delete(path, ...handlers) {
      routes.delete.set(path, handlers);
    },
  };
}

function createJsonResponse() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(payload) {
      res.body = payload;
      return res;
    },
  };
  return res;
}

describe('policy analysis routes reuse stored analysis snapshots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reuses stored analysis on the C policy analyze route', async () => {
    const policy = {
      id: 8,
      customerId: 7,
      type: '医疗',
      analysis: {
        productOverview: '已归档责任概述',
        coreFeature: '已归档责任特点',
        coverageTable: [],
        exclusions: [],
        purchaseAdvice: '已归档建议',
        generatedAt: '2026-03-25T08:00:00.000Z',
      },
    };
    stateMocks.getState.mockReturnValueOnce({
      policies: [policy],
    });

    const app = createFakeApp();
    registerInsuranceRoutes(app);
    const handler = app.routes.post.get('/api/insurance/policies/analyze').at(-1);

    const req = {
      body: { policyId: 8 },
      user: { id: 7 },
    };
    const res = createJsonResponse();

    await handler(req, res);

    expect(analysisMocks.analyzeInsurancePolicyResponsibilities).not.toHaveBeenCalled();
    expect(stateMocks.persistPoliciesByIds).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      analysis: policy.analysis,
      policy: expect.objectContaining({
        id: 8,
        analysis: policy.analysis,
      }),
    });
  });

  it('filters C policy list to the current customer and hides unowned sample policies', async () => {
    stateMocks.getState.mockReturnValueOnce({
      policies: [
        { id: 1, customerId: 9, type: '医疗', name: '客户自己的保单' },
        { id: 2, createdBy: 9, type: '重疾', name: '客户历史保单' },
        { id: 3, type: '医疗', name: '无归属样例保单' },
        { id: 4, customerId: 10, type: '意外', name: '其他客户保单' },
      ],
    });

    const app = createFakeApp();
    registerInsuranceRoutes(app);
    const handler = app.routes.get.get('/api/insurance/policies').at(-1);

    const req = {
      user: { id: 9 },
    };
    const res = createJsonResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      policies: [
        expect.objectContaining({ id: 2, name: '客户历史保单' }),
        expect.objectContaining({ id: 1, name: '客户自己的保单' }),
      ],
    });
  });

  it('blocks C policy detail access for policies outside the current customer scope', async () => {
    stateMocks.getState.mockReturnValueOnce({
      policies: [{ id: 21, customerId: 88, type: '医疗', name: '其他客户保单' }],
    });

    const app = createFakeApp();
    registerInsuranceRoutes(app);
    const handler = app.routes.get.get('/api/insurance/policies/:id').at(-1);

    const req = {
      params: { id: 21 },
      user: { id: 9 },
    };
    const res = createJsonResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({
      code: 'POLICY_NOT_FOUND',
    });
  });

  it('reuses stored analysis on the B customer policy analyze route', async () => {
    const policy = {
      id: 11,
      customerId: 9,
      type: '医疗',
      analysis: {
        productOverview: '已归档责任概述',
        coreFeature: '已归档责任特点',
        coverageTable: [],
        exclusions: [],
        purchaseAdvice: '已归档建议',
        generatedAt: '2026-03-25T08:00:00.000Z',
      },
    };
    const customer = {
      id: 9,
      tenantId: 2,
    };
    const deps = {
      appendAuditLog: vi.fn(),
      dataScope: () => (_req, _res, next) => next?.(),
      getState: () => ({
        users: [customer],
        policies: [policy],
      }),
      nextId: vi.fn(),
      permissionRequired: () => (_req, _res, next) => next?.(),
      persistState: vi.fn(),
      tenantContext: (_req, _res, next) => next?.(),
    };

    const app = createFakeApp();
    registerBAdminCustomerRoutes(app, deps);
    const handler = app.routes.post.get('/api/b/customers/:id/policies/:policyId/analyze').at(-1);

    const req = {
      params: { id: '9', policyId: '11' },
      dataScope: {
        canAccessCustomer: () => true,
      },
    };
    const res = createJsonResponse();

    await handler(req, res);

    expect(analysisMocks.analyzeInsurancePolicyResponsibilities).not.toHaveBeenCalled();
    expect(stateMocks.persistPoliciesByIds).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      analysis: policy.analysis,
      policy: expect.objectContaining({
        id: 11,
        analysis: policy.analysis,
      }),
    });
  });

  it('persists a fresh B policy analysis snapshot for later reuse', async () => {
    const policy = {
      id: 12,
      customerId: 9,
      type: '医疗',
      amount: 50000,
      annualPremium: 3496,
      responsibilities: [],
    };
    const customer = {
      id: 9,
      tenantId: 2,
    };
    const analysis = {
      productOverview: '首次整理概述',
      coreFeature: '首次整理特点',
      coverageTable: [
        {
          coverageType: '一般医疗保险金',
          scenario: '住院及门急诊保障',
          payout: '5万元',
          note: '测试说明',
        },
      ],
      exclusions: ['测试免责'],
      purchaseAdvice: '测试建议',
      generatedAt: '2026-03-25T09:00:00.000Z',
    };
    analysisMocks.analyzeInsurancePolicyResponsibilities.mockResolvedValueOnce(analysis);
    analysisMocks.mapAnalysisToPolicyResponsibilities.mockReturnValueOnce([
      { name: '一般医疗保险金', desc: '住院及门急诊保障；测试说明', limit: 50000 },
    ]);

    const deps = {
      appendAuditLog: vi.fn(),
      dataScope: () => (_req, _res, next) => next?.(),
      getState: () => ({
        users: [customer],
        policies: [policy],
      }),
      nextId: vi.fn(),
      permissionRequired: () => (_req, _res, next) => next?.(),
      persistState: vi.fn(),
      tenantContext: (_req, _res, next) => next?.(),
    };

    const app = createFakeApp();
    registerBAdminCustomerRoutes(app, deps);
    const handler = app.routes.post.get('/api/b/customers/:id/policies/:policyId/analyze').at(-1);

    const req = {
      params: { id: '9', policyId: '12' },
      dataScope: {
        canAccessCustomer: () => true,
      },
    };
    const res = createJsonResponse();

    await handler(req, res);

    expect(analysisMocks.analyzeInsurancePolicyResponsibilities).toHaveBeenCalledTimes(1);
    expect(stateMocks.persistPolicyAnalysisSnapshot).toHaveBeenCalledWith({
      policyId: 12,
      analysis: expect.objectContaining({
        productOverview: '首次整理概述',
      }),
      responsibilities: [{ name: '一般医疗保险金', desc: '住院及门急诊保障；测试说明', limit: 50000 }],
      updatedAt: expect.any(String),
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      policy: expect.objectContaining({
        id: 12,
        analysis: expect.objectContaining({
          productOverview: '首次整理概述',
        }),
      }),
    });
  });

  it('passes amount and firstPremium through the C analyze route payload', async () => {
    const analysis = {
      productOverview: '测试概述',
      coreFeature: '测试特点',
      coverageTable: [],
      exclusions: [],
      purchaseAdvice: '测试建议',
      generatedAt: '2026-03-25T09:10:00.000Z',
    };
    analysisMocks.analyzeInsurancePolicyResponsibilities.mockResolvedValueOnce(analysis);

    const app = createFakeApp();
    registerInsuranceRoutes(app);
    const handler = app.routes.post.get('/api/insurance/policies/analyze').at(-1);

    const req = {
      body: {
        policy: {
          company: '新华保险',
          name: '畅行万里臻享版两全保险',
          date: '2024-01-15',
          amount: 50000,
          firstPremium: 3496,
        },
      },
    };
    const res = createJsonResponse();

    await handler(req, res);

    expect(analysisMocks.analyzeInsurancePolicyResponsibilities).toHaveBeenCalledWith({
      policy: {
        company: '新华保险',
        name: '畅行万里臻享版两全保险',
        date: '2024-01-15',
        amount: 50000,
        firstPremium: 3496,
      },
    });
    expect(res.statusCode).toBe(200);
  });
});
