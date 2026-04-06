export type RedemptionRow = {
  id: number;
  orderId?: number;
  itemId?: number;
  itemName?: string;
  itemImage?: string;
  pointsCost?: number;
  status?: string;
  writeoffToken?: string;
  expiresAt?: string;
  writtenOffAt?: string;
  createdAt?: string;
};

export type OrderRow = {
  id: number;
  productId?: number;
  orderNo?: string;
  productName?: string;
  productImage?: string;
  pointsAmount?: number;
  status?: string;
  paymentStatus?: string;
  fulfillmentStatus?: string;
  refundStatus?: string;
  createdAt?: string;
};

export type MallItemRow = {
  id: number;
  name?: string;
  title?: string;
  image?: string;
  pointsCost?: number;
  stock?: number;
};

export type ExchangeViewModel = {
  id: number;
  rawId: number;
  orderId: number;
  orderNo: string;
  name: string;
  date: string;
  image: string;
  points: number;
  status: string;
  orderStatus: string;
  code: string;
  qrCode: string;
  completedDate?: string;
  createdAt?: string;
  expiresAt?: string;
  rawOrder: OrderRow | null;
  rawRedemption: RedemptionRow;
};

export function resolveExchangeStatus(redemption: RedemptionRow) {
  if (String(redemption.status || '') === 'written_off') return '已完成';
  const expiresAt = new Date(String(redemption.expiresAt || '')).getTime();
  if (Number.isFinite(expiresAt) && expiresAt < Date.now()) return '已过期';
  return '待核销';
}

export function resolveOrderStatus(order: OrderRow | null, redemption: RedemptionRow) {
  if (!order) return '订单同步中';
  if (String(redemption.status || '') === 'written_off' || String(order.fulfillmentStatus || '') === 'written_off') return '已核销';
  if (String(order.refundStatus || '') === 'refunded') return '已退款';
  if (String(order.status || '') === 'cancelled') return '已取消';
  if (String(order.paymentStatus || '') === 'paid') return '待核销';
  if (String(order.paymentStatus || '') === 'pending') return '待支付';
  return String(order.status || '处理中');
}

function resolveMallItem(
  order: OrderRow | null,
  redemption: RedemptionRow,
  mallItems: MallItemRow[] = [],
) {
  const byId = mallItems.find((item) => Number(item.id || 0) === Number(order?.productId || redemption.itemId || 0));
  if (byId) return byId;
  const normalizedName = String(redemption.itemName || order?.productName || '').trim();
  if (!normalizedName) return null;
  return (
    mallItems.find((item) => String(item.name || item.title || '').trim() === normalizedName) || null
  );
}

export function buildExchangeViewModels(
  redemptions: RedemptionRow[] = [],
  orders: OrderRow[] = [],
  mallItems: MallItemRow[] = [],
) {
  const orderMap = new Map(orders.map((order) => [Number(order.id || 0), order]));
  return redemptions.map((row) => {
    const order = orderMap.get(Number(row.orderId || 0)) || null;
    const mallItem = resolveMallItem(order, row, mallItems);
    return {
      id: Number(row.id || 0),
      rawId: Number(row.id || 0),
      orderId: Number(row.orderId || 0),
      orderNo: String(order?.orderNo || ''),
      name: String(row.itemName || order?.productName || mallItem?.name || mallItem?.title || '兑换商品'),
      date: String(order?.createdAt || row.createdAt || '').slice(0, 10),
      image: String(row.itemImage || order?.productImage || mallItem?.image || ''),
      points: Number(row.pointsCost || order?.pointsAmount || mallItem?.pointsCost || 0),
      status: resolveExchangeStatus(row),
      orderStatus: resolveOrderStatus(order, row),
      code: String(row.writeoffToken || ''),
      qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${row.writeoffToken || ''}`,
      completedDate: row.writtenOffAt ? String(row.writtenOffAt).slice(0, 10) : undefined,
      createdAt: String(row.createdAt || ''),
      expiresAt: String(row.expiresAt || ''),
      rawOrder: order,
      rawRedemption: row,
    } satisfies ExchangeViewModel;
  });
}

export function pickLatestPendingExchange(exchanges: ExchangeViewModel[]) {
  return (
    [...exchanges]
      .filter((item) => item.status === '待核销')
      .sort((a, b) => {
        const timeA = new Date(String(a.createdAt || '')).getTime();
        const timeB = new Date(String(b.createdAt || '')).getTime();
        if (Number.isFinite(timeA) && Number.isFinite(timeB) && timeA !== timeB) return timeB - timeA;
        return Number(b.id || 0) - Number(a.id || 0);
      })[0] || null
  );
}
