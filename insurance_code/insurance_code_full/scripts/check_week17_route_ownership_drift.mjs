#!/usr/bin/env node

import {
  gatewayRouteMap,
  gatewayServiceRegistry,
  isGatewayServiceEnabled,
} from '../server/microservices/gateway/route-map.mjs';
import { userServiceOwnedRoutes } from '../server/microservices/user-service/router.mjs';
import { pointsServiceOwnedRoutes } from '../server/microservices/points-service/router.mjs';
import { learningServiceOwnedRoutes } from '../server/microservices/learning-service/boundary.mjs';
import { activityServiceOwnedRoutes } from '../server/microservices/activity-service/boundary.mjs';

const expectedServices = ['user-service', 'points-service', 'learning-service', 'activity-service'];
const expectedRegistry = {
  'v1-monolith': { envKey: 'GATEWAY_V1_BASE_URL', flagEnvKey: null, enabledByDefault: true },
  'user-service': { envKey: 'GATEWAY_USER_SERVICE_URL', flagEnvKey: null, enabledByDefault: true },
  'points-service': { envKey: 'GATEWAY_POINTS_SERVICE_URL', flagEnvKey: null, enabledByDefault: true },
  'learning-service': { envKey: 'GATEWAY_LEARNING_SERVICE_URL', flagEnvKey: 'GATEWAY_ENABLE_LEARNING_SERVICE', enabledByDefault: false },
  'activity-service': { envKey: 'GATEWAY_ACTIVITY_SERVICE_URL', flagEnvKey: 'GATEWAY_ENABLE_ACTIVITY_SERVICE', enabledByDefault: false },
};

const serviceOwnedRoutes = {
  'user-service': userServiceOwnedRoutes,
  'points-service': pointsServiceOwnedRoutes,
  'learning-service': learningServiceOwnedRoutes,
  'activity-service': activityServiceOwnedRoutes,
};

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

function overlap(a, b) {
  return sortUnique(a).filter((item) => sortUnique(b).includes(item));
}

function main() {
  const routeServices = sortUnique(gatewayRouteMap.map((item) => item.service));
  const registryServices = sortUnique(Object.keys(gatewayServiceRegistry));

  assert(
    JSON.stringify(routeServices) === JSON.stringify(sortUnique(expectedServices)),
    'gateway route owner service set drifted',
    { expected: sortUnique(expectedServices), actual: routeServices },
  );
  assert(
    JSON.stringify(registryServices) === JSON.stringify(sortUnique(Object.keys(expectedRegistry))),
    'gateway registry service set drifted',
    { expected: sortUnique(Object.keys(expectedRegistry)), actual: registryServices },
  );

  const checks = [];
  for (const [service, expectations] of Object.entries(expectedRegistry)) {
    const registryItem = gatewayServiceRegistry[service];
    assert(Boolean(registryItem), 'gateway registry item missing', { service });
    assert(registryItem.envKey === expectations.envKey, 'gateway env key drifted', { service, expected: expectations.envKey, actual: registryItem.envKey });
    assert((registryItem.flagEnvKey || null) === expectations.flagEnvKey, 'gateway flag env key drifted', {
      service,
      expected: expectations.flagEnvKey,
      actual: registryItem.flagEnvKey || null,
    });
    if (service !== 'v1-monolith') {
      const enabledByDefault = expectations.flagEnvKey ? Boolean(registryItem.enabledByDefault) : true;
      assert(enabledByDefault === expectations.enabledByDefault, 'gateway enabled-by-default drifted', {
        service,
        expected: expectations.enabledByDefault,
        actual: enabledByDefault,
      });
    }
    checks.push({
      name: `week17.gateway-registry.${service}`,
      ok: true,
      envKey: registryItem.envKey,
      flagEnvKey: registryItem.flagEnvKey || null,
      enabledByDefault: registryItem.flagEnvKey ? Boolean(registryItem.enabledByDefault) : true,
    });
  }

  for (const service of expectedServices) {
    const expectedRoutes = sortUnique(serviceOwnedRoutes[service]);
    const actualRoutes = sortUnique(gatewayRouteMap.find((item) => item.service === service)?.routes || []);
    const diff = compare(expectedRoutes, actualRoutes);
    assert(diff.missing.length === 0, 'gateway missing service-owned routes', { service, diff });
    assert(diff.unexpected.length === 0, 'gateway has unexpected service-owned routes', { service, diff });
    checks.push({
      name: `week17.gateway-routes.${service}`,
      ok: true,
      routeCount: actualRoutes.length,
    });
  }

  const pairs = [
    ['user-service', 'points-service'],
    ['user-service', 'learning-service'],
    ['user-service', 'activity-service'],
    ['points-service', 'learning-service'],
    ['points-service', 'activity-service'],
    ['learning-service', 'activity-service'],
  ];

  for (const [left, right] of pairs) {
    const overlaps = overlap(serviceOwnedRoutes[left], serviceOwnedRoutes[right]);
    assert(overlaps.length === 0, 'service route ownership overlaps', { left, right, overlaps });
    checks.push({
      name: `week17.route-overlap.${left}.${right}`,
      ok: true,
      overlapCount: overlaps.length,
    });
  }

  assert(isGatewayServiceEnabled('learning-service', {}) === false, 'learning-service should stay disabled by default');
  assert(isGatewayServiceEnabled('activity-service', {}) === false, 'activity-service should stay disabled by default');
  checks.push({ name: 'week17.learning.default-off', ok: true });
  checks.push({ name: 'week17.activity.default-off', ok: true });

  console.log(JSON.stringify({ ok: true, checks }, null, 2));
}

main();
