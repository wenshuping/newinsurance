import { describe, expect, it } from 'vitest';
import { listVisiblePAdminEmployees, toPAdminCustomerListItem } from '../server/skeleton-c-v1/routes/p-admin-workforce.routes.mjs';

describe('toPAdminCustomerListItem', () => {
  it('classifies direct unassigned customers into public pool', () => {
    const item = toPAdminCustomerListItem(
      {
        id: 101,
        name: '自然注册客户',
        mobile: '13800000001',
        tenantId: 2,
        ownerUserId: 0,
        orgId: 2,
        teamId: 2,
        referrerCustomerId: 0,
        referrerShareCode: '',
        referredAt: null,
      },
      null,
      { id: 2, name: '新华保险', tenantCode: 'tenant-alpha' },
    );

    expect(item.acquisitionSource).toBe('direct');
    expect(item.poolStatus).toBe('unassigned');
    expect(item.ownerName).toBe('');
    expect(item.tenantId).toBe(2);
    expect(item.tenantName).toBe('新华保险');
  });

  it('keeps referred customers marked as shared after assignment', () => {
    const item = toPAdminCustomerListItem(
      {
        id: 102,
        name: '分享实名客户',
        mobile: '13800000002',
        tenantId: 2,
        ownerUserId: 8003,
        orgId: 2,
        teamId: 3,
        referrerCustomerId: 903,
        referrerShareCode: 'sh1.example',
        referredAt: '2026-03-29T10:00:00.000Z',
      },
      { name: '方雨晴', email: 'fangyuqing@126.com', account: 'fangyuqing' },
    );

    expect(item.acquisitionSource).toBe('shared');
    expect(item.poolStatus).toBe('assigned');
    expect(item.ownerName).toBe('方雨晴');
  });

  it('keeps employee management scoped to the platform tenant while assignable scope can span tenants', () => {
    const state = {
      tenants: [
        { id: 1, name: '平台机构' },
        { id: 2, name: '新华保险' },
      ],
      teams: [
        { id: 1, tenantId: 1, orgId: 1, name: '平台团队' },
        { id: 2, tenantId: 2, orgId: 2, name: '租户A团队' },
      ],
      agents: [
        { id: 9002, tenantId: 1, orgId: 1, teamId: 1, name: '平台运营', role: 'manager' },
        { id: 8002, tenantId: 2, orgId: 2, teamId: 2, name: '新华保险管理员', role: 'manager' },
      ],
    };
    const ensureTenantTeams = (nextState, tenantId) =>
      (nextState.teams || []).filter((row) => Number(row.tenantId || 0) === Number(tenantId || 0));

    const manageList = listVisiblePAdminEmployees({
      state,
      tenantId: 1,
      orgId: 1,
      ensureTenantTeams,
      includeAllTenants: false,
    });
    const assignableList = listVisiblePAdminEmployees({
      state,
      tenantId: 1,
      orgId: 1,
      ensureTenantTeams,
      includeAllTenants: true,
    });

    expect(manageList.map((row) => row.id)).toEqual([9002]);
    expect(assignableList.map((row) => row.id)).toEqual([9002, 8002]);
  });
});
