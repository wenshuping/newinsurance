import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PublicCustomerPoolPage, buildAssignableTenantOptions, filterAssignableEmployeesByTenant } from './PublicCustomerPoolPage';

test('PublicCustomerPoolPage does not eagerly render full employee options for every row', () => {
  const html = renderToStaticMarkup(
    <PublicCustomerPoolPage
      customers={[
        {
          id: 1,
          name: '客户A',
          mobile: '13800000001',
          tenantId: 2,
          tenantName: '新华保险',
          ownerUserId: 0,
          ownerName: '',
          orgId: 2,
          teamId: 2,
          referrerCustomerId: 0,
          referrerShareCode: '',
          referredAt: null,
          acquisitionSource: 'direct',
          poolStatus: 'unassigned',
        },
        {
          id: 2,
          name: '客户B',
          mobile: '13800000002',
          tenantId: 2,
          tenantName: '新华保险',
          ownerUserId: 0,
          ownerName: '',
          orgId: 2,
          teamId: 2,
          referrerCustomerId: 0,
          referrerShareCode: '',
          referredAt: null,
          acquisitionSource: 'direct',
          poolStatus: 'unassigned',
        },
      ]}
      employees={[
        {
          id: 101,
          name: '新华保险管理员',
          tenantId: 2,
          tenantName: '新华保险',
          orgId: 2,
          teamId: 2,
          role: 'manager',
          teamName: '租户A团队',
        },
        {
          id: 102,
          name: '方雨晴',
          tenantId: 2,
          tenantName: '新华保险',
          orgId: 2,
          teamId: 3,
          role: 'support',
          teamName: '团队 3',
        },
      ]}
      assigningCustomerId={null}
      selectedAgentByCustomerId={{}}
      onSelectAgent={() => undefined}
      onAssign={async () => undefined}
    />,
  );

  assert.ok(html.includes('客户A'));
  assert.ok(html.includes('客户B'));
  assert.equal(html.includes('新华保险管理员'), false);
  assert.equal(html.includes('方雨晴'), false);
});

test('buildAssignableTenantOptions deduplicates tenants from employees', () => {
  const options = buildAssignableTenantOptions([
    { id: 101, name: '员工A', tenantId: 2, tenantName: '新华保险', orgId: 2, teamId: 2, role: 'manager' },
    { id: 102, name: '员工B', tenantId: 2, tenantName: '新华保险', orgId: 2, teamId: 3, role: 'agent' },
    { id: 103, name: '员工C', tenantId: 3, tenantName: '平安保险', orgId: 3, teamId: 5, role: 'support' },
  ]);

  assert.deepEqual(options, [
    { tenantId: '2', tenantName: '新华保险' },
    { tenantId: '3', tenantName: '平安保险' },
  ]);
});

test('filterAssignableEmployeesByTenant only returns employees in selected tenant', () => {
  const employees = [
    { id: 101, name: '员工A', tenantId: 2, tenantName: '新华保险', orgId: 2, teamId: 2, role: 'manager' },
    { id: 102, name: '员工B', tenantId: 2, tenantName: '新华保险', orgId: 2, teamId: 3, role: 'agent' },
    { id: 103, name: '员工C', tenantId: 3, tenantName: '平安保险', orgId: 3, teamId: 5, role: 'support' },
  ];

  assert.deepEqual(
    filterAssignableEmployeesByTenant(employees, '2').map((row) => row.id),
    [101, 102],
  );
  assert.deepEqual(
    filterAssignableEmployeesByTenant(employees, '3').map((row) => row.id),
    [103],
  );
  assert.deepEqual(filterAssignableEmployeesByTenant(employees, '').map((row) => row.id), []);
});
