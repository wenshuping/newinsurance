#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FORBIDDEN_STATE_WRITE_PATTERNS = [
  /\bstate\.[A-Za-z0-9_$]+\s*=/g,
  /\bstate\.[A-Za-z0-9_$]+\.(push|unshift|splice|pop|shift|sort|reverse)\s*\(/g,
];

const RULES = [
  {
    file: 'server/skeleton-c-v1/services/points.service.mjs',
    requiredSnippets: ['../repositories/points.repository.mjs'],
    forbiddenSnippets: ['nextId('],
  },
  {
    file: 'server/skeleton-c-v1/services/analytics.service.mjs',
    requiredSnippets: ['../repositories/analytics.repository.mjs'],
  },
  {
    file: 'server/skeleton-c-v1/services/customer-assignment.service.mjs',
    requiredSnippets: ['../usecases/customer-assignment-write.usecase.mjs'],
  },
  {
    file: 'server/skeleton-c-v1/services/commerce.service.mjs',
    requiredSnippets: ['../repositories/commerce.repository.mjs', 'commitCommerceWrite'],
    forbiddenSnippets: ['persistState'],
  },
];

function lineOf(source, index) {
  return source.slice(0, index).split('\n').length;
}

function trimSnippet(text) {
  return text.replace(/\s+/g, ' ').trim().slice(0, 180);
}

const violations = [];
const checkedFiles = [];

for (const rule of RULES) {
  const absolutePath = path.join(ROOT, rule.file);
  if (!fs.existsSync(absolutePath)) {
    violations.push({
      file: rule.file,
      type: 'missing_file',
      message: 'target service file not found',
    });
    continue;
  }

  const source = fs.readFileSync(absolutePath, 'utf8');
  checkedFiles.push(rule.file);

  for (const required of rule.requiredSnippets || []) {
    if (!source.includes(required)) {
      violations.push({
        file: rule.file,
        type: 'missing_required_snippet',
        snippet: required,
      });
    }
  }

  for (const forbidden of rule.forbiddenSnippets || []) {
    if (source.includes(forbidden)) {
      const idx = source.indexOf(forbidden);
      const line = lineOf(source, idx);
      const lineText = source.split('\n')[line - 1] || '';
      violations.push({
        file: rule.file,
        type: 'forbidden_snippet',
        snippet: forbidden,
        line,
        context: trimSnippet(lineText),
      });
    }
  }

  for (const pattern of FORBIDDEN_STATE_WRITE_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of source.matchAll(pattern)) {
      const idx = match.index ?? 0;
      const line = lineOf(source, idx);
      const lineText = source.split('\n')[line - 1] || '';
      violations.push({
        file: rule.file,
        type: 'forbidden_state_write',
        pattern: String(pattern),
        matched: trimSnippet(match[0] || ''),
        line,
        context: trimSnippet(lineText),
      });
    }
  }
}

if (violations.length > 0) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        code: 'SERVICE_WRITE_LAYER_GUARD_FAILED',
        checked: checkedFiles.length,
        checkedFiles,
        violations,
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
      checked: checkedFiles.length,
      checkedFiles,
      checks: ['required_repository_binding', 'forbidden_state_writes', 'forbidden_service_legacy_snippets'],
    },
    null,
    2
  )
);
