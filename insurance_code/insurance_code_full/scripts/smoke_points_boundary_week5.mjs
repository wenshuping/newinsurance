#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(
  ROOT,
  'server/microservices/points-service/write-boundary-whitelist.json'
);

function fail(code, details) {
  console.error(JSON.stringify({ ok: false, code, ...details }, null, 2));
  process.exit(1);
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

function toAbsolute(relPath) {
  return path.join(ROOT, relPath);
}

function toPosix(relPath) {
  return relPath.split(path.sep).join('/');
}

function listCodeFiles(targetPath) {
  if (!fs.existsSync(targetPath)) return [];
  const stat = fs.statSync(targetPath);
  if (stat.isFile()) return /\.(mjs|js|cjs|ts)$/.test(targetPath) ? [targetPath] : [];

  const files = [];
  for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const absolute = path.join(targetPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...listCodeFiles(absolute));
      continue;
    }
    if (/\.(mjs|js|cjs|ts)$/.test(entry.name)) files.push(absolute);
  }
  return files;
}

function lineOf(source, index) {
  return source.slice(0, index).split('\n').length;
}

function trimLine(text) {
  return text.replace(/\s+/g, ' ').trim().slice(0, 200);
}

function makeWriteMatchers(table, collection) {
  return [
    {
      type: 'state_collection_assign',
      table,
      regex: new RegExp(`\\bstate\\.${collection}\\s*=`, 'g'),
    },
    {
      type: 'state_collection_mutation',
      table,
      regex: new RegExp(
        `\\bstate\\.${collection}\\.(push|unshift|splice|pop|shift|sort|reverse)\\s*\\(`,
        'g'
      ),
    },
    {
      type: 'sql_insert',
      table,
      regex: new RegExp(`\\bINSERT\\s+INTO\\s+${table}\\b`, 'gi'),
    },
    {
      type: 'sql_update',
      table,
      regex: new RegExp(`\\bUPDATE\\s+${table}\\b`, 'gi'),
    },
    {
      type: 'sql_delete',
      table,
      regex: new RegExp(`\\bDELETE\\s+FROM\\s+${table}\\b`, 'gi'),
    },
  ];
}

function collectMatches(relFile, source, matchers) {
  const lines = source.split('\n');
  const hits = [];
  for (const matcher of matchers) {
    matcher.regex.lastIndex = 0;
    for (const match of source.matchAll(matcher.regex)) {
      const index = match.index ?? 0;
      const line = lineOf(source, index);
      hits.push({
        file: relFile,
        table: matcher.table,
        type: matcher.type,
        line,
        matched: trimLine(match[0] || ''),
        context: trimLine(lines[line - 1] || ''),
      });
    }
  }
  return hits;
}

function ensureFilesExist(files, category) {
  const missing = files.filter((relPath) => !fs.existsSync(toAbsolute(relPath)));
  if (missing.length > 0) {
    fail('POINTS_BOUNDARY_WHITELIST_MISSING_FILES', { category, missing });
  }
}

function normalizePatterns(caller) {
  if (Array.isArray(caller?.patterns)) {
    return caller.patterns
      .map((item) => String(item || '').trim())
      .filter(Boolean);
  }
  const single = String(caller?.pattern || '').trim();
  return single ? [single] : [];
}

