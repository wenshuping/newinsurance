import React, { useEffect, useState } from 'react';
import { ChevronLeft, Calendar, PartyPopper, CheckCircle2, QrCode } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api, type ActivityHistoryItem } from '../../lib/api';
import ActivityHistoryDetail from './ActivityHistoryDetail';

interface Props {
  onClose: () => void;
}

function formatDate(value: string) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.slice(0, 10);
}

export default function MyActivities({ onClose }: Props) {
  const [items, setItems] = useState<ActivityHistoryItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ActivityHistoryItem | null>(null);

  useEffect(() => {
    let mounted = true;
    api.activityHistory()
      .then((res) => {
        if (!mounted) return;
        setItems(Array.isArray(res.list) ? res.list : []);
      })
      .catch(() => {
        if (!mounted) return;
        setItems([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-50 bg-slate-50 flex flex-col"
    >
      <header className="bg-white sticky top-0 z-20 px-4 py-4 flex items-center justify-between border-b border-slate-100">
        <button onClick={onClose} className="p-2 -ml-2 text-slate-700 active:bg-slate-100 rounded-full transition-colors">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold">我的活动</h1>
        <div className="w-10" />
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-4 pb-safe">
        {items.map((item) => {
          const writtenOff = String(item.writtenOffAt || '').trim();
          const writeoffLabel = writtenOff ? '已核销' : '待核销';
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedItem(item)}
              className="w-full rounded-[28px] border border-slate-100 bg-white p-4 text-left shadow-sm transition-transform active:scale-[0.99]"
            >
              <div className="flex gap-4">
                <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
                  {item.image ? (
                    <img src={item.image} alt={item.title} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-50 via-white to-blue-50 text-orange-400">
                      <PartyPopper size={28} />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-2 text-lg font-bold leading-7 text-slate-900">{item.title}</h3>
                      <p className="mt-1 truncate text-sm text-slate-500">{item.description || '已完成活动参与，可查看详情与核销码。'}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                        writtenOff ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                      }`}
                    >
                      {writeoffLabel}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex items-center gap-2 text-xs text-slate-500">
                      <Calendar size={14} className="shrink-0" />
                      <span className="truncate whitespace-nowrap">完成日期：{formatDate(item.completedAt || item.completedDate || item.createdAt)}</span>
                    </div>
                    <div className="shrink-0 flex items-center gap-1.5 text-emerald-600 font-bold">
                      <CheckCircle2 size={14} />
                      <span className="whitespace-nowrap">+{Number(item.rewardPoints || 0)} 积分</span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-blue-600">
                    <QrCode size={14} />
                    <span className="truncate">点击查看活动详情与核销二维码</span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}

        {items.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 border border-slate-100 text-sm text-slate-500 shadow-sm">
            暂无活动记录，完成活动兑换后会显示在这里。
          </div>
        ) : null}
      </main>

      <AnimatePresence>
        {selectedItem ? <ActivityHistoryDetail item={selectedItem} onClose={() => setSelectedItem(null)} /> : null}
      </AnimatePresence>
    </motion.div>
  );
}
