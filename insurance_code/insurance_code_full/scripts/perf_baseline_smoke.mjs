#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KEEP_COUNT = Number(process.env.RELEASE_REPORT_KEEP || '30');
const ITERATIONS = Number(process.env.PERF_BASELINE_ITERATIONS || '10');
const TIMEOUT_MS = Number(process.env.PERF_BASELINE_TIMEOUT_MS || '5000');
const P95_THRESHOLD_MS = Number(process.env.PERF_BASELINE_P95_MS || '1200');
const AVG_THRESHOLD_MS = Number(process.env.PERF_BASELINE_AVG_MS || '600');
const MAX_ERROR_RATE = Number(process.env.PERF_BASELINE_MAX_ERROR_RATE || '0');

function percentile(sortedValues, ratio) {
  if (!sortedValues.length) return 0;
  const idx = Math.min(sortedValues.length - 1, Math.max(0, Math.ceil(sortedValues.length * ratio) - 1));
  return sortedValues[idx];
}

function toMs(startNs, endNs) {
  return Number(endNs - startNs) / 1_000_000;
}

async function requestOnce(base, endpoint) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = process.hrtime.bigint();
  try {
    const response = await fetch(`${base}${endpoint}`, {
      headers: {
        'x-tenant-id': '1',
      },
      signal: controller.signal,
    });
    const ended = process.hrtime.bigint();
    return {
      ok: response.ok,
      status: response.status,
      durationMs: toMs(started, ended),
    };
  } catch (error) {
    const ended = process.hrtime.bigint();
    return {
      ok: false,
      status: 0,
      durationMs: toMs(started, ended),
      error: String(error?.message || error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function buildEndpointMetrics(endpoint, samples) {
  const durations = samples.map((s) => s.durationMs).sort((a, b) => a - b);
  const okCount = samples.filter((s) => s.ok).length;
  const failCount = samples.length - okCount;
  const avgMs = durations.length ? durations.reduce((acc, value) => acc + value, 0) / durations.length : 0;
  const p95Ms = percentile(durations, 0.95);
  const maxMs = durations.length ? durations[durations.length - 1] : 0;
  const minMs = durations.length ? durations[0] : 0;
  const errorRate = samples.length ? failCount / samples.length : 0;
  return {
    endpoint,
    total: samples.length,
    okCount,
    failCount,
    errorRate,
    avgMs: Number(avgMs.toFixed(2)),
    p95Ms: Number(p95Ms.toFixed(2)),
    minMs: Number(minMs.toFixed(2)),
    maxMs: Number(maxMs.toFixed(2)),
    sampleStatuses: samples.map((s) => s.status),
  };
}

async function cleanupReports(reportsDir) {
  await fs.mkdir(reportsDir, { recursive: true });
  const entries = await fs.readdir(reportsDir, { withFileTypes: true });
  const stamps = entries
    .filter((entry) => entry.isFile() && /^perf-baseline-\d{8}-\d{6}\.json$/.test(entry.name))
    .map((entry) => entry.name.match(/^perf-baseline-(\d{8}-\d{6})\.json$/)?.[1] || '')
    .filter(Boolean)
    .sort();
  const remove = stamps.slice(0, Math.max(0, stamps.length - KEEP_COUNT));
  for (const stamp of remove) {
    await fs.rm(path.join(reportsDir, `perf-baseline-${stamp}.json`), { force: true });
    await fs.rm(path.join(reportsDir, `perf-baseline-${stamp}.md`), { force: true });
  }
  return {
    keepCount: KEEP_COUNT,
    removedCount: remove.length,
    removed: remove.map((s) => `perf-baseline-${s}`),
    currentCount: stamps.length - remove.length,
  };
}

async function main() {
  const base = String(process.env.API_BASE_URL || process.env.API_BASE || 'http://127.0.0.1:4000').replace(/\/+$/, '');
  const endpoints = String(
    process.env.PERF_BASELINE_ENDPOINTS || '/api/health,/api/mall/items,/api/activities,/api/learning/courses'
  )
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const startedAt = Date.now();
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
  const reportJsonFile = path.join(reportsDir, `perf-baseline-${stamp}.json`);
  const reportMdFile = path.join(reportsDir, `perf-baseline-${stamp}.md`);

  const endpointMetrics = [];
  for (const endpoint of endpoints) {
    const samples = [];
    for (let i = 0; i < ITERATIONS; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      samples.push(await requestOnce(base, endpoint));
    }
    endpointMetrics.push(buildEndpointMetrics(endpoint, samples));
  }

  const allFailed = endpointMetrics.filter((m) => m.failCount > 0);
  const p95Exceeded = endpointMetrics.filter((m) => m.p95Ms > P95_THRESHOLD_MS);
  const avgExceeded = endpointMetrics.filter((m) => m.avgMs > AVG_THRESHOLD_MS);
  const errorRateExceeded = endpointMetrics.filter((m) => m.errorRate > MAX_ERROR_RATE);
  const ok = allFailed.length === 0 && p95Exceeded.length === 0 && avgExceeded.length === 0 && errorRateExceeded.length === 0;

  const payload = {
    ok,
    finishedAt: new Date().toISOString(),
    base,
    thresholds: {
      p95Ms: P95_THRESHOLD_MS,
      avgMs: AVG_THRESHOLD_MS,
      maxErrorRate: MAX_ERROR_RATE,
      timeoutMs: TIMEOUT_MS,
      iterations: ITERATIONS,
    },
    endpointMetrics,
    failures: {
      statusFailures: allFailed.map((m) => m.endpoint),
      p95Exceeded: p95Exceeded.map((m) => ({ endpoint: m.endpoint, p95Ms: m.p95Ms })),
      avgExceeded: avgExceeded.map((m) => ({ endpoint: m.endpoint, avgMs: m.avgMs })),
      errorRateExceeded: errorRateExceeded.map((m) => ({ endpoint: m.endpoint, errorRate: m.errorRate })),
    },
    totalMs: Date.now() - startedAt,
    reportJsonFile,
    reportMdFile,
  };

  await fs.mkdir(reportsDir, { recursive: true });
  await fs.writeFile(reportJsonFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  const markdown = `# Perf Baseline Report

- Time: ${payload.finishedAt}
- Result: **${payload.ok ? 'PASS' : 'FAIL'}**
- Base: ${payload.base}
- Iterations per endpoint: ${ITERATIONS}
- Thresholds: p95<=${P95_THRESHOLD_MS}ms, avg<=${AVG_THRESHOLD_MS}ms, errorRate<=${MAX_ERROR_RATE}
- Duration: ${payload.totalMs}ms

## Endpoint Metrics

${endpointMetrics
  .map(
    (m) =>
      `- ${m.endpoint}: ${m.failCount === 0 ? 'PASS' : 'FAIL'} | avg=${m.avgMs}ms p95=${m.p95Ms}ms min=${m.minMs}ms max=${m.maxMs}ms errors=${m.failCount}/${m.total}`
  )
  .join('\n')}
`;
  await fs.writeFile(reportMdFile, `${markdown}\n`, 'utf8');
  const cleanup = await cleanupReports(reportsDir);

  console.log(JSON.stringify({ ...payload, cleanup }, null, 2));
  if (!ok) process.exit(1);
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