function main() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    fail('POINTS_BOUNDARY_MANIFEST_NOT_FOUND', { manifest: MANIFEST_PATH });
  }

  const manifest = readJson(MANIFEST_PATH);
  const {
    mainWriteTables = [],
    tableStateCollections = {},
    routeWhitelist = [],
    usecaseWhitelist = [],
    repositoryWhitelist = [],
    internalServiceFiles = [],
    ignoreFiles = [],
    forbiddenScopes = [],
    indirectCrossDomainCallers = [],
  } = manifest;

  ensureFilesExist(routeWhitelist, 'routeWhitelist');
  ensureFilesExist(usecaseWhitelist, 'usecaseWhitelist');
  ensureFilesExist(repositoryWhitelist, 'repositoryWhitelist');
  ensureFilesExist(internalServiceFiles, 'internalServiceFiles');
  ensureFilesExist(ignoreFiles, 'ignoreFiles');

  const matchers = mainWriteTables.flatMap((table) => {
    const collection = tableStateCollections[table];
    if (!collection) fail('POINTS_BOUNDARY_MANIFEST_INVALID', { message: `missing collection mapping for ${table}` });
    return makeWriteMatchers(table, collection);
  });

  const repositorySet = new Set(repositoryWhitelist);
  const ignoreSet = new Set(ignoreFiles);
  const internalBoundarySet = new Set([
    ...routeWhitelist,
    ...usecaseWhitelist,
    ...repositoryWhitelist,
    ...internalServiceFiles,
  ]);

  const serverFiles = listCodeFiles(path.join(ROOT, 'server')).map((absolute) => toPosix(path.relative(ROOT, absolute)));
  const nonWhitelistedDirectWrites = [];

  for (const relFile of serverFiles) {
    if (repositorySet.has(relFile) || ignoreSet.has(relFile)) continue;
    const absolute = toAbsolute(relFile);
    const source = readText(absolute);
    const hits = collectMatches(relFile, source, matchers);
    if (hits.length > 0) nonWhitelistedDirectWrites.push(...hits);
  }

  const forbiddenScopeViolations = [];
  const forbiddenScopeSummary = [];
  for (const scope of forbiddenScopes) {
    const scopeFiles = [];
    for (const relPath of scope.paths || []) {
      const absolute = toAbsolute(relPath);
      scopeFiles.push(...listCodeFiles(absolute));
    }
    const uniqueScopeFiles = [...new Set(scopeFiles)].map((absolute) => toPosix(path.relative(ROOT, absolute)));
    const hits = [];
    for (const relFile of uniqueScopeFiles) {
      const source = readText(toAbsolute(relFile));
      hits.push(...collectMatches(relFile, source, matchers));
    }
    forbiddenScopeSummary.push({
      scope: scope.name,
      checkedFiles: uniqueScopeFiles.length,
      violations: hits.length,
    });
    forbiddenScopeViolations.push(...hits.map((hit) => ({ scope: scope.name, ...hit })));
  }

  const indirectCallerFindings = [];
  for (const caller of indirectCrossDomainCallers) {
    const relFile = caller.file;
    const absolute = toAbsolute(relFile);
    if (!fs.existsSync(absolute)) {
      fail('POINTS_BOUNDARY_INDIRECT_CALLER_MISSING', { file: relFile });
    }
    const source = readText(absolute);
    const patterns = normalizePatterns(caller);
    if (patterns.length === 0) {
      fail('POINTS_BOUNDARY_INDIRECT_CALLER_INVALID', { file: relFile, caller });
    }

    const missingPatterns = patterns.filter((pattern) => !source.includes(pattern));
    if (missingPatterns.length > 0) {
      fail('POINTS_BOUNDARY_INDIRECT_CALLER_PATTERN_MISSING', {
        file: relFile,
        missingPatterns,
        expectedPatterns: patterns,
      });
    }

    if (!internalBoundarySet.has(relFile)) {
      for (const pattern of patterns) {
        const index = source.indexOf(pattern);
        const line = lineOf(source, index);
        indirectCallerFindings.push({
          file: relFile,
          line,
          pattern,
          reason: caller.reason || '',
        });
      }
    }
  }

  if (nonWhitelistedDirectWrites.length > 0 || forbiddenScopeViolations.length > 0) {
    fail('POINTS_BOUNDARY_VIOLATION', {
      manifest: toPosix(path.relative(ROOT, MANIFEST_PATH)),
      mainWriteTables,
      nonWhitelistedDirectWrites,
      forbiddenScopeViolations,
      forbiddenScopeSummary,
    });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        manifest: toPosix(path.relative(ROOT, MANIFEST_PATH)),
        mainWriteTables,
        routeWhitelistCount: routeWhitelist.length,
        usecaseWhitelistCount: usecaseWhitelist.length,
        repositoryWhitelistCount: repositoryWhitelist.length,
        checks: [
          'points_whitelist_files_exist',
          'non_whitelisted_server_files_do_not_direct_write_points_tables',
          'gateway_service_has_no_direct_points_table_writes',
          'user_service_has_no_direct_points_table_writes',
          'indirect_cross_domain_callers_match_expected_points_settlement_patterns',
        ],
        forbiddenScopeSummary,
        indirectCallerFindings,
      },
      null,
      2
    )
  );
}

main();
