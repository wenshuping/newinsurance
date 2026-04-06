#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {
  activityServiceCompatibilityLayers,
  activityServiceForbiddenPointsTables,
  activityServiceOwnedRoutes,
  activityServiceSplitConclusion,
  pointsServicePermanentActivityAdjacentRoutes,
} from '../server/microservices/activity-service/boundary.mjs';
import { pointsServiceOwnedRoutes } from '../server/microservices/points-service/router.mjs';

const ROOT = process.cwd();
const EXPECTED_ACTIVITY_ROUTES = [
  '/api/activities',
  '/api/activities/:id/complete',
  '/api/p/activities',
  '/api/p/activities/:id',
  '/api/b/activity-configs',
  '/api/b/activity-configs/:id',
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

function main() {
  const violations = [];

  const activityRoutes = sortUnique(activityServiceOwnedRoutes);
  const expectedActivityRoutes = sortUnique(EXPECTED_ACTIVITY_ROUTES);
  if (JSON.stringify(activityRoutes) !== JSON.stringify(expectedActivityRoutes)) {
    violations.push({
      type: 'activity_owned_routes_mismatch',
      expected: expectedActivityRoutes,
      actual: activityRoutes,
    });
  }

  for (const route of pointsServicePermanentActivityAdjacentRoutes) {
    if (!pointsServiceOwnedRoutes.includes(route)) {
      violations.push({
        type: 'points_missing_permanent_route',
        route,
      });
    }
    if (activityServiceOwnedRoutes.includes(route)) {
      violations.push({
        type: 'activity_claims_points_permanent_route',
        route,
      });
    }
  }

  for (const layer of activityServiceCompatibilityLayers) {
    if (!fs.existsSync(toAbsolute(layer.file))) {
      violations.push({
        type: 'compatibility_layer_missing',
        file: layer.file,
      });
    }
  }

  const clientRouteSource = read('server/microservices/activity-service/c-activity.routes.mjs');
  ensureIncludes(
    clientRouteSource,
    'settleReward: settleActivityRewardOverHttp',
    violations,
    'activity_complete_missing_points_http_caller',
    'server/microservices/activity-service/c-activity.routes.mjs',
  );
  ensureExcludes(
    clientRouteSource,
    'recordPoints(',
    violations,
    'activity_client_route_local_points_write',
    'server/microservices/activity-service/c-activity.routes.mjs',
  );
  ensureExcludes(
    clientRouteSource,
    'appendPoints(',
    violations,
    'activity_client_route_local_points_append',
    'server/microservices/activity-service/c-activity.routes.mjs',
  );

  const pointsClientSource = read('server/microservices/activity-service/points-service.client.mjs');
  ensureIncludes(
    pointsClientSource,
    '/internal/points-service/activity-rewards/settle',
    violations,
    'activity_points_client_missing_contract_endpoint',
    'server/microservices/activity-service/points-service.client.mjs',
  );
  ensureIncludes(
    pointsClientSource,
    "'x-internal-service': 'activity-service'",
    violations,
    'activity_points_client_missing_internal_caller_header',
    'server/microservices/activity-service/points-service.client.mjs',
  );

  const pointsRewardRouteSource = read('server/microservices/points-service/activity-reward.route.mjs');
  ensureIncludes(
    pointsRewardRouteSource,
    "router.post('/internal/points-service/activity-rewards/settle'",
    violations,
    'points_missing_activity_reward_route',
    'server/microservices/points-service/activity-reward.route.mjs',
  );
  ensureIncludes(
    pointsRewardRouteSource,
    "caller !== 'activity-service'",
    violations,
    'points_missing_activity_internal_caller_guard',
    'server/microservices/points-service/activity-reward.route.mjs',
  );

  const legacyRouteSource = read('server/skeleton-c-v1/routes/activities.routes.mjs');
  ensureIncludes(
    legacyRouteSource,
    'settleActivityRewardViaPointsService',
    violations,
    'legacy_activity_route_missing_points_adapter',
    'server/skeleton-c-v1/routes/activities.routes.mjs',
  );
  ensureIncludes(
    legacyRouteSource,
    "app.post('/api/sign-in'",
    violations,
    'legacy_activity_route_missing_sign_in_residue_marker',
    'server/skeleton-c-v1/routes/activities.routes.mjs',
  );
  ensureExcludes(
    legacyRouteSource,
    'recordPoints(',
    violations,
    'legacy_activity_route_local_points_write',
    'server/skeleton-c-v1/routes/activities.routes.mjs',
  );

  const legacyServiceSource = read('server/skeleton-c-v1/services/activity-reward.service.mjs');
  ensureIncludes(
    legacyServiceSource,
    'settleActivityRewardOverHttp',
    violations,
    'legacy_activity_reward_service_missing_http_adapter',
    'server/skeleton-c-v1/services/activity-reward.service.mjs',
  );
  ensureExcludes(
    legacyServiceSource,
    'recordPoints(',
    violations,
    'legacy_activity_reward_service_local_points_write',
    'server/skeleton-c-v1/services/activity-reward.service.mjs',
  );
  ensureExcludes(
    legacyServiceSource,
    'appendPoints(',
    violations,
    'legacy_activity_reward_service_local_points_append',
    'server/skeleton-c-v1/services/activity-reward.service.mjs',
  );

  const pointsRouterSource = read('server/microservices/points-service/router.mjs');
  for (const route of pointsServicePermanentActivityAdjacentRoutes) {
    if (!pointsRouterSource.includes(`'${route}'`)) {
      violations.push({
        type: 'points_router_missing_declared_route',
        file: 'server/microservices/points-service/router.mjs',
        route,
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: violations.length === 0,
        checks: [
          'activity_stable_routes_are_fixed',
          'points_permanent_routes_stay_in_points_service',
          'activity_complete_uses_points_internal_contract',
          'points_exposes_activity_reward_provider_route',
          'legacy_activity_layers_remain_controlled',
        ],
        forbiddenPointsTables: activityServiceForbiddenPointsTables,
        splitConclusion: activityServiceSplitConclusion,
        compatibilityLayers: activityServiceCompatibilityLayers,
        pointsPermanentRoutes: pointsServicePermanentActivityAdjacentRoutes,
        violations,
      },
      null,
      2,
    ),
  );

  if (violations.length > 0) process.exit(1);
}

main();
