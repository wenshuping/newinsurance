import React from 'react';
import { ShieldCheck, BookOpen, CalendarCheck, Gift } from 'lucide-react';

interface Props {
  requireAuth: (action: () => void) => void;
  onOpenInsurance: () => void;
  onOpenLearning: () => void;
  onSignIn: () => void;
}

export default function CoreFeatures({ requireAuth, onOpenInsurance, onOpenLearning, onSignIn }: Props) {
  const features = [
    { name: '保障管理', icon: ShieldCheck, color: 'text-blue-500', bg: 'bg-blue-50', action: onOpenInsurance },
    { name: '保险课堂', icon: BookOpen, color: 'text-orange-500', bg: 'bg-orange-50', action: onOpenLearning },
    { name: '每日签到', icon: CalendarCheck, color: 'text-green-500', bg: 'bg-green-50', action: () => requireAuth(onSignIn) },
    { name: '分享有礼', icon: Gift, color: 'text-pink-500', bg: 'bg-pink-50' },
  ];

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-600/70">Earn Points</p>
          <h2 className="mt-1 text-lg font-bold text-slate-900">赚取积分</h2>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {features.map((feature, idx) => (
          <button
            key={idx}
            onClick={feature.action}
            className="flex flex-col items-center gap-2 active:scale-95 transition-transform"
          >
            <div className={`w-14 h-14 rounded-2xl ${feature.bg} flex items-center justify-center ${feature.color}`}>
              <feature.icon size={28} />
            </div>
            <span className="text-xs font-medium text-slate-700">{feature.name}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
