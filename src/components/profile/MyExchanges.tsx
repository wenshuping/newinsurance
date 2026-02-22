import React, { useState } from 'react';
import { ChevronLeft, Calendar, Ticket, CheckCircle2, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ExchangeDetail from './ExchangeDetail';

interface Props {
  onClose: () => void;
}

export default function MyExchanges({ onClose }: Props) {
  const [activeTab, setActiveTab] = useState('all');
  const [selectedExchange, setSelectedExchange] = useState<any>(null);

  const exchanges = [
    {
      id: 'EX123456789',
      name: '美的智能电饭煲',
      date: '2023-10-25',
      image: 'https://picsum.photos/seed/cooker/400/300',
      points: 1000,
      status: '待核销',
      code: '8829 4012',
      qrCode: 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=EX123456789'
    },
    {
      id: 'EX987654321',
      name: '东北五常大米 5kg',
      date: '2023-10-10',
      image: 'https://picsum.photos/seed/rice2/400/300',
      points: 500,
      status: '已完成',
      completedDate: '2023-10-12'
    },
    {
      id: 'EX456789123',
      name: '年度基础体检套餐',
      date: '2023-08-15',
      image: 'https://picsum.photos/seed/health2/400/300',
      points: 3000,
      status: '已过期'
    }
  ];

  const filteredExchanges = exchanges.filter(ex => {
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
        {filteredExchanges.map(exchange => (
          <div 
            key={exchange.id}
            onClick={() => exchange.status === '待核销' && setSelectedExchange(exchange)}
            className={`bg-white rounded-2xl p-4 shadow-sm border border-slate-100 ${
              exchange.status === '待核销' ? 'active:scale-[0.98] transition-transform cursor-pointer' : 'opacity-80'
            }`}
          >
            <div className="flex flex-col sm:flex-row gap-4">
              <div className={`w-full sm:w-32 h-32 rounded-xl overflow-hidden shrink-0 bg-slate-50 ${
                exchange.status !== '待核销' ? 'grayscale opacity-80' : ''
              }`}>
                <img src={exchange.image} alt={exchange.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className={`text-lg font-bold leading-tight ${
                      exchange.status !== '待核销' ? 'text-slate-600' : 'text-slate-900'
                    }`}>
                      {exchange.name}
                    </h3>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 ml-2 ${
                      exchange.status === '待核销' ? 'bg-blue-50 text-blue-600' :
                      exchange.status === '已完成' ? 'bg-slate-100 text-slate-500' :
                      'bg-slate-100 text-slate-400'
                    }`}>
                      {exchange.status}
                    </span>
                  </div>
                  
                  <div className="flex items-center text-slate-500 text-xs mb-1">
                    <Calendar size={14} className="mr-1.5" />
                    <span>兑换日期：{exchange.date}</span>
                  </div>
                </div>

                {exchange.status === '待核销' && (
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center text-slate-500 text-xs">
                      <Ticket size={14} className="mr-1.5" />
                      <span>券码：{exchange.code}</span>
                    </div>
                    <button className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md shadow-blue-500/20 flex items-center gap-1">
                      去核销
                      <ArrowRight size={16} />
                    </button>
                  </div>
                )}

                {exchange.status === '已完成' && (
                  <div className="mt-4 flex items-center text-slate-500 text-xs">
                    <CheckCircle2 size={14} className="mr-1.5 text-green-500" />
                    <span>已于 {exchange.completedDate} 完成核销</span>
                  </div>
                )}

                {exchange.status === '已过期' && (
                  <div className="mt-4 text-red-400 text-xs font-medium">
                    有效期已过
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
            onClose={() => setSelectedExchange(null)} 
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
