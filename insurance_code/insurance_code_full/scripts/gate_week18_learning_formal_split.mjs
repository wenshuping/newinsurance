#!/usr/bin/env node

import { spawn } from 'node:child_process';

const checks = [
  {
    name: 'week18-learning-formal-split-check',
    cmd: ['node', 'scripts/check_week18_learning_formal_split.mjs'],
  },
  {
    name: 'learning-service-boundary-guard',
    cmd: ['node', 'scripts/check_learning_service_boundary_guard.mjs'],
  },
  {
    name: 'learning-user-legacy-review',
    cmd: ['node', 'scripts/review_learning_user_legacy_routes.mjs'],
  },
  {
    name: 'week18-learning-formal-split-smoke',
    cmd: ['node', 'scripts/smoke_week18_learning_formal_split.mjs'],
  },
];

function run(cmd, args) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('close', (code) => {
      resolve({ code: Number(code || 0), stdout, stderr });
    });
  });
}

async function main() {
  const results = [];

  for (const check of checks) {
    const [cmd, ...args] = check.cmd;
    const result = await run(cmd, args);
    results.push({
      name: check.name,
      ok: result.code === 0,
      exitCode: result.code,
      stdout: result.stdout.trim(),
      stderr: result.stderr.trim(),
    });
    if (result.code !== 0) {
      console.error(JSON.stringify({ ok: false, results }, null, 2));
      process.exit(1);
    }
  }

  console.log(JSON.stringify({ ok: true, results }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: String(error?.message || error) }, null, 2));
  process.exit(1);
});
