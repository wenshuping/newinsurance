#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TARGET = path.join(ROOT, 'server/skeleton-c-v1/routes/p-admin.routes.mjs');

function fail(message, context = null) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        message,
        context,
      },
      null,
      2
    )
  );
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
    './p-admin-auth.routes.mjs',
    './p-admin-activities.routes.mjs',
    './p-admin-events.routes.mjs',
    './p-admin-governance.routes.mjs',
    './p-admin-learning.routes.mjs',
    './p-admin-mall.routes.mjs',
    './p-admin-metrics.routes.mjs',
    './p-admin-ops.routes.mjs',
    './p-admin-tags.routes.mjs',
    './p-admin-workforce.routes.mjs',
    './p-admin.deps.mjs',
  ]);

  const unexpectedImports = importPaths.filter((p) => !expectedImports.has(p));
  if (unexpectedImports.length > 0) {
    fail('p-admin.routes.mjs has unexpected imports (must use deps factory only)', { unexpectedImports });
  }

  const missingImports = [...expectedImports].filter((p) => !importPaths.includes(p));
  if (missingImports.length > 0) {
    fail('p-admin.routes.mjs missing required route/deps imports', { missingImports });
  }

  if (!/const\s+deps\s*=\s*buildPAdminRouteDeps\(\)\s*;/.test(code)) {
    fail('p-admin.routes.mjs must build deps via buildPAdminRouteDeps()');
  }

  const expectedRegistrations = [
    ['registerPAdminAuthRoutes', 'auth'],
    ['registerPAdminGovernanceRoutes', 'governance'],
    ['registerPAdminOpsRoutes', 'ops'],
    ['registerPAdminActivityRoutes', 'activity'],
    ['registerPAdminLearningRoutes', 'learning'],
    ['registerPAdminWorkforceRoutes', 'workforce'],
    ['registerPAdminMallRoutes', 'mall'],
    ['registerPAdminTagRoutes', 'tags'],
    ['registerPAdminMetricRoutes', 'metrics'],
    ['registerPAdminEventRoutes', 'events'],
  ];

  const missingRegs = [];
  for (const [fnName, key] of expectedRegistrations) {
    const re = new RegExp(`${fnName}\\(\\s*app\\s*,\\s*deps\\.${key}\\s*\\)`);
    if (!re.test(code)) missingRegs.push(`${fnName}(app, deps.${key})`);
  }
  if (missingRegs.length > 0) {
    fail('p-admin.routes.mjs must register routes with deps.<domain>', { missingRegs });
  }

  const forbiddenInlineDeps = /registerPAdmin[A-Za-z]+Routes\(\s*app\s*,\s*\{[\s\S]*?\}\s*\)/m;
  if (forbiddenInlineDeps.test(code)) {
    fail('inline deps object detected in p-admin.routes.mjs (forbidden)');
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        file: TARGET,
        checks: ['import_whitelist', 'deps_factory_build', 'registration_domain_wiring', 'no_inline_deps_literal'],
      },
      null,
      2
    )
  );
}

main();
