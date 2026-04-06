#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();

const ACTIVITY_RUNTIME_FILES = [
  'server/microservices/activity-service/app.mjs',
  'server/microservices/activity-service/router.mjs',
  'server/microservices/activity-service/c-activity.routes.mjs',
  'server/microservices/activity-service/p-activity.routes.mjs',
  'server/microservices/activity-service/b-activity.routes.mjs',
  'server/skeleton-c-v1/routes/p-admin-activities.routes.mjs',
  'server/skeleton-c-v1/routes/b-admin-activity.routes.mjs',
  'server/skeleton-c-v1/usecases/activity-complete.usecase.mjs',
  'server/skeleton-c-v1/usecases/p-activity-write.usecase.mjs',
  'server/skeleton-c-v1/usecases/b-activity-config-write.usecase.mjs',
  'server/skeleton-c-v1/repositories/activity-write.repository.mjs',
  'server/skeleton-c-v1/repositories/p-activity-write.repository.mjs',
  'server/skeleton-c-v1/repositories/b-activity-config-write.repository.mjs',
];

const FORBIDDEN_ROUTE_SNIPPETS = ['/api/auth/send-code', '/api/auth/verify-basic', '/api/me'];
const USER_WRITE_PATTERNS = [
  /\bstate\.users\s*=|\bstate\.users\.(push|unshift|splice|pop|shift|sort|reverse)\s*\(/g,
  /\bstate\.sessions\s*=|\bstate\.sessions\.(push|unshift|splice|pop|shift|sort|reverse)\s*\(/g,
  /\b(createSession|createActorSession)\s*\(/g,
  /\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM|MERGE\s+INTO|UPSERT\s+INTO)\s+(app_users|c_customers|p_sessions)\b/gi,
];
const USER_SERVICE_IMPORT_PATTERN = /from\s+['"][^'"]*microservices\/user-service\/[^'"]+['"]/g;

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function pushViolation(violations, type, detail) {
  violations.push({ type, ...detail });
}

function scan(relativePath, patterns) {
  const source = read(relativePath);
  const findings = [];
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    for (const match of source.matchAll(pattern)) {
      findings.push({ matched: String(match[0] || '').trim() });
    }
  }
  return findings;
}

async function main() {
  const violations = [];
  const boundaryModule = await import(
    pathToFileURL(path.join(ROOT, 'server/microservices/activity-service/boundary.mjs')).href
  );

  const appSource = read('server/microservices/activity-service/app.mjs');
  const routerSource = read('server/microservices/activity-service/router.mjs');
  const cRouteSource = read('server/microservices/activity-service/c-activity.routes.mjs');
  const pAdminSource = read('server/skeleton-c-v1/routes/p-admin-activities.routes.mjs');
  const bAdminSource = read('server/skeleton-c-v1/routes/b-admin-activity.routes.mjs');
  const activityCompleteUsecase = read('server/skeleton-c-v1/usecases/activity-complete.usecase.mjs');

  if (!appSource.includes('app.use(unifiedAuthAndTenantContext);')) {
    pushViolation(violations, 'activity_service_missing_shared_auth_context', {
      file: 'server/microservices/activity-service/app.mjs',
    });
  }

  if (!appSource.includes('app.use(csrfProtection);')) {
    pushViolation(violations, 'activity_service_missing_shared_csrf', {
      file: 'server/microservices/activity-service/app.mjs',
    });
  }

  if (!cRouteSource.includes("router.get('/api/activities', authOptional, tenantContext,")) {
    pushViolation(violations, 'activity_service_list_missing_tenant_context', {
      file: 'server/microservices/activity-service/c-activity.routes.mjs',
    });
  }

  if (!cRouteSource.includes("router.post('/api/activities/:id/complete', authRequired, tenantContext,")) {
    pushViolation(violations, 'activity_service_complete_missing_tenant_context', {
      file: 'server/microservices/activity-service/c-activity.routes.mjs',
      expected: "router.post('/api/activities/:id/complete', authRequired, tenantContext, ...)",
    });
  }

  if (!cRouteSource.includes('settleActivityRewardOverHttp')) {
    pushViolation(violations, 'activity_service_complete_not_using_points_contract', {
      file: 'server/microservices/activity-service/c-activity.routes.mjs',
    });
  }

  if (cRouteSource.includes('recordPoints(')) {
    pushViolation(violations, 'activity_service_complete_local_points_write', {
      file: 'server/microservices/activity-service/c-activity.routes.mjs',
    });
  }

  if (!activityCompleteUsecase.includes('canDeliverTemplateToActor')) {
    pushViolation(violations, 'activity_complete_missing_owner_tenant_visibility_check', {
      file: 'server/skeleton-c-v1/usecases/activity-complete.usecase.mjs',
    });
  }

  if (!pAdminSource.includes('tenantContext') || !pAdminSource.includes('canAccessTemplate')) {
    pushViolation(violations, 'activity_service_p_admin_missing_tenant_template_guard', {
      file: 'server/skeleton-c-v1/routes/p-admin-activities.routes.mjs',
    });
  }

  if (!bAdminSource.includes('tenantContext') || !bAdminSource.includes('canAccessTemplate')) {
    pushViolation(violations, 'activity_service_b_admin_missing_tenant_template_guard', {
      file: 'server/skeleton-c-v1/routes/b-admin-activity.routes.mjs',
    });
  }

  if (!routerSource.includes('stableContracts: activityServiceStableContracts')) {
    pushViolation(violations, 'activity_service_ready_missing_stable_contracts', {
      file: 'server/microservices/activity-service/router.mjs',
    });
  }

  if (!routerSource.includes('mainWriteTables: activityServiceMainWriteTables')) {
    pushViolation(violations, 'activity_service_ready_missing_main_write_tables', {
      file: 'server/microservices/activity-service/router.mjs',
    });
  }

  const stableContracts = Array.isArray(boundaryModule.activityServiceStableContracts)
    ? boundaryModule.activityServiceStableContracts
    : [];
  if (!stableContracts.includes('POST /api/activities/:id/complete')) {
    pushViolation(violations, 'activity_service_boundary_missing_stable_complete_contract', {
      file: 'server/microservices/activity-service/boundary.mjs',
    });
  }

  const mainWriteTables = Array.isArray(boundaryModule.activityServiceMainWriteTables)
    ? boundaryModule.activityServiceMainWriteTables.map((row) => String(row?.table || ''))
    : [];
  const expectedMainWriteTables = ['p_activities', 'c_activity_completions'];
  if (mainWriteTables.length !== expectedMainWriteTables.length || expectedMainWriteTables.some((table) => !mainWriteTables.includes(table))) {
    pushViolation(violations, 'activity_service_boundary_main_write_tables_mismatch', {
      file: 'server/microservices/activity-service/boundary.mjs',
      expected: expectedMainWriteTables,
      actual: mainWriteTables,
    });
  }

  const forbiddenUserTables = ['app_users', 'c_customers', 'p_sessions'];
  if (mainWriteTables.some((table) => forbiddenUserTables.includes(table))) {
    pushViolation(violations, 'activity_service_boundary_claims_user_tables', {
      file: 'server/microservices/activity-service/boundary.mjs',
      actual: mainWriteTables,
    });
  }

  for (const relativePath of ACTIVITY_RUNTIME_FILES) {
    const source = read(relativePath);

    for (const snippet of FORBIDDEN_ROUTE_SNIPPETS) {
      if (source.includes(snippet)) {
        pushViolation(violations, 'activity_service_exposes_user_route', {
          file: relativePath,
          snippet,
        });
      }
    }

    USER_SERVICE_IMPORT_PATTERN.lastIndex = 0;
    if (USER_SERVICE_IMPORT_PATTERN.test(source)) {
      pushViolation(violations, 'activity_service_imports_user_service_module', {
        file: relativePath,
      });
    }

    const findings = scan(relativePath, USER_WRITE_PATTERNS);
    if (findings.length > 0) {
      pushViolation(violations, 'activity_service_writes_user_boundary', {
        file: relativePath,
        findings,
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: violations.length === 0,
        checks: [
          'activity_service_no_auth_me_takeover',
          'activity_service_no_direct_user_write',
          'activity_service_reuses_shared_session_csrf',
          'activity_service_list_uses_owner_tenant_visibility',
          'activity_service_admin_routes_use_tenant_template_guards',
          'activity_service_complete_requires_tenant_context',
          'activity_service_ready_exports_stable_boundary',
        ],
        violations,
      },
      null,
      2,
    ),
  );

  if (violations.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: String(error?.message || error),
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
