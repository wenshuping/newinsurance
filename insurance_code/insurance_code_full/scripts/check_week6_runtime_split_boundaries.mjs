#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.STORAGE_BACKEND = process.env.STORAGE_BACKEND || 'file';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const userServiceDir = path.join(repoRoot, 'server/microservices/user-service');
const pointsServiceDir = path.join(repoRoot, 'server/microservices/points-service');

function sortUnique(items) {
  return Array.from(new Set((items || []).map((item) => String(item || '').trim()).filter(Boolean))).sort();
}

function assert(condition, message, context = null) {
  if (condition) return;
  const error = new Error(message);
  error.context = context;
  throw error;
}

async function walkFiles(rootDir) {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(absolute)));
      continue;
    }
    if (entry.isFile() && /\.(mjs|js|ts|tsx)$/.test(entry.name)) {
      files.push(absolute);
    }
  }
  return files.sort();
}

function extractImportSpecifiers(source) {
  const importRe = /(?:import\s+[^'"]*from\s*|import\s*\()\s*['"]([^'"]+)['"]/g;
  const specifiers = [];
  let match = importRe.exec(source);
  while (match) {
    specifiers.push(String(match[1] || '').trim());
    match = importRe.exec(source);
  }
  return specifiers;
}

function resolveImportTarget(filePath, specifier) {
  if (!specifier || !specifier.startsWith('.')) return '';
  const withBase = path.resolve(path.dirname(filePath), specifier);
  return withBase;
}

async function scanCrossServiceImports({ serviceName, rootDir, forbiddenDir, forbiddenLabel }) {
  const files = await walkFiles(rootDir);
  const violations = [];

  for (const filePath of files) {
    const source = await fs.readFile(filePath, 'utf8');
    const specifiers = extractImportSpecifiers(source);
    for (const specifier of specifiers) {
      const resolved = resolveImportTarget(filePath, specifier);
      const targetsForbiddenDir = resolved && (resolved === forbiddenDir || resolved.startsWith(`${forbiddenDir}${path.sep}`));
      const targetsForbiddenName =
        specifier === forbiddenLabel ||
        specifier.includes(`/${forbiddenLabel}/`) ||
        specifier.startsWith(`../${forbiddenLabel}`) ||
        specifier.startsWith(`./${forbiddenLabel}`);

      if (targetsForbiddenDir || targetsForbiddenName) {
        violations.push({
          file: filePath,
          specifier,
          forbidden: forbiddenLabel,
        });
      }
    }
  }

  return {
    service: serviceName,
    scannedFiles: files.length,
    violations,
  };
}

function compareRouteSets({ service, expectedRoutes, gatewayRoutes }) {
  const expected = sortUnique(expectedRoutes);
  const actual = sortUnique(gatewayRoutes);
  const missingInGateway = expected.filter((route) => !actual.includes(route));
  const unexpectedInGateway = actual.filter((route) => !expected.includes(route));

  return {
    service,
    expectedCount: expected.length,
    gatewayCount: actual.length,
    missingInGateway,
    unexpectedInGateway,
  };
}

async function main() {
  const [{ userServiceOwnedRoutes }, { pointsServiceOwnedRoutes }, { gatewayRouteMap }] = await Promise.all([
    import('../server/microservices/user-service/router.mjs'),
    import('../server/microservices/points-service/router.mjs'),
    import('../server/microservices/gateway/route-map.mjs'),
  ]);

  const gatewayUserRoutes = gatewayRouteMap.find((item) => item.service === 'user-service')?.routes || [];
  const gatewayPointsRoutes = gatewayRouteMap.find((item) => item.service === 'points-service')?.routes || [];
  const gatewayServices = sortUnique(gatewayRouteMap.map((item) => item.service));

  const userRoutes = sortUnique(userServiceOwnedRoutes);
  const pointsRoutes = sortUnique(pointsServiceOwnedRoutes);

  const userGatewayMatch = compareRouteSets({
    service: 'user-service',
    expectedRoutes: userRoutes,
    gatewayRoutes: gatewayUserRoutes,
  });
  const pointsGatewayMatch = compareRouteSets({
    service: 'points-service',
    expectedRoutes: pointsRoutes,
    gatewayRoutes: gatewayPointsRoutes,
  });
  const overlappingRoutes = userRoutes.filter((route) => pointsRoutes.includes(route));

  const [userImportScan, pointsImportScan] = await Promise.all([
    scanCrossServiceImports({
      serviceName: 'user-service',
      rootDir: userServiceDir,
      forbiddenDir: pointsServiceDir,
      forbiddenLabel: 'points-service',
    }),
    scanCrossServiceImports({
      serviceName: 'points-service',
      rootDir: pointsServiceDir,
      forbiddenDir: userServiceDir,
      forbiddenLabel: 'user-service',
    }),
  ]);

  assert(gatewayServices.includes('user-service'), 'gateway missing user-service owner set', { gatewayServices });
  assert(gatewayServices.includes('points-service'), 'gateway missing points-service owner set', { gatewayServices });
  assert(gatewayRouteMap.length >= 2, 'gateway route owner count regressed below Week6 scope', {
    gatewayRouteMapLength: gatewayRouteMap.length,
  });
  assert(userGatewayMatch.missingInGateway.length === 0, 'gateway missing user-service owned routes', userGatewayMatch);
  assert(userGatewayMatch.unexpectedInGateway.length === 0, 'gateway has unexpected user-service owned routes', userGatewayMatch);
  assert(pointsGatewayMatch.missingInGateway.length === 0, 'gateway missing points-service owned routes', pointsGatewayMatch);
  assert(pointsGatewayMatch.unexpectedInGateway.length === 0, 'gateway has unexpected points-service owned routes', pointsGatewayMatch);
  assert(overlappingRoutes.length === 0, 'user-service and points-service routes overlap', { overlappingRoutes });
  assert(userImportScan.violations.length === 0, 'user-service imports points-service directly', userImportScan);
  assert(pointsImportScan.violations.length === 0, 'points-service imports user-service directly', pointsImportScan);

  console.log(
    JSON.stringify(
      {
        ok: true,
        checks: [
          {
            name: 'gateway.user-service.routes',
            ok: true,
            expectedCount: userGatewayMatch.expectedCount,
            gatewayCount: userGatewayMatch.gatewayCount,
          },
          {
            name: 'gateway.points-service.routes',
            ok: true,
            expectedCount: pointsGatewayMatch.expectedCount,
            gatewayCount: pointsGatewayMatch.gatewayCount,
          },
          {
            name: 'service.route-overlap',
            ok: true,
            overlapCount: overlappingRoutes.length,
          },
          {
            name: 'user-service.cross-import',
            ok: true,
            scannedFiles: userImportScan.scannedFiles,
          },
          {
            name: 'points-service.cross-import',
            ok: true,
            scannedFiles: pointsImportScan.scannedFiles,
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
