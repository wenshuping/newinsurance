#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {
  activityServiceForbiddenPointsTables,
  activityServiceLegacyReviewRoots,
  activityServiceMainWriteTables,
  activityServiceOwnedRoutes,
  activityServiceProtectedServiceRoots,
  activityServiceStableContracts,
  activityServiceWriteBindings,
  activityServiceWriteWhitelist,
} from '../server/microservices/activity-service/boundary.mjs';

const ROOT = process.cwd();
const EXPECTED_MAIN_TABLES = ['c_activity_completions', 'p_activities'];
const EXPECTED_OWNED_ROUTES = [
  '/api/activities',
  '/api/activities/:id/complete',
  '/api/p/activities',
  '/api/p/activities/:id',
  '/api/b/activity-configs',
  '/api/b/activity-configs/:id',
];
const EXPECTED_STABLE_CONTRACTS = [
  'GET /api/activities',
  'POST /api/activities/:id/complete',
  'GET /api/p/activities',
  'POST /api/p/activities',
  'PUT /api/p/activities/:id',
  'DELETE /api/p/activities/:id',
  'GET /api/b/activity-configs',
  'POST /api/b/activity-configs',
  'PUT /api/b/activity-configs/:id',
];
const FORBIDDEN_ROUTE_SNIPPETS = [
  '/api/auth/send-code',
  '/api/auth/verify-basic',
  '/api/me',
  '/api/sign-in',
  '/api/mall/activities',
  '/api/mall/activities/:id/join',
  '/api/mall/redeem',
  '/api/redemptions/:id/writeoff',
];
const USER_WRITE_PATTERNS = [
  {
    key: 'state_users_write',
    regex: /\bstate\.users\s*=|\bstate\.users\.(push|unshift|splice|pop|shift|sort|reverse)\s*\(/g,
  },
  {
    key: 'state_sessions_write',
    regex: /\bstate\.sessions\s*=|\bstate\.sessions\.(push|unshift|splice|pop|shift|sort|reverse)\s*\(/g,
  },
  {
    key: 'create_session_invocation',
    regex: /\b(createSession|createActorSession)\s*\(/g,
  },
  {
    key: 'user_table_sql_write',
    regex: /\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM|MERGE\s+INTO|UPSERT\s+INTO)\s+(app_users|c_customers|p_sessions)\b/gi,
  },
];
const POINTS_BYPASS_PATTERNS = [
  {
    key: 'record_points_invocation',
    regex: /\brecordPoints\s*\(/g,
  },
  {
    key: 'append_points_invocation',
    regex: /\bappendPoints\s*\(/g,
  },
  {
    key: 'points_runtime_write',
    regex: /\bstate\.(pointAccounts|pointTransactions|orders|redemptions|signIns)\s*=|\bstate\.(pointAccounts|pointTransactions|orders|redemptions|signIns)\.(push|unshift|splice|pop|shift)\s*\(/g,
  },
  {
    key: 'points_table_sql_write',
    regex: /\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM|MERGE\s+INTO|UPSERT\s+INTO)\s+(c_point_accounts|c_point_transactions|p_orders|c_redeem_records|c_sign_ins)\b/gi,
  },
];
const CROSS_SERVICE_IMPORT_PATTERNS = [
  {
    key: 'user_service_module_import',
    regex: /from\s+['"][^'"]*microservices\/user-service\/[^'"]+['"]/g,
  },
  {
    key: 'points_service_module_import',
    regex: /from\s+['"][^'"]*microservices\/points-service\/[^'"]+['"]/g,
  },
];
const ACTIVITY_OWNED_CODE_FILES = [
  ...activityServiceWriteWhitelist.routes,
  ...activityServiceWriteWhitelist.usecases,
  ...activityServiceWriteWhitelist.repositories,
];

function toAbsolute(relativePath) {
  return path.join(ROOT, relativePath);
}

function lineOf(source, index) {
  return source.slice(0, index).split('\n').length;
}

function trimSnippet(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 200);
}

function walkMjsFiles(relativeTarget) {
  const absoluteTarget = toAbsolute(relativeTarget);
  if (!fs.existsSync(absoluteTarget)) return [];
  const stat = fs.statSync(absoluteTarget);
  if (stat.isFile()) return [relativeTarget];

  const files = [];
  const stack = [absoluteTarget];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const absoluteChild = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absoluteChild);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith('.mjs')) continue;
      files.push(path.relative(ROOT, absoluteChild));
    }
  }
  return files.sort();
}

function scan(relativePath, patterns) {
  const source = fs.readFileSync(toAbsolute(relativePath), 'utf8');
  const findings = [];
  for (const rule of patterns) {
    rule.regex.lastIndex = 0;
    for (const match of source.matchAll(rule.regex)) {
      const index = match.index ?? 0;
      const line = lineOf(source, index);
      const lineText = source.split('\n')[line - 1] || '';
      findings.push({
        rule: rule.key,
        line,
        matched: trimSnippet(match[0]),
        context: trimSnippet(lineText),
      });
    }
  }
  return findings;
}

function ensureBindings(bindingGroup, violations) {
  for (const binding of bindingGroup) {
    const absolutePath = toAbsolute(binding.file);
    if (!fs.existsSync(absolutePath)) {
      violations.push({ type: 'missing_whitelist_file', file: binding.file });
      continue;
    }
    const source = fs.readFileSync(absolutePath, 'utf8');
    for (const requiredImport of binding.requiredImports || []) {
      if (!source.includes(requiredImport)) {
        violations.push({
          type: 'missing_required_import',
          file: binding.file,
          requiredImport,
        });
      }
    }
  }
}

function sortUnique(items) {
  return Array.from(new Set((items || []).map((item) => String(item || '').trim()).filter(Boolean))).sort();
}

function main() {
  const violations = [];
  const serviceFiles = new Set(activityServiceProtectedServiceRoots.flatMap((target) => walkMjsFiles(target)));

  const declaredTables = sortUnique(activityServiceMainWriteTables.map((item) => item.table));
  if (JSON.stringify(declaredTables) !== JSON.stringify(sortUnique(EXPECTED_MAIN_TABLES))) {
    violations.push({
      type: 'main_write_tables_mismatch',
      expected: EXPECTED_MAIN_TABLES,
      actual: declaredTables,
    });
  }

  if (JSON.stringify(sortUnique(activityServiceOwnedRoutes)) !== JSON.stringify(sortUnique(EXPECTED_OWNED_ROUTES))) {
    violations.push({
      type: 'owned_routes_mismatch',
      expected: EXPECTED_OWNED_ROUTES,
      actual: sortUnique(activityServiceOwnedRoutes),
    });
  }

  if (JSON.stringify(sortUnique(activityServiceStableContracts)) !== JSON.stringify(sortUnique(EXPECTED_STABLE_CONTRACTS))) {
    violations.push({
      type: 'stable_contracts_mismatch',
      expected: EXPECTED_STABLE_CONTRACTS,
      actual: sortUnique(activityServiceStableContracts),
    });
  }

  ensureBindings(activityServiceWriteBindings.routes, violations);
  ensureBindings(activityServiceWriteBindings.usecases || [], violations);

  for (const relativePath of serviceFiles) {
    if (!fs.existsSync(toAbsolute(relativePath))) continue;
    const source = fs.readFileSync(toAbsolute(relativePath), 'utf8');
    const metadataOnlyFile = relativePath.endsWith('server/microservices/activity-service/boundary.mjs');
    if (!metadataOnlyFile) {
      for (const snippet of FORBIDDEN_ROUTE_SNIPPETS) {
        if (source.includes(snippet)) {
          violations.push({
            type: 'forbidden_route_exposed',
            file: relativePath,
            snippet,
          });
        }
      }
    }

    const userWriteFindings = scan(relativePath, USER_WRITE_PATTERNS);
    if (userWriteFindings.length > 0) {
      violations.push({
        type: 'activity_service_writes_user_boundary',
        file: relativePath,
        findings: userWriteFindings,
      });
    }

    const pointsBypassFindings = scan(relativePath, POINTS_BYPASS_PATTERNS);
    if (pointsBypassFindings.length > 0) {
      violations.push({
        type: 'activity_service_writes_points_boundary',
        file: relativePath,
        findings: pointsBypassFindings,
      });
    }

    const crossServiceImports = scan(relativePath, CROSS_SERVICE_IMPORT_PATTERNS);
    if (crossServiceImports.length > 0) {
      violations.push({
        type: 'activity_service_imports_points_service_module',
        file: relativePath,
        findings: crossServiceImports,
      });
    }
  }

  for (const relativePath of ACTIVITY_OWNED_CODE_FILES) {
    if (!fs.existsSync(toAbsolute(relativePath))) continue;
    const pointsBypassFindings = scan(relativePath, POINTS_BYPASS_PATTERNS);
    if (pointsBypassFindings.length > 0) {
      violations.push({
        type: 'activity_owned_code_bypasses_points_contract',
        file: relativePath,
        findings: pointsBypassFindings,
      });
    }
  }

  for (const relativePath of activityServiceLegacyReviewRoots) {
    if (!fs.existsSync(toAbsolute(relativePath))) continue;
    const source = fs.readFileSync(toAbsolute(relativePath), 'utf8');
    if (relativePath.endsWith('activity-complete.usecase.mjs')) {
      if (!source.includes('resolveSettleReward(') || !source.includes('await settleReward(')) {
        violations.push({
          type: 'activity_complete_missing_injected_settlement',
          file: relativePath,
        });
      }
      if (source.includes('recordPoints(')) {
        violations.push({
          type: 'activity_complete_still_calls_recordPoints',
          file: relativePath,
        });
      }
    }
    if (relativePath.endsWith('activity-reward.service.mjs')) {
      if (!source.includes('settleActivityRewardOverHttp')) {
        violations.push({
          type: 'legacy_activity_reward_service_missing_http_adapter',
          file: relativePath,
        });
      }
      if (source.includes('recordPoints(')) {
        violations.push({
          type: 'legacy_activity_reward_service_writes_points_locally',
          file: relativePath,
        });
      }
    }
    if (relativePath.endsWith('activities.routes.mjs')) {
      if (!source.includes('settleActivityRewardViaPointsService')) {
        violations.push({
          type: 'legacy_activity_route_missing_points_adapter',
          file: relativePath,
        });
      }
      if (!source.includes("app.post('/api/activities/:id/complete', authRequired, tenantContext,")) {
        violations.push({
          type: 'legacy_activity_route_missing_tenant_context',
          file: relativePath,
        });
      }
    }
  }

  const routerSource = fs.readFileSync(toAbsolute('server/microservices/activity-service/router.mjs'), 'utf8');
  if (!routerSource.includes("/internal/activity-service/observability")) {
    violations.push({
      type: 'missing_internal_observability_route',
      file: 'server/microservices/activity-service/router.mjs',
    });
  }

  console.log(
    JSON.stringify(
      {
        ok: violations.length === 0,
        checks: [
          'activity_main_write_tables_match_stable',
          'activity_owned_routes_match_stable',
          'activity_stable_contracts_match_stable',
          'activity_service_does_not_expose_frozen_routes',
          'activity_service_does_not_write_points_main_tables',
          'activity_complete_uses_injected_points_settlement',
          'legacy_activity_route_uses_points_adapter',
          'activity_service_has_internal_observability_route',
        ],
        forbiddenPointsTables: activityServiceForbiddenPointsTables,
        violations,
      },
      null,
      2,
    ),
  );

  if (violations.length > 0) process.exit(1);
}

main();
