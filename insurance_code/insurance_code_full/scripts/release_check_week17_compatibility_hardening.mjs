#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const REPORT_DIR = path.resolve(process.cwd(), 'docs/reports');
const steps = [
  { name: 'compatibility-residual-scan', cmd: ['node', 'scripts/check_week17_compatibility_residuals.mjs'] },
  { name: 'route-ownership-drift-scan', cmd: ['node', 'scripts/check_week17_route_ownership_drift.mjs'] },
  { name: 'write-fallback-misuse-scan', cmd: ['node', 'scripts/check_week17_write_fallback_misuse.mjs'] },
  { name: 'week18-learning-formal-split-release-check', cmd: ['node', 'scripts/smoke_week18_learning_formal_split.mjs'] },
  { name: 'week16-activity-complete-release-check', cmd: ['node', 'scripts/smoke_week16_activity_complete.mjs'] },
];

function nowStamp() {
  const d = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return [d.getFullYear(), pad(d.getMonth() + 1), pad(d.getDate()), '-', pad(d.getHours()), pad(d.getMinutes()), pad(d.getSeconds())].join('');
}

function parseTrailingJson(output) {
  const trimmed = String(output || '').trim();
  if (!trimmed) return null;
  const start = trimmed.lastIndexOf('\n{');
  const candidate = start >= 0 ? trimmed.slice(start + 1) : trimmed.startsWith('{') ? trimmed : '';
  if (!candidate) return null;
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function runStep(step) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(step.cmd[0], step.cmd.slice(1), {
      cwd: process.cwd(),
      env: {
        ...process.env,
        STORAGE_BACKEND: process.env.STORAGE_BACKEND || 'file',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk || '');
      process.stdout.write(chunk);
    });

    child.stderr.on('data', (chunk) => {
      stderr += String(chunk || '');
      process.stderr.write(chunk);
    });

    child.on('close', (code) => {
      resolve({
        name: step.name,
        ok: Number(code || 0) === 0,
        code: Number(code || 0),
        durationMs: Date.now() - startedAt,
        summary: parseTrailingJson(stdout),
        stderr: stderr.trim(),
      });
    });
  });
}

function toMarkdown(report) {
  const lines = [
    '# Week17 边界硬化与兼容层收缩报告',
    '',
    `- 时间：${report.executedAt}`,
    `- 结果：${report.ok ? 'PASS' : 'FAIL'}`,
    '',
    '## 执行项',
    '',
  ];

  for (const result of report.results) {
    lines.push(`- ${result.name}: ${result.ok ? 'PASS' : 'FAIL'} | ${result.durationMs}ms`);
  }

  lines.push(
    '',
    '## 结论',
    '',
    `- compatibility residual scan: ${report.criteria.compatibilityResidualScan ? 'PASS' : 'FAIL'}`,
    `- route ownership drift scan: ${report.criteria.routeOwnershipDriftScan ? 'PASS' : 'FAIL'}`,
    `- write fallback misuse scan: ${report.criteria.writeFallbackMisuseScan ? 'PASS' : 'FAIL'}`,
    `- learning formal split release-check: ${report.criteria.learningFormalSplitReleaseCheck ? 'PASS' : 'FAIL'}`,
    `- activity complete release-check: ${report.criteria.activityCompleteReleaseCheck ? 'PASS' : 'FAIL'}`,
  );

  return `${lines.join('\n')}\n`;
}

function writeReports(report) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const stamp = nowStamp();
  const jsonPath = path.join(REPORT_DIR, `week17-compatibility-hardening-${stamp}.json`);
  const mdPath = path.join(REPORT_DIR, `week17-compatibility-hardening-${stamp}.md`);
  const latestJsonPath = path.join(REPORT_DIR, 'week17-compatibility-hardening-latest.json');
  const latestMdPath = path.join(REPORT_DIR, 'week17-compatibility-hardening-latest.md');
  const markdown = toMarkdown(report);

  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(mdPath, markdown);
  fs.writeFileSync(latestJsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(latestMdPath, markdown);

  return { jsonPath, mdPath, latestJsonPath, latestMdPath };
}

async function main() {
  const startedAt = Date.now();
  const results = [];

  for (const step of steps) {
    console.log(`[week17-compatibility-release] running=${step.name}`);
    const result = await runStep(step);
    results.push(result);
    if (!result.ok) break;
  }

  const failed = results.filter((item) => !item.ok);
  const criteria = {
    compatibilityResidualScan: Boolean(results.find((item) => item.name === 'compatibility-residual-scan')?.ok),
    routeOwnershipDriftScan: Boolean(results.find((item) => item.name === 'route-ownership-drift-scan')?.ok),
    writeFallbackMisuseScan: Boolean(results.find((item) => item.name === 'write-fallback-misuse-scan')?.ok),
    learningFormalSplitReleaseCheck: Boolean(results.find((item) => item.name === 'week18-learning-formal-split-release-check')?.ok),
    activityCompleteReleaseCheck: Boolean(results.find((item) => item.name === 'week16-activity-complete-release-check')?.ok),
  };

  const report = {
    ok: failed.length === 0,
    executedAt: new Date().toISOString(),
    totalMs: Date.now() - startedAt,
    failed: failed.map((item) => item.name),
    criteria,
    results,
  };

  report.reports = writeReports(report);
  console.log(JSON.stringify(report, null, 2));
  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: String(error?.message || error) }, null, 2));
  process.exit(1);
});
