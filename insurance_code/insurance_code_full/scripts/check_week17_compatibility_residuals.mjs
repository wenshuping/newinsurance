#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { userServiceOwnedRoutes } from '../server/microservices/user-service/router.mjs';
import { pointsServiceOwnedRoutes } from '../server/microservices/points-service/router.mjs';
import { learningServiceOwnedRoutes, learningServiceWriteWhitelist } from '../server/microservices/learning-service/boundary.mjs';
import { activityServiceOwnedRoutes, activityServiceWriteWhitelist } from '../server/microservices/activity-service/boundary.mjs';
import { userServiceWriteWhitelist } from '../server/microservices/user-service/boundary.mjs';

const ROOT = process.cwd();
const pointsBoundaryWhitelist = JSON.parse(
  fs.readFileSync(
    path.join(ROOT, 'server/microservices/points-service/write-boundary-whitelist.json'),
    'utf8',
  ),
);

const mountedRouteFiles = [
  'server/skeleton-c-v1/routes/health.routes.mjs',
  'server/skeleton-c-v1/routes/auth.routes.mjs',
  'server/skeleton-c-v1/routes/user.routes.mjs',
  'server/skeleton-c-v1/routes/activities.routes.mjs',
  'server/skeleton-c-v1/routes/points.routes.mjs',
  'server/skeleton-c-v1/routes/mall.routes.mjs',
  'server/skeleton-c-v1/routes/redemptions.routes.mjs',
  'server/skeleton-c-v1/routes/orders.routes.mjs',
  'server/skeleton-c-v1/routes/learning.routes.mjs',
  'server/skeleton-c-v1/routes/insurance.routes.mjs',
  'server/skeleton-c-v1/routes/b-admin-auth.routes.mjs',
  'server/skeleton-c-v1/routes/b-admin-customers.routes.mjs',
  'server/skeleton-c-v1/routes/b-admin-content.routes.mjs',
  'server/skeleton-c-v1/routes/b-admin-activity.routes.mjs',
  'server/skeleton-c-v1/routes/b-admin-mall.routes.mjs',
  'server/skeleton-c-v1/routes/b-admin-orders.routes.mjs',
  'server/skeleton-c-v1/routes/p-admin-auth.routes.mjs',
  'server/skeleton-c-v1/routes/p-admin-governance.routes.mjs',
  'server/skeleton-c-v1/routes/p-admin-ops.routes.mjs',
  'server/skeleton-c-v1/routes/p-admin-activities.routes.mjs',
  'server/skeleton-c-v1/routes/p-admin-learning.routes.mjs',
  'server/skeleton-c-v1/routes/p-admin-workforce.routes.mjs',
  'server/skeleton-c-v1/routes/p-admin-mall.routes.mjs',
  'server/skeleton-c-v1/routes/p-admin-tags.routes.mjs',
  'server/skeleton-c-v1/routes/p-admin-metrics.routes.mjs',
  'server/skeleton-c-v1/routes/p-admin-events.routes.mjs',
  'server/skeleton-c-v1/routes/track.routes.mjs',
  'server/skeleton-c-v1/routes/uploads.routes.mjs',
];

const expectedCompatibilityOnlyRouteFiles = sortUnique([
  'server/skeleton-c-v1/routes/auth.routes.mjs',
  'server/skeleton-c-v1/routes/activities.routes.mjs',
  'server/skeleton-c-v1/routes/mall.routes.mjs',
  'server/skeleton-c-v1/routes/orders.routes.mjs',
  'server/skeleton-c-v1/routes/points.routes.mjs',
  'server/skeleton-c-v1/routes/redemptions.routes.mjs',
  'server/skeleton-c-v1/routes/learning.routes.mjs',
  'server/skeleton-c-v1/routes/b-admin-activity.routes.mjs',
  'server/skeleton-c-v1/routes/p-admin-activities.routes.mjs',
  'server/skeleton-c-v1/routes/p-admin-learning.routes.mjs',
]);

const expectedMustKeepRouteFiles = sortUnique(
  mountedRouteFiles.filter((file) => !expectedCompatibilityOnlyRouteFiles.includes(file)),
);

const serviceOwnedPatterns = {
  'user-service': sortUnique(userServiceOwnedRoutes),
  'points-service': sortUnique(pointsServiceOwnedRoutes),
  'learning-service': sortUnique(learningServiceOwnedRoutes),
  'activity-service': sortUnique(activityServiceOwnedRoutes),
};

const expectedRetireNowFiles = [];

function sortUnique(items) {
  return Array.from(new Set((items || []).map((item) => String(item || '').trim()).filter(Boolean))).sort();
}

function assert(condition, message, context = null) {
  if (condition) return;
  const error = new Error(message);
  error.context = context;
  throw error;
}

function matchesPathPattern(pattern, pathname) {
  const patternSegments = String(pattern || '').split('/').filter(Boolean);
  const pathnameSegments = String(pathname || '').split('/').filter(Boolean);
  if (patternSegments.length !== pathnameSegments.length) return false;
  return patternSegments.every((segment, index) => (segment.startsWith(':') ? Boolean(pathnameSegments[index]) : segment === pathnameSegments[index]));
}

function extractRoutes(relativePath) {
  const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
  const routes = [];
  const routeRegex = /app\.(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(routeRegex)) {
    routes.push({ method: String(match[1] || '').toUpperCase(), path: String(match[2] || '').trim() });
  }
  return routes;
}

