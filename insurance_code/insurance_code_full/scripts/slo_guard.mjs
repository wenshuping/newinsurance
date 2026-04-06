#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KEEP_COUNT = Number(process.env.RELEASE_REPORT_KEEP || '30');
const UPTIME_MIN = Number(process.env.SLO_API_UPTIME_MIN || '99');
const ERROR_RATE_MAX = Number(process.env.SLO_API_ERROR_RATE_MAX || '1');
const P95_MAX_MS = Number(process.env.SLO_API_P95_MAX_MS || '1200');
const STRICT_MODE = process.env.SLO_GUARD_STRICT !== '0';

if (!process.env.STORAGE_BACKEND && !process.env.DATABASE_URL) {
  process.env.STORAGE_BACKEND = 'dbjson';
}

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

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function hourKeyToDate(hourKey) {
  const match = String(hourKey || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})$/);
  if (!match) return null;
  const [, y, m, d, h] = match;
  return new Date(Number(y), Number(m) - 1, Number(d), Number(h), 0, 0, 0);
}

function readLatestStamp(entries, prefix) {
  return entries
    .filter((entry) => entry.isFile() && new RegExp(`^${prefix}-(\\d{8}-\\d{6})\\.json$`).test(entry.name))
    .map((entry) => entry.name.match(new RegExp(`^${prefix}-(\\d{8}-\\d{6})\\.json$`))?.[1] || '')
    .filter(Boolean)
    .sort()
    .at(-1);
}

async function readLatestPerfReport(reportsDir) {
  const entries = await fs.readdir(reportsDir, { withFileTypes: true });
  const stamp = readLatestStamp(entries, 'perf-baseline');
  if (!stamp) return null;
  const file = path.join(reportsDir, `perf-baseline-${stamp}.json`);
  const raw = await fs.readFile(file, 'utf8');
  return {
    file,
    stamp,
    data: JSON.parse(raw),
  };
}

function buildSliResult({ key, name, value, target, operator, unit = '', note = '' }) {
  const pass = operator === '>=' ? value >= target : value <= target;
  return {
    key,
    name,
    value: Number(value.toFixed(4)),
    target,
    operator,
    unit,
    status: pass ? 'PASS' : 'FAIL',
    note,
  };
}

function toSeverityByGap(item) {
  if (item.status === 'PASS') return 'none';
  if (item.key === 'api_uptime_24h') return item.value < item.target - 1 ? 'critical' : 'warning';
  if (item.key === 'api_error_rate_1h') return item.value > item.target * 2 ? 'critical' : 'warning';
  if (item.key === 'api_perf_p95_ms') return item.value > item.target * 1.25 ? 'critical' : 'warning';
  return 'warning';
}

async function cleanupReports(reportsDir) {
  const entries = await fs.readdir(reportsDir, { withFileTypes: true });
  const stamps = entries
    .filter((entry) => entry.isFile() && /^slo-guard-\d{8}-\d{6}\.json$/.test(entry.name))
    .map((entry) => entry.name.match(/^slo-guard-(\d{8}-\d{6})\.json$/)?.[1] || '')
    .filter(Boolean)
    .sort();
  const remove = stamps.slice(0, Math.max(0, stamps.length - KEEP_COUNT));
  for (const stamp of remove) {
    await fs.rm(path.join(reportsDir, `slo-guard-${stamp}.json`), { force: true });
    await fs.rm(path.join(reportsDir, `slo-guard-${stamp}.md`), { force: true });
  }
  return {
    keepCount: KEEP_COUNT,
    removedCount: remove.length,
    removed: remove.map((x) => `slo-guard-${x}`),
    currentCount: stamps.length - remove.length,
  };
}

