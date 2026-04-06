#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const docPath = path.join(repoRoot, 'docs', 'error-code-dictionary-v1.md');

const sourceDirs = [
  path.join(repoRoot, 'server', 'skeleton-c-v1'),
  path.join(repoRoot, 'src'),
  path.join(repoRoot, '..', 'insurance_code_B', 'src'),
  path.join(repoRoot, '..', 'insurance_code_P', 'src'),
];

const includeExt = new Set(['.mjs', '.js', '.ts', '.tsx']);
const codePatterns = [
  /\bcode\s*:\s*['"]([A-Z][A-Z0-9_]{2,})['"]/g,
  /buildError\([^\)]*['"]([A-Z][A-Z0-9_]{2,})['"]/g,
  /throw new Error\(['"]([A-Z][A-Z0-9_]{2,})['"]\)/g,
  /e\?\.code\s*===\s*['"]([A-Z][A-Z0-9_]{2,})['"]/g,
  /code\s*===\s*['"]([A-Z][A-Z0-9_]{2,})['"]/g,
  /\b([A-Z][A-Z0-9_]{2,})\s*:\s*\[/g,
];

function walkFiles(dir, out) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, out);
      continue;
    }
    if (includeExt.has(path.extname(entry.name))) out.push(fullPath);
  }
}

function collectUsedCodes() {
  const files = [];
  for (const dir of sourceDirs) walkFiles(dir, files);
  const set = new Set();
  const skip = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD', 'TRUE', 'FALSE', 'YES']);

  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    for (const pattern of codePatterns) {
      let match = null;
      while ((match = pattern.exec(text))) {
        const code = String(match[1] || '').trim();
        if (code && !skip.has(code)) set.add(code);
      }
    }
  }
  return [...set].sort();
}

function collectDocumentedCodes() {
  if (!fs.existsSync(docPath)) {
    throw new Error(`dictionary doc not found: ${docPath}`);
  }
  const text = fs.readFileSync(docPath, 'utf8');
  const begin = '<!-- ERROR_CODE_DICTIONARY:BEGIN -->';
  const end = '<!-- ERROR_CODE_DICTIONARY:END -->';
  const s = text.indexOf(begin);
  const e = text.indexOf(end);
  if (s < 0 || e < 0 || e <= s) {
    throw new Error(`dictionary markers not found in ${docPath}`);
  }
  const block = text.slice(s + begin.length, e);
  const matches = [...block.matchAll(/`([A-Z][A-Z0-9_]{2,})`/g)];
  return [...new Set(matches.map((m) => m[1]))].sort();
}

function main() {
  const used = collectUsedCodes();
  const documented = collectDocumentedCodes();
  const documentedSet = new Set(documented);
  const usedSet = new Set(used);

  const missingInDoc = used.filter((code) => !documentedSet.has(code));
  const extraInDoc = documented.filter((code) => !usedSet.has(code));

  if (missingInDoc.length > 0) {
    console.error('[check:error-codes] missing codes in docs/error-code-dictionary-v1.md:');
    for (const code of missingInDoc) console.error(`- ${code}`);
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        usedCount: used.length,
        documentedCount: documented.length,
        extraInDocCount: extraInDoc.length,
        extraInDoc,
      },
      null,
      2
    )
  );
}

main();
