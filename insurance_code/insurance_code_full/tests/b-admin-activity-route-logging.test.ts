import { beforeEach, describe, expect, it, vi } from 'vitest';

const { executeCreateBActivityConfig, executeUpdateBActivityConfig } = vi.hoisted(() => ({
  executeCreateBActivityConfig: vi.fn(),
  executeUpdateBActivityConfig: vi.fn(),
}));

vi.mock('../server/skeleton-c-v1/usecases/b-activity-config-write.usecase.mjs', () => ({
  executeCreateBActivityConfig,
  executeUpdateBActivityConfig,
}));

import { registerBAdminActivityRoutes } from '../server/skeleton-c-v1/routes/b-admin-activity.routes.mjs';

function createRouteApp() {
  const routes = new Map();
  return {
    routes,
    post(path, ...handlers) {
      routes.set(`POST ${path}`, handlers.at(-1));
    },
    put(path, ...handlers) {
      routes.set(`PUT ${path}`, handlers.at(-1));
    },
    get(path, ...handlers) {
      routes.set(`GET ${path}`, handlers.at(-1));
    },
  };
}

function createDeps() {
  return {
    canAccessTemplate: () => true,
    effectiveTemplateStatusForActor: () => 'draft',
    getState: () => ({ activities: [] }),
    permissionRequired: () => (_req, _res, next) => next?.(),
    tenantContext: (_req, _res, next) => next?.(),
    hasRole: () => false,
    nextId: () => 1,
    persistState: vi.fn(),
  };
}

function createResponseMock() {
  const response = {
    json: vi.fn(),
    status: vi.fn(),
  };
  response.status.mockReturnValue(response);
  return response;
}

describe('b admin activity route logging', () => {
  beforeEach(() => {
    executeCreateBActivityConfig.mockReset();
    executeUpdateBActivityConfig.mockReset();
  });

  it('writes a structured success log for activity config creation', async () => {
    executeCreateBActivityConfig.mockResolvedValue({
      ok: true,
      idempotent: false,
      item: {
        id: 265,
        tenantId: 2,
        title: '2027年测试',
      },
    });
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const app = createRouteApp();

    registerBAdminActivityRoutes(app, createDeps());
    const handler = app.routes.get('POST /api/b/activity-configs');

    const req = {
      body: {
        title: '2027年测试',
        rewardPoints: 9,
        idempotencyKey: 'b-activity-create-2027-test-001',
      },
      actor: {
        actorType: 'employee',
        actorId: 8002,
      },
      tenantContext: {
        tenantId: 2,
      },
      headers: {
        'x-trace-id': 'trace-2027',
        'x-request-id': 'request-2027',
      },
      traceId: 'trace-2027',
      requestId: 'request-2027',
    };
    const res = createResponseMock();

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      idempotent: false,
      item: {
        id: 265,
        tenantId: 2,
        title: '2027年测试',
      },
    });
    expect(infoSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(infoSpy.mock.calls[0]?.[0] || '{}'));
    expect(payload).toMatchObject({
      service: 'api-v1',
      domain: 'b-activity-config',
      event: 'create',
      route: 'POST /api/b/activity-configs',
      result: 'success',
      status_code: 200,
      trace_id: 'trace-2027',
      request_id: 'request-2027',
      tenant_id: 2,
      actor_type: 'employee',
      actor_id: 8002,
      activity_id: 265,
      title: '2027年测试',
      idempotent: false,
    });
  });

  it('writes a structured failure log for activity config creation errors', async () => {
    executeCreateBActivityConfig.mockRejectedValue(new Error('TITLE_REQUIRED'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const app = createRouteApp();

    registerBAdminActivityRoutes(app, createDeps());
    const handler = app.routes.get('POST /api/b/activity-configs');

    const req = {
      body: {
        title: '',
        idempotencyKey: 'b-activity-create-2027-test-002',
      },
      actor: {
        actorType: 'employee',
        actorId: 8002,
      },
      tenantContext: {
        tenantId: 2,
      },
      headers: {
        'x-trace-id': 'trace-2027-error',
      },
      traceId: 'trace-2027-error',
      requestId: 'request-2027-error',
    };
    const res = createResponseMock();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ code: 'TITLE_REQUIRED', message: '活动名称不能为空' });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(warnSpy.mock.calls[0]?.[0] || '{}'));
    expect(payload).toMatchObject({
      service: 'api-v1',
      domain: 'b-activity-config',
      event: 'create',
      route: 'POST /api/b/activity-configs',
      result: 'error',
      status_code: 400,
      trace_id: 'trace-2027-error',
      request_id: 'request-2027-error',
      tenant_id: 2,
      actor_type: 'employee',
      actor_id: 8002,
      title: '',
      error_code: 'TITLE_REQUIRED',
    });
  });
});
