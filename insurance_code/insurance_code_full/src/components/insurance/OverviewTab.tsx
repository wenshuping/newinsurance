import React, { useEffect, useState } from 'react';
import { CalendarClock, Gift, FileCheck } from 'lucide-react';
import { api } from '../../lib/api';

const reminderMeta: Record<string, { icon: any; wrapClass: string; actionClass: string; tagClass: string }> = {
  renewal: {
    icon: CalendarClock,
    wrapClass: 'bg-orange-50 text-orange-500',
    actionClass: 'bg-blue-500 text-white',
    tagClass: 'text-orange-500 bg-orange-50',
  },
  birthday: {
    icon: Gift,
    wrapClass: 'bg-pink-50 text-pink-500',
    actionClass: 'bg-blue-50 text-blue-500',
    tagClass: 'text-slate-400',
  },
  report: {
    icon: FileCheck,
    wrapClass: 'bg-blue-50 text-blue-500',
    actionClass: 'text-slate-400 border border-slate-200',
    tagClass: 'text-slate-400',
  },
};

export default function OverviewTab({ refreshKey = 0 }: { refreshKey?: number }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    api
      .insuranceOverview()
      .then((resp) => {
        if (!mounted) return;
        setData(resp);
      })
      .catch((err) => {
        console.error(err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [refreshKey]);

  if (loading) return <div className="p-4 text-sm text-slate-500">保障数据加载中...</div>;
  if (!data) return <div className="p-4 text-sm text-slate-500">暂无保障数据</div>;

  const { reminders } = data;

  return (
    <div className="p-4 space-y-6">
      <section>
        <div className="space-y-3">
          {(reminders || []).map((item: any) => {
            const meta = reminderMeta[item.kind] || reminderMeta.report;
            const Icon = meta.icon;
            const lowEmphasis = item.kind === 'report';
            return (
              <div
                key={item.id}
                className={`bg-white p-4 rounded-2xl flex items-center gap-4 border border-slate-100 shadow-sm ${lowEmphasis ? 'opacity-70' : ''}`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${meta.wrapClass}`}>
                  <Icon size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <h4 className="font-bold text-sm truncate">{item.title}</h4>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${meta.tagClass}`}>{item.tag}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{item.desc}</p>
                </div>
                <button className={`text-xs font-bold px-3 py-2 rounded-lg shrink-0 ${meta.actionClass}`}>{item.actionText}</button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
