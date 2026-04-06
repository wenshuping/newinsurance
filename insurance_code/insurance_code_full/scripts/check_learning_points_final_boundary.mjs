#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  learningServiceBridgeCompatibilityContracts,
  learningServiceBridgeCompatibilityRoutes,
  learningServiceOwnedRoutes,
  learningServiceRewardSettlementContract,
  learningServiceSplitConclusion,
} from '../server/microservices/learning-service/boundary.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..');
const POINTS_MAIN_TABLES = [
  'c_point_accounts',
  'c_point_transactions',
  'p_products',
  'p_orders',
  'c_redeem_records',
  'c_sign_ins',
];
const EXPECTED_LEARNING_ROUTES = [
  '/api/learning/courses',
  '/api/learning/games',
  '/api/learning/tools',
  '/api/learning/courses/:id',
  '/api/learning/courses/:id/complete',
  '/api/p/learning/courses',
  '/api/p/learning/courses/:id',
];
const EXPECTED_BRIDGE_ROUTES = [
  '/api/b/content/items',
  '/api/b/content/items/:id',
];
const EXPECTED_BRIDGE_CONTRACTS = [
  'GET /api/b/content/items',
  'POST /api/b/content/items',
  'PUT /api/b/content/items/:id',
];
const LEARNING_REVIEW_ROOTS = [
  'server/microservices/learning-service',
  'server/skeleton-c-v1/routes/learning.routes.mjs',
  'server/skeleton-c-v1/routes/p-admin-learning.routes.mjs',
  'server/skeleton-c-v1/routes/b-admin-content.routes.mjs',
  'server/skeleton-c-v1/services/learning-service.bridge.mjs',
  'server/skeleton-c-v1/usecases/learning-complete.usecase.mjs',
  'server/skeleton-c-v1/services/learning-reward.service.mjs',
];

function toAbsolute(relativePath) {
  return path.join(ROOT, relativePath);
}

function read(relativePath) {
  return fs.readFileSync(toAbsolute(relativePath), 'utf8');
}

