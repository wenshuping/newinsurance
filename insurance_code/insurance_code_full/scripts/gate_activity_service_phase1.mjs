#!/usr/bin/env node

import { spawn } from 'node:child_process';

const checks = [
  {
    name: 'activity-user-boundary-guard',
    cmd: ['node', 'scripts/check_activity_user_boundary_guard.mjs'],
  },
  {
    name: 'activity-service-boundary-phase1',
    cmd: ['node', 'scripts/check_activity_service_boundary_phase1.mjs'],
  },
  {
    name: 'activity-service-phase1-smoke',
    cmd: ['node', 'scripts/smoke_activity_service_phase1.mjs'],
  },
  {
    name: 'activity-points-reward-phase1-smoke',
    cmd: ['node', 'scripts/smoke_activity_points_reward_phase1.mjs'],
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

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: String(err?.message || err) }, null, 2));
  process.exit(1);
});
