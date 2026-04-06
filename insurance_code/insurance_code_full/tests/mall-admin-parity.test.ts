import { describe, expect, it } from 'vitest';

import { buildAdminMallActivityList, buildAdminMallProductList } from '../server/skeleton-c-v1/routes/mall-admin.shared.mjs';

const actor = { actorType: 'employee', actorId: 8003, tenantId: 2, orgId: 2, teamId: 3 };

const baseState = {
  roles: [
    { id: 1, key: 'platform_admin' },
    { id: 2, key: 'company_admin' },
    { id: 3, key: 'team_lead' },
    { id: 4, key: 'agent' },
  ],
  userRoles: [
    { tenantId: 1, userType: 'employee', userId: 9001, roleId: 1 },
    { tenantId: 2, userType: 'employee', userId: 8002, roleId: 2 },
    { tenantId: 2, userType: 'employee', userId: 8003, roleId: 3 },
  ],
};

describe('mall admin parity', () => {
  it('prefers tenant mall-product overrides over platform source rows', () => {
    const state = {
      ...baseState,
      pProducts: [
        {
          id: 101,
          tenantId: 1,
          title: '平台商品模板',
          status: 'active',
          createdBy: 9001,
          creatorRole: 'platform_admin',
          sortOrder: 10,
        },
        {
          id: 201,
          tenantId: 2,
          title: '租户覆盖商品',
          status: 'active',
          createdBy: 8002,
          creatorRole: 'company_admin',
          sourceTemplateId: 101,
          platformTemplate: true,
          sortOrder: 3,
        },
        {
          id: 202,
          tenantId: 2,
          title: '个人商品',
          status: 'active',
          createdBy: 8003,
          creatorRole: 'team_lead',
          sortOrder: 4,
        },
      ],
    };

    const list = buildAdminMallProductList({
      state,
      actor,
      canAccessTemplate: () => true,
      effectiveTemplateStatusForActor: (_state, _actor, row) => String(row?.status || 'inactive'),
    });

    expect(list.map((item) => item.title)).toEqual(['租户覆盖商品', '个人商品']);
    expect(list[0]).toMatchObject({ templateSource: 'platform', templateTag: '平台模板' });
    expect(list[1]).toMatchObject({ templateSource: 'personal', templateTag: '个人模板' });
  });

  it('prefers tenant mall-activity overrides over platform source rows', () => {
    const state = {
      ...baseState,
      mallActivities: [
        {
          id: 301,
          tenantId: 1,
          title: '平台活动模板',
          status: 'published',
          createdBy: 9001,
          creatorRole: 'platform_admin',
          sortOrder: 10,
        },
        {
          id: 401,
          tenantId: 2,
          title: '租户覆盖活动',
          status: 'published',
          createdBy: 8002,
          creatorRole: 'company_admin',
          sourceTemplateId: 301,
          platformTemplate: true,
          sortOrder: 2,
        },
        {
          id: 402,
          tenantId: 2,
          title: '我的活动',
          status: 'published',
          createdBy: 8003,
          creatorRole: 'team_lead',
          sortOrder: 3,
        },
      ],
    };

    const list = buildAdminMallActivityList({
      state,
      actor,
      canAccessTemplate: () => true,
      effectiveTemplateStatusForActor: (_state, _actor, row) => String(row?.status || 'inactive'),
    });

    expect(list.map((item) => item.title)).toEqual(['租户覆盖活动', '我的活动']);
    expect(list[0]).toMatchObject({ templateSource: 'platform', templateTag: '平台模板' });
    expect(list[1]).toMatchObject({ templateSource: 'personal', templateTag: '个人模板' });
  });
});
