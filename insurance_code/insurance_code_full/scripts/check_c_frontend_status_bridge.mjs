#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SHARED = path.resolve(ROOT, '../../shared-contracts/template-status.ts');
const C_BRIDGE = path.resolve(ROOT, 'src/lib/templateStatus.ts');
const C_ACTIVITY_DETAIL = path.resolve(ROOT, 'src/components/activities/ActivityDetail.tsx');

function fail(message, context = null) {
  console.error(JSON.stringify({ ok: false, message, context }, null, 2));
  process.exit(1);
}

function mustContain(code, pattern, file, why) {
  if (!code.includes(pattern)) fail(why, { file, pattern });
}

function mustNotContain(code, pattern, file, why) {
  if (code.includes(pattern)) fail(why, { file, pattern });
}

function main() {
  if (!fs.existsSync(SHARED)) fail('shared template-status not found', { file: SHARED });
  if (!fs.existsSync(C_BRIDGE)) fail('C templateStatus bridge not found', { file: C_BRIDGE });
  if (!fs.existsSync(C_ACTIVITY_DETAIL)) fail('C ActivityDetail.tsx not found', { file: C_ACTIVITY_DETAIL });

  const sharedCode = fs.readFileSync(SHARED, 'utf8');
  const bridgeCode = fs.readFileSync(C_BRIDGE, 'utf8');
  const activityDetailCode = fs.readFileSync(C_ACTIVITY_DETAIL, 'utf8');

  mustContain(sharedCode, 'export function runningStatusLabel', SHARED, 'shared-contracts must export runningStatusLabel');
  mustContain(sharedCode, 'export function runningStatusPillClass', SHARED, 'shared-contracts must export runningStatusPillClass');
  mustContain(sharedCode, 'export function normalizeRunningStatus', SHARED, 'shared-contracts must export normalizeRunningStatus');

  mustContain(bridgeCode, 'runningStatusLabel', C_BRIDGE, 'C bridge must re-export runningStatusLabel');
  mustContain(bridgeCode, 'runningStatusPillClass', C_BRIDGE, 'C bridge must re-export runningStatusPillClass');
  mustContain(bridgeCode, 'normalizeRunningStatus', C_BRIDGE, 'C bridge must re-export normalizeRunningStatus');

  mustContain(
    activityDetailCode,
    "from '../../lib/templateStatus'",
    C_ACTIVITY_DETAIL,
    'ActivityDetail must import status helpers from C bridge'
  );
  mustContain(activityDetailCode, 'runningStatusLabel(activity?.status)', C_ACTIVITY_DETAIL, 'ActivityDetail must use runningStatusLabel');
  mustContain(
    activityDetailCode,
    'runningStatusPillClass(activity?.status)',
    C_ACTIVITY_DETAIL,
    'ActivityDetail must use runningStatusPillClass'
  );

  mustNotContain(
    activityDetailCode,
    "activity?.status === 'active'",
    C_ACTIVITY_DETAIL,
    'ActivityDetail should not hardcode active status branch'
  );
  mustNotContain(
    activityDetailCode,
    "activity?.status === 'draft'",
    C_ACTIVITY_DETAIL,
    'ActivityDetail should not hardcode draft status branch'
  );
  mustNotContain(
    activityDetailCode,
    "activity?.status === 'inactive'",
    C_ACTIVITY_DETAIL,
    'ActivityDetail should not hardcode inactive status branch'
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        checks: [
          'shared_running_status_exports',
          'c_bridge_reexports_running_status_helpers',
          'c_activity_detail_uses_bridge_running_status_helpers',
          'no_local_status_branching_in_activity_detail',
        ],
      },
      null,
      2
    )
  );
}

main();
