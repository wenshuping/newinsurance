import React from 'react';
import { Headset, ShieldAlert } from 'lucide-react';

interface Props {
  onOpen: () => void;
}

export default function AdvisorCard({ onOpen }: Props) {
  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center justify-between rounded-[22px] border border-blue-50 bg-white p-3 shadow-sm text-left transition-transform active:scale-[0.99]"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-blue-100 bg-blue-50 text-blue-500">
          <Headset size={20} />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-bold leading-6 text-slate-900">顾问服务</h3>
          <p className="mt-0.5 text-xs leading-5 text-slate-500 sm:text-sm">查看专属顾问简介与联系方式</p>
        </div>
      </div>
      <span className="ml-3 inline-flex h-10 shrink-0 items-center gap-1 rounded-full bg-blue-500 px-3.5 text-xs font-bold whitespace-nowrap text-white shadow-md shadow-blue-200 sm:px-4 sm:text-sm">
        <ShieldAlert size={15} />
        查看顾问
      </span>
    </button>
  );
}
