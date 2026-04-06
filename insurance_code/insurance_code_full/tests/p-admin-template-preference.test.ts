import { describe, expect, it } from 'vitest';
import { decoratePlatformTemplateRow, preferActorTemplateRows } from '../server/skeleton-c-v1/routes/p-admin.shared.mjs';

describe('p admin template preference', () => {
  it('prefers tenant override rows over platform source rows for company admins', () => {
    const state = {
      roles: [
        { id: 1, key: 'platform_admin' },
        { id: 2, key: 'company_admin' },
      ],
      userRoles: [
        { tenantId: 1, userType: 'employee', userId: 9001, roleId: 1 },
        { tenantId: 2, userType: 'employee', userId: 8002, roleId: 2 },
      ],
    };
    const actor = { actorType: 'employee', actorId: 8002, tenantId: 2 };
    const rows = [
      {
        id: 115,
        tenantId: 1,
        title: '视频测试',
        status: 'published',
        createdBy: 9001,
        creatorRole: '',
        templateScope: 'tenant',
      },
      {
        id: 116,
        tenantId: 2,
        title: '视频测试',
        status: 'inactive',
        createdBy: 8002,
        creatorRole: 'company_admin',
        templateScope: 'tenant',
        sourceTemplateId: 115,
        platformTemplate: true,
      },
    ];

    const result = preferActorTemplateRows(state, actor, rows);

    expect(result.map((row) => Number(row.id))).toEqual([116]);
    expect(decoratePlatformTemplateRow(state, rows[0])).toMatchObject({
      isPlatformTemplate: true,
      templateTag: '平台模板',
    });
  });

  it('keeps original rows when no tenant override exists', () => {
    const state = {
      roles: [{ id: 1, key: 'platform_admin' }, { id: 2, key: 'company_admin' }],
      userRoles: [
        { tenantId: 1, userType: 'employee', userId: 9001, roleId: 1 },
        { tenantId: 2, userType: 'employee', userId: 8002, roleId: 2 },
      ],
    };
    const actor = { actorType: 'employee', actorId: 8002, tenantId: 2 };
    const rows = [
      {
        id: 115,
        tenantId: 1,
        title: '视频测试',
        status: 'published',
        createdBy: 9001,
        creatorRole: '',
        templateScope: 'tenant',
      },
    ];

    const result = preferActorTemplateRows(state, actor, rows);

    expect(result.map((row) => Number(row.id))).toEqual([115]);
  });
});