function sortUnique(values) {
  return Array.from(new Set((values || []).map((item) => String(item || '').trim()).filter(Boolean))).sort();
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

function scanForForbiddenPatterns(relativePath) {
  const source = read(relativePath);
  const findings = [];
  const directWritePatterns = [
    { type: 'append_points', regex: /\bappendPoints\s*\(/g },
    { type: 'record_points', regex: /\brecordPoints\s*\(/g },
    { type: 'points_runtime_write', regex: /\bstate\.(pointAccounts|pointTransactions|orders|redemptions|signIns|pProducts)\s*=|\bstate\.(pointAccounts|pointTransactions|orders|redemptions|signIns|pProducts)\.(push|unshift|splice|pop|shift)\s*\(/g },
    { type: 'points_sql_write', regex: /\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM|MERGE\s+INTO|UPSERT\s+INTO)\s+(c_point_accounts|c_point_transactions|p_products|p_orders|c_redeem_records|c_sign_ins)\b/gi },
  ];

  for (const rule of directWritePatterns) {
    rule.regex.lastIndex = 0;
    for (const match of source.matchAll(rule.regex)) {
      findings.push({ type: rule.type, matched: String(match[0] || '').trim() });
    }
  }

  return findings;
}

function ensureIncludes(source, snippet, violations, type, file) {
  if (!source.includes(snippet)) {
    violations.push({ type, file, snippet });
  }
}

function ensureExcludes(source, snippet, violations, type, file) {
  if (source.includes(snippet)) {
    violations.push({ type, file, snippet });
  }
}

function compare(expected, actual) {
  return {
    missing: expected.filter((item) => !actual.includes(item)),
    unexpected: actual.filter((item) => !expected.includes(item)),
  };
}

function main() {
  const violations = [];

  const routeDiff = compare(sortUnique(EXPECTED_LEARNING_ROUTES), sortUnique(learningServiceOwnedRoutes));
  if (routeDiff.missing.length > 0 || routeDiff.unexpected.length > 0) {
    violations.push({
      type: 'learning_owned_routes_mismatch',
      expected: sortUnique(EXPECTED_LEARNING_ROUTES),
      actual: sortUnique(learningServiceOwnedRoutes),
      diff: routeDiff,
    });
  }

  const bridgeRouteDiff = compare(sortUnique(EXPECTED_BRIDGE_ROUTES), sortUnique(learningServiceBridgeCompatibilityRoutes));
  if (bridgeRouteDiff.missing.length > 0 || bridgeRouteDiff.unexpected.length > 0) {
    violations.push({
      type: 'learning_bridge_routes_mismatch',
      expected: sortUnique(EXPECTED_BRIDGE_ROUTES),
      actual: sortUnique(learningServiceBridgeCompatibilityRoutes),
      diff: bridgeRouteDiff,
    });
  }

  const bridgeContractDiff = compare(sortUnique(EXPECTED_BRIDGE_CONTRACTS), sortUnique(learningServiceBridgeCompatibilityContracts));
  if (bridgeContractDiff.missing.length > 0 || bridgeContractDiff.unexpected.length > 0) {
    violations.push({
      type: 'learning_bridge_contracts_mismatch',
      expected: sortUnique(EXPECTED_BRIDGE_CONTRACTS),
      actual: sortUnique(learningServiceBridgeCompatibilityContracts),
      diff: bridgeContractDiff,
    });
  }

  if (learningServiceRewardSettlementContract.endpoint !== '/internal/points-service/learning-rewards/settle') {
    violations.push({
      type: 'learning_reward_contract_endpoint_drift',
      actual: learningServiceRewardSettlementContract.endpoint,
    });
  }

  if (learningServiceSplitConclusion?.formalSplitReady !== true || learningServiceSplitConclusion?.status !== 'formally_split') {
    violations.push({
      type: 'learning_formal_split_conclusion_not_finalized',
      actual: learningServiceSplitConclusion,
    });
  }

  const serviceRouteSource = read('server/microservices/learning-service/c-learning.routes.mjs');
  ensureIncludes(
    serviceRouteSource,
    'settleReward: settleLearningRewardOverHttp',
    violations,
    'learning_service_route_missing_points_http_settlement',
    'server/microservices/learning-service/c-learning.routes.mjs',
  );
  ensureIncludes(
    serviceRouteSource,
    "router.get('/api/learning/games'",
    violations,
    'learning_service_route_missing_games_route',
    'server/microservices/learning-service/c-learning.routes.mjs',
  );
  ensureIncludes(
    serviceRouteSource,
    "router.get('/api/learning/tools'",
    violations,
    'learning_service_route_missing_tools_route',
    'server/microservices/learning-service/c-learning.routes.mjs',
  );

  const pointsClientSource = read('server/microservices/learning-service/points-service.client.mjs');
  ensureIncludes(
    pointsClientSource,
    '/internal/points-service/learning-rewards/settle',
    violations,
    'learning_points_client_missing_contract_endpoint',
    'server/microservices/learning-service/points-service.client.mjs',
  );
  ensureIncludes(
    pointsClientSource,
    "'x-internal-service': 'learning-service'",
    violations,
    'learning_points_client_missing_internal_caller_header',
    'server/microservices/learning-service/points-service.client.mjs',
  );

  const legacyRouteSource = read('server/skeleton-c-v1/routes/learning.routes.mjs');
  ensureIncludes(
    legacyRouteSource,
    'forwardLearningServiceRequest',
    violations,
    'legacy_learning_route_missing_bridge_forwarder',
    'server/skeleton-c-v1/routes/learning.routes.mjs',
  );
  ensureIncludes(
    legacyRouteSource,
    'listLearningCourses',
    violations,
    'legacy_learning_route_missing_courses_read_fallback',
    'server/skeleton-c-v1/routes/learning.routes.mjs',
  );
  ensureIncludes(
    legacyRouteSource,
    'listLearningGames',
    violations,
    'legacy_learning_route_missing_games_read_fallback',
    'server/skeleton-c-v1/routes/learning.routes.mjs',
  );
  ensureIncludes(
    legacyRouteSource,
    'listLearningTools',
    violations,
    'legacy_learning_route_missing_tools_read_fallback',
    'server/skeleton-c-v1/routes/learning.routes.mjs',
  );
  ensureExcludes(
    legacyRouteSource,
    'settleLearningCourseRewardLocal',
    violations,
    'legacy_learning_route_still_uses_local_reward_handler',
    'server/skeleton-c-v1/routes/learning.routes.mjs',
  );
  ensureExcludes(
    legacyRouteSource,
    'settleLearningCourseRewardViaPointsService',
    violations,
    'legacy_learning_route_still_directly_uses_points_reward_adapter',
    'server/skeleton-c-v1/routes/learning.routes.mjs',
  );

  const bridgeServiceSource = read('server/skeleton-c-v1/services/learning-service.bridge.mjs');
  ensureIncludes(
    bridgeServiceSource,
    'resolveLearningServiceBaseUrl',
    violations,
    'learning_bridge_service_missing_base_url_resolver',
    'server/skeleton-c-v1/services/learning-service.bridge.mjs',
  );
  ensureIncludes(
    bridgeServiceSource,
    'forwardLearningServiceRequest',
    violations,
    'learning_bridge_service_missing_forwarder',
    'server/skeleton-c-v1/services/learning-service.bridge.mjs',
  );
  ensureIncludes(
    bridgeServiceSource,
    'x-learning-legacy-bridge',
    violations,
    'learning_bridge_service_missing_legacy_bridge_header',
    'server/skeleton-c-v1/services/learning-service.bridge.mjs',
  );
  ensureIncludes(
    bridgeServiceSource,
    'x-learning-bridge-target',
    violations,
    'learning_bridge_service_missing_bridge_target_header',
    'server/skeleton-c-v1/services/learning-service.bridge.mjs',
  );

  const pAdminLegacySource = read('server/skeleton-c-v1/routes/p-admin-learning.routes.mjs');
  ensureIncludes(
    pAdminLegacySource,
    'forwardLearningServiceRequest',
    violations,
    'legacy_p_learning_route_missing_bridge_forwarder',
    'server/skeleton-c-v1/routes/p-admin-learning.routes.mjs',
  );

  const bAdminLegacySource = read('server/skeleton-c-v1/routes/b-admin-content.routes.mjs');
  ensureIncludes(
    bAdminLegacySource,
    'forwardLearningServiceRequest',
    violations,
    'legacy_b_content_route_missing_bridge_forwarder',
    'server/skeleton-c-v1/routes/b-admin-content.routes.mjs',
  );

  const usecaseSource = read('server/skeleton-c-v1/usecases/learning-complete.usecase.mjs');
  ensureIncludes(
    usecaseSource,
    'resolveSettleReward(',
    violations,
    'learning_complete_missing_resolve_settle_reward',
    'server/skeleton-c-v1/usecases/learning-complete.usecase.mjs',
  );
  ensureIncludes(
    usecaseSource,
    'await settleReward(',
    violations,
    'learning_complete_missing_await_settle_reward',
    'server/skeleton-c-v1/usecases/learning-complete.usecase.mjs',
  );

  const legacyRewardServiceSource = read('server/skeleton-c-v1/services/learning-reward.service.mjs');
  ensureIncludes(
    legacyRewardServiceSource,
    'settleLearningRewardOverHttp',
    violations,
    'legacy_learning_reward_service_missing_http_adapter',
    'server/skeleton-c-v1/services/learning-reward.service.mjs',
  );

  const pointsRouteSource = read('server/microservices/points-service/learning-reward.route.mjs');
  ensureIncludes(
    pointsRouteSource,
    "router.post('/internal/points-service/learning-rewards/settle'",
    violations,
    'points_missing_learning_reward_contract_route',
    'server/microservices/points-service/learning-reward.route.mjs',
  );
  ensureIncludes(
    pointsRouteSource,
    "caller !== 'learning-service'",
    violations,
    'points_missing_learning_internal_caller_guard',
    'server/microservices/points-service/learning-reward.route.mjs',
  );

  const whitelist = JSON.parse(read('server/microservices/points-service/write-boundary-whitelist.json'));
  const learningIndirectCaller = Array.isArray(whitelist.indirectCrossDomainCallers)
    ? whitelist.indirectCrossDomainCallers.find((item) => String(item?.file || '') === 'server/skeleton-c-v1/usecases/learning-complete.usecase.mjs')
    : null;
  if (!learningIndirectCaller) {
    violations.push({ type: 'points_whitelist_missing_learning_indirect_caller' });
  } else {
    const actualPatterns = sortUnique(learningIndirectCaller.patterns || []);
    const expectedPatterns = sortUnique(['resolveSettleReward(', 'deps?.settleReward', 'await settleReward(']);
    const patternDiff = compare(expectedPatterns, actualPatterns);
    if (patternDiff.missing.length > 0 || patternDiff.unexpected.length > 0) {
      violations.push({
        type: 'points_whitelist_learning_patterns_drift',
        expected: expectedPatterns,
        actual: actualPatterns,
        diff: patternDiff,
      });
    }
  }

  const reviewFiles = sortUnique(LEARNING_REVIEW_ROOTS.flatMap((target) => walkMjsFiles(target)));
  for (const relativePath of reviewFiles) {
    const findings = scanForForbiddenPatterns(relativePath);
    if (findings.length === 0) continue;
    violations.push({
      type: 'learning_points_boundary_forbidden_write_pattern',
      file: relativePath,
      findings,
    });
  }

  console.log(
    JSON.stringify(
      {
        ok: violations.length === 0,
        checks: [
          'learning_formal_split_routes_match_current_model',
          'learning_bridge_compatibility_matches_current_model',
          'learning_complete_reaches_points_via_learning_service_contract',
          'legacy_learning_routes_are_bridge_or_read_fallback_only',
          'learning_paths_have_no_local_points_write_fallback',
          'learning_paths_have_no_direct_points_main_table_write',
          'points_whitelist_tracks_injected_learning_settlement',
        ],
        pointsMainTables: POINTS_MAIN_TABLES,
        rewardContract: learningServiceRewardSettlementContract,
        splitConclusion: learningServiceSplitConclusion,
        violations,
      },
      null,
      2,
    ),
  );

  if (violations.length > 0) process.exit(1);
}

main();
