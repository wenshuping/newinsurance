#!/usr/bin/env node

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..');

const checks = [
  {
    name: 'learning-points-final-boundary',
    cmd: ['node', 'scripts/check_learning_points_final_boundary.mjs'],
  },
  {
    name: 'learning-points-legacy-review',
    cmd: ['node', 'scripts/review_learning_points_legacy_routes_week18.mjs'],
  },
  {
    name: 'week18-learning-formal-split-gate',
    cmd: ['node', 'scripts/gate_week18_learning_formal_split.mjs'],
  },
  {
    name: 'points-learning-reward-smoke',
    cmd: ['node', 'scripts/smoke_points_learning_reward_week13.mjs'],
  },
];

function run(cmd, args) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
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
