#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const gatewayAppPath = path.join(ROOT, 'server/microservices/gateway/app.mjs');
const routeMapPath = path.join(ROOT, 'server/microservices/gateway/route-map.mjs');
const week14ReleaseCheckPath = path.join(ROOT, 'scripts/smoke_week14_learning_complete.mjs');
const week16ReleaseCheckPath = path.join(ROOT, 'scripts/smoke_week16_activity_complete.mjs');

function assert(condition, message, context = null) {
  if (condition) return;
  const error = new Error(message);
  error.context = context;
  throw error;
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function has(source, needle) {
  return String(source || '').includes(needle);
}

async function main() {
  const gatewayAppSource = read(gatewayAppPath);
  const routeMapSource = read(routeMapPath);
  const week14Source = read(week14ReleaseCheckPath);
  const week16Source = read(week16ReleaseCheckPath);

  const canFallbackGuardPattern = /function canFallbackOnError\(req, target\) \{[\s\S]*?return target\.mode === 'v2' && Boolean\(target\.fallbackBaseUrl\) && \(method === 'GET' \|\| method === 'HEAD'\);[\s\S]*?\}/;
  assert(canFallbackGuardPattern.test(gatewayAppSource), 'gateway fallback guard drifted from GET/HEAD-only policy');
  assert(has(gatewayAppSource, "if (!canFallbackOnError(req, target))"), 'gateway missing non-fallback branch for unsupported write-path fallback');
  assert(has(gatewayAppSource, "code: 'GATEWAY_UPSTREAM_UNAVAILABLE'"), 'gateway missing 502 upstream unavailable contract');
  assert(has(gatewayAppSource, "reason: 'fallback-after-network-error'"), 'gateway missing network-error fallback reason');
  assert(has(gatewayAppSource, "reason: 'fallback-after-5xx'"), 'gateway missing 5xx fallback reason');
  assert(has(routeMapSource, 'GATEWAY_FORCE_V1_PATHS'), 'gateway route map missing manual force-v1 path switch');
  assert(has(routeMapSource, 'GATEWAY_ENABLE_V1_FALLBACK'), 'gateway route map missing read fallback switch');

  assert(has(week14Source, 'learning.complete.no-auto-fallback'), 'week14 release-check missing write no-auto-fallback assertion');
  assert(has(week14Source, 'learning.complete.manual-rollback.v1'), 'week14 release-check missing manual rollback assertion');
  assert(has(week14Source, 'GATEWAY_FORCE_V1_PATHS'), 'week14 release-check missing force-v1-path switch');
  assert(has(week16Source, 'activity.complete.no-auto-fallback'), 'week16 release-check missing write no-auto-fallback assertion');
  assert(has(week16Source, 'activity.complete.manual-rollback.v1'), 'week16 release-check missing manual rollback assertion');
  assert(has(week16Source, 'GATEWAY_FORCE_V1_PATHS'), 'week16 release-check missing force-v1-path switch');

  console.log(
    JSON.stringify(
      {
        ok: true,
        checks: [
          {
            name: 'week17.gateway-write-fallback-guard',
            ok: true,
            policy: 'GET_HEAD_only',
          },
          {
            name: 'week17.gateway-manual-rollback-switch',
            ok: true,
            env: 'GATEWAY_FORCE_V1_PATHS',
          },
          {
            name: 'week17.learning-write-rollback-drill',
            ok: true,
            source: 'scripts/smoke_week14_learning_complete.mjs',
          },
          {
            name: 'week17.activity-write-rollback-drill',
            ok: true,
            source: 'scripts/smoke_week16_activity_complete.mjs',
          },
        ],
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: String(error?.message || error),
        context: error?.context || null,
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
