import React, { useEffect, useState } from 'react';
import { ChevronLeft, Ticket, ArrowRight, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ExchangeDetail from './ExchangeDetail';
import { api } from '../../lib/api';
import { getApiErrorMessage } from '../../lib/ui-error';
import { buildExchangeViewModels, ExchangeViewModel, MallItemRow, OrderRow } from '../../lib/exchange-view-model';

interface Props {
  onClose: () => void;
  initialExchanges?: ExchangeViewModel[];
}

export default function MyExchanges({ onClose, initialExchanges = [] }: Props) {
  const [activeTab, setActiveTab] = useState('all');
  const [selectedExchange, setSelectedExchange] = useState<ExchangeViewModel | null>(null);
  const [exchanges, setExchanges] = useState<ExchangeViewModel[]>(initialExchanges);
  const [loading, setLoading] = useState(initialExchanges.length === 0);
  const [error, setError] = useState('');

  const loadExchanges = async () => {
    setLoading(true);
    setError('');
    try {
      const [redemptionsRes, ordersRes, mallItemsRes] = await Promise.all([
        api.redemptions(),
        api.orders().catch(() => ({ list: [] as OrderRow[] })),
        api.mallItems().catch(() => ({ items: [] as MallItemRow[] })),
      ]);
      setExchanges(
        buildExchangeViewModels(
          Array.isArray(redemptionsRes.list) ? redemptionsRes.list : [],
          Array.isArray(ordersRes.list) ? ordersRes.list : [],
          Array.isArray(mallItemsRes.items) ? mallItemsRes.items : [],
        ),
      );
    } catch (e: any) {
      setError(getApiErrorMessage(e, '兑换记录加载失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExchanges().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (initialExchanges.length > 0) {
      setExchanges(initialExchanges);
    }
  }, [initialExchanges]);

  const filteredExchanges = exchanges.filter((ex) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pending') return ex.status === '待核销';
    if (activeTab === 'completed') return ex.status === '已完成';
    return true;
  });

  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-50 bg-slate-50 flex flex-col"
    >
      {/* Header */}
      <header className="bg-white sticky top-0 z-20 px-4 py-4 flex items-center justify-between border-b border-slate-100">
        <button onClick={onClose} className="p-2 -ml-2 text-slate-700 active:bg-slate-100 rounded-full transition-colors">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold">我的兑换</h1>
        <div className="w-10"></div>
      </header>

      {/* Tabs */}
      <div className="bg-white sticky top-[61px] z-10 flex border-b border-slate-100">
        {[
          { id: 'all', label: '全部' },
          { id: 'pending', label: '待核销' },
          { id: 'completed', label: '已完成' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-3.5 text-sm font-bold relative ${
              activeTab === tab.id ? 'text-blue-500' : 'text-slate-500'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <motion.div 
                layoutId="exchangeTabIndicator"
                className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-blue-500 rounded-t-full"
              />
            )}
          </button>
        ))}
      </div>

      {/* List */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4 pb-safe">
        {error ? (
          <div className="rounded-2xl border border-amber-100 bg-amber-50/80 px-4 py-3 text-sm text-amber-700">
            {error}
          </div>
        ) : null}

        {loading && exchanges.length === 0 ? (
          <div className="space-y-4">
            {[0, 1].map((row) => (
              <div key={row} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="animate-pulse space-y-4">
                  <div className="h-32 rounded-xl bg-slate-100" />
                  <div className="h-6 w-2/3 rounded-full bg-slate-100" />
                  <div className="h-4 w-1/2 rounded-full bg-slate-100" />
                  <div className="h-10 rounded-xl bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {!loading && filteredExchanges.length === 0 ? (
          <div className="rounded-[28px] border border-slate-100 bg-white px-5 py-10 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-300">
              <Ticket size={28} />
            </div>
            <h3 className="mt-4 text-lg font-bold text-slate-900">暂无兑换记录</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              当前筛选下还没有可展示的兑换记录。稍后可再次进入，或下拉重试刷新数据。
            </p>
            <button
              onClick={() => {
                loadExchanges().catch(() => undefined);
              }}
              className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-bold text-white active:scale-95 transition-transform"
            >
              <RefreshCw size={15} />
              重新加载
            </button>
          </div>
        ) : null}

        {filteredExchanges.map((exchange) => (
          <div 
            key={exchange.id}
            onClick={() => exchange.status === '待核销' && setSelectedExchange(exchange)}
            className={`group flex w-full flex-col text-left ${
              exchange.status === '待核销' ? 'active:scale-[0.985] transition-transform cursor-pointer' : 'opacity-80'
            }`}
          >
            <div
              className={`relative aspect-[16/9] overflow-hidden rounded-[26px] shadow-sm shadow-slate-200/60 ${
                exchange.status === '待核销' ? 'bg-slate-950' : 'bg-slate-700'
              }`}
            >
              {exchange.image ? (
                <img src={exchange.image} alt={exchange.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div
                  className={`h-full w-full bg-gradient-to-br ${
                    exchange.status === '待核销'
                      ? 'from-sky-500 via-indigo-500 to-violet-300'
                      : 'from-slate-500 via-slate-600 to-slate-400'
                  }`}
                />
              )}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.30),transparent_34%),linear-gradient(to_top,rgba(15,23,42,0.7),rgba(15,23,42,0.14),transparent)]" />
              {!exchange.image ? (
                <div className="absolute -right-3 bottom-0 text-white/15">
                  <Ticket size={138} strokeWidth={1.2} />
                </div>
              ) : null}
              <div className="absolute inset-x-0 top-0 flex items-start justify-between px-3 pt-3 text-white">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur ring-1 ${
                    exchange.status === '待核销'
                      ? 'bg-amber-500/18 text-amber-50 ring-amber-200/35'
                      : exchange.status === '已完成'
                        ? 'bg-emerald-500/18 text-emerald-50 ring-emerald-200/35'
                        : 'bg-white/12 text-white ring-white/20'
                  }`}
                >
                  {exchange.status}
                </span>
                <span className="text-[13px] font-semibold">
                  {exchange.points > 0 ? `${exchange.points}积分` : '兑换记录'}
                </span>
              </div>
              <div className="absolute inset-x-0 bottom-0 px-3 pb-3 text-white">
                <span className="text-[13px] font-medium">{exchange.date || '兑换记录'}</span>
              </div>
            </div>

            <div className="px-1 pb-1 pt-3">
              <h3
                className={`line-clamp-2 text-[20px] font-semibold leading-7 ${
                  exchange.status === '待核销' ? 'text-slate-900' : 'text-slate-700'
                }`}
              >
                {exchange.name}
              </h3>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">
                {exchange.status === '已完成'
                  ? `已于 ${exchange.completedDate || exchange.date || '--'} 完成核销`
                  : exchange.status === '已过期'
                    ? '该兑换已过期，可在积分商城重新兑换其他商品'
                    : `订单状态：${exchange.orderStatus || '待核销'}`}
              </p>

              {exchange.status === '待核销' ? (
                <div className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-sky-700">
                  去核销
                  <ArrowRight size={16} />
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </main>

      {/* Detail Overlay */}
      <AnimatePresence>
        {selectedExchange && (
          <ExchangeDetail 
            exchange={selectedExchange} 
            onClose={() => {
              setSelectedExchange(null);
              loadExchanges().catch(() => undefined);
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
