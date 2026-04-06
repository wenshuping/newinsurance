#!/usr/bin/env node

import { spawn } from 'node:child_process';

const steps = [
  {
    name: 'week8-gate',
    cmd: ['node', 'scripts/gate_week8_runtime_split.mjs'],
  },
  {
    name: 'week11-grayscale-drill',
    cmd: ['node', 'scripts/smoke_week11_grayscale_drill.mjs'],
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

async function main() {
  const startedAt = Date.now();
  const results = [];

  for (const step of steps) {
    console.log(`[week11-runtime-gate] running=${step.name}`);
    const result = await runStep(step);
    results.push(result);
    if (!result.ok) break;
  }

  const failed = results.filter((item) => !item.ok);
  const report = {
    ok: failed.length === 0,
    totalMs: Date.now() - startedAt,
    failed: failed.map((item) => item.name),
    results,
  };

  console.log(JSON.stringify(report, null, 2));
  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: String(error?.message || error),
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
