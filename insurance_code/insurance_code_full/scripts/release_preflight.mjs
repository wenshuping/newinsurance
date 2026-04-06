#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateReleaseDashboard } from './release_dashboard.mjs';

const RELEASE_REPORT_KEEP = Number(process.env.RELEASE_REPORT_KEEP || '30');

function runCommand(step, env = process.env) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(step.command, step.args || [], {
      stdio: 'inherit',
      shell: false,
      env,
    });

    child.on('exit', (code, signal) => {
      resolve({
        label: step.label,
        category: step.category,
        ok: code === 0,
        skipped: false,
        code: code ?? -1,
        signal: signal || '',
        durationMs: Date.now() - startedAt,
      });
    });

    child.on('error', (error) => {
      resolve({
        label: step.label,
        category: step.category,
        ok: false,
        skipped: false,
        code: -1,
        signal: '',
        durationMs: Date.now() - startedAt,
        error: String(error?.message || error),
      });
    });
  });
}

function skippedResult(step) {
  return {
    label: step.label,
    category: step.category,
    ok: true,
    skipped: true,
    code: 0,
    signal: '',
    durationMs: 0,
  };
}

function buildCategorySummary(results) {
  const bucket = new Map();
  for (const result of results) {
    if (!bucket.has(result.category)) {
      bucket.set(result.category, {
        category: result.category,
        ok: true,
        total: 0,
        failed: 0,
        skipped: 0,
      });
    }
    const row = bucket.get(result.category);
    row.total += 1;
    if (result.skipped) row.skipped += 1;
    if (!result.ok) {
      row.failed += 1;
      row.ok = false;
    }
  }
  return [...bucket.values()];
}

