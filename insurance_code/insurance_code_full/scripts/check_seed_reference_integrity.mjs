#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const seedPath = path.join(rootDir, 'server', 'data', 'db.json');

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function toIdSet(rows) {
  return new Set(
    (Array.isArray(rows) ? rows : [])
      .map((row) => Number(row?.id))
      .filter((value) => Number.isFinite(value)),
  );
}

function pushIssue(store, collection, field, rowId, value) {
  if (!store[collection]) store[collection] = [];
  store[collection].push({
    field,
    rowId: rowId ?? null,
    value: value ?? null,
  });
}

function checkReferenceSet(rows, collection, field, validIds, issues) {
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || typeof row !== 'object') continue;
    if (!(field in row)) continue;
    const raw = row[field];
    if (raw === null || raw === undefined || raw === '') continue;
    const value = Number(raw);
    if (!Number.isFinite(value) || !validIds.has(value)) {
      pushIssue(issues, collection, field, row.id, raw);
    }
  }
}

if (!fs.existsSync(seedPath)) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        seedPath,
        error: `missing seed file: ${seedPath}`,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

const seed = loadJson(seedPath);
const issues = {};

const tenantIds = toIdSet(seed.tenants);
const orgIds = toIdSet(seed.orgUnits);
const teamIds = toIdSet(seed.teams);
const userIds = toIdSet(seed.users);

for (const [collection, rows] of Object.entries(seed)) {
  if (!Array.isArray(rows)) continue;
  checkReferenceSet(rows, collection, 'tenantId', tenantIds, issues);
  checkReferenceSet(rows, collection, 'orgId', orgIds, issues);
  checkReferenceSet(rows, collection, 'teamId', teamIds, issues);
  checkReferenceSet(rows, collection, 'ownerUserId', userIds, issues);
}

const groupedCounts = Object.fromEntries(
  Object.entries(issues).map(([collection, rows]) => [collection, rows.length]),
);

const result = {
  ok: Object.keys(issues).length === 0,
  seedPath,
  checkedReferences: ['tenantId', 'orgId', 'teamId', 'ownerUserId'],
  counts: {
    tenants: tenantIds.size,
    orgUnits: orgIds.size,
    teams: teamIds.size,
    users: userIds.size,
  },
  issueCountsByCollection: groupedCounts,
  issues,
};

console.log(JSON.stringify(result, null, 2));

if (!result.ok) process.exit(1);
