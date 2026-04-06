#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TARGET = path.join(ROOT, 'server/skeleton-c-v1/common/state.mjs');

function fail(message, context = null) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        message,
        context,
      },
      null,
      2
    )
  );
  process.exit(1);
}

function main() {
  if (!fs.existsSync(TARGET)) fail('target file not found', { file: TARGET });
  const code = fs.readFileSync(TARGET, 'utf8');

  const guardedTables = [
    'c_customers',
    'b_agents',
    'p_products',
    'p_activities',
    'p_learning_materials',
    'p_sessions',
    'p_orders',
    'c_redeem_records',
    'c_sign_ins',
    'c_activity_completions',
    'c_learning_records',
    'c_point_transactions',
    'p_track_events',
    'p_audit_logs',
    'p_metric_uv_daily',
    'p_metric_counter_daily',
    'p_metric_counter_hourly',
    'p_event_definitions',
    'p_metric_rules',
  ];

  const truncateHits = guardedTables.filter((table) => new RegExp(`truncateAndInsert\\(\\s*client\\s*,\\s*['\"]${table}['\"]`).test(code));
  if (truncateHits.length > 0) {
    fail('incremental persistence regression: guarded tables must not use truncateAndInsert', { truncateHits });
  }

  const missingSyncHits = guardedTables.filter((table) => new RegExp(`syncTableByPrimaryKeys\\(\\s*client\\s*,\\s*['\"]${table}['\"]`).test(code) === false);
  if (missingSyncHits.length > 0) {
    fail('incremental persistence regression: guarded tables must use syncTableByPrimaryKeys', { missingSyncHits });
  }

  const clearOrderMatch = code.match(/const\s+clearOrder\s*=\s*\[([\s\S]*?)\];/m);
  if (!clearOrderMatch) fail('clearOrder block not found');
  const clearOrderRaw = clearOrderMatch[1];
  const clearOrderHits = guardedTables.filter((table) => new RegExp(`['\"]${table}['\"]`).test(clearOrderRaw));
  if (clearOrderHits.length > 0) {
    fail('incremental persistence regression: guarded tables must not appear in clearOrder', { clearOrderHits });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        file: TARGET,
        checks: [
          'guarded_tables_not_using_truncate_and_insert',
          'guarded_tables_using_sync_table_by_primary_keys',
          'guarded_tables_not_in_clear_order',
        ],
      },
      null,
      2
    )
  );
}

main();
