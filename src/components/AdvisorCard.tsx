import React from 'react';
import { Headset } from 'lucide-react';
import { ACTION_COPY } from '../lib/uiCopy';

export default function AdvisorCard() {
  const serviceDays = 324;

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-blue-50 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <img 
          src="https://picsum.photos/seed/advisor/100/100" 
          alt="Advisor" 
          className="w-14 h-14 rounded-full border-2 border-blue-100 object-cover"
          referrerPolicy="no-referrer"
        />
        <div>
          <h3 className="font-bold text-lg">{ACTION_COPY.cAdvisorTitle}</h3>
          <p className="text-sm text-slate-500 mt-0.5">{ACTION_COPY.cAdvisorServiceDaysPrefix}{serviceDays}{ACTION_COPY.cAdvisorServiceDaysSuffix}</p>
        </div>
      </div>
      <button className="bg-blue-500 text-white px-4 py-2.5 rounded-full text-sm font-bold flex items-center gap-1.5 shadow-md shadow-blue-200 active:scale-95 transition-transform">
        <Headset size={18} />
        {ACTION_COPY.cAdvisorContact}
      </button>
    </div>
  );
}
