#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SHARED = path.resolve(ROOT, '../../shared-contracts/template-status.ts');
const B_BRIDGE = path.resolve(ROOT, '../../insurance_code_B/src/lib/templateStatus.ts');
const B_APP = path.resolve(ROOT, '../../insurance_code_B/src/App.tsx');

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
  if (!fs.existsSync(B_BRIDGE)) fail('B templateStatus bridge not found', { file: B_BRIDGE });
  if (!fs.existsSync(B_APP)) fail('B App.tsx not found', { file: B_APP });

  const sharedCode = fs.readFileSync(SHARED, 'utf8');
  const bridgeCode = fs.readFileSync(B_BRIDGE, 'utf8');
  const appCode = fs.readFileSync(B_APP, 'utf8');

  mustContain(
    sharedCode,
    'export const CONTENT_STATUS_FILTER_OPTIONS',
    SHARED,
    'shared-contracts must export CONTENT_STATUS_FILTER_OPTIONS'
  );
  mustContain(
    sharedCode,
    'export const RUNNING_STATUS_FILTER_OPTIONS',
    SHARED,
    'shared-contracts must export RUNNING_STATUS_FILTER_OPTIONS'
  );
  mustContain(
    sharedCode,
    'export type ContentRunningStatusFilter',
    SHARED,
    'shared-contracts must export ContentRunningStatusFilter'
  );
  mustContain(
    sharedCode,
    'export function isRunningStatusActive',
    SHARED,
    'shared-contracts must export isRunningStatusActive'
  );

  mustContain(
    bridgeCode,
    'CONTENT_STATUS_FILTER_OPTIONS',
    B_BRIDGE,
    'B templateStatus bridge must re-export CONTENT_STATUS_FILTER_OPTIONS'
  );
  mustContain(
    bridgeCode,
    'RUNNING_STATUS_FILTER_OPTIONS',
    B_BRIDGE,
    'B templateStatus bridge must re-export RUNNING_STATUS_FILTER_OPTIONS'
  );
  mustContain(
    bridgeCode,
    'type ContentRunningStatusFilter',
    B_BRIDGE,
    'B templateStatus bridge must re-export ContentRunningStatusFilter'
  );
  mustContain(
    bridgeCode,
    'isRunningStatusActive',
    B_BRIDGE,
    'B templateStatus bridge must re-export isRunningStatusActive'
  );

  mustContain(
    appCode,
    '? CONTENT_STATUS_FILTER_OPTIONS',
    B_APP,
    'B App should use CONTENT_STATUS_FILTER_OPTIONS in currentFilterOptions'
  );
  mustContain(
    appCode,
    ': RUNNING_STATUS_FILTER_OPTIONS',
    B_APP,
    'B App should use RUNNING_STATUS_FILTER_OPTIONS in currentFilterOptions'
  );
  mustContain(
    appCode,
    'useState<ContentRunningStatusFilter>',
    B_APP,
    'B App should use shared ContentRunningStatusFilter for statusFilter state'
  );
  mustContain(
    appCode,
    'isRunningStatusActive(',
    B_APP,
    'B App should use shared isRunningStatusActive for running status active checks'
  );

  mustNotContain(
    appCode,
    "[{ label: '全部', value: 'all' }, ...CONTENT_STATUS_OPTIONS]",
    B_APP,
    'B App should not locally compose content filter options'
  );
  mustNotContain(
    appCode,
    "[{ label: '全部', value: 'all' }, ...RUNNING_STATUS_OPTIONS]",
    B_APP,
    'B App should not locally compose running filter options'
  );
  mustNotContain(
    appCode,
    "type StatusFilter = 'all' | 'published' | 'active' | 'draft' | 'inactive';",
    B_APP,
    'B App should not define local status filter union type'
  );
  mustNotContain(
    appCode,
    'const isActiveStatus =',
    B_APP,
    'B App should not define local isActiveStatus helper'
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        checks: [
          'shared_exports',
          'b_bridge_reexports',
          'b_app_uses_shared_filter_options',
          'b_app_filter_state_uses_shared_type',
          'b_app_uses_shared_running_active_mapper',
          'no_local_all_plus_status_options_concat_or_local_union',
        ],
      },
      null,
      2
    )
  );
}

main();
