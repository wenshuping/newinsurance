#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const PROJECTS = [
  { name: 'C', root: ROOT },
  { name: 'B', root: path.resolve(ROOT, '../../insurance_code_B') },
  { name: 'P', root: path.resolve(ROOT, '../../insurance_code_P') },
];

function readFileSafe(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;
      walkFiles(full, out);
      continue;
    }
    if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function checkProject(project) {
  const pkgFile = path.join(project.root, 'package.json');
  const srcDir = path.join(project.root, 'src');

  if (!fs.existsSync(pkgFile) || !fs.existsSync(srcDir)) {
    return {
      name: project.name,
      root: project.root,
      skipped: true,
      reason: 'workspace_not_found',
    };
  }

  const templateBridgeFile = path.join(project.root, 'src/lib/templateStatus.ts');
  const errorBridgeFile = path.join(project.root, 'src/lib/ui-error.ts');
  const apiFile = path.join(project.root, 'src/lib/api.ts');

  const missing = [];
  if (!fs.existsSync(templateBridgeFile)) missing.push('src/lib/templateStatus.ts');
  if (!fs.existsSync(errorBridgeFile)) missing.push('src/lib/ui-error.ts');
  if (!fs.existsSync(apiFile)) missing.push('src/lib/api.ts');
  if (missing.length > 0) {
    return {
      name: project.name,
      root: project.root,
      ok: false,
      issue: 'missing_required_files',
      missing,
    };
  }

  const templateBridge = readFileSafe(templateBridgeFile) || '';
  const errorBridge = readFileSafe(errorBridgeFile) || '';
  const api = readFileSafe(apiFile) || '';

  const errors = [];
  if (!templateBridge.includes("@contracts/template-status")) {
    errors.push('template bridge must import @contracts/template-status');
  }
  if (!errorBridge.includes("@contracts/error-ui")) {
    errors.push('ui-error bridge must import @contracts/error-ui');
  }
  if (!api.includes("@contracts/error-ui")) {
    errors.push('api must import @contracts/error-ui for统一错误口径');
  }

  const files = walkFiles(srcDir);
  const directTemplateContractImports = [];
  const directErrorUiImports = [];

  for (const file of files) {
    const rel = path.relative(project.root, file).replaceAll('\\', '/');
    const text = readFileSafe(file) || '';
    if (
      text.includes("@contracts/template-status") &&
      rel !== 'src/lib/templateStatus.ts'
    ) {
      directTemplateContractImports.push(rel);
    }
    if (
      text.includes("@contracts/error-ui") &&
      rel !== 'src/lib/ui-error.ts' &&
      rel !== 'src/lib/api.ts'
    ) {
      directErrorUiImports.push(rel);
    }
  }

  if (directTemplateContractImports.length > 0) {
    errors.push(`direct @contracts/template-status imports outside bridge: ${directTemplateContractImports.join(', ')}`);
  }
  if (directErrorUiImports.length > 0) {
    errors.push(`direct @contracts/error-ui imports outside allowed files: ${directErrorUiImports.join(', ')}`);
  }

  return {
    name: project.name,
    root: project.root,
    ok: errors.length === 0,
    errors,
    checks: {
      hasTemplateBridge: true,
      hasErrorBridge: true,
      apiUsesErrorContract: true,
      noDirectTemplateContractImportOutsideBridge: directTemplateContractImports.length === 0,
      noDirectErrorUiImportOutsideAllowed: directErrorUiImports.length === 0,
    },
  };
}

function main() {
  const results = PROJECTS.map(checkProject);
  const hardFailures = results.filter((r) => r.ok === false);
  const payload = {
    ok: hardFailures.length === 0,
    results,
  };

  if (!payload.ok) {
    console.error(JSON.stringify(payload, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify(payload, null, 2));
}

main();
