#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {
  learningServiceBridgeCompatibilityContracts,
  learningServiceBridgeCompatibilityRoutes,
  learningServiceCompatibilityLayers,
  learningServiceDeprecatedContracts,
  learningServiceDeprecatedRoutes,
  learningServiceForbiddenUserTables,
  learningServiceLegacyReviewRoots,
  learningServiceMainWriteTables,
  learningServiceOwnedRoutes,
  learningServicePilotCompatibilityContracts,
  learningServicePilotCompatibilityRoutes,
  learningServiceProtectedServiceRoots,
  learningServiceSplitConclusion,
  learningServiceStableContracts,
  learningServiceWriteBindings,
  learningServiceWriteWhitelist,
} from '../server/microservices/learning-service/boundary.mjs';

const ROOT = process.cwd();
const EXPECTED_STABLE_MAIN_TABLES = ['p_learning_materials', 'c_learning_records'];
const EXPECTED_STABLE_ROUTES = [
  '/api/learning/courses',
  '/api/learning/games',
  '/api/learning/tools',
  '/api/learning/courses/:id',
  '/api/learning/courses/:id/complete',
  '/api/p/learning/courses',
  '/api/p/learning/courses/:id',
];
const EXPECTED_STABLE_CONTRACTS = [
  'GET /api/learning/courses',
  'GET /api/learning/games',
  'GET /api/learning/tools',
  'GET /api/learning/courses/:id',
  'POST /api/learning/courses/:id/complete',
  'GET /api/p/learning/courses',
  'POST /api/p/learning/courses',
  'PUT /api/p/learning/courses/:id',
  'DELETE /api/p/learning/courses/:id',
];
const EXPECTED_BRIDGE_ROUTES = ['/api/b/content/items', '/api/b/content/items/:id'];
const EXPECTED_BRIDGE_CONTRACTS = [
  'GET /api/b/content/items',
  'POST /api/b/content/items',
  'PUT /api/b/content/items/:id',
];
const EXPECTED_DEPRECATED_ROUTES = [];
const EXPECTED_DEPRECATED_CONTRACTS = [];
const FORBIDDEN_ROUTE_SNIPPETS = ['/api/auth/send-code', '/api/auth/verify-basic', '/api/me'];
const USER_WRITE_PATTERNS = [
  {
    key: 'state_users_write',
    regex: /\bstate\.(users|sessions)\s*=|\bstate\.(users|sessions)\.(push|unshift|splice|pop|shift|sort|reverse)\s*\(/g,
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
const LEARNING_WRITE_PATTERNS = [
  {
    key: 'learning_runtime_write',
    regex: /\bstate\.(learningCourses|courseCompletions|pLearningMaterials)\s*=|\bstate\.(learningCourses|courseCompletions|pLearningMaterials)\.(push|unshift|splice|pop|shift)\s*\(/g,
  },
  {
    key: 'learning_table_sql_write',
    regex: /\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM|MERGE\s+INTO|UPSERT\s+INTO)\s+(p_learning_materials|c_learning_records)\b/gi,
  },
];
const POINTS_CROSS_WRITE_PATTERNS = [
  { key: 'append_points_invocation', regex: /\bappendPoints\s*\(/g },
  { key: 'record_points_invocation', regex: /\brecordPoints\s*\(/g },
  {
    key: 'points_runtime_write',
    regex: /\bstate\.(pointAccounts|pointTransactions)\s*=|\bstate\.(pointAccounts|pointTransactions)\.(push|unshift|splice|pop|shift)\s*\(/g,
  },
  {
    key: 'points_table_sql_write',
    regex: /\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM|MERGE\s+INTO|UPSERT\s+INTO)\s+(c_point_accounts|c_point_transactions)\b/gi,
  },
];
const CROSS_SERVICE_IMPORT_PATTERNS = [
  {
    key: 'points_service_module_import',
    regex: /from\s+['"][^'"]*microservices\/points-service\/[^'"]+['"]/g,
  },
];
const LEGACY_BRIDGE_BINDINGS = [
  {
    file: 'server/skeleton-c-v1/routes/learning.routes.mjs',
    required: ['forwardLearningServiceRequest'],
  },
  {
    file: 'server/skeleton-c-v1/routes/p-admin-learning.routes.mjs',
    required: ['forwardLearningServiceRequest'],
  },
  {
    file: 'server/skeleton-c-v1/routes/b-admin-content.routes.mjs',
    required: ['forwardLearningServiceRequest'],
  },
  {
    file: 'server/skeleton-c-v1/services/learning-service.bridge.mjs',
    required: ['resolveLearningServiceBaseUrl', 'forwardLearningServiceRequest', 'respondLearningRouteDeprecated'],
  },
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

function sortUnique(items) {
  return Array.from(new Set((items || []).map((item) => String(item || '').trim()).filter(Boolean))).sort();
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
        violations.push({ type: 'missing_required_import', file: binding.file, requiredImport });
      }
    }
  }
}

function ensureDeclared(actual, expected, type, violations) {
  if (JSON.stringify(sortUnique(actual)) !== JSON.stringify(sortUnique(expected))) {
    violations.push({ type, expected: sortUnique(expected), actual: sortUnique(actual) });
  }
}

function main() {
  const violations = [];
  const legacyFindings = [];
  const serviceFiles = new Set(learningServiceProtectedServiceRoots.flatMap((target) => walkMjsFiles(target)));

  ensureDeclared(learningServiceMainWriteTables.map((item) => item.table), EXPECTED_STABLE_MAIN_TABLES, 'stable_main_write_tables_mismatch', violations);
  ensureDeclared(learningServiceOwnedRoutes, EXPECTED_STABLE_ROUTES, 'stable_owned_routes_mismatch', violations);
  ensureDeclared(learningServiceStableContracts, EXPECTED_STABLE_CONTRACTS, 'stable_contracts_mismatch', violations);
  ensureDeclared(learningServiceBridgeCompatibilityRoutes, EXPECTED_BRIDGE_ROUTES, 'bridge_routes_mismatch', violations);
  ensureDeclared(learningServiceBridgeCompatibilityContracts, EXPECTED_BRIDGE_CONTRACTS, 'bridge_contracts_mismatch', violations);
  ensureDeclared(learningServiceDeprecatedRoutes, EXPECTED_DEPRECATED_ROUTES, 'deprecated_routes_mismatch', violations);
  ensureDeclared(learningServiceDeprecatedContracts, EXPECTED_DEPRECATED_CONTRACTS, 'deprecated_contracts_mismatch', violations);

  if (learningServicePilotCompatibilityRoutes.length > 0 || learningServicePilotCompatibilityContracts.length > 0) {
    violations.push({
      type: 'pilot_compatibility_not_cleared',
      routes: learningServicePilotCompatibilityRoutes,
      contracts: learningServicePilotCompatibilityContracts,
    });
  }

  if (!learningServiceSplitConclusion?.formalSplitReady || learningServiceSplitConclusion?.status !== 'formally_split') {
    violations.push({
      type: 'split_conclusion_not_finalized',
      splitConclusion: learningServiceSplitConclusion,
    });
  }

  if ((learningServiceCompatibilityLayers || []).length < 4) {
    violations.push({
      type: 'compatibility_layers_incomplete',
      compatibilityLayers: learningServiceCompatibilityLayers,
    });
  }

  ensureBindings(learningServiceWriteBindings.routes, violations);
  ensureBindings(learningServiceWriteBindings.usecases || [], violations);

  for (const binding of LEGACY_BRIDGE_BINDINGS) {
    const absolutePath = toAbsolute(binding.file);
    if (!fs.existsSync(absolutePath)) {
      violations.push({ type: 'missing_legacy_bridge_file', file: binding.file });
      continue;
    }
    const source = fs.readFileSync(absolutePath, 'utf8');
    for (const snippet of binding.required) {
      if (!source.includes(snippet)) {
        violations.push({ type: 'legacy_bridge_binding_missing', file: binding.file, snippet });
      }
    }
  }

  for (const relativePath of serviceFiles) {
    if (!fs.existsSync(toAbsolute(relativePath))) continue;
    const source = fs.readFileSync(toAbsolute(relativePath), 'utf8');
    for (const snippet of FORBIDDEN_ROUTE_SNIPPETS) {
      if (source.includes(snippet)) {
        violations.push({ type: 'forbidden_user_route_exposed', file: relativePath, snippet });
      }
    }
    const userWriteFindings = scan(relativePath, USER_WRITE_PATTERNS);
    if (userWriteFindings.length > 0) {
      violations.push({ type: 'learning_service_writes_user_boundary', file: relativePath, findings: userWriteFindings });
    }
    const crossServiceImports = scan(relativePath, CROSS_SERVICE_IMPORT_PATTERNS);
    if (crossServiceImports.length > 0) {
      violations.push({ type: 'learning_service_imports_points_service_module', file: relativePath, findings: crossServiceImports });
    }
  }

  const ownedCodeFiles = new Set([
    ...learningServiceWriteWhitelist.routes,
    ...learningServiceWriteWhitelist.usecases,
    ...learningServiceWriteWhitelist.repositories,
  ]);

  for (const relativePath of ownedCodeFiles) {
    if (!fs.existsSync(toAbsolute(relativePath))) continue;
    const pointsBypassFindings = scan(relativePath, POINTS_CROSS_WRITE_PATTERNS);
    if (pointsBypassFindings.length > 0) {
      violations.push({ type: 'learning_service_bypasses_points_contract', file: relativePath, findings: pointsBypassFindings });
    }
  }

  const whitelistFiles = new Set([
    ...learningServiceWriteWhitelist.routes,
    ...learningServiceWriteWhitelist.usecases,
    ...learningServiceWriteWhitelist.repositories,
    ...learningServiceWriteWhitelist.infra,
  ]);

  for (const relativePath of learningServiceLegacyReviewRoots) {
    if (!fs.existsSync(toAbsolute(relativePath))) continue;
    if (whitelistFiles.has(relativePath)) continue;
    const learningFindings = scan(relativePath, LEARNING_WRITE_PATTERNS);
    const pointsFindings = scan(relativePath, POINTS_CROSS_WRITE_PATTERNS);
    const crossServiceImports = scan(relativePath, CROSS_SERVICE_IMPORT_PATTERNS);
    if (crossServiceImports.length > 0) {
      violations.push({ type: 'legacy_learning_path_imports_points_service_module', file: relativePath, findings: crossServiceImports });
    }
    if (learningFindings.length === 0 && pointsFindings.length === 0) continue;
    legacyFindings.push({ file: relativePath, learningFindings, pointsFindings });
  }

  const payload = {
    ok: violations.length === 0,
    mainWriteTables: learningServiceMainWriteTables,
    forbiddenUserTables: learningServiceForbiddenUserTables,
    checks: [
      'stable_main_write_tables_declared',
      'stable_owned_routes_declared',
      'stable_contracts_declared',
      'bridge_and_deprecated_routes_declared',
      'pilot_compatibility_cleared',
      'split_conclusion_finalized',
      'route_and_usecase_bindings_verified',
      'learning_service_no_auth_me_routes',
      'learning_service_no_user_direct_write',
      'learning_service_no_points_direct_write',
      'legacy_learning_bridges_are_non_writing',
    ],
    legacyReviewRequired: legacyFindings.length > 0,
    legacyFindings,
    splitConclusion: learningServiceSplitConclusion,
    compatibilityLayers: learningServiceCompatibilityLayers,
    violations,
  };

  if (violations.length > 0) {
    console.error(JSON.stringify(payload, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify(payload, null, 2));
}

main();
