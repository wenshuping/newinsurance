#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const seedPath = path.join(rootDir, 'server', 'data', 'db.json');
const runtimeSnapshotPath = path.join(rootDir, 'server', 'data', 'runtime-snapshot.json');
const gitignorePath = path.join(rootDir, '.gitignore');

const runtimeOnlyKeys = [
  'sessions',
  'smsCodes',
  'auditLogs',
  'domainEvents',
  'outboxEvents',
  'idempotencyRecords',
  'metricDailyUv',
  'metricDailyCounters',
  'metricHourlyCounters',
  'trackEvents',
  'actorCsrfTokens',
  'orderPayments',
  'orderFulfillments',
  'orderRefunds',
  'activityCompletions',
  'courseCompletions',
  'signIns',
  'pOpsJobs',
  'pOpsJobLogs',
  'reconciliationReports',
];

const errors = [];

if (!fs.existsSync(seedPath)) {
  errors.push(`missing seed file: ${seedPath}`);
} else {
  const seed = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
  for (const key of runtimeOnlyKeys) {
    const value = seed[key];
    if (Array.isArray(value) && value.length > 0) {
      errors.push(`seed file must not contain runtime records: ${key} has ${value.length} entries`);
    }
  }
}

if (!fs.existsSync(gitignorePath)) {
  errors.push(`missing .gitignore: ${gitignorePath}`);
} else {
  const gitignore = fs.readFileSync(gitignorePath, 'utf-8');
  if (!gitignore.includes('server/data/runtime-snapshot.json')) {
    errors.push('missing ignore rule: server/data/runtime-snapshot.json');
  }
}

const result = {
  ok: errors.length === 0,
  seedPath,
  runtimeSnapshotPath,
  runtimeSnapshotPresent: fs.existsSync(runtimeSnapshotPath),
  checkedRuntimeOnlyKeys: runtimeOnlyKeys,
  errors,
};

console.log(JSON.stringify(result, null, 2));

if (!result.ok) process.exit(1);
