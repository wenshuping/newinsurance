import React, { useEffect, useState } from 'react';
import { ChevronLeft, Calendar, Ticket, CheckCircle2, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ExchangeDetail from './ExchangeDetail';
import { api } from '../../lib/api';
import { ACTION_COPY } from '../../lib/uiCopy';

interface Props {
  onClose: () => void;
}

export default function MyExchanges({ onClose }: Props) {
  const [activeTab, setActiveTab] = useState('all');
  const [selectedExchange, setSelectedExchange] = useState<any>(null);
  const [exchanges, setExchanges] = useState<any[]>([]);

  const loadExchanges = async () => {
    const res = await api.redemptions();
    setExchanges(
      res.list.map((x: any) => ({
        id: x.id,
        orderNo: `EX${x.id}`,
        name: x.itemName,
        date: (x.createdAt || '').slice(0, 10),
        image: `https://picsum.photos/seed/redeem${x.id}/400/300`,
        points: x.pointsCost,
        status: x.status === 'written_off' ? ACTION_COPY.cTabCompleted : new Date(x.expiresAt).getTime() < Date.now() ? ACTION_COPY.cStatusExpired : ACTION_COPY.cTabPendingWriteoff,
        code: x.writeoffToken,
        qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${x.writeoffToken}`,
        completedDate: x.writtenOffAt ? String(x.writtenOffAt).slice(0, 10) : undefined,
        rawId: x.id,
      }))
    );
  };

  useEffect(() => {
    loadExchanges().catch(() => undefined);
  }, []);

  const filteredExchanges = exchanges.filter(ex => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pending') return ex.status === ACTION_COPY.cTabPendingWriteoff;
    if (activeTab === 'completed') return ex.status === ACTION_COPY.cTabCompleted;
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
        <h1 className="text-lg font-bold">{ACTION_COPY.cMyExchangesTitle}</h1>
        <div className="w-10"></div>
      </header>

      {/* Tabs */}
      <div className="bg-white sticky top-[61px] z-10 flex border-b border-slate-100">
        {[
          { id: 'all', label: ACTION_COPY.cTabAll },
          { id: 'pending', label: ACTION_COPY.cTabPendingWriteoff },
          { id: 'completed', label: ACTION_COPY.cTabCompleted }
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
        {filteredExchanges.map(exchange => (
          <div 
            key={exchange.id}
            onClick={() => exchange.status === ACTION_COPY.cTabPendingWriteoff && setSelectedExchange(exchange)}
            className={`bg-white rounded-2xl p-4 shadow-sm border border-slate-100 ${
              exchange.status === ACTION_COPY.cTabPendingWriteoff ? 'active:scale-[0.98] transition-transform cursor-pointer' : 'opacity-80'
            }`}
          >
            <div className="flex flex-col sm:flex-row gap-4">
              <div className={`w-full sm:w-32 h-32 rounded-xl overflow-hidden shrink-0 bg-slate-50 ${
                exchange.status !== ACTION_COPY.cTabPendingWriteoff ? 'grayscale opacity-80' : ''
              }`}>
                <img src={exchange.image} alt={exchange.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className={`text-lg font-bold leading-tight ${
                      exchange.status !== ACTION_COPY.cTabPendingWriteoff ? 'text-slate-600' : 'text-slate-900'
                    }`}>
                      {exchange.name}
                    </h3>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 ml-2 ${
                      exchange.status === ACTION_COPY.cTabPendingWriteoff ? 'bg-blue-50 text-blue-600' :
                      exchange.status === ACTION_COPY.cTabCompleted ? 'bg-slate-100 text-slate-500' :
                      'bg-slate-100 text-slate-400'
                    }`}>
                      {exchange.status}
                    </span>
                  </div>
                  
                  <div className="flex items-center text-slate-500 text-xs mb-1">
                    <Calendar size={14} className="mr-1.5" />
                    <span>{ACTION_COPY.cExchangeDatePrefix}{exchange.date}</span>
                  </div>
                </div>

                {exchange.status === ACTION_COPY.cTabPendingWriteoff && (
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center text-slate-500 text-xs">
                      <Ticket size={14} className="mr-1.5" />
                      <span>{ACTION_COPY.cCouponCodePrefix}{exchange.code}</span>
                    </div>
                    <button className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md shadow-blue-500/20 flex items-center gap-1">
                      {ACTION_COPY.cWriteoffNow}
                      <ArrowRight size={16} />
                    </button>
                  </div>
                )}

                {exchange.status === ACTION_COPY.cTabCompleted && (
                  <div className="mt-4 flex items-center text-slate-500 text-xs">
                    <CheckCircle2 size={14} className="mr-1.5 text-green-500" />
                    <span>{ACTION_COPY.cCompletedWriteoffPrefix}{exchange.completedDate}{ACTION_COPY.cCompletedWriteoffSuffix}</span>
                  </div>
                )}

                {exchange.status === ACTION_COPY.cStatusExpired && (
                  <div className="mt-4 text-red-400 text-xs font-medium">
                    {ACTION_COPY.cExpiredHint}
                  </div>
                )}
              </div>
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
