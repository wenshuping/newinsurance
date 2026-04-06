import assert from 'node:assert/strict';
import test from 'node:test';

import { buildBPermissionAccess, getVisibleBNavIds } from './b-nav';

test('keeps all root nav tabs visible even when permissions are limited', () => {
  const access = buildBPermissionAccess({
    tenantId: 2,
    roleKey: 'team_member',
    allowedViews: [],
    modules: [],
    grants: [],
    dataPermission: { supported: false, status: 'reserved' },
  });

  assert.deepEqual(getVisibleBNavIds(access), ['home', 'customers', 'tools', 'analytics', 'profile']);
});
