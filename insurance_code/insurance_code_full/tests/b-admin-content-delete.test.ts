import { beforeEach, describe, expect, it, vi } from 'vitest';

const { executeDeleteBContentItem } = vi.hoisted(() => ({
  executeDeleteBContentItem: vi.fn(),
}));

vi.mock('../server/skeleton-c-v1/usecases/b-content-write.usecase.mjs', () => ({
  executeDeleteBContentItem,
  executeCreateBContentItem: vi.fn(),
  executeReorderBContentItems: vi.fn(),
  executeUpdateBContentItem: vi.fn(),
}));

import { registerBAdminContentRoutes } from '../server/skeleton-c-v1/routes/b-admin-content.routes.mjs';
import { canAccessTemplate, effectiveTemplateStatusForActor, hasRole } from '../server/skeleton-c-v1/common/template-visibility.mjs';

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
    delete(path, ...handlers) {
      routes.set(`DELETE ${path}`, handlers.at(-1));
    },
    get(path, ...handlers) {
      routes.set(`GET ${path}`, handlers.at(-1));
    },
  };
}

function createResponseMock() {
  return {
    payload: undefined,
    json(payload) {
      this.payload = payload;
      return payload;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    statusCode: 200,
  };
}

describe('b admin content delete route', () => {
  beforeEach(() => {
    executeDeleteBContentItem.mockReset();
  });

  it('maps b content delete requests to learning course delete usecase', async () => {
    executeDeleteBContentItem.mockResolvedValue({ ok: true });

    const app = createRouteApp();
    const state = {
      roles: [{ id: 3, key: 'team_lead' }],
      userRoles: [{ tenantId: 2, userType: 'employee', userId: 8003, roleId: 3 }],
      learningCourses: [],
    };
    const deps = {
      canAccessTemplate,
      effectiveTemplateStatusForActor,
      getState: () => state,
      persistState: () => {},
      hasRole,
      permissionRequired: () => (_req, _res, next) => next?.(),
      tenantContext: (_req, _res, next) => next?.(),
    };

    registerBAdminContentRoutes(app, deps);
    const handler = app.routes.get('DELETE /api/b/content/items/:id');
    const req = {
      params: { id: '121' },
      actor: { actorType: 'employee', actorId: 8003, tenantId: 2 },
      tenantContext: { tenantId: 2 },
    };
    const res = createResponseMock();

    await handler(req, res);

    expect(executeDeleteBContentItem).toHaveBeenCalledTimes(1);
    expect(executeDeleteBContentItem.mock.calls[0][0]).toMatchObject({
      id: 121,
      actor: { actorType: 'employee', actorId: 8003, tenantId: 2 },
      tenantContext: { tenantId: 2 },
    });
    expect(res.payload).toEqual({ ok: true });
  });
});