async function main() {
  const { initializeState, getState, closeState } = await import('../server/skeleton-c-v1/common/state.mjs');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const reportsDir = path.resolve(__dirname, '../docs/reports');
  await fs.mkdir(reportsDir, { recursive: true });

  await initializeState();
  const state = getState();

  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const hourly = Array.isArray(state.metricHourlyCounters) ? state.metricHourlyCounters : [];
  const sumHourly = (metricKey, start, end) =>
    hourly
      .filter((row) => {
        if (String(row?.metricKey || '') !== metricKey) return false;
        const d = hourKeyToDate(row?.hourKey);
        return Boolean(d && d >= start && d <= end);
      })
      .reduce((acc, row) => acc + toNumber(row?.cnt, 0), 0);

  let total24 = sumHourly('api_total', twentyFourHoursAgo, now);
  let success24 = sumHourly('api_success', twentyFourHoursAgo, now);
  let fail24 = sumHourly('api_fail', twentyFourHoursAgo, now);
  if (total24 <= 0) {
    const audit = Array.isArray(state.auditLogs) ? state.auditLogs : [];
    const recent = audit.filter((row) => {
      const d = new Date(row?.createdAt || '');
      return !Number.isNaN(d.getTime()) && d >= twentyFourHoursAgo && d <= now;
    });
    total24 = recent.length;
    success24 = recent.filter((row) => String(row?.result || '').toLowerCase() === 'success').length;
    fail24 = recent.filter((row) => String(row?.result || '').toLowerCase() === 'fail').length;
  }

  let total1h = sumHourly('api_total', oneHourAgo, now);
  let fail1h = sumHourly('api_fail', oneHourAgo, now);
  if (total1h <= 0) {
    const audit = Array.isArray(state.auditLogs) ? state.auditLogs : [];
    const recent = audit.filter((row) => {
      const d = new Date(row?.createdAt || '');
      return !Number.isNaN(d.getTime()) && d >= oneHourAgo && d <= now;
    });
    total1h = recent.length;
    fail1h = recent.filter((row) => String(row?.result || '').toLowerCase() === 'fail').length;
  }

  const apiUptime24 = total24 > 0 ? (success24 / total24) * 100 : 100;
  const apiErrorRate1h = total1h > 0 ? (fail1h / total1h) * 100 : 0;

  const perfReport = await readLatestPerfReport(reportsDir);
  const endpointMetrics = Array.isArray(perfReport?.data?.endpointMetrics) ? perfReport.data.endpointMetrics : [];
  const maxP95Ms = endpointMetrics.reduce((acc, row) => Math.max(acc, toNumber(row?.p95Ms, 0)), 0);

  const sliResults = [
    buildSliResult({
      key: 'api_uptime_24h',
      name: 'API可用性（24h）',
      value: apiUptime24,
      target: UPTIME_MIN,
      operator: '>=',
      unit: '%',
      note: '来源 metricHourlyCounters(api_total/api_success)，无聚合时回退 auditLogs',
    }),
    buildSliResult({
      key: 'api_error_rate_1h',
      name: 'API错误率（1h）',
      value: apiErrorRate1h,
      target: ERROR_RATE_MAX,
      operator: '<=',
      unit: '%',
      note: '来源 metricHourlyCounters(api_total/api_fail)，无聚合时回退 auditLogs',
    }),
    buildSliResult({
      key: 'api_perf_p95_ms',
      name: '核心接口P95（ms）',
      value: maxP95Ms,
      target: P95_MAX_MS,
      operator: '<=',
      unit: 'ms',
      note: `来源 ${perfReport?.file || 'N/A'} 的 endpointMetrics.p95Ms`,
    }),
  ];

  const alerts = sliResults
    .filter((x) => x.status !== 'PASS')
    .map((x) => ({
      key: x.key,
      name: x.name,
      severity: toSeverityByGap(x),
      message: `${x.name} 当前=${x.value}${x.unit}，阈值 ${x.operator} ${x.target}${x.unit}`,
    }));

  const ok = alerts.length === 0;
  const stamp = buildStamp();
  const jsonFile = path.join(reportsDir, `slo-guard-${stamp}.json`);
  const mdFile = path.join(reportsDir, `slo-guard-${stamp}.md`);
  const latestJson = path.join(reportsDir, 'slo-guard-latest.json');
  const latestMd = path.join(reportsDir, 'slo-guard-latest.md');

  const payload = {
    ok,
    generatedAt: new Date().toISOString(),
    thresholds: {
      apiUptime24hMin: UPTIME_MIN,
      apiErrorRate1hMax: ERROR_RATE_MAX,
      apiP95MsMax: P95_MAX_MS,
    },
    inputs: {
      backend: process.env.STORAGE_BACKEND || 'postgres',
      total24,
      success24,
      fail24,
      total1h,
      fail1h,
      perfReport: perfReport ? path.relative(process.cwd(), perfReport.file) : '',
    },
    sliResults,
    alerts,
    files: {
      json: path.relative(process.cwd(), jsonFile),
      markdown: path.relative(process.cwd(), mdFile),
      latestJson: path.relative(process.cwd(), latestJson),
      latestMarkdown: path.relative(process.cwd(), latestMd),
    },
  };

  const markdown = `# SLO Guard Report

- Time: ${payload.generatedAt}
- Result: **${payload.ok ? 'PASS' : 'FAIL'}**
- Data Backend: ${payload.inputs.backend}
- Perf Source: ${payload.inputs.perfReport || 'N/A'}

## SLI Results

| Key | Name | Value | Target | Status | Note |
|---|---|---:|---|---|---|
${payload.sliResults
  .map(
    (x) =>
      `| ${x.key} | ${x.name} | ${x.value}${x.unit} | ${x.operator} ${x.target}${x.unit} | ${x.status} | ${String(x.note || '').replace(/\|/g, '\\|')} |`
  )
  .join('\n')}

## Alert Events

${payload.alerts.length === 0 ? '- none' : payload.alerts.map((x) => `- [${x.severity}] ${x.message}`).join('\n')}
`;

  await fs.writeFile(jsonFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await fs.writeFile(mdFile, `${markdown}\n`, 'utf8');
  await fs.writeFile(latestJson, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await fs.writeFile(latestMd, `${markdown}\n`, 'utf8');
  const cleanup = await cleanupReports(reportsDir);
  await closeState().catch(() => undefined);

  console.log(JSON.stringify({ ...payload, cleanup }, null, 2));
  if (STRICT_MODE && !ok) process.exit(1);
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
