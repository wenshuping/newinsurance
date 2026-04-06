import React from 'react';
import { ShieldCheck, BookOpen, CalendarCheck, Gift } from 'lucide-react';
import { NOTICE_COPY } from '../lib/noticeCopy';
import { ACTION_COPY } from '../lib/uiCopy';

interface Props {
  requireAuth: (action: () => void) => void;
}

export default function CoreFeatures({ requireAuth }: Props) {
  const features = [
    { name: ACTION_COPY.cFeatureInsurance, icon: ShieldCheck, color: 'text-blue-500', bg: 'bg-blue-50' },
    { name: ACTION_COPY.cFeatureClass, icon: BookOpen, color: 'text-orange-500', bg: 'bg-orange-50' },
    { name: ACTION_COPY.cFeatureSignIn, icon: CalendarCheck, color: 'text-green-500', bg: 'bg-green-50', action: () => requireAuth(() => alert(NOTICE_COPY.cSignInSuccess)) },
    { name: ACTION_COPY.cFeatureShare, icon: Gift, color: 'text-pink-500', bg: 'bg-pink-50' },
  ];

  return (
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
  );
}
