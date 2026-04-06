import React from 'react';
import { UserCircle, Bell } from 'lucide-react';

type Props = {
  customerName?: string | null;
};

export default function Header({ customerName }: Props) {
  const hour = new Date().getHours();
  let greeting = '你好';
  if (hour < 12) greeting = '早上好';
  else if (hour < 18) greeting = '下午好';
  else greeting = '晚上好';
  const displayName = String(customerName || '').trim() || '您';

  return (
    <header className="flex items-center justify-between bg-white px-4 pt-4 pb-2 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100 text-blue-500">
          <UserCircle size={28} />
        </div>
        <div>
          <h1 className="text-lg font-bold leading-7 text-slate-900">{displayName}，{greeting}！</h1>
        </div>
      </div>
      <button className="relative flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
        <Bell size={19} className="text-slate-700" />
        <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-red-500"></span>
      </button>
    </header>
  );
}
