import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, CalendarDays, CheckCircle2, PartyPopper, QrCode, ScanLine } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import QRCode from 'qrcode';
import type { ActivityHistoryItem } from '../../lib/api';

interface Props {
  item: ActivityHistoryItem;
  onClose: () => void;
}

function toDisplayDate(value?: string | null) {
  const text = String(value || '').trim();
  return text ? text.slice(0, 10) : '--';
}

function resolveWriteoffLabel(item: ActivityHistoryItem) {
  return String(item?.writeoffStatus || '').trim().toLowerCase() === 'written_off' || item?.writtenOffAt
    ? '已核销'
    : '待核销';
}

export default function ActivityHistoryDetail({ item, onClose }: Props) {
  const [showQr, setShowQr] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');

  const display = useMemo(() => {
    const writeoffToken = String(item?.writeoffToken || '').trim();
    return {
      title: String(item?.title || '活动详情'),
      description: String(item?.description || '已完成活动参与，可在现场向工作人员出示活动二维码进行核销。'),
      image: String(item?.image || item?.cover || ''),
      points: Number(item?.rewardPoints || 0),
      completedDate: toDisplayDate(item?.completedAt || item?.completedDate || item?.createdAt),
      writtenOffAt: toDisplayDate(item?.writtenOffAt || ''),
      writeoffToken,
      writeoffLabel: resolveWriteoffLabel(item),
      orderId: Number(item?.orderId || 0),
    };
  }, [item]);

  useEffect(() => {
    let active = true;
    if (!display.writeoffToken) {
      setQrCodeDataUrl('');
      return () => {
        active = false;
      };
    }
    QRCode.toDataURL(display.writeoffToken, {
      width: 320,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((value) => {
        if (active) setQrCodeDataUrl(value);
      })
      .catch(() => {
        if (active) setQrCodeDataUrl('');
      });
    return () => {
      active = false;
    };
  }, [display.writeoffToken]);

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-[10070] bg-slate-50 flex flex-col"
    >
      <header className="bg-white sticky top-0 z-20 px-4 py-4 flex items-center justify-between border-b border-slate-100">
        <button onClick={onClose} className="p-2 -ml-2 text-slate-700 active:bg-slate-100 rounded-full transition-colors">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold">活动详情</h1>
        <div className="w-10" />
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-4 pb-28">
        <section className="overflow-hidden rounded-[28px] border border-slate-100 bg-white shadow-sm">
          <div className="relative aspect-video overflow-hidden bg-slate-100">
            {display.image ? (
              <img src={display.image} alt={display.title} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-100 via-white to-blue-50 text-orange-400">
                <PartyPopper size={42} />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/15 to-transparent" />
            <div className="absolute left-4 right-4 top-4 flex items-start justify-between gap-3">
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-bold backdrop-blur ${
                  display.writeoffLabel === '已核销'
                    ? 'bg-emerald-500/15 text-emerald-50 ring-1 ring-emerald-100/30'
                    : 'bg-amber-500/15 text-amber-50 ring-1 ring-amber-100/30'
                }`}
              >
                {display.writeoffLabel}
              </span>
              <span className="rounded-full bg-slate-950/55 px-3 py-1 text-xs font-bold text-white">
                +{display.points} 积分
              </span>
            </div>
            <div className="absolute inset-x-0 bottom-0 p-4 text-white">
              <p className="text-xs uppercase tracking-[0.2em] text-white/70">我的活动</p>
              <h2 className="mt-2 text-2xl font-black leading-tight">{display.title}</h2>
            </div>
          </div>

          <div className="space-y-4 px-4 py-4">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 font-semibold text-slate-600">
                <CalendarDays size={14} />
                完成于 {display.completedDate}
              </span>
              {display.writtenOffAt !== '--' ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-600">
                  <CheckCircle2 size={14} />
                  核销于 {display.writtenOffAt}
                </span>
              ) : null}
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">活动简介</p>
              <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">{display.description}</p>
            </div>

            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">活动核销码</p>
              <p className="mt-3 break-all font-mono text-sm text-slate-700">{display.writeoffToken || '--'}</p>
              <p className="mt-2 text-xs leading-6 text-slate-500">
                到店后向业务员出示二维码或核销码即可完成活动核销。
              </p>
            </div>
          </div>
        </section>
      </main>

      <div className="fixed bottom-0 left-0 right-0 border-t border-slate-100 bg-white px-4 py-4 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.06)] pb-safe">
        <button
          type="button"
          onClick={() => setShowQr(true)}
          disabled={!display.writeoffToken}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 text-base font-bold text-white shadow-lg shadow-blue-500/20 transition-transform active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <QrCode size={18} />
          查看活动二维码
        </button>
      </div>

      <AnimatePresence>
        {showQr ? (
          <div className="fixed inset-0 z-[10080] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
              onClick={() => setShowQr(false)}
            />
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="relative w-full max-w-sm rounded-[32px] bg-white px-6 py-7 text-center shadow-2xl"
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <ScanLine size={26} />
              </div>
              <h3 className="mt-4 text-xl font-bold text-slate-900">请向业务员出示此码</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                现场出示二维码即可完成活动核销，离场后记录会自动同步。
              </p>

              <div className="mx-auto mt-6 flex h-72 w-72 items-center justify-center rounded-[28px] border border-slate-100 bg-slate-50 p-4">
                {qrCodeDataUrl ? (
                  <img src={qrCodeDataUrl} alt="活动核销二维码" className="h-full w-full rounded-2xl bg-white object-contain p-3" />
                ) : (
                  <div className="text-sm text-slate-400">二维码生成中...</div>
                )}
              </div>

              <div className="mt-5 rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">核销码</p>
                <p className="mt-2 break-all font-mono text-sm text-slate-700">{display.writeoffToken || '--'}</p>
              </div>

              <button
                type="button"
                onClick={() => setShowQr(false)}
                className="mt-6 h-11 w-full rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-700"
              >
                完成
              </button>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
