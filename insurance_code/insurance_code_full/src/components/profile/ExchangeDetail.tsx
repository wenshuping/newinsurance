import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, QrCode, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../../lib/api';
import { getApiErrorMessage, showApiError } from '../../lib/ui-error';

interface Props {
  exchange: any;
  onClose: () => void;
}

function toDisplayDate(value?: string) {
  return value ? String(value).slice(0, 10) : '--';
}

function resolveOrderStatus(order: any, redemption: any) {
  if (!order) return '订单同步中';
  if (String(redemption?.status || '') === 'written_off' || String(order.fulfillmentStatus || '') === 'written_off') return '已核销';
  if (String(order.refundStatus || '') === 'refunded') return '已退款';
  if (String(order.status || '') === 'cancelled') return '已取消';
  if (String(order.paymentStatus || '') === 'paid') return '待核销';
  if (String(order.paymentStatus || '') === 'pending') return '待支付';
  return String(order.status || '处理中');
}

function resolveRedemptionStatus(redemption: any, fallbackStatus?: string) {
  if (String(redemption?.status || '') === 'written_off') return '已完成';
  if (new Date(String(redemption?.expiresAt || '')).getTime() < Date.now()) return '已过期';
  return fallbackStatus || '待核销';
}

export default function ExchangeDetail({ exchange, onClose }: Props) {
  const [showQR, setShowQR] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [detail, setDetail] = useState<{ order: any; redemption: any | null } | null>(null);
  const [detailLoading, setDetailLoading] = useState(Boolean(exchange?.orderId));
  const [detailError, setDetailError] = useState('');

  useEffect(() => {
    let active = true;
    if (!Number.isFinite(Number(exchange?.orderId)) || Number(exchange.orderId) <= 0) {
      setDetailLoading(false);
      return () => {
        active = false;
      };
    }

    setDetailLoading(true);
    setDetailError('');
    api.orderDetail(Number(exchange.orderId))
      .then((payload) => {
        if (!active) return;
        setDetail(payload);
      })
      .catch((error: any) => {
        if (!active) return;
        setDetailError(getApiErrorMessage(error, '订单详情加载失败，先展示兑换记录'));
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });

    return () => {
      active = false;
    };
  }, [exchange?.orderId]);

  const order = detail?.order || exchange?.rawOrder || null;
  const redemption = detail?.redemption || exchange?.rawRedemption || null;

  const view = useMemo(
    () => ({
      image: exchange?.image || '',
      name: String(redemption?.itemName || exchange?.name || order?.productName || '兑换商品'),
      points: Number(redemption?.pointsCost || exchange?.points || order?.pointsAmount || 0),
      orderNo: String(order?.orderNo || exchange?.orderNo || ''),
      orderStatus: resolveOrderStatus(order, redemption),
      redemptionStatus: resolveRedemptionStatus(redemption, exchange?.status),
      date: toDisplayDate(redemption?.createdAt || order?.createdAt || exchange?.createdAt || exchange?.date),
      expiresAt: toDisplayDate(redemption?.expiresAt || exchange?.expiresAt),
      redemptionId: Number(redemption?.id || exchange?.rawId || exchange?.id || 0),
      writeoffToken: String(redemption?.writeoffToken || exchange?.code || ''),
    }),
    [exchange, order, redemption],
  );

  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-50 bg-slate-50 flex flex-col"
    >
      <header className="bg-white sticky top-0 z-10 px-4 py-4 flex items-center justify-between border-b border-slate-100">
        <button onClick={onClose} className="p-2 -ml-2 text-slate-700 active:bg-slate-100 rounded-full transition-colors">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold">兑换详情</h1>
        <div className="w-10"></div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
        {/* Product Info */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="aspect-square w-full max-w-[200px] mx-auto mb-6 rounded-xl overflow-hidden bg-slate-50">
            <img src={view.image} alt={view.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
          <h2 className="text-2xl font-bold text-center mb-2">{view.name}</h2>
          <div className="flex justify-center items-center gap-2 text-orange-500 font-bold text-lg mb-6">
            <span>{view.points} 积分</span>
          </div>
          
          <div className="space-y-3 border-t border-slate-100 pt-4">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">订单编号</span>
              <span className="font-medium">{view.orderNo || '订单同步中'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">订单状态</span>
              <span className="font-medium">{detailLoading ? '加载中...' : view.orderStatus}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">兑换时间</span>
              <span className="font-medium">{view.date}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">兑换状态</span>
              <span className="font-bold text-orange-500">{view.redemptionStatus}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <h3 className="font-bold text-base mb-3">关联兑换信息</h3>
          {detailError ? <p className="text-sm text-amber-600 mb-3">{detailError}</p> : null}
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">兑换记录ID</span>
              <span className="font-medium">{view.redemptionId || '--'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">核销码</span>
              <span className="font-medium">{view.writeoffToken || '--'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">有效期至</span>
              <span className="font-medium">{view.expiresAt}</span>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <h3 className="font-bold text-base mb-3">使用说明</h3>
          <ul className="space-y-2 text-sm text-slate-600 list-disc list-inside">
            <li>请向门店工作人员出示核销二维码</li>
            <li>二维码截图无效，请在现场打开此页面</li>
            <li>商品一经核销，不可退换</li>
            <li>有效期至：{view.expiresAt}</li>
          </ul>
        </div>
      </main>

      {/* Bottom Action */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100 pb-safe shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
        <button 
          onClick={() => setShowQR(true)}
          className="w-full bg-gradient-to-r from-orange-400 to-orange-500 text-white font-bold text-lg py-3.5 rounded-xl shadow-lg shadow-orange-200 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
        >
          <QrCode size={20} />
          出示核销码
        </button>
      </div>

      {/* QR Code Modal */}
      <AnimatePresence>
        {showQR && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setShowQR(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-xs bg-white rounded-3xl p-8 flex flex-col items-center shadow-2xl"
            >
              <h3 className="text-xl font-bold mb-2">向店员出示此码</h3>
              <p className="text-sm text-slate-500 mb-6">请勿将此码分享给他人</p>
              
              <div className="w-48 h-48 bg-slate-50 rounded-xl p-2 border-2 border-slate-100 mb-6">
                <img src={exchange.qrCode} alt="QR Code" className="w-full h-full" referrerPolicy="no-referrer" />
              </div>
              
              <p className="text-xs text-slate-400 font-mono tracking-widest">{view.orderNo || '订单同步中'}</p>
              
              <button 
                onClick={() => {
                  setSubmitting(true);
                  api.writeoff(view.redemptionId || exchange.rawId || exchange.id, view.writeoffToken || exchange.code)
                    .then(() => {
                      setShowQR(false);
                      alert('核销成功！');
                      onClose();
                    })
                    .catch((e: any) => {
                      showApiError(e, '核销失败');
                    })
                    .finally(() => setSubmitting(false));
                }}
                className="mt-8 w-full bg-slate-100 text-slate-700 font-bold py-3 rounded-xl active:bg-slate-200 transition-colors disabled:opacity-50"
                disabled={submitting || detailLoading}
              >
                {submitting ? '核销中...' : '确认核销'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
