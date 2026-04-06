#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TARGET = path.join(ROOT, 'server/skeleton-c-v1/routes/c-app.routes.mjs');

function fail(message, context = null) {
  console.error(JSON.stringify({ ok: false, message, context }, null, 2));
  process.exit(1);
}

function main() {
  if (!fs.existsSync(TARGET)) fail('target file not found', { file: TARGET });
  const code = fs.readFileSync(TARGET, 'utf8');

  const importLines = code.split('\n').filter((line) => line.trim().startsWith('import '));
  const importPathRe = /from\s+['"]([^'"]+)['"]/;
  const importPaths = importLines
    .map((line) => {
      const m = line.match(importPathRe);
      return m ? m[1] : null;
    })
    .filter(Boolean);

  const expectedImports = new Set([
    './activities.routes.mjs',
    './auth.routes.mjs',
    './health.routes.mjs',
    './insurance.routes.mjs',
    './learning.routes.mjs',
    './mall.routes.mjs',
    './orders.routes.mjs',
    './points.routes.mjs',
    './redemptions.routes.mjs',
    './user.routes.mjs',
  ]);
  const unexpectedImports = importPaths.filter((p) => !expectedImports.has(p));
  if (unexpectedImports.length > 0) {
    fail('c-app.routes.mjs has unexpected imports', { unexpectedImports });
  }
  const missingImports = [...expectedImports].filter((p) => !importPaths.includes(p));
  if (missingImports.length > 0) {
    fail('c-app.routes.mjs missing required imports', { missingImports });
  }

  const expectedRegistrations = [
    'registerHealthRoutes(app)',
    'registerAuthRoutes(app)',
    'registerUserRoutes(app)',
    'registerActivitiesRoutes(app)',
    'registerPointsRoutes(app)',
    'registerMallRoutes(app)',
    'registerRedemptionsRoutes(app)',
    'registerOrdersRoutes(app)',
    'registerLearningRoutes(app)',
    'registerInsuranceRoutes(app)',
  ];
  const missingRegs = expectedRegistrations.filter((s) => !code.includes(s));
  if (missingRegs.length > 0) {
    fail('c-app.routes.mjs missing required module registrations', { missingRegs });
  }

  if (!/export function registerCAppRoutes\(app\)/.test(code)) {
    fail('registerCAppRoutes(app) export is required');
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        file: TARGET,
        checks: ['import_whitelist', 'module_registration', 'register_export_signature'],
      },
      null,
      2
    )
  );
}

main();
