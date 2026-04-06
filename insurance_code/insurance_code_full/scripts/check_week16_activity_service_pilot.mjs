#!/usr/bin/env node

import { gatewayRouteMap, gatewayServiceRegistry, isGatewayServiceEnabled } from '../server/microservices/gateway/route-map.mjs';
import { activityServiceOwnedRoutes } from '../server/microservices/activity-service/boundary.mjs';
import { learningServiceOwnedRoutes } from '../server/microservices/learning-service/boundary.mjs';
import { pointsServiceOwnedRoutes } from '../server/microservices/points-service/router.mjs';
import { userServiceOwnedRoutes } from '../server/microservices/user-service/router.mjs';

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
  const gatewayActivity = gatewayRouteMap.find((item) => item.service === 'activity-service');
  const expectedActivityRoutes = sortUnique(activityServiceOwnedRoutes);
  const gatewayActivityRoutes = sortUnique(gatewayActivity?.routes || []);
  const userRoutes = sortUnique(userServiceOwnedRoutes);
  const pointsRoutes = sortUnique(pointsServiceOwnedRoutes);
  const learningRoutes = sortUnique(learningServiceOwnedRoutes);
  const overlaps = {
    user: expectedActivityRoutes.filter((item) => userRoutes.includes(item)),
    points: expectedActivityRoutes.filter((item) => pointsRoutes.includes(item)),
    learning: expectedActivityRoutes.filter((item) => learningRoutes.includes(item)),
  };
  const diff = compare(expectedActivityRoutes, gatewayActivityRoutes);
  const registry = gatewayServiceRegistry['activity-service'] || null;

  assert(Boolean(registry), 'gateway missing activity-service registry item');
  assert(Boolean(gatewayActivity), 'gateway missing activity-service route owner');
  assert(registry.envKey === 'GATEWAY_ACTIVITY_SERVICE_URL', 'activity-service env key drifted', { registry });
  assert(registry.flagEnvKey === 'GATEWAY_ENABLE_ACTIVITY_SERVICE', 'activity-service enable flag drifted', { registry });
  assert(registry.enabledByDefault === false, 'activity-service should stay disabled by default', { registry });
  assert(isGatewayServiceEnabled('activity-service', {}) === false, 'activity-service should be disabled by default');
  assert(diff.missing.length === 0, 'gateway missing activity-service pilot routes', diff);
  assert(diff.unexpected.length === 0, 'gateway has unexpected activity-service pilot routes', diff);
  assert(overlaps.user.length === 0, 'activity-service overlaps user-service routes', overlaps);
  assert(overlaps.points.length === 0, 'activity-service overlaps points-service routes', overlaps);
  assert(overlaps.learning.length === 0, 'activity-service overlaps learning-service routes', overlaps);

  console.log(
    JSON.stringify(
      {
        ok: true,
        checks: [
          {
            name: 'gateway.activity-service.registry',
            ok: true,
            envKey: registry.envKey,
            flagEnvKey: registry.flagEnvKey,
            enabledByDefault: registry.enabledByDefault,
          },
          {
            name: 'gateway.activity-service.routes',
            ok: true,
            routeCount: gatewayActivityRoutes.length,
          },
          {
            name: 'activity-service.no-route-overlap',
            ok: true,
            userOverlapCount: overlaps.user.length,
            pointsOverlapCount: overlaps.points.length,
            learningOverlapCount: overlaps.learning.length,
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
