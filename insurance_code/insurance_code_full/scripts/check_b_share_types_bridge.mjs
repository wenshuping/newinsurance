#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SHARED = path.resolve(ROOT, '../../shared-contracts/b-share.ts');
const SHARED_INDEX = path.resolve(ROOT, '../../shared-contracts/index.ts');
const B_BRIDGE = path.resolve(ROOT, '../../insurance_code_B/src/lib/shareTypes.ts');
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
  for (const file of [SHARED, SHARED_INDEX, B_BRIDGE, B_APP]) {
    if (!fs.existsSync(file)) fail('required file not found', { file });
  }

  const sharedCode = fs.readFileSync(SHARED, 'utf8');
  const sharedIndexCode = fs.readFileSync(SHARED_INDEX, 'utf8');
  const bridgeCode = fs.readFileSync(B_BRIDGE, 'utf8');
  const appCode = fs.readFileSync(B_APP, 'utf8');

  mustContain(sharedCode, "export type BToolKind = 'content' | 'activity' | 'product' | 'mall-activity';", SHARED, 'shared b-share must export BToolKind');
  mustContain(sharedCode, 'export type BSharePath =', SHARED, 'shared b-share must export BSharePath');
  mustContain(sharedCode, 'export const B_SHARE_TRACK_EVENTS = {', SHARED, 'shared b-share must export B_SHARE_TRACK_EVENTS');
  mustContain(sharedCode, 'export function bToolKindShareLabel', SHARED, 'shared b-share must export bToolKindShareLabel');
  mustContain(sharedCode, 'export function bToolKindDetailTitle', SHARED, 'shared b-share must export bToolKindDetailTitle');
  mustContain(sharedCode, 'export function bToolKindShareButtonLabel', SHARED, 'shared b-share must export bToolKindShareButtonLabel');
  mustContain(sharedCode, 'export function bToolKindDetailSharePath', SHARED, 'shared b-share must export bToolKindDetailSharePath');
  mustContain(sharedIndexCode, "export * from './b-share';", SHARED_INDEX, 'shared index must export b-share');

  mustContain(bridgeCode, 'BToolKind', B_BRIDGE, 'B bridge must re-export BToolKind');
  mustContain(bridgeCode, 'BSharePath', B_BRIDGE, 'B bridge must re-export BSharePath');
  mustContain(bridgeCode, 'B_SHARE_TRACK_EVENTS', B_BRIDGE, 'B bridge must re-export B_SHARE_TRACK_EVENTS');
  mustContain(bridgeCode, 'bToolKindShareLabel', B_BRIDGE, 'B bridge must re-export bToolKindShareLabel');
  mustContain(bridgeCode, 'bToolKindDetailTitle', B_BRIDGE, 'B bridge must re-export bToolKindDetailTitle');
  mustContain(bridgeCode, 'bToolKindShareButtonLabel', B_BRIDGE, 'B bridge must re-export bToolKindShareButtonLabel');
  mustContain(bridgeCode, 'bToolKindDetailSharePath', B_BRIDGE, 'B bridge must re-export bToolKindDetailSharePath');

  mustContain(appCode, "from './lib/shareTypes';", B_APP, 'B App must import from shareTypes bridge');
  mustContain(appCode, 'B_SHARE_TRACK_EVENTS.', B_APP, 'B App should use B_SHARE_TRACK_EVENTS from bridge');
  mustContain(appCode, 'bToolKindShareLabel(', B_APP, 'B App should use bToolKindShareLabel from bridge');
  mustContain(appCode, 'bToolKindDetailTitle(', B_APP, 'B App should use bToolKindDetailTitle from bridge');
  mustContain(appCode, 'bToolKindShareButtonLabel(', B_APP, 'B App should use bToolKindShareButtonLabel from bridge');
  mustContain(appCode, 'bToolKindDetailSharePath(', B_APP, 'B App should use bToolKindDetailSharePath from bridge');
  mustContain(appCode, 'kind: BToolKind', B_APP, 'B App should use BToolKind in local state/function signatures');
  mustContain(appCode, 'sharePath: BSharePath', B_APP, 'B App should use BSharePath in share handler signature');

  mustNotContain(appCode, "type ToolKind = 'content' | 'activity' | 'product' | 'mall-activity';", B_APP, 'B App should not define local ToolKind');
  mustNotContain(appCode, 'type SharePath =', B_APP, 'B App should not define local SharePath');
  mustNotContain(appCode, "kind === 'content' ? '知识学习' : kind === 'activity' ? '活动中心' : kind === 'product' ? '积分商品' : '积分活动';", B_APP, 'B App should not define local shareLabel ternary');
  mustNotContain(appCode, "detailModal.kind === 'content' ? '内容详情' : detailModal.kind === 'activity' ? '活动详情' : detailModal.kind === 'product' ? '商品详情' : '活动货架详情'", B_APP, 'B App should not define local detail title ternary');
  mustNotContain(appCode, "detailModal.kind === 'content'\n                        ? 'content_detail'\n                        : detailModal.kind === 'activity'\n                          ? 'activity_detail'\n                          : 'product_detail'", B_APP, 'B App should not define local detail share path ternary');
  mustNotContain(appCode, "detailModal.kind === 'activity' ? '活动' : detailModal.kind === 'product' ? '商品' : '内容'", B_APP, 'B App should not define local share button label ternary');
  mustNotContain(appCode, "event: 'b_tools_share_attempt'", B_APP, 'B App should not hardcode share track event names');
  mustNotContain(appCode, "event: 'b_tools_share_cancel'", B_APP, 'B App should not hardcode share track event names');
  mustNotContain(appCode, "event: 'b_tools_share_success'", B_APP, 'B App should not hardcode share track event names');
  mustNotContain(appCode, "event: 'b_tools_share_failed'", B_APP, 'B App should not hardcode share track event names');

  console.log(
    JSON.stringify(
      {
        ok: true,
        checks: [
          'shared_b_share_exported',
          'shared_index_exported',
          'b_bridge_reexports',
          'b_app_uses_bridge_types',
          'b_app_uses_bridge_track_event_constants',
          'b_app_uses_bridge_share_label',
          'b_app_uses_bridge_detail_mappings',
          'no_local_toolkind_sharepath_type_or_detail_share_ternaries',
        ],
      },
      null,
      2
    )
  );
}

main();
