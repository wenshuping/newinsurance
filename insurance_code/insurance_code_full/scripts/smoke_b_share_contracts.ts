type BToolKind = 'content' | 'activity' | 'product' | 'mall-activity';

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

const KINDS: BToolKind[] = ['content', 'activity', 'product', 'mall-activity'];

async function loadBShareContracts() {
  const mod = await import('../../../shared-contracts/b-share.ts');
  const ns = ((mod as { default?: unknown; 'module.exports'?: unknown }).default ??
    (mod as { 'module.exports'?: unknown })['module.exports'] ??
    mod) as {
    B_SHARE_TRACK_EVENTS: Record<'attempt' | 'cancel' | 'success' | 'failed', string>;
    bToolKindDetailSharePath: (kind: BToolKind) => string | null;
    bToolKindDetailTitle: (kind: BToolKind) => string;
    bToolKindShareButtonLabel: (kind: BToolKind) => string;
    bToolKindShareLabel: (kind: BToolKind) => string;
  };
  return ns;
}

async function main() {
  const {
    B_SHARE_TRACK_EVENTS,
    bToolKindDetailSharePath,
    bToolKindDetailTitle,
    bToolKindShareButtonLabel,
    bToolKindShareLabel,
  } = await loadBShareContracts();
  // share label mapping
  assert(bToolKindShareLabel('content') === '知识学习', 'content share label mismatch');
  assert(bToolKindShareLabel('activity') === '活动中心', 'activity share label mismatch');
  assert(bToolKindShareLabel('product') === '积分商品', 'product share label mismatch');
  assert(bToolKindShareLabel('mall-activity') === '积分活动', 'mall-activity share label mismatch');

  // detail title mapping
  assert(bToolKindDetailTitle('content') === '内容详情', 'content detail title mismatch');
  assert(bToolKindDetailTitle('activity') === '活动详情', 'activity detail title mismatch');
  assert(bToolKindDetailTitle('product') === '商品详情', 'product detail title mismatch');
  assert(bToolKindDetailTitle('mall-activity') === '活动货架详情', 'mall-activity detail title mismatch');

  // share button label mapping
  assert(bToolKindShareButtonLabel('content') === '内容', 'content share button label mismatch');
  assert(bToolKindShareButtonLabel('activity') === '活动', 'activity share button label mismatch');
  assert(bToolKindShareButtonLabel('product') === '商品', 'product share button label mismatch');
  assert(bToolKindShareButtonLabel('mall-activity') === '内容', 'mall-activity share button label mismatch');

  // detail share path mapping
  assert(bToolKindDetailSharePath('content') === 'content_detail', 'content share path mismatch');
  assert(bToolKindDetailSharePath('activity') === 'activity_detail', 'activity share path mismatch');
  assert(bToolKindDetailSharePath('product') === 'product_detail', 'product share path mismatch');
  assert(bToolKindDetailSharePath('mall-activity') === null, 'mall-activity share path should be null');

  // event constants stability
  assert(B_SHARE_TRACK_EVENTS.attempt === 'b_tools_share_attempt', 'share attempt event mismatch');
  assert(B_SHARE_TRACK_EVENTS.cancel === 'b_tools_share_cancel', 'share cancel event mismatch');
  assert(B_SHARE_TRACK_EVENTS.success === 'b_tools_share_success', 'share success event mismatch');
  assert(B_SHARE_TRACK_EVENTS.failed === 'b_tools_share_failed', 'share failed event mismatch');

  console.log(
    JSON.stringify(
      {
        ok: true,
        checks: [
          'share_label_mapping',
          'detail_title_mapping',
          'share_button_label_mapping',
          'detail_share_path_mapping',
          'track_event_constants',
        ],
        kindCount: KINDS.length,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