function ownersForPath(pathname) {
  return Object.entries(serviceOwnedPatterns)
    .filter(([, patterns]) => patterns.some((pattern) => matchesPathPattern(pattern, pathname)))
    .map(([service]) => service)
    .sort();
}

function buildBridgeOnlyFiles() {
  const files = [
    ...userServiceWriteWhitelist.usecases,
    ...userServiceWriteWhitelist.repositories,
    ...pointsBoundaryWhitelist.usecaseWhitelist,
    ...pointsBoundaryWhitelist.repositoryWhitelist,
    ...pointsBoundaryWhitelist.internalServiceFiles,
    ...learningServiceWriteWhitelist.usecases,
    ...learningServiceWriteWhitelist.repositories,
    ...activityServiceWriteWhitelist.usecases,
    ...activityServiceWriteWhitelist.repositories,
    'server/skeleton-c-v1/routes/p-admin.deps.mjs',
    'server/skeleton-c-v1/routes/b-admin.deps.mjs',
    'server/skeleton-c-v1/services/activity-reward.service.mjs',
    'server/skeleton-c-v1/services/learning-reward.service.mjs',
  ];
  return sortUnique(
    files.filter(
      (file) => !mountedRouteFiles.includes(file) && !file.endsWith('common/state.mjs') && fs.existsSync(path.join(ROOT, file)),
    ),
  );
}

function main() {
  for (const file of mountedRouteFiles) {
    assert(fs.existsSync(path.join(ROOT, file)), 'mounted skeleton route file missing', { file });
  }

  const compatibilityOnlyFiles = [];
  const mustKeepFiles = [];
  const routeInventory = [];
  const serviceOwnedResidualRoutes = {
    'user-service': [],
    'points-service': [],
    'learning-service': [],
    'activity-service': [],
  };

  for (const file of mountedRouteFiles) {
    const routes = extractRoutes(file);
    const ownerSets = routes.map((route) => ownersForPath(route.path));
    const unmatchedRoutes = routes.filter((route) => ownersForPath(route.path).length === 0).map((route) => `${route.method} ${route.path}`);
    const distinctOwners = sortUnique(ownerSets.flat());
    const isCompatibilityOnly = routes.length > 0 && unmatchedRoutes.length === 0 && distinctOwners.length >= 1;

    if (isCompatibilityOnly) compatibilityOnlyFiles.push(file);
    else mustKeepFiles.push(file);

    for (const route of routes) {
      for (const owner of ownersForPath(route.path)) {
        serviceOwnedResidualRoutes[owner].push(route.path);
      }
    }

    routeInventory.push({
      file,
      routeCount: routes.length,
      compatibilityOnly: isCompatibilityOnly,
      owners: distinctOwners,
      unmatchedRoutes,
    });
  }

  for (const owner of Object.keys(serviceOwnedResidualRoutes)) {
    serviceOwnedResidualRoutes[owner] = sortUnique(serviceOwnedResidualRoutes[owner]);
  }

  const actualCompatibilityOnlyFiles = sortUnique(compatibilityOnlyFiles);
  const actualMustKeepFiles = sortUnique(mustKeepFiles);
  const actualRetireNowFiles = [];
  const bridgeOnlyFiles = buildBridgeOnlyFiles();

  assert(
    JSON.stringify(actualCompatibilityOnlyFiles) === JSON.stringify(expectedCompatibilityOnlyRouteFiles),
    'compatibility-only route file set drifted',
    { expected: expectedCompatibilityOnlyRouteFiles, actual: actualCompatibilityOnlyFiles },
  );
  assert(
    JSON.stringify(actualMustKeepFiles) === JSON.stringify(expectedMustKeepRouteFiles),
    'must-keep route file set drifted',
    { expected: expectedMustKeepRouteFiles, actual: actualMustKeepFiles },
  );
  assert(
    JSON.stringify(actualRetireNowFiles) === JSON.stringify(expectedRetireNowFiles),
    'retire-now file set drifted',
    { expected: expectedRetireNowFiles, actual: actualRetireNowFiles },
  );

  for (const [service, patterns] of Object.entries(serviceOwnedPatterns)) {
    assert(
      JSON.stringify(serviceOwnedResidualRoutes[service]) === JSON.stringify(patterns),
      'service-owned residual route set drifted in skeleton compatibility layer',
      { service, expected: patterns, actual: serviceOwnedResidualRoutes[service] },
    );
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        checks: [
          {
            name: 'week17.compatibility-only-route-files',
            ok: true,
            count: actualCompatibilityOnlyFiles.length,
            files: actualCompatibilityOnlyFiles,
          },
          {
            name: 'week17.must-keep-route-files',
            ok: true,
            count: actualMustKeepFiles.length,
            files: actualMustKeepFiles,
          },
          {
            name: 'week17.bridge-only-files',
            ok: true,
            count: bridgeOnlyFiles.length,
            files: bridgeOnlyFiles,
          },
          {
            name: 'week17.retire-now-files',
            ok: true,
            count: actualRetireNowFiles.length,
            files: actualRetireNowFiles,
          },
          {
            name: 'week17.service-owned-residual-routes',
            ok: true,
            services: Object.fromEntries(
              Object.entries(serviceOwnedResidualRoutes).map(([service, routes]) => [service, { count: routes.length, routes }]),
            ),
          },
        ],
        routeInventory,
      },
      null,
      2,
    ),
  );
}

main();
