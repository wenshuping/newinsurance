#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ACTIVITY_FILES = [
  'server/skeleton-c-v1/routes/activities.routes.mjs',
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

function scan(relativePath, patterns) {
  const source = read(relativePath);
  const findings = [];
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    for (const match of source.matchAll(pattern)) {
      findings.push({
        matched: String(match[0] || '').trim(),
      });
    }
  }
  return findings;
}

function pushViolation(violations, type, detail) {
  violations.push({ type, ...detail });
}

function main() {
  const violations = [];
  const routeSource = read('server/skeleton-c-v1/routes/activities.routes.mjs');
  const pAdminSource = read('server/skeleton-c-v1/routes/p-admin-activities.routes.mjs');
  const bAdminSource = read('server/skeleton-c-v1/routes/b-admin-activity.routes.mjs');
  const activityCompleteUsecase = read('server/skeleton-c-v1/usecases/activity-complete.usecase.mjs');
  const appSource = read('server/skeleton-c-v1/app.mjs');

  if (!routeSource.includes("app.get('/api/activities', authOptional, tenantContext,")) {
    pushViolation(violations, 'activities_list_missing_tenant_context', {
      file: 'server/skeleton-c-v1/routes/activities.routes.mjs',
    });
  }

  if (!routeSource.includes("app.post('/api/activities/:id/complete', authRequired, tenantContext,")) {
    pushViolation(violations, 'activity_complete_missing_tenant_context', {
      file: 'server/skeleton-c-v1/routes/activities.routes.mjs',
      expected: "app.post('/api/activities/:id/complete', authRequired, tenantContext, ...)",
    });
  }

  if (!routeSource.includes('canDeliverTemplateToActor')) {
    pushViolation(violations, 'activities_list_missing_owner_visibility_guard', {
      file: 'server/skeleton-c-v1/routes/activities.routes.mjs',
    });
  }

  if (!activityCompleteUsecase.includes('canDeliverTemplateToActor')) {
    pushViolation(violations, 'activity_complete_missing_visibility_check', {
      file: 'server/skeleton-c-v1/usecases/activity-complete.usecase.mjs',
    });
  }

  if (!pAdminSource.includes('tenantContext') || !pAdminSource.includes('canAccessTemplate')) {
    pushViolation(violations, 'p_admin_activity_missing_tenant_template_guard', {
      file: 'server/skeleton-c-v1/routes/p-admin-activities.routes.mjs',
    });
  }

  if (!bAdminSource.includes('tenantContext') || !bAdminSource.includes('canAccessTemplate')) {
    pushViolation(violations, 'b_admin_activity_missing_tenant_template_guard', {
      file: 'server/skeleton-c-v1/routes/b-admin-activity.routes.mjs',
    });
  }

  if (!appSource.includes('app.use(csrfProtection);')) {
    pushViolation(violations, 'global_csrf_protection_missing', {
      file: 'server/skeleton-c-v1/app.mjs',
    });
  }

  for (const relativePath of ACTIVITY_FILES) {
    const source = read(relativePath);

    for (const snippet of FORBIDDEN_ROUTE_SNIPPETS) {
      if (source.includes(snippet)) {
        pushViolation(violations, 'activity_exposes_user_route', {
          file: relativePath,
          snippet,
        });
      }
    }

    USER_SERVICE_IMPORT_PATTERN.lastIndex = 0;
    if (USER_SERVICE_IMPORT_PATTERN.test(source)) {
      pushViolation(violations, 'activity_imports_user_service_module', {
        file: relativePath,
      });
    }

    const findings = scan(relativePath, USER_WRITE_PATTERNS);
    if (findings.length > 0) {
      pushViolation(violations, 'activity_writes_user_boundary', {
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
          'activity_no_auth_me_takeover',
          'activity_no_direct_user_write',
          'activity_reuses_shared_session_csrf',
          'activity_list_uses_owner_tenant_visibility',
          'activity_admin_routes_use_tenant_template_guards',
          'activity_complete_requires_tenant_context',
        ],
        violations,
      },
      null,
      2,
    ),
  );

  if (violations.length > 0) process.exit(1);
}

main();
