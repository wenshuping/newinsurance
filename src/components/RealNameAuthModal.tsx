import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ShieldCheck, Loader2 } from 'lucide-react';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export default function RealNameAuthModal({ onClose, onSuccess }: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSendCode = () => {
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setError('请输入正确的手机号码');
      return;
    }
    setError('');
    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      setCountdown(60);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) clearInterval(timer);
          return prev - 1;
        });
      }, 1000);
    }, 1000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // 直接当做认证成功，进行下一步操作
    onSuccess();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div 
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 pb-safe shadow-2xl"
        >
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <ShieldCheck className="text-blue-500" size={24} />
              <h2 className="text-xl font-bold">实名认证</h2>
            </div>
            <button onClick={onClose} className="p-2 -mr-2 text-slate-400 hover:bg-slate-100 rounded-full">
              <X size={20} />
            </button>
          </div>
          
          <p className="text-sm text-slate-500 mb-6">
            为了保障您的权益，参与活动及兑换奖品前需完成实名认证。
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">真实姓名</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="请输入您的真实姓名"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">手机号码</label>
              <input 
                type="tel" 
                maxLength={11}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                placeholder="请输入您的手机号码"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">验证码</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="请输入验证码"
                  className="flex-1 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                />
                <button 
                  type="button"
                  onClick={handleSendCode}
                  disabled={countdown > 0 || isSending || phone.length !== 11}
                  className="px-4 py-3 rounded-xl bg-blue-50 text-blue-600 font-medium text-sm whitespace-nowrap disabled:opacity-50 disabled:bg-slate-50 disabled:text-slate-400 min-w-[110px]"
                >
                  {isSending ? <Loader2 size={18} className="animate-spin mx-auto" /> : countdown > 0 ? `${countdown}s 后重试` : '获取验证码'}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-red-500 text-sm">{error}</p>
            )}

            <button 
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-6 bg-blue-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-500/30 active:scale-[0.98] transition-all flex justify-center items-center"
            >
              {isSubmitting ? <Loader2 className="animate-spin" /> : '提交认证'}
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
