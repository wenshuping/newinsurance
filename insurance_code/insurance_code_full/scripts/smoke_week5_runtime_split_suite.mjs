#!/usr/bin/env node

import { spawn } from 'node:child_process';

const steps = [
  {
    name: 'user-service',
    cmd: ['node', 'scripts/smoke_user_service_contract.mjs'],
  },
  {
    name: 'points-service',
    cmd: ['node', 'scripts/smoke_points_service_week5.mjs'],
  },
  {
    name: 'gateway',
    cmd: ['node', 'scripts/smoke_gateway_week1.mjs'],
  },
  {
    name: 'runtime-split-e2e',
    cmd: ['node', 'scripts/smoke_week5_runtime_split_e2e.mjs'],
  },
];

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

function tail(text, lines = 12) {
  return String(text || '')
    .trim()
    .split('\n')
    .slice(-lines)
    .join('\n');
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
        json: parseTrailingJson(stdout),
        stdoutTail: tail(stdout),
        stderrTail: tail(stderr),
      });
    });
  });
}

async function main() {
  const results = [];

  for (const step of steps) {
    console.log(`[week5-runtime-split-suite] running=${step.name}`);
    const result = await runStep(step);
    results.push(result);
  }

  const failed = results.filter((item) => !item.ok);
  const report = {
    ok: failed.length === 0,
    total: results.length,
    failed: failed.map((item) => item.name),
    results: results.map((item) => ({
      name: item.name,
      ok: item.ok,
      code: item.code,
      durationMs: item.durationMs,
      summary: item.json || null,
      stdoutTail: item.ok ? '' : item.stdoutTail,
      stderrTail: item.ok ? '' : item.stderrTail,
    })),
  };

  console.log(JSON.stringify(report, null, 2));
  if (failed.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: String(err?.message || err),
      },
      null,
      2
    )
  );
  process.exit(1);
});
