#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const routesDir = path.join(process.cwd(), 'server', 'skeleton-c-v1', 'routes');
const dtoImportNeedle = "../dto/write-commands.dto.mjs";
const usecaseImportNeedle = '../usecases/';
const routeFiles = fs
  .readdirSync(routesDir)
  .filter((name) => name.endsWith('.routes.mjs'))
  .map((name) => path.join(routesDir, name));

const writePattern = /\bapp\.(post|put|delete)\s*\(/;
const dtoOffenders = [];
const usecaseOffenders = [];

for (const filePath of routeFiles) {
  const source = fs.readFileSync(filePath, 'utf8');
  if (!writePattern.test(source)) continue;
  if (!source.includes(dtoImportNeedle)) {
    dtoOffenders.push(path.relative(process.cwd(), filePath));
  }
  if (!source.includes(usecaseImportNeedle)) {
    usecaseOffenders.push(path.relative(process.cwd(), filePath));
  }
}

if (dtoOffenders.length > 0 || usecaseOffenders.length > 0) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        code: 'ROUTE_WRITE_LAYER_GUARD_FAILED',
        message: 'Found write routes missing required layering imports (DTO/usecase)',
        dtoOffenders,
        usecaseOffenders,
      },
      null,
      2
    )
  );
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      checked: routeFiles.length,
      message: 'All write route modules import write-commands DTO and usecase modules',
    },
    null,
    2
  )
);
