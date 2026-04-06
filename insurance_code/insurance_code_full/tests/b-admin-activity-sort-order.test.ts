import { describe, expect, it } from 'vitest';
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

function createResponseMock() {
  const response = {
    json: (payload) => payload,
    status(code) {
      this.statusCode = code;
      return this;
    },
    statusCode: 200,
  };
  return response;
}

describe('b admin activity config list ordering', () => {
  it('returns activities sorted by sortOrder asc before fallback time ordering', async () => {
    const app = createRouteApp();
    const deps = {
      canAccessTemplate: () => true,
      effectiveTemplateStatusForActor: () => 'online',
      getState: () => ({
        activities: [
          {
            id: 11,
            tenantId: 2,
            title: '排序 12',
            sourceDomain: 'activity',
            status: 'online',
            sortOrder: 12,
            updatedAt: '2026-04-03T10:00:00.000Z',
          },
          {
            id: 7,
            tenantId: 2,
            title: '排序 2',
            sourceDomain: 'activity',
            status: 'online',
            sortOrder: 2,
            updatedAt: '2026-04-01T10:00:00.000Z',
          },
          {
            id: 9,
            tenantId: 2,
            title: '排序 5',
            sourceDomain: 'activity',
            status: 'online',
            sortOrder: 5,
            updatedAt: '2026-04-02T10:00:00.000Z',
          },
        ],
      }),
      permissionRequired: () => (_req, _res, next) => next?.(),
      tenantContext: (_req, _res, next) => next?.(),
    };

    registerBAdminActivityRoutes(app, deps);
    const handler = app.routes.get('GET /api/b/activity-configs');
    const req = {
      actor: { actorType: 'employee', actorId: 8003 },
      tenantContext: { tenantId: 2 },
    };
    const res = createResponseMock();

    const payload = await handler(req, res);
    const list = payload?.list || [];

    expect(list.map((item) => item.id)).toEqual([7, 9, 11]);
    expect(list.map((item) => item.sortOrder)).toEqual([2, 5, 12]);
  });

  it('keeps company template activity status in sync for agents', async () => {
    const app = createRouteApp();
    const deps = {
      canAccessTemplate: () => true,
      effectiveTemplateStatusForActor: (_state, _actor, row) => String(row?.status || ''),
      getState: () => ({
        roles: [
          { id: 1, key: 'company_admin' },
          { id: 2, key: 'agent' },
        ],
        userRoles: [
          { tenantId: 2, userType: 'employee', userId: 8002, roleId: 1 },
          { tenantId: 2, userType: 'agent', userId: 8003, roleId: 2 },
        ],
        activities: [
          {
            id: 70,
            tenantId: 2,
            title: '链路活动_1772773375022',
            sourceDomain: 'activity',
            status: 'published',
            createdBy: 8002,
            creatorRole: 'company_admin',
            sortOrder: 1,
            updatedAt: '2026-04-03T10:00:00.000Z',
          },
        ],
      }),
      permissionRequired: () => (_req, _res, next) => next?.(),
      tenantContext: (_req, _res, next) => next?.(),
    };

    registerBAdminActivityRoutes(app, deps);
    const handler = app.routes.get('GET /api/b/activity-configs');
    const req = {
      actor: { actorType: 'agent', actorId: 8003, tenantId: 2 },
      tenantContext: { tenantId: 2 },
    };
    const res = createResponseMock();

    const payload = await handler(req, res);
    const list = payload?.list || [];

    expect(list).toHaveLength(1);
    expect(list[0]?.title).toBe('链路活动_1772773375022');
    expect(list[0]?.status).toBe('published');
  });
});
