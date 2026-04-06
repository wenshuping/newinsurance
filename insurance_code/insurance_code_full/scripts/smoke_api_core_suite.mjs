#!/usr/bin/env node

import { spawn } from 'node:child_process';

const SUITE = [
  {
    name: 'track_tenant_context',
    cmd: ['node', 'scripts/track_tenant_context_smoke.mjs'],
    optional: false,
  },
  {
    name: 'assignment_visibility_chain',
    cmd: ['node', 'scripts/smoke_assignment_visibility_chain.mjs'],
    optional: false,
  },
  {
    name: 'mall_commerce',
    cmd: ['node', 'scripts/smoke_mall_commerce_api.mjs'],
    optional: false,
  },
  {
    name: 'orders_lifecycle',
    cmd: ['node', 'scripts/smoke_orders_lifecycle_api.mjs'],
    optional: false,
  },
  {
    name: 'learning_mall_layer',
    cmd: ['node', 'scripts/smoke_learning_mall_layer.mjs'],
    optional: false,
  },
  {
    name: 'transaction_writepaths',
    cmd: ['node', 'scripts/smoke_transaction_writepaths.mjs'],
    optional: false,
  },
  {
    name: 'p_ops_async_jobs',
    cmd: ['node', 'scripts/smoke_p_ops_async_jobs.mjs'],
    optional: false,
  },
  {
    name: 'c_app_modules',
    cmd: ['node', 'scripts/c_app_module_smoke.mjs'],
    optional: process.env.SMOKE_SKIP_C_APP === '1',
  },
  {
    name: 'b_admin_modules',
    cmd: ['node', 'scripts/b_admin_module_smoke.mjs'],
    optional: process.env.SMOKE_SKIP_B_ADMIN === '1',
  },
  {
    name: 'p_admin_modules',
    cmd: ['node', 'scripts/p_admin_module_smoke.mjs'],
    optional: process.env.SMOKE_SKIP_P_ADMIN === '1',
  },
];

function runStep(step) {
  return new Promise((resolve) => {
    const [bin, ...args] = step.cmd;
    const startedAt = Date.now();
    const child = spawn(bin, args, {
      stdio: 'inherit',
      env: process.env,
      shell: false,
    });
    child.on('exit', (code, signal) => {
      resolve({
        name: step.name,
        optional: step.optional,
        ok: code === 0,
        code: code ?? -1,
        signal: signal || '',
        durationMs: Date.now() - startedAt,
      });
    });
    child.on('error', (error) => {
      resolve({
        name: step.name,
        optional: step.optional,
        ok: false,
        code: -1,
        signal: '',
        durationMs: Date.now() - startedAt,
        error: String(error?.message || error),
      });
    });
  });
}

async function main() {
  const base = String(process.env.API_BASE_URL || process.env.API_BASE || 'http://127.0.0.1:4000').replace(/\/+$/, '');
  const startedAt = Date.now();
  const results = [];

  console.log(`[smoke:api-core] base=${base}`);
  for (const step of SUITE) {
    console.log(`[smoke:api-core] running=${step.name}${step.optional ? ' (optional)' : ''}`);
    const result = await runStep(step);
    results.push(result);
    if (!result.ok && !step.optional) {
      break;
    }
  }

  const hardFailures = results.filter((r) => !r.ok && !r.optional);
  const optionalFailures = results.filter((r) => !r.ok && r.optional);
  const payload = {
    ok: hardFailures.length === 0,
    base,
    totalMs: Date.now() - startedAt,
    hardFailures: hardFailures.length,
    optionalFailures: optionalFailures.length,
    results,
  };

  console.log(JSON.stringify(payload, null, 2));
  if (hardFailures.length > 0) process.exit(1);
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
