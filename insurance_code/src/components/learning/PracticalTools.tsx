import React from 'react';
import { Calculator, ShieldAlert, FileSearch, ArrowRight } from 'lucide-react';
import { ACTION_COPY } from '../../lib/uiCopy';

export default function PracticalTools() {
  const tools = [
    {
      id: 1,
      title: ACTION_COPY.cToolPensionCalc,
      desc: ACTION_COPY.cToolPensionCalcDesc,
      icon: Calculator,
      color: 'text-emerald-500',
      bg: 'bg-emerald-50'
    },
    {
      id: 2,
      title: ACTION_COPY.cToolCoverageGap,
      desc: ACTION_COPY.cToolCoverageGapDesc,
      icon: ShieldAlert,
      color: 'text-blue-500',
      bg: 'bg-blue-50'
    },
    {
      id: 3,
      title: ACTION_COPY.cToolClaimProgress,
      desc: ACTION_COPY.cToolClaimProgressDesc,
      icon: FileSearch,
      color: 'text-purple-500',
      bg: 'bg-purple-50'
    }
  ];

  return (
    <div className="p-4 space-y-4">
      {tools.map(tool => (
        <button 
          key={tool.id} 
          className="w-full bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-center gap-4 active:scale-[0.98] transition-transform text-left"
        >
          <div className={`w-14 h-14 rounded-full ${tool.bg} flex items-center justify-center flex-shrink-0`}>
            <tool.icon size={28} className={tool.color} />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-slate-900 mb-1">{tool.title}</h3>
            <p className="text-sm text-slate-500">{tool.desc}</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 flex-shrink-0">
            <ArrowRight size={18} />
          </div>
        </button>
      ))}
    </div>
  );
}
