import React from 'react';
import { Shield, HeartPulse, Stethoscope } from 'lucide-react';

interface Props {
  onSelectPolicy: (policy: any) => void;
}

export default function PolicyListTab({ onSelectPolicy }: Props) {
  const policies = [
    {
      id: 1,
      company: '平安健康保险股份有限公司',
      name: '尊享e生2024',
      type: '医疗',
      icon: Stethoscope,
      amount: '300.00万',
      nextPayment: '2025-01-01',
      status: '保障中',
      color: 'text-blue-500',
      bg: 'bg-blue-50'
    },
    {
      id: 2,
      company: '中国人寿保险',
      name: '国寿福重疾险',
      type: '重疾',
      icon: HeartPulse,
      amount: '50.00万',
      nextPayment: '2024-08-15',
      status: '保障中',
      color: 'text-red-500',
      bg: 'bg-red-50'
    },
    {
      id: 3,
      company: '太平洋保险',
      name: '太保意外伤害险',
      type: '意外',
      icon: Shield,
      amount: '100.00万',
      nextPayment: '2024-11-20',
      status: '保障中',
      color: 'text-orange-500',
      bg: 'bg-orange-50'
    }
  ];

  return (
    <div className="p-4 space-y-4">
      {policies.map(policy => (
        <div 
          key={policy.id} 
          onClick={() => onSelectPolicy(policy)}
          className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 active:scale-[0.98] transition-transform cursor-pointer"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full ${policy.bg} flex items-center justify-center ${policy.color}`}>
                <policy.icon size={24} />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-900">{policy.name}</h3>
                <p className="text-xs text-slate-500">{policy.company}</p>
              </div>
            </div>
            <span className="px-2 py-1 bg-green-50 text-green-600 text-[10px] font-bold rounded">
              {policy.status}
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
            <div>
              <p className="text-xs text-slate-400 mb-1">保障额度</p>
              <p className="font-bold text-slate-900">{policy.amount}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">下次缴费日</p>
              <p className="font-bold text-slate-900">{policy.nextPayment}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
