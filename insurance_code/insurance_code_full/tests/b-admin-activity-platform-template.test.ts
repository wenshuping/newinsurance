import { describe, expect, it } from 'vitest';
import { registerBAdminActivityRoutes } from '../server/skeleton-c-v1/routes/b-admin-activity.routes.mjs';
import { canAccessTemplate, effectiveTemplateStatusForActor } from '../server/skeleton-c-v1/common/template-visibility.mjs';

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
  return {
    json(payload) {
      return payload;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    statusCode: 200,
  };
}

describe('b admin activity platform template visibility', () => {
  it('keeps platform-derived tenant activities visible alongside team lead overrides', async () => {
    const app = createRouteApp();
    const state = {
      roles: [
        { id: 1, key: 'platform_admin' },
        { id: 2, key: 'company_admin' },
        { id: 3, key: 'team_lead' },
      ],
      userRoles: [
        { tenantId: 1, userType: 'employee', userId: 9001, roleId: 1 },
        { tenantId: 2, userType: 'employee', userId: 8002, roleId: 2 },
        { tenantId: 2, userType: 'employee', userId: 8003, roleId: 3 },
      ],
      activities: [
        {
          id: 115,
          tenantId: 1,
          title: '平台活动',
          sourceDomain: 'activity',
          status: 'published',
          createdBy: 9001,
          creatorRole: 'platform_admin',
          templateScope: 'platform',
          updatedAt: '2026-04-04T07:00:00.000Z',
        },
        {
          id: 116,
          tenantId: 2,
          title: '平台活动',
          sourceDomain: 'activity',
          status: 'published',
          createdBy: 8002,
          creatorRole: 'company_admin',
          templateScope: 'tenant',
          sourceTemplateId: 115,
          platformTemplate: true,
          updatedAt: '2026-04-04T08:00:00.000Z',
        },
        {
          id: 121,
          tenantId: 2,
          title: '平台活动',
          sourceDomain: 'activity',
          status: 'published',
          createdBy: 8003,
          creatorRole: 'team_lead',
          templateScope: 'tenant',
          sourceTemplateId: 116,
          platformTemplate: true,
          updatedAt: '2026-04-04T09:00:00.000Z',
        },
        {
          id: 122,
          tenantId: 2,
          title: '租户活动',
          sourceDomain: 'activity',
          status: 'published',
          createdBy: 8002,
          creatorRole: 'company_admin',
          updatedAt: '2026-04-04T10:00:00.000Z',
        },
      ],
    };
    const deps = {
      canAccessTemplate,
      effectiveTemplateStatusForActor,
      getState: () => state,
      permissionRequired: () => (_req, _res, next) => next?.(),
      tenantContext: (_req, _res, next) => next?.(),
    };

    registerBAdminActivityRoutes(app, deps);
    const handler = app.routes.get('GET /api/b/activity-configs');
    const req = {
      actor: { actorType: 'employee', actorId: 8003, tenantId: 2 },
      tenantContext: { tenantId: 2 },
    };
    const res = createResponseMock();

    const payload = await handler(req, res);
    const list = payload?.list || [];

    expect(list.map((item) => item.id)).toEqual([122, 121, 116]);
    expect(list.map((item) => item.title)).toEqual(['租户活动', '平台活动', '平台活动']);
    expect(list.slice(1).map((item) => item.templateTag)).toEqual(['平台模板', '平台模板']);
    expect(list.slice(1).map((item) => item.templateSource)).toEqual(['platform', 'platform']);
  });
});
