#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const P_APP = path.resolve(ROOT, '../../insurance_code_P/src/App.tsx');
const P_BRIDGE = path.resolve(ROOT, '../../insurance_code_P/src/lib/templateStatus.ts');
const SHARED_STATUS = path.resolve(ROOT, '../../shared-contracts/template-status.ts');

function fail(message, context = null) {
  console.error(JSON.stringify({ ok: false, message, context }, null, 2));
  process.exit(1);
}

function mustContain(file, pattern, why) {
  const code = fs.readFileSync(file, 'utf8');
  if (!code.includes(pattern)) fail(why, { file, pattern });
  return code;
}

function mustNotContain(file, pattern, why) {
  const code = fs.readFileSync(file, 'utf8');
  if (code.includes(pattern)) fail(why, { file, pattern });
}

function main() {
  if (!fs.existsSync(P_APP)) fail('P app file not found', { file: P_APP });
  if (!fs.existsSync(P_BRIDGE)) fail('P templateStatus bridge not found', { file: P_BRIDGE });
  if (!fs.existsSync(SHARED_STATUS)) fail('shared template-status not found', { file: SHARED_STATUS });

  mustContain(SHARED_STATUS, 'export const TENANT_STATUS_OPTIONS', 'shared-contracts must export TENANT_STATUS_OPTIONS');
  mustContain(SHARED_STATUS, 'export const ENABLED_STATUS_OPTIONS', 'shared-contracts must export ENABLED_STATUS_OPTIONS');
  mustContain(SHARED_STATUS, 'export type OnlineStatusFilter', 'shared-contracts must export OnlineStatusFilter');
  mustContain(SHARED_STATUS, 'export type EnabledStatusFilter', 'shared-contracts must export EnabledStatusFilter');
  mustContain(SHARED_STATUS, 'export type TagStatusFilter', 'shared-contracts must export TagStatusFilter');
  mustContain(SHARED_STATUS, 'export function toActivityOnlineStatus', 'shared-contracts must export toActivityOnlineStatus');

  mustContain(P_BRIDGE, 'TENANT_STATUS_OPTIONS', 'P templateStatus bridge must re-export TENANT_STATUS_OPTIONS');
  mustContain(P_BRIDGE, 'ENABLED_STATUS_OPTIONS', 'P templateStatus bridge must re-export ENABLED_STATUS_OPTIONS');
  mustContain(P_BRIDGE, 'type OnlineStatusFilter', 'P templateStatus bridge must re-export OnlineStatusFilter');
  mustContain(P_BRIDGE, 'type EnabledStatusFilter', 'P templateStatus bridge must re-export EnabledStatusFilter');
  mustContain(P_BRIDGE, 'type TagStatusFilter', 'P templateStatus bridge must re-export TagStatusFilter');
  mustContain(P_BRIDGE, 'toActivityOnlineStatus', 'P templateStatus bridge must re-export toActivityOnlineStatus');

  const appCode = fs.readFileSync(P_APP, 'utf8');
  if (!appCode.includes('TENANT_STATUS_OPTIONS.map')) {
    fail('P app tenant status select must use TENANT_STATUS_OPTIONS', { file: P_APP });
  }
  if (!appCode.includes('ENABLED_STATUS_OPTIONS.map')) {
    fail('P app metric status select must use ENABLED_STATUS_OPTIONS', { file: P_APP });
  }
  if (!appCode.includes('useState<OnlineStatusFilter>')) {
    fail('P app activity status filter state must use OnlineStatusFilter type from bridge', { file: P_APP });
  }
  if (!appCode.includes('useState<EnabledStatusFilter>')) {
    fail('P app enabled status filter state must use EnabledStatusFilter type from bridge', { file: P_APP });
  }
  if (!appCode.includes('useState<TagStatusFilter>')) {
    fail('P app tag status filter state must use TagStatusFilter type from bridge', { file: P_APP });
  }
  if (!appCode.includes('toActivityOnlineStatus(')) {
    fail('P app activity status mapping must use toActivityOnlineStatus from bridge', { file: P_APP });
  }

  mustNotContain(P_APP, '<option value="active">已激活</option>', 'P app should not hardcode tenant status option labels');
  mustNotContain(P_APP, '<option value="inactive">未激活</option>', 'P app should not hardcode tenant status option labels');
  mustNotContain(P_APP, '<option value="enabled">生效中</option>', 'P app should not hardcode enabled status option labels');
  mustNotContain(P_APP, '<option value="disabled">已禁用</option>', 'P app should not hardcode enabled status option labels');
  mustNotContain(P_APP, 'const normalizeActivityStatus =', 'P app should not define local activity status normalizer');

  console.log(
    JSON.stringify(
      {
        ok: true,
        checks: [
          'shared_status_options_exported',
          'p_bridge_reexports_status_options',
          'p_app_selects_and_filter_state_use_shared_types',
          'p_app_activity_status_uses_shared_mapper',
          'no_hardcoded_status_options_in_p_app',
        ],
      },
      null,
      2
    )
  );
}

main();
