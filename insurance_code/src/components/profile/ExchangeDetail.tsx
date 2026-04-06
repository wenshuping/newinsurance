import React, { useState } from 'react';
import { ChevronLeft, QrCode, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../../lib/api';
import { ERROR_COPY } from '../../lib/errorCopy';
import { NOTICE_COPY } from '../../lib/noticeCopy';
import { ACTION_COPY } from '../../lib/uiCopy';

interface Props {
  exchange: any;
  onClose: () => void;
}

export default function ExchangeDetail({ exchange, onClose }: Props) {
  const [showQR, setShowQR] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
        <h1 className="text-lg font-bold">{ACTION_COPY.cExchangeDetailTitle}</h1>
        <div className="w-10"></div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
        {/* Product Info */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="aspect-square w-full max-w-[200px] mx-auto mb-6 rounded-xl overflow-hidden bg-slate-50">
            <img src={exchange.image} alt={exchange.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
          <h2 className="text-2xl font-bold text-center mb-2">{exchange.name}</h2>
          <div className="flex justify-center items-center gap-2 text-orange-500 font-bold text-lg mb-6">
            <span>{exchange.points}{ACTION_COPY.cExchangePointSuffix}</span>
          </div>
          
          <div className="space-y-3 border-t border-slate-100 pt-4">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">{ACTION_COPY.cExchangeOrderNo}</span>
              <span className="font-medium">{exchange.id}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">{ACTION_COPY.cExchangeTime}</span>
              <span className="font-medium">{exchange.date}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">{ACTION_COPY.cExchangeStatus}</span>
              <span className="font-bold text-orange-500">{exchange.status}</span>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <h3 className="font-bold text-base mb-3">{ACTION_COPY.cExchangeUsageTitle}</h3>
          <ul className="space-y-2 text-sm text-slate-600 list-disc list-inside">
            <li>{ACTION_COPY.cExchangeRule1}</li>
            <li>{ACTION_COPY.cExchangeRule2}</li>
            <li>{ACTION_COPY.cExchangeRule3}</li>
            <li>{ACTION_COPY.cExchangeRule4}</li>
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
          {ACTION_COPY.cExchangeShowWriteoffCode}
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
              <h3 className="text-xl font-bold mb-2">{ACTION_COPY.cExchangeShowToClerk}</h3>
              <p className="text-sm text-slate-500 mb-6">{ACTION_COPY.cExchangeDontShareCode}</p>
              
              <div className="w-48 h-48 bg-slate-50 rounded-xl p-2 border-2 border-slate-100 mb-6">
                <img src={exchange.qrCode} alt="QR Code" className="w-full h-full" referrerPolicy="no-referrer" />
              </div>
              
              <p className="text-xs text-slate-400 font-mono tracking-widest">{exchange.orderNo || exchange.id}</p>
              
              <button 
                onClick={() => {
                  setSubmitting(true);
                  api.writeoff(exchange.rawId || exchange.id, exchange.code)
                    .then(() => {
                      setShowQR(false);
                      alert(NOTICE_COPY.cWriteoffSuccess);
                      onClose();
                    })
                    .catch((e: any) => {
                      alert(e?.message || ERROR_COPY.writeoffFailed);
                    })
                    .finally(() => setSubmitting(false));
                }}
                className="mt-8 w-full bg-slate-100 text-slate-700 font-bold py-3 rounded-xl active:bg-slate-200 transition-colors disabled:opacity-50"
                disabled={submitting}
              >
                {submitting ? ACTION_COPY.cExchangeWritingOff : ACTION_COPY.cExchangeConfirmWriteoff}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
