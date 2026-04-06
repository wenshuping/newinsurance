#!/usr/bin/env node

import fs from 'node:fs';
import {
  gatewayRouteMap,
  gatewayServiceRegistry,
  isGatewayServiceEnabled,
} from '../server/microservices/gateway/route-map.mjs';
import { learningServiceOwnedRoutes, learningServiceSplitConclusion } from '../server/microservices/learning-service/boundary.mjs';
import { userServiceOwnedRoutes } from '../server/microservices/user-service/router.mjs';
import { pointsServiceOwnedRoutes } from '../server/microservices/points-service/router.mjs';

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
  const monolithLearningRouteSource = fs.readFileSync(`${repoRoot}/server/skeleton-c-v1/routes/learning.routes.mjs`, 'utf8');
  const monolithPLearningRouteSource = fs.readFileSync(`${repoRoot}/server/skeleton-c-v1/routes/p-admin-learning.routes.mjs`, 'utf8');
  const monolithBContentRouteSource = fs.readFileSync(`${repoRoot}/server/skeleton-c-v1/routes/b-admin-content.routes.mjs`, 'utf8');
  const bridgeServiceSource = fs.readFileSync(`${repoRoot}/server/skeleton-c-v1/services/learning-service.bridge.mjs`, 'utf8');
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
  assert(learningServiceSplitConclusion?.formalSplitReady === true, 'learning split conclusion must be finalized', { learningServiceSplitConclusion });
  assert(monolithLearningRouteSource.includes('forwardLearningServiceRequest'), 'monolith learning route must keep complete bridge toward learning-service');
  assert(monolithLearningRouteSource.includes('listLearningCourses'), 'monolith learning route must retain local list fallback');
  assert(monolithLearningRouteSource.includes('getLearningCourseById'), 'monolith learning route must retain local detail fallback');
  assert(monolithLearningRouteSource.includes('listLearningGames'), 'monolith learning route must retain local games fallback');
  assert(monolithLearningRouteSource.includes('listLearningTools'), 'monolith learning route must retain local tools fallback');
  assert(monolithPLearningRouteSource.includes('forwardLearningServiceRequest'), 'monolith p-admin learning route must bridge to learning-service');
  assert(monolithBContentRouteSource.includes('forwardLearningServiceRequest'), 'monolith b-admin content route must bridge to learning-service');
  assert(bridgeServiceSource.includes('forwardLearningServiceRequest'), 'missing shared learning bridge service');

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
            routeSet: gatewayLearningRoutes,
          },
          {
            name: 'learning-service.no-route-overlap',
            ok: true,
            userOverlapCount: overlaps.user.length,
            pointsOverlapCount: overlaps.points.length,
          },
          {
            name: 'learning.monolith.read-fallback-and-complete-bridge',
            ok: true,
            stableReadFallbackRetained: true,
            completeBridgeRetained: true,
            compatibilityRoutesBridged: true,
          },
          {
            name: 'learning.formal-split-conclusion',
            ok: true,
            splitConclusion: learningServiceSplitConclusion,
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
