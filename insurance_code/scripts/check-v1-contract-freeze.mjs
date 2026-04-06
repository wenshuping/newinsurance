#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const manifestPath = path.resolve(repoRoot, 'shared-contracts', 'v1-freeze-manifest.json');
const serverPath = path.resolve(repoRoot, 'server', 'index.mjs');
const checklistPath = path.resolve(repoRoot, 'docs', 'api-v1-contract-freeze-checklist-2026-03-01.md');

const errors = [];

function assertFileExists(filePath) {
  if (!fs.existsSync(filePath)) {
    errors.push(`missing file: ${path.relative(repoRoot, filePath)}`);
  }
}

assertFileExists(manifestPath);
assertFileExists(serverPath);
assertFileExists(checklistPath);

if (errors.length > 0) {
  fail();
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const serverCode = fs.readFileSync(serverPath, 'utf8');
const checklist = fs.readFileSync(checklistPath, 'utf8');

for (const rel of manifest.files || []) {
  const abs = path.resolve(repoRoot, rel);
  if (!fs.existsSync(abs)) {
    errors.push(`manifest file not found: ${rel}`);
  }
}

for (const endpoint of manifest.endpoints || []) {
  const method = String(endpoint.method || '').toLowerCase();
  const routePath = String(endpoint.path || '');
  const routeLiteral = routePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const routeRegex = new RegExp(`app\\.${method}\\(\\s*['"]${routeLiteral}['"]`);
  if (!routeRegex.test(serverCode)) {
    errors.push(`endpoint not found in server/index.mjs: ${endpoint.method} ${endpoint.path}`);
  }
  if (!checklist.includes(`${endpoint.method} ${endpoint.path}`)) {
    errors.push(`endpoint not listed in checklist doc: ${endpoint.method} ${endpoint.path}`);
  }
}

if (errors.length > 0) {
  fail();
}

console.log(
  JSON.stringify(
    {
      ok: true,
      checkedFiles: manifest.files.length,
      checkedEndpoints: manifest.endpoints.length,
      manifestVersion: manifest.version,
    },
    null,
    2
  )
);

function fail() {
  console.error(
    JSON.stringify(
      {
        ok: false,
        errors,
      },
      null,
      2
    )
  );
  process.exit(1);
}

