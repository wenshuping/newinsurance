#!/usr/bin/env node

import assert from 'node:assert/strict';
import { buildBAdminRouteDeps } from '../server/skeleton-c-v1/routes/b-admin.deps.mjs';

function expectFn(obj, key) {
  assert.equal(typeof obj?.[key], 'function', `expected function: ${key}`);
}

function main() {
  const deps = buildBAdminRouteDeps();
  [
    'dataScope',
    'permissionRequired',
    'tenantContext',
    'appendAuditLog',
    'createActorSession',
    'getState',
    'nextId',
    'persistState',
    'resolveSessionFromBearer',
    'upsertActorCsrfToken',
    'canAccessTemplate',
    'hasRole',
    'fulfillOrderWriteoff',
  ].forEach((name) => expectFn(deps, name));

  console.log(
    JSON.stringify(
      {
        ok: true,
        checks: ['b_admin_deps_factory_shape'],
      },
      null,
      2
    )
  );
}

main();
