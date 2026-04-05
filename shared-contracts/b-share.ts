export type BToolKind = 'content' | 'activity' | 'product' | 'mall-activity';

export type BSharePath =
  | 'content_list'
  | 'activity_config_list'
  | 'mall_product_list'
  | 'mall_activity_list'
  | 'content_detail'
  | 'activity_detail'
  | 'product_detail';

export const B_SHARE_TRACK_EVENTS = {
  attempt: 'b_tools_share_attempt',
  cancel: 'b_tools_share_cancel',
  success: 'b_tools_share_success',
  failed: 'b_tools_share_failed',
} as const;

export function bToolKindShareLabel(kind: BToolKind): string {
  if (kind === 'content') return '知识学习';
  if (kind === 'activity') return '活动中心';
  if (kind === 'product') return '积分商品';
  return '积分活动';
}

export function bToolKindDetailTitle(kind: BToolKind): string {
  if (kind === 'content') return '内容详情';
  if (kind === 'activity') return '活动详情';
  if (kind === 'product') return '商品详情';
  return '活动货架详情';
}

export function bToolKindShareButtonLabel(kind: BToolKind): string {
  if (kind === 'activity') return '活动';
  if (kind === 'product') return '商品';
  return '内容';
}

export function bToolKindDetailSharePath(kind: BToolKind): BSharePath | null {
  if (kind === 'content') return 'content_detail';
  if (kind === 'activity') return 'activity_detail';
  if (kind === 'product') return 'product_detail';
  return null;
}
