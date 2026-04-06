#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SHARED_OPTIONS = path.resolve(ROOT, '../../shared-contracts/select-options.ts');
const SHARED_INDEX = path.resolve(ROOT, '../../shared-contracts/index.ts');
const P_BRIDGE = path.resolve(ROOT, '../../insurance_code_P/src/lib/selectOptions.ts');
const P_APP = path.resolve(ROOT, '../../insurance_code_P/src/App.tsx');

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
  if (!fs.existsSync(SHARED_OPTIONS)) fail('shared select-options not found', { file: SHARED_OPTIONS });
  if (!fs.existsSync(SHARED_INDEX)) fail('shared index not found', { file: SHARED_INDEX });
  if (!fs.existsSync(P_BRIDGE)) fail('P selectOptions bridge not found', { file: P_BRIDGE });
  if (!fs.existsSync(P_APP)) fail('P App.tsx not found', { file: P_APP });

  const sharedCode = fs.readFileSync(SHARED_OPTIONS, 'utf8');
  const sharedIndexCode = fs.readFileSync(SHARED_INDEX, 'utf8');
  const bridgeCode = fs.readFileSync(P_BRIDGE, 'utf8');
  const appCode = fs.readFileSync(P_APP, 'utf8');

  mustContain(sharedCode, 'export const EVENT_TYPE_OPTIONS', SHARED_OPTIONS, 'shared select-options must export EVENT_TYPE_OPTIONS');
  mustContain(
    sharedCode,
    'export const EVENT_COLLECT_METHOD_OPTIONS',
    SHARED_OPTIONS,
    'shared select-options must export EVENT_COLLECT_METHOD_OPTIONS'
  );
  mustContain(sharedCode, 'export const EMPLOYEE_ROLE_OPTIONS', SHARED_OPTIONS, 'shared select-options must export EMPLOYEE_ROLE_OPTIONS');
  mustContain(sharedCode, 'export function employeeRoleLabel', SHARED_OPTIONS, 'shared select-options must export employeeRoleLabel');
  mustContain(sharedCode, 'export function eventTypeLabel', SHARED_OPTIONS, 'shared select-options must export eventTypeLabel');
  mustContain(sharedCode, 'export function eventTypePillClass', SHARED_OPTIONS, 'shared select-options must export eventTypePillClass');
  mustContain(sharedCode, 'export function eventCollectMethodLabel', SHARED_OPTIONS, 'shared select-options must export eventCollectMethodLabel');
  mustContain(sharedCode, 'export const ACTIVITY_TYPE_OPTIONS', SHARED_OPTIONS, 'shared select-options must export ACTIVITY_TYPE_OPTIONS');
  mustContain(sharedIndexCode, "export * from './select-options';", SHARED_INDEX, 'shared index must export select-options');

  mustContain(bridgeCode, 'EVENT_TYPE_OPTIONS', P_BRIDGE, 'P bridge must re-export EVENT_TYPE_OPTIONS');
  mustContain(bridgeCode, 'EVENT_COLLECT_METHOD_OPTIONS', P_BRIDGE, 'P bridge must re-export EVENT_COLLECT_METHOD_OPTIONS');
  mustContain(bridgeCode, 'EMPLOYEE_ROLE_OPTIONS', P_BRIDGE, 'P bridge must re-export EMPLOYEE_ROLE_OPTIONS');
  mustContain(bridgeCode, 'employeeRoleLabel', P_BRIDGE, 'P bridge must re-export employeeRoleLabel');
  mustContain(bridgeCode, 'eventTypeLabel', P_BRIDGE, 'P bridge must re-export eventTypeLabel');
  mustContain(bridgeCode, 'eventTypePillClass', P_BRIDGE, 'P bridge must re-export eventTypePillClass');
  mustContain(bridgeCode, 'eventCollectMethodLabel', P_BRIDGE, 'P bridge must re-export eventCollectMethodLabel');
  mustContain(bridgeCode, 'ACTIVITY_TYPE_OPTIONS', P_BRIDGE, 'P bridge must re-export ACTIVITY_TYPE_OPTIONS');

  mustContain(appCode, 'EVENT_TYPE_OPTIONS.map', P_APP, 'P app must use EVENT_TYPE_OPTIONS.map');
  mustContain(appCode, 'EVENT_COLLECT_METHOD_OPTIONS.map', P_APP, 'P app must use EVENT_COLLECT_METHOD_OPTIONS.map');
  mustContain(appCode, 'EMPLOYEE_ROLE_OPTIONS.map', P_APP, 'P app must use EMPLOYEE_ROLE_OPTIONS.map');
  mustContain(appCode, 'employeeRoleLabel(', P_APP, 'P app must use employeeRoleLabel from bridge');
  mustContain(appCode, 'eventTypeLabel(', P_APP, 'P app must use eventTypeLabel from bridge');
  mustContain(appCode, 'eventTypePillClass(', P_APP, 'P app must use eventTypePillClass from bridge');
  mustContain(appCode, 'eventCollectMethodLabel(', P_APP, 'P app must use eventCollectMethodLabel from bridge');
  mustContain(appCode, 'ACTIVITY_TYPE_OPTIONS.map', P_APP, 'P app must use ACTIVITY_TYPE_OPTIONS.map');

  mustNotContain(appCode, '<option value="system">系统预置</option>', P_APP, 'P app should not hardcode eventType options');
  mustNotContain(appCode, '<option value="custom">自定义</option>', P_APP, 'P app should not hardcode eventType options');
  mustNotContain(appCode, '<option value="frontend">前端埋点</option>', P_APP, 'P app should not hardcode collectMethod options');
  mustNotContain(appCode, '<option value="backend">后端日志</option>', P_APP, 'P app should not hardcode collectMethod options');
  mustNotContain(appCode, '<option value="both">两者兼有</option>', P_APP, 'P app should not hardcode collectMethod options');
  mustNotContain(appCode, '<option value="manager">公司管理员</option>', P_APP, 'P app should not hardcode role options');
  mustNotContain(appCode, '<option value="salesperson">业务员</option>', P_APP, 'P app should not hardcode role options');
  mustNotContain(appCode, '<option value="support">团队主管</option>', P_APP, 'P app should not hardcode role options');
  mustNotContain(appCode, '<option value="task">任务活动</option>', P_APP, 'P app should not hardcode activity type options');
  mustNotContain(appCode, '<option value="competition">竞赛活动</option>', P_APP, 'P app should not hardcode activity type options');
  mustNotContain(appCode, '<option value="invite">邀请活动</option>', P_APP, 'P app should not hardcode activity type options');
  mustNotContain(appCode, "roleValue === 'manager' ? '公司管理员' : roleValue === 'support' ? '团队主管' : '业务员'", P_APP, 'P app should not hardcode role label mapping');
  mustNotContain(appCode, "const typeLabel = (type: string) => (type === 'system' ? '系统预置' : '自定义');", P_APP, 'P app should not define local event type label mapping');
  mustNotContain(appCode, "const typePill = (type: string) => (type === 'system' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600');", P_APP, 'P app should not define local event type pill mapping');
  mustNotContain(appCode, "const methodLabel = (method: string) => (method === 'backend' ? '后端日志' : method === 'both' ? '前后端' : '前端埋点');", P_APP, 'P app should not define local event collect method label mapping');

  console.log(
    JSON.stringify(
      {
        ok: true,
        checks: [
          'shared_select_options_exported',
          'shared_index_exported',
          'p_bridge_reexports',
          'p_app_uses_options_constants',
          'no_hardcoded_event_role_activity_options',
        ],
      },
      null,
      2
    )
  );
}

main();
