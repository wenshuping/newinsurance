#!/usr/bin/env node

import fs from 'node:fs';
import { gatewayRouteMap, gatewayServiceRegistry, isGatewayServiceEnabled } from '../server/microservices/gateway/route-map.mjs';
import { userServiceOwnedRoutes } from '../server/microservices/user-service/router.mjs';
import { pointsServiceOwnedRoutes } from '../server/microservices/points-service/router.mjs';
import { learningServiceOwnedRoutes } from '../server/microservices/learning-service/boundary.mjs';

function sortUnique(items) {
  return Array.from(new Set((items || []).map((item) => String(item || '').trim()).filter(Boolean))).sort();
}

function assert(condition, message, context = null) {
  if (condition) return;
  const error = new Error(message);
  error.context = context;
  throw error;
}

function compare(expected, actual) {
  return {
    missing: expected.filter((item) => !actual.includes(item)),
    unexpected: actual.filter((item) => !expected.includes(item)),
  };
}

async function main() {
  const repoRoot = process.cwd();
  const monolithLearningRoutePath = `${repoRoot}/server/skeleton-c-v1/routes/learning.routes.mjs`;
  const monolithRewardServicePath = `${repoRoot}/server/skeleton-c-v1/services/learning-reward.service.mjs`;
  const monolithLearningRouteSource = fs.readFileSync(monolithLearningRoutePath, 'utf8');
  const monolithRewardServiceSource = fs.readFileSync(monolithRewardServicePath, 'utf8');
  const gatewayLearning = gatewayRouteMap.find((item) => item.service === 'learning-service');
  const expectedLearningRoutes = sortUnique(learningServiceOwnedRoutes);
  const gatewayLearningRoutes = sortUnique(gatewayLearning?.routes || []);
  const userRoutes = sortUnique(userServiceOwnedRoutes);
  const pointsRoutes = sortUnique(pointsServiceOwnedRoutes);
  const overlaps = {
    user: expectedLearningRoutes.filter((item) => userRoutes.includes(item)),
    points: expectedLearningRoutes.filter((item) => pointsRoutes.includes(item)),
  };
  const diff = compare(expectedLearningRoutes, gatewayLearningRoutes);
  const registry = gatewayServiceRegistry['learning-service'] || null;

  assert(Boolean(registry), 'gateway missing learning-service registry item');
  assert(Boolean(gatewayLearning), 'gateway missing learning-service route owner');
  assert(registry.envKey === 'GATEWAY_LEARNING_SERVICE_URL', 'learning-service env key drifted', { registry });
  assert(registry.flagEnvKey === 'GATEWAY_ENABLE_LEARNING_SERVICE', 'learning-service enable flag drifted', { registry });
  assert(registry.enabledByDefault === false, 'learning-service should stay disabled by default', { registry });
  assert(isGatewayServiceEnabled('learning-service', {}) === false, 'learning-service should be disabled by default');
  assert(diff.missing.length === 0, 'gateway missing learning-service routes', diff);
  assert(diff.unexpected.length === 0, 'gateway has unexpected learning-service routes', diff);
  assert(overlaps.user.length === 0, 'learning-service overlaps user-service routes', overlaps);
  assert(overlaps.points.length === 0, 'learning-service overlaps points-service routes', overlaps);
  assert(gatewayLearningRoutes.includes('/api/learning/courses/:id/complete'), 'learning complete route must be owned by learning-service', {
    gatewayLearningRoutes,
  });
  assert(gatewayLearningRoutes.includes('/api/learning/games'), 'learning games route must be owned by learning-service', {
    gatewayLearningRoutes,
  });
  assert(gatewayLearningRoutes.includes('/api/learning/tools'), 'learning tools route must be owned by learning-service', {
    gatewayLearningRoutes,
  });
  assert(monolithLearningRouteSource.includes('settleLearningCourseRewardViaPointsService'), 'monolith learning route must use points-service reward adapter');
  assert(!monolithLearningRouteSource.includes('settleLearningCourseRewardLocal'), 'monolith learning route must not reference local reward settlement');
  assert(monolithRewardServiceSource.includes('settleLearningRewardOverHttp'), 'monolith learning reward service must delegate to points-service HTTP contract');
  assert(!monolithRewardServiceSource.includes('recordPoints('), 'monolith learning reward service must not write points locally');

  console.log(
    JSON.stringify(
      {
        ok: true,
        checks: [
          {
            name: 'gateway.learning-service.registry',
            ok: true,
            envKey: registry.envKey,
            flagEnvKey: registry.flagEnvKey,
            enabledByDefault: registry.enabledByDefault,
          },
          {
            name: 'gateway.learning-service.routes',
            ok: true,
            routeCount: gatewayLearningRoutes.length,
            completeRoutedToLearning: gatewayLearningRoutes.includes('/api/learning/courses/:id/complete'),
            gamesRoutedToLearning: gatewayLearningRoutes.includes('/api/learning/games'),
            toolsRoutedToLearning: gatewayLearningRoutes.includes('/api/learning/tools'),
          },
          {
            name: 'learning-service.no-route-overlap',
            ok: true,
            userOverlapCount: overlaps.user.length,
            pointsOverlapCount: overlaps.points.length,
          },
          {
            name: 'week14.monolith-learning-complete.uses-points-contract',
            ok: true,
            monolithRouteUsesPointsAdapter: true,
            monolithRewardServiceUsesHttpContract: true,
          },
        ],
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: String(error?.message || error),
        context: error?.context || null,
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
