#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {
  userServiceLegacyReviewRoots,
  userServiceMainWriteTables,
  userServiceProtectedServiceRoots,
  userServiceWriteBindings,
  userServiceWriteWhitelist,
} from '../server/microservices/user-service/boundary.mjs';

const ROOT = process.cwd();
const EXPECTED_MAIN_TABLES = ['app_users', 'c_customers', 'p_sessions'];
const USER_MUTATION_FIELDS = [
  'tenantId',
  'orgId',
  'teamId',
  'ownerUserId',
  'name',
  'mobile',
  'nickName',
  'avatarUrl',
  'isVerifiedBasic',
  'verifiedAt',
  'lastActiveAt',
  'deviceInfo',
];
const USER_WRITE_PATTERNS = [
  {
    key: 'state_users_write',
    regex: /\bstate\.users\s*=|\bstate\.users\.(push|unshift|splice|pop|shift|sort|reverse)\s*\(/g,
  },
  {
    key: 'state_sessions_write',
    regex: /\bstate\.sessions\s*=|\bstate\.sessions\.(push|unshift|splice|pop|shift|sort|reverse)\s*\(/g,
  },
  {
    key: 'create_session_invocation',
    regex: /\bcreateSession\s*\(/g,
  },
  {
    key: 'user_table_sql_write',
    regex: /\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM|MERGE\s+INTO|UPSERT\s+INTO)\s+(app_users|c_customers|p_sessions)\b/gi,
  },
  {
    key: 'user_or_customer_field_assignment',
    regex: new RegExp(`\\b(user|customer)\\.(${USER_MUTATION_FIELDS.join('|')})\\s*=`, 'g'),
  },
];

function toAbsolute(relativePath) {
  return path.join(ROOT, relativePath);
}

function lineOf(source, index) {
  return source.slice(0, index).split('\n').length;
}

function trimSnippet(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

function walkMjsFiles(relativeTarget) {
  const absoluteTarget = toAbsolute(relativeTarget);
  if (!fs.existsSync(absoluteTarget)) return [];
  const stat = fs.statSync(absoluteTarget);
  if (stat.isFile()) return [relativeTarget];

  const files = [];
  const stack = [absoluteTarget];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const absoluteChild = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absoluteChild);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith('.mjs')) continue;
      files.push(path.relative(ROOT, absoluteChild));
    }
  }
  return files.sort();
}

function scanFileForUserWrites(relativePath) {
  const absolutePath = toAbsolute(relativePath);
  const source = fs.readFileSync(absolutePath, 'utf8');
  const findings = [];

  for (const rule of USER_WRITE_PATTERNS) {
    rule.regex.lastIndex = 0;
    for (const match of source.matchAll(rule.regex)) {
      const idx = match.index ?? 0;
      const line = lineOf(source, idx);
      const lineText = source.split('\n')[line - 1] || '';
      findings.push({
        rule: rule.key,
        line,
        matched: trimSnippet(match[0]),
        context: trimSnippet(lineText),
      });
    }
  }

  return findings;
}

function ensureBindings(bindingGroup, violations) {
  for (const binding of bindingGroup) {
    const absolutePath = toAbsolute(binding.file);
    if (!fs.existsSync(absolutePath)) {
      violations.push({
        type: 'missing_whitelist_file',
        file: binding.file,
      });
      continue;
    }

    const source = fs.readFileSync(absolutePath, 'utf8');
    for (const requiredImport of binding.requiredImports || []) {
      if (!source.includes(requiredImport)) {
        violations.push({
          type: 'missing_required_import',
          file: binding.file,
          requiredImport,
        });
      }
    }
  }
}

function hasExpectedMainTables() {
  const declared = userServiceMainWriteTables.map((item) => item.table);
  return EXPECTED_MAIN_TABLES.every((table) => declared.includes(table));
}

function main() {
  const violations = [];
  const legacyFindings = [];

  if (!hasExpectedMainTables()) {
    violations.push({
      type: 'missing_main_write_tables',
      expected: EXPECTED_MAIN_TABLES,
      actual: userServiceMainWriteTables.map((item) => item.table),
    });
  }

  const whitelistFiles = new Set([
    ...userServiceWriteWhitelist.routes,
    ...userServiceWriteWhitelist.usecases,
    ...userServiceWriteWhitelist.repositories,
    ...userServiceWriteWhitelist.infra,
  ]);

  ensureBindings(userServiceWriteBindings.routes, violations);
  ensureBindings(userServiceWriteBindings.usecases, violations);

  const protectedFiles = new Set([
    'server/microservices/gateway.mjs',
    ...userServiceProtectedServiceRoots.flatMap((target) => walkMjsFiles(target)),
  ]);

  for (const relativePath of protectedFiles) {
    if (!fs.existsSync(toAbsolute(relativePath))) continue;
    const findings = scanFileForUserWrites(relativePath);
    if (findings.length > 0) {
      violations.push({
        type: 'protected_service_direct_write',
        file: relativePath,
        findings,
      });
    }
  }

  const reviewFiles = new Set(userServiceLegacyReviewRoots.flatMap((target) => walkMjsFiles(target)));
  for (const relativePath of reviewFiles) {
    if (whitelistFiles.has(relativePath)) continue;
    const findings = scanFileForUserWrites(relativePath);
    if (findings.length === 0) continue;
    legacyFindings.push({
      file: relativePath,
      findings,
    });
  }

  const payload = {
    ok: violations.length === 0,
    mainWriteTables: userServiceMainWriteTables,
    whitelist: userServiceWriteWhitelist,
    checks: [
      'main_write_tables_declared',
      'route_whitelist_imports_verified',
      'usecase_whitelist_imports_verified',
      'gateway_points_no_user_direct_write',
      'legacy_non_user_writers_scanned',
    ],
    legacyReviewRequired: legacyFindings.length > 0,
    legacyFindings,
    violations,
  };

  if (violations.length > 0) {
    console.error(JSON.stringify(payload, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify(payload, null, 2));
}

main();
