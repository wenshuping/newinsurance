#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KEEP_COUNT = Number(process.env.CI_GATE_REPORT_KEEP || '20');

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

function parseCommandArgs(argv) {
  const sep = argv.indexOf('--');
  if (sep >= 0 && sep < argv.length - 1) {
    return argv.slice(sep + 1);
  }
  return ['npm', 'run', 'ci:gate:core'];
}

function runCommand(tokens) {
  return new Promise((resolve) => {
    const [command, ...args] = tokens;
    const startedAt = Date.now();
    const child = spawn(command, args, { stdio: 'inherit', shell: false, env: process.env });
    child.on('exit', (code, signal) =>
      resolve({
        command,
        args,
        ok: code === 0,
        code: code ?? -1,
        signal: signal || '',
        durationMs: Date.now() - startedAt,
      })
    );
    child.on('error', (error) =>
      resolve({
        command,
        args,
        ok: false,
        code: -1,
        signal: '',
        durationMs: Date.now() - startedAt,
        error: String(error?.message || error),
      })
    );
  });
}

function buildMarkdown(payload) {
  const line = payload.result.ok ? 'PASS' : 'FAIL';
  return `# CI Gate Report

- Time: ${payload.finishedAt}
- CWD: \`${payload.cwd}\`
- Command: \`${[payload.result.command, ...payload.result.args].join(' ')}\`
- Result: **${line}**
- Exit Code: ${payload.result.code}
- Duration: ${payload.result.durationMs}ms
- Json Report: \`${payload.jsonFile}\`
`;
}

async function cleanupReports(reportsDir) {
  const entries = await fs.readdir(reportsDir, { withFileTypes: true });
  const stamps = entries
    .filter((entry) => entry.isFile() && /^ci-gate-core-\d{8}-\d{6}\.json$/.test(entry.name))
    .map((entry) => entry.name.match(/^ci-gate-core-(\d{8}-\d{6})\.json$/)?.[1] || '')
    .filter(Boolean)
    .sort();

  const remove = stamps.slice(0, Math.max(0, stamps.length - KEEP_COUNT));
  for (const stamp of remove) {
    await fs.rm(path.join(reportsDir, `ci-gate-core-${stamp}.json`), { force: true });
    await fs.rm(path.join(reportsDir, `ci-gate-core-${stamp}.md`), { force: true });
  }
  return {
    keepCount: KEEP_COUNT,
    totalBefore: stamps.length,
    removedCount: remove.length,
    removed: remove,
    totalAfter: stamps.length - remove.length,
  };
}

async function main() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const reportsDir = path.resolve(__dirname, '../docs/reports');
  await fs.mkdir(reportsDir, { recursive: true });

  const stamp = buildStamp();
  const jsonPath = path.join(reportsDir, `ci-gate-core-${stamp}.json`);
  const mdPath = path.join(reportsDir, `ci-gate-core-${stamp}.md`);
  const tokens = parseCommandArgs(process.argv);

  const started = new Date();
  const result = await runCommand(tokens);
  const finished = new Date();

  const payload = {
    ok: result.ok,
    cwd: process.cwd(),
    startedAt: started.toISOString(),
    finishedAt: finished.toISOString(),
    result,
    jsonFile: path.relative(process.cwd(), jsonPath),
    markdownFile: path.relative(process.cwd(), mdPath),
  };

  await fs.writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await fs.writeFile(mdPath, `${buildMarkdown(payload)}\n`, 'utf8');
  const cleanup = await cleanupReports(reportsDir);

  console.log(JSON.stringify({ ...payload, cleanup }, null, 2));
  if (!result.ok) process.exit(1);
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
