#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_KEEP_COUNT = Number(process.env.RELEASE_DASHBOARD_KEEP || process.env.RELEASE_REPORT_KEEP || '30');
const DEFAULT_MAX_AGE_HOURS = Number(process.env.RELEASE_DASHBOARD_MAX_AGE_HOURS || '72');

function buildStamp(date = new Date()) {
  return [
    String(date.getFullYear()),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
    '-',
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
    String(date.getSeconds()).padStart(2, '0'),
  ].join('');
}

function toSafeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mdEscapeCell(input) {
  return String(input ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

async function readJsonFileSafe(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return { ok: true, data: JSON.parse(raw) };
  } catch (error) {
    return {
      ok: false,
      error: String(error?.message || error),
      data: null,
    };
  }
}

async function readLatestReport(reportsDir, prefix, label, maxAgeHours) {
  const entries = await fs.readdir(reportsDir, { withFileTypes: true });
  const stamps = entries
    .filter((entry) => entry.isFile() && new RegExp(`^${prefix}-(\\d{8}-\\d{6})\\.json$`).test(entry.name))
    .map((entry) => entry.name.match(new RegExp(`^${prefix}-(\\d{8}-\\d{6})\\.json$`))?.[1] || '')
    .filter(Boolean)
    .sort();

  if (stamps.length === 0) {
    return {
      label,
      prefix,
      exists: false,
      status: 'MISSING',
      ok: false,
      ageMinutes: null,
      stale: false,
      file: '',
      stamp: '',
      report: null,
    };
  }

  const stamp = stamps[stamps.length - 1];
  const file = path.join(reportsDir, `${prefix}-${stamp}.json`);
  const parsed = await readJsonFileSafe(file);
  if (!parsed.ok || !parsed.data) {
    return {
      label,
      prefix,
      exists: true,
      status: 'INVALID',
      ok: false,
      ageMinutes: null,
      stale: false,
      file,
      stamp,
      parseError: parsed.error,
      report: null,
    };
  }

  const report = parsed.data;
  const finishedAtRaw = report.finishedAt || report.startedAt || report.generatedAt || '';
  const finishedAtMs = Date.parse(String(finishedAtRaw));
  let ageMinutes = null;
  if (Number.isFinite(finishedAtMs)) {
    ageMinutes = Number(((Date.now() - finishedAtMs) / 60000).toFixed(1));
  } else {
    const stat = await fs.stat(file);
    ageMinutes = Number(((Date.now() - stat.mtimeMs) / 60000).toFixed(1));
  }
  const stale = ageMinutes > maxAgeHours * 60;
  const ok = report.ok === true;

  return {
    label,
    prefix,
    exists: true,
    status: ok ? (stale ? 'STALE' : 'PASS') : 'FAIL',
    ok,
    ageMinutes,
    stale,
    file,
    stamp,
    report,
  };
}

function buildSummary(reports) {
  const missing = reports.filter((item) => !item.exists).map((item) => item.label);
  const invalid = reports.filter((item) => item.status === 'INVALID').map((item) => item.label);
  const failed = reports.filter((item) => item.exists && !item.ok && item.status !== 'INVALID').map((item) => item.label);
  const stale = reports.filter((item) => item.stale).map((item) => item.label);
  const ok = missing.length === 0 && invalid.length === 0 && failed.length === 0 && stale.length === 0;
  return { ok, missing, invalid, failed, stale };
}

function buildDashboardMarkdown(payload) {
  const preflight = payload.latest.releasePreflight;
  const perf = payload.latest.perfBaseline;
  const ciGate = payload.latest.ciGateCore;
  const slo = payload.latest.sloGuard;

  const actions = [];
  if (payload.summary.missing.length > 0) actions.push(`缺失报告：${payload.summary.missing.join(', ')}`);
  if (payload.summary.invalid.length > 0) actions.push(`解析失败：${payload.summary.invalid.join(', ')}`);
  if (payload.summary.failed.length > 0) actions.push(`执行失败：${payload.summary.failed.join(', ')}`);
  if (payload.summary.stale.length > 0) actions.push(`报告过期：${payload.summary.stale.join(', ')}（>${payload.maxAgeHours}h）`);
  if (actions.length === 0) actions.push('无阻断项，可进入发布评审。');

  const preflightCategoryRows = ((preflight.report && preflight.report.categories) || [])
    .map((row) => `| ${mdEscapeCell(row.category)} | ${row.ok ? 'PASS' : 'FAIL'} | ${toSafeNumber(row.total)} | ${toSafeNumber(row.failed)} | ${toSafeNumber(row.skipped)} |`)
    .join('\n');

  const perfRows = ((perf.report && perf.report.endpointMetrics) || [])
    .map(
      (row) =>
        `| ${mdEscapeCell(row.endpoint)} | ${toSafeNumber(row.avgMs)} | ${toSafeNumber(row.p95Ms)} | ${toSafeNumber(row.failCount)} | ${toSafeNumber(row.total)} |`
    )
    .join('\n');

  const ciCommand =
    ciGate.report && ciGate.report.result
      ? `${ciGate.report.result.command || ''} ${(ciGate.report.result.args || []).join(' ')}`
      : '';

  return `# Release Dashboard

- Generated At: ${payload.generatedAt}
- Overall: **${payload.ok ? 'GREEN' : 'RED'}**
- Max Age Window: ${payload.maxAgeHours}h
- Stamped Json: \`${payload.files.stampedJson}\`
- Stamped Markdown: \`${payload.files.stampedMarkdown}\`
- Latest Json: \`${payload.files.latestJson}\`
- Latest Markdown: \`${payload.files.latestMarkdown}\`

## Latest Reports

| Report | Status | Finished At | Age (min) | File |
|---|---|---|---:|---|
| release-preflight | ${preflight.status} | ${mdEscapeCell(preflight.report?.finishedAt || '')} | ${preflight.ageMinutes ?? '-'} | \`${mdEscapeCell(preflight.file)}\` |
| perf-baseline | ${perf.status} | ${mdEscapeCell(perf.report?.finishedAt || '')} | ${perf.ageMinutes ?? '-'} | \`${mdEscapeCell(perf.file)}\` |
| ci-gate-core | ${ciGate.status} | ${mdEscapeCell(ciGate.report?.finishedAt || '')} | ${ciGate.ageMinutes ?? '-'} | \`${mdEscapeCell(ciGate.file)}\` |
| slo-guard | ${slo.status} | ${mdEscapeCell(slo.report?.generatedAt || '')} | ${slo.ageMinutes ?? '-'} | \`${mdEscapeCell(slo.file)}\` |

## Preflight Categories

| Category | Result | Total | Failed | Skipped |
|---|---|---:|---:|---:|
${preflightCategoryRows || '| - | - | - | - | - |'}

## Perf Baseline Snapshot

| Endpoint | Avg(ms) | P95(ms) | Fail | Total |
|---|---:|---:|---:|---:|
${perfRows || '| - | - | - | - | - |'}

## CI Gate

- Result: **${ciGate.status}**
- Command: \`${mdEscapeCell(ciCommand)}\`
- Duration: ${toSafeNumber(ciGate.report?.result?.durationMs)}ms

## SLO Guard

- Result: **${slo.status}**
- Alerts: ${toSafeNumber(slo.report?.alerts?.length, 0)}
- Thresholds: uptime>=${toSafeNumber(slo.report?.thresholds?.apiUptime24hMin, 0)}%, errorRate<=${toSafeNumber(slo.report?.thresholds?.apiErrorRate1hMax, 0)}%, p95<=${toSafeNumber(slo.report?.thresholds?.apiP95MsMax, 0)}ms

## Actions

${actions.map((line) => `- ${line}`).join('\n')}
`;
}

async function cleanupDashboardReports(reportsDir, keepCount) {
  const entries = await fs.readdir(reportsDir, { withFileTypes: true });
  const stamps = entries
    .filter((entry) => entry.isFile() && /^release-dashboard-\d{8}-\d{6}\.json$/.test(entry.name))
    .map((entry) => entry.name.match(/^release-dashboard-(\d{8}-\d{6})\.json$/)?.[1] || '')
    .filter(Boolean)
    .sort();
  const remove = stamps.slice(0, Math.max(0, stamps.length - keepCount));
  for (const stamp of remove) {
    await fs.rm(path.join(reportsDir, `release-dashboard-${stamp}.json`), { force: true });
    await fs.rm(path.join(reportsDir, `release-dashboard-${stamp}.md`), { force: true });
  }
  return {
    keepCount,
    removedCount: remove.length,
    removed: remove.map((stamp) => `release-dashboard-${stamp}`),
    currentCount: stamps.length - remove.length,
  };
}

export async function generateReleaseDashboard(options = {}) {
  const keepCount = toSafeNumber(options.keepCount, DEFAULT_KEEP_COUNT);
  const maxAgeHours = toSafeNumber(options.maxAgeHours, DEFAULT_MAX_AGE_HOURS);
  const reportsDir = String(options.reportsDir || '');

  const effectiveReportsDir = reportsDir || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../docs/reports');
  await fs.mkdir(effectiveReportsDir, { recursive: true });

  const releasePreflight = await readLatestReport(effectiveReportsDir, 'release-preflight', 'release-preflight', maxAgeHours);
  const perfBaseline = await readLatestReport(effectiveReportsDir, 'perf-baseline', 'perf-baseline', maxAgeHours);
  const ciGateCore = await readLatestReport(effectiveReportsDir, 'ci-gate-core', 'ci-gate-core', maxAgeHours);
  const sloGuard = await readLatestReport(effectiveReportsDir, 'slo-guard', 'slo-guard', maxAgeHours);
  const summary = buildSummary([releasePreflight, perfBaseline, ciGateCore, sloGuard]);

  const stamp = buildStamp();
  const stampedJsonPath = path.join(effectiveReportsDir, `release-dashboard-${stamp}.json`);
  const stampedMdPath = path.join(effectiveReportsDir, `release-dashboard-${stamp}.md`);
  const latestJsonPath = path.join(effectiveReportsDir, 'release-dashboard-latest.json');
  const latestMdPath = path.join(effectiveReportsDir, 'release-dashboard-latest.md');

  const payload = {
    ok: summary.ok,
    generatedAt: new Date().toISOString(),
    stamp,
    maxAgeHours,
    latest: {
      releasePreflight,
      perfBaseline,
      ciGateCore,
      sloGuard,
    },
    summary,
    files: {
      stampedJson: path.relative(process.cwd(), stampedJsonPath),
      stampedMarkdown: path.relative(process.cwd(), stampedMdPath),
      latestJson: path.relative(process.cwd(), latestJsonPath),
      latestMarkdown: path.relative(process.cwd(), latestMdPath),
    },
  };

  const markdown = buildDashboardMarkdown(payload);
  await fs.writeFile(stampedJsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await fs.writeFile(stampedMdPath, `${markdown}\n`, 'utf8');
  await fs.writeFile(latestJsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await fs.writeFile(latestMdPath, `${markdown}\n`, 'utf8');
  const cleanup = await cleanupDashboardReports(effectiveReportsDir, keepCount);

  return { ...payload, cleanup };
}

async function main() {
  const payload = await generateReleaseDashboard();
  console.log(JSON.stringify(payload, null, 2));
  if (process.env.RELEASE_DASHBOARD_STRICT === '1' && !payload.ok) process.exit(1);
}

const currentFile = fileURLToPath(import.meta.url);
const entryFile = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (entryFile && path.resolve(currentFile) === entryFile) {
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
}