async function main() {
  const startedAt = Date.now();
  const results = [];
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const reportsDir = path.resolve(__dirname, '../docs/reports');
  const now = new Date();
  const stamp = [
    String(now.getFullYear()),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    '-',
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');
  const reportFile = path.join(reportsDir, `release-preflight-${stamp}.json`);
  const reportMarkdownFile = path.join(reportsDir, `release-preflight-${stamp}.md`);
  const persistStatsFile = path.join(reportsDir, 'persist-sync-stats-latest.json');

  async function cleanupReports() {
    await fs.mkdir(reportsDir, { recursive: true });
    const entries = await fs.readdir(reportsDir, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile() && /^release-preflight-\d{8}-\d{6}\.json$/.test(entry.name))
      .map((entry) => entry.name.match(/^release-preflight-(\d{8}-\d{6})\.json$/)?.[1] || '')
      .filter(Boolean)
      .sort();
    const removeCount = Math.max(0, files.length - RELEASE_REPORT_KEEP);
    const removing = files.slice(0, removeCount);
    for (const stampValue of removing) {
      await fs.rm(path.join(reportsDir, `release-preflight-${stampValue}.json`), { force: true });
      await fs.rm(path.join(reportsDir, `release-preflight-${stampValue}.md`), { force: true });
    }
    return {
      keepCount: RELEASE_REPORT_KEEP,
      removedCount: removing.length,
      removed: removing.map((x) => `release-preflight-${x}`),
      currentCount: files.length - removing.length,
    };
  }

  async function readPersistSyncStats() {
    try {
      const raw = await fs.readFile(persistStatsFile, 'utf8');
      const parsed = JSON.parse(raw);
      const generatedMs = Date.parse(String(parsed?.generatedAt || ''));
      if (!Number.isFinite(generatedMs)) return null;
      if (generatedMs < startedAt) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function buildPayload(stage = '') {
    return {
      ok: results.every((r) => r.ok),
      stage,
      finishedAt: new Date().toISOString(),
      totalMs: Date.now() - startedAt,
      hasDatabaseUrl,
      categories: buildCategorySummary(results),
      results,
      reportFile,
      persistSyncStats: null,
    };
  }

  async function writeReport(payload) {
    const withPersist = { ...payload, persistSyncStats: await readPersistSyncStats() };
    await fs.mkdir(reportsDir, { recursive: true });
    await fs.writeFile(reportFile, `${JSON.stringify(withPersist, null, 2)}\n`, 'utf8');
    const markdown = `# Release Preflight Report

- Time: ${withPersist.finishedAt}
- Result: **${withPersist.ok ? 'PASS' : 'FAIL'}**
- Stage: ${withPersist.stage || 'done'}
- Duration: ${withPersist.totalMs}ms
- Report Json: \`${path.relative(process.cwd(), reportFile)}\`
- Persist Stats: ${withPersist.persistSyncStats ? 'available' : 'none'}

## Category Summary

${(withPersist.categories || [])
  .map((c) => `- ${c.category}: ${c.ok ? 'PASS' : 'FAIL'} (total=${c.total}, failed=${c.failed}, skipped=${c.skipped})`)
  .join('\n')}

## Steps

${(withPersist.results || [])
  .map(
    (r) =>
      `- ${r.label} [${r.category}]: ${r.skipped ? 'SKIPPED' : r.ok ? 'PASS' : 'FAIL'} (code=${r.code}, duration=${r.durationMs}ms${
        r.error ? `, error=${r.error}` : ''
      })`
  )
  .join('\n')}
`;
    await fs.writeFile(reportMarkdownFile, `${markdown}\n`, 'utf8');
    try {
      await generateReleaseDashboard({
        reportsDir,
        keepCount: RELEASE_REPORT_KEEP,
      });
    } catch (error) {
      console.warn(`[release:preflight] release dashboard refresh failed: ${String(error?.message || error)}`);
    }
    return withPersist;
  }

  const hasDatabaseUrl = String(process.env.DATABASE_URL || '').trim().length > 0;
  const steps = [];

  steps.push({
    label: 'db:mall:backfill-source-product-id',
    category: 'persist',
    command: 'npm',
    args: ['run', 'db:mall:backfill-source-product-id'],
    skip: false,
  });

  if (hasDatabaseUrl) {
    steps.push({
      label: 'db:fk:precheck',
      category: 'persist',
      command: 'npm',
      args: ['run', 'db:fk:precheck'],
      skip: false,
    });
  } else {
    console.log('[release:preflight] skip db:fk:precheck (DATABASE_URL not set)');
  }

  steps.push(
    {
      label: 'risk:check-tenant-fallback',
      category: 'risk',
      command: 'npm',
      args: ['run', 'risk:check-tenant-fallback'],
      skip: false,
    },
    {
      label: 'docs:check-links:all',
      category: 'docs',
      command: 'npm',
      args: ['run', 'docs:check-links:all'],
      skip: false,
    },
    {
      label: 'test:smoke:api-core',
      category: 'smoke',
      command: 'npm',
      args: ['run', 'test:smoke:api-core'],
      skip: false,
    },
    {
      label: 'test:perf:baseline',
      category: 'perf',
      command: 'npm',
      args: ['run', 'test:perf:baseline'],
      skip: process.env.PREFLIGHT_SKIP_PERF === '1',
    },
    {
      label: 'lint:persistence:incremental-writepaths',
      category: 'persist',
      command: 'npm',
      args: ['run', 'lint:persistence:incremental-writepaths'],
      skip: false,
    },
    {
      label: 'ci:gate:core:report',
      category: 'gate',
      command: 'npm',
      args: ['run', 'ci:gate:core:report'],
      skip: false,
    },
    {
      label: 'slo:guard',
      category: 'slo',
      command: 'npm',
      args: ['run', 'slo:guard'],
      skip: false,
    }
  );

  for (const step of steps) {
    const result = step.skip ? skippedResult(step) : await runCommand(step);
    results.push(result);
    if (!result.ok) {
      const payload = await writeReport(buildPayload(step.label));
      const cleanup = await cleanupReports();
      console.error(JSON.stringify({ ...payload, cleanup }, null, 2));
      process.exit(1);
    }
  }

  const payload = await writeReport(buildPayload());
  const cleanup = await cleanupReports();
  console.log(JSON.stringify({ ...payload, cleanup }, null, 2));
  if (!payload.ok) process.exit(1);
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: String(error?.message || error),
      },
      null,
      2
    )
  );
  process.exit(1);
});
