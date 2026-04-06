#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TARGET = path.join(ROOT, 'server/skeleton-c-v1/routes/b-admin.routes.mjs');

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
    './b-admin.deps.mjs',
    './b-admin-auth.routes.mjs',
    './b-admin-customers.routes.mjs',
    './b-admin-content.routes.mjs',
    './b-admin-activity.routes.mjs',
    './b-admin-mall.routes.mjs',
    './b-admin-orders.routes.mjs',
  ]);
  const unexpectedImports = importPaths.filter((p) => !expectedImports.has(p));
  if (unexpectedImports.length > 0) {
    fail('b-admin.routes.mjs has unexpected imports', { unexpectedImports });
  }
  const missingImports = [...expectedImports].filter((p) => !importPaths.includes(p));
  if (missingImports.length > 0) {
    fail('b-admin.routes.mjs missing required imports', { missingImports });
  }

  const forbiddenImports = [
    '../common/access-control.mjs',
    '../common/state.mjs',
    '../services/commerce.service.mjs',
  ];
  const hitForbidden = importPaths.filter((p) => forbiddenImports.includes(p));
  if (hitForbidden.length > 0) {
    fail('b-admin.routes.mjs has forbidden direct imports (must come from deps factory)', { hitForbidden });
  }

  if (!importPaths.includes('./b-admin.deps.mjs')) {
    fail('b-admin.routes.mjs must import ./b-admin.deps.mjs');
  }

  if (!/export function registerBAdminRoutes\(app,\s*customDeps\s*=\s*\{\}\)/.test(code)) {
    fail('registerBAdminRoutes must support customDeps parameter');
  }

  if (!/const\s+deps\s*=\s*\{\s*\.\.\.\s*buildBAdminRouteDeps\(\)\s*,\s*\.\.\.\s*customDeps\s*\}\s*;/.test(code)) {
    fail('b-admin.routes.mjs must build deps using buildBAdminRouteDeps() + customDeps override');
  }

  const expectedRegistrations = [
    'registerBAdminAuthRoutes(app, deps)',
    'registerBAdminCustomerRoutes(app, deps)',
    'registerBAdminContentRoutes(app, deps)',
    'registerBAdminActivityRoutes(app, deps)',
    'registerBAdminMallRoutes(app, deps)',
    'registerBAdminOrderRoutes(app, deps)',
  ];
  const missingRegs = expectedRegistrations.filter((s) => !code.includes(s));
  if (missingRegs.length > 0) {
    fail('b-admin.routes.mjs missing required module registrations', { missingRegs });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        file: TARGET,
        checks: [
          'import_whitelist',
          'no_forbidden_imports',
          'deps_factory_imported',
          'custom_deps_override_pattern',
          'module_registration',
        ],
      },
      null,
      2
    )
  );
}

main();
