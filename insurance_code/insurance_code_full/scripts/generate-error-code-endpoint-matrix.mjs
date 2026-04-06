#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const routesDir = path.join(repoRoot, 'server', 'skeleton-c-v1', 'routes');
const outputPath = path.join(repoRoot, 'docs', 'error-code-endpoint-matrix-v1.md');
const checkMode = process.argv.includes('--check');

function collectRouteFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) continue;
    if (entry.name.endsWith('.mjs')) files.push(fullPath);
  }
  return files.sort();
}

function escapeMd(value) {
  return String(value).replace(/\|/g, '\\|');
}

function extractEntriesFromFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split('\n');
  const entries = [];

  let currentRoute = null;
  const routeRegex = /(router|app)\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/;
  const inlineJsonCodeRegex = /res\.status\((\d{3})\)\.json\(\{\s*code:\s*['"]([A-Z][A-Z0-9_]{2,})['"]/;
  const branchCodeRegex = /if\s*\(\s*code\s*===\s*['"]([A-Z][A-Z0-9_]{2,})['"]\s*\)\s*return\s+res\.status\((\d{3})\)\.json/;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const routeMatch = line.match(routeRegex);
    if (routeMatch) {
      currentRoute = {
        method: routeMatch[2].toUpperCase(),
        path: routeMatch[3],
      };
      continue;
    }
    if (!currentRoute) continue;

    const inlineMatch = line.match(inlineJsonCodeRegex);
    if (inlineMatch) {
      entries.push({
        code: inlineMatch[2],
        status: Number(inlineMatch[1]),
        method: currentRoute.method,
        path: currentRoute.path,
        source: path.relative(repoRoot, filePath),
      });
    }

    const branchMatch = line.match(branchCodeRegex);
    if (branchMatch) {
      entries.push({
        code: branchMatch[1],
        status: Number(branchMatch[2]),
        method: currentRoute.method,
        path: currentRoute.path,
        source: path.relative(repoRoot, filePath),
      });
    }
  }

  return entries;
}

function uniqueEntries(entries) {
  const seen = new Set();
  const out = [];
  for (const item of entries) {
    const key = `${item.code}|${item.status}|${item.method}|${item.path}|${item.source}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out.sort((a, b) => {
    if (a.code !== b.code) return a.code.localeCompare(b.code);
    if (a.path !== b.path) return a.path.localeCompare(b.path);
    if (a.method !== b.method) return a.method.localeCompare(b.method);
    if (a.status !== b.status) return a.status - b.status;
    return a.source.localeCompare(b.source);
  });
}

function renderMarkdown(entries) {
  const codeCount = new Set(entries.map((x) => x.code)).size;
  const lines = [];
  lines.push('# 错误码触发接口矩阵（v1）');
  lines.push('');
  lines.push('更新时间：2026-03-03');
  lines.push('');
  lines.push('来源：`server/skeleton-c-v1/routes/*.mjs` 自动扫描生成。');
  lines.push('');
  lines.push('维护方式：');
  lines.push('- 生成：`npm run docs:generate:error-matrix`');
  lines.push('- 校验：`npm run docs:check:error-matrix`');
  lines.push('');
  lines.push(`统计：共 ${entries.length} 条映射，覆盖 ${codeCount} 个错误码。`);
  lines.push('');
  lines.push('| 错误码 | HTTP | 方法 | 路径 | 来源文件 |');
  lines.push('|---|---:|---|---|---|');
  for (const item of entries) {
    lines.push(
      `| \`${escapeMd(item.code)}\` | ${item.status} | ${item.method} | \`${escapeMd(item.path)}\` | \`${escapeMd(item.source)}\` |`
    );
  }
  lines.push('');
  return lines.join('\n');
}

function main() {
  const routeFiles = collectRouteFiles(routesDir);
  const raw = routeFiles.flatMap((filePath) => extractEntriesFromFile(filePath));
  const entries = uniqueEntries(raw);
  const next = renderMarkdown(entries);

  if (checkMode) {
    if (!fs.existsSync(outputPath)) {
      console.error(`[docs:check:error-matrix] missing file: ${outputPath}`);
      process.exit(1);
    }
    const current = fs.readFileSync(outputPath, 'utf8');
    if (current !== next) {
      console.error('[docs:check:error-matrix] docs/error-code-endpoint-matrix-v1.md is outdated.');
      console.error('Run: npm run docs:generate:error-matrix');
      process.exit(1);
    }
    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: 'check',
          file: path.relative(repoRoot, outputPath),
          entryCount: entries.length,
          codeCount: new Set(entries.map((x) => x.code)).size,
        },
        null,
        2
      )
    );
    return;
  }

  fs.writeFileSync(outputPath, next, 'utf8');
  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: 'generate',
        file: path.relative(repoRoot, outputPath),
        entryCount: entries.length,
        codeCount: new Set(entries.map((x) => x.code)).size,
      },
      null,
      2
    )
  );
}

main();
