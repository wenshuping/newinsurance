import { describe, expect, it } from 'vitest';
import {
  ensurePublicPoolTenantState,
  isDirectUnassignedCustomer,
  isPublicPoolTenant,
  PUBLIC_POOL_TENANT_CODE,
  PUBLIC_POOL_TENANT_NAME,
} from '../server/skeleton-c-v1/common/public-pool-tenant.mjs';

describe('public pool tenant helper', () => {
  it('creates the public pool tenant skeleton and migrates direct unassigned customers', () => {
    const state = {
      tenants: [{ id: 1, name: '平台租户', tenantCode: 'platform', type: 'company', status: 'active' }],
      orgUnits: [{ id: 1, tenantId: 1, name: '平台机构' }],
      teams: [{ id: 1, tenantId: 1, orgId: 1, name: '平台团队' }],
      users: [
        {
          id: 101,
          tenantId: 2,
          orgId: 2,
          teamId: 2,
          ownerUserId: 0,
          referrerCustomerId: 0,
          referrerShareCode: '',
          name: '自然流客户',
        },
        {
          id: 102,
          tenantId: 2,
          orgId: 2,
          teamId: 2,
          ownerUserId: 8001,
          referrerCustomerId: 0,
          referrerShareCode: '',
          name: '已分配自然流客户',
        },
        {
          id: 103,
          tenantId: 2,
          orgId: 2,
          teamId: 2,
          ownerUserId: 0,
          referrerCustomerId: 900,
          referrerShareCode: 'share-001',
          name: '分享客户',
        },
      ],
    };

    const result = ensurePublicPoolTenantState({
      state,
      nextId: (list) => Math.max(0, ...(list || []).map((row) => Number(row?.id || 0))) + 1,
    });

    expect(result.changed).toBe(true);
    expect(result.tenant).toMatchObject({
      id: 2,
      tenantCode: PUBLIC_POOL_TENANT_CODE,
      name: PUBLIC_POOL_TENANT_NAME,
    });
    expect(result.org).toMatchObject({ tenantId: 2, name: '公共池默认机构' });
    expect(result.team).toMatchObject({ tenantId: 2, orgId: Number(result.org.id), name: '公共池默认团队' });

    expect(state.users[0]).toMatchObject({
      tenantId: Number(result.tenant.id),
      orgId: Number(result.org.id),
      teamId: Number(result.team.id),
      ownerUserId: 0,
    });
    expect(state.users[1]).toMatchObject({ tenantId: 2, orgId: 2, teamId: 2, ownerUserId: 8001 });
    expect(state.users[2]).toMatchObject({ tenantId: 2, orgId: 2, teamId: 2, referrerCustomerId: 900 });
  });

  it('recognizes the protected public pool tenant and direct-unassigned customers', () => {
    expect(isPublicPoolTenant({ id: 9, tenantCode: PUBLIC_POOL_TENANT_CODE, name: '任意名字' })).toBe(true);
    expect(isPublicPoolTenant({ id: 9, tenantCode: 'tenant-alpha', name: PUBLIC_POOL_TENANT_NAME })).toBe(true);
    expect(isPublicPoolTenant({ id: 9, tenantCode: 'tenant-alpha', name: '新华保险' })).toBe(false);

    expect(
      isDirectUnassignedCustomer({ ownerUserId: 0, referrerCustomerId: 0, referrerShareCode: '' }),
    ).toBe(true);
    expect(
      isDirectUnassignedCustomer({ ownerUserId: 9001, referrerCustomerId: 0, referrerShareCode: '' }),
    ).toBe(false);
    expect(
      isDirectUnassignedCustomer({ ownerUserId: 0, referrerCustomerId: 1, referrerShareCode: 'share-1' }),
    ).toBe(false);
  });
});
