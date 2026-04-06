import React from 'react';
import { UserCircle, Bell } from 'lucide-react';
import { ACTION_COPY } from '../lib/uiCopy';

interface HeaderProps {
  userName?: string | null;
}

export default function Header({ userName }: HeaderProps) {
  const displayName = String(userName || '').trim();
  const greeting = displayName ? `${displayName}，您好呀` : '您好呀';

  return (
    <header className="px-4 pt-6 pb-2 flex justify-between items-center bg-white shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-500">
          <UserCircle size={32} />
        </div>
        <div>
          <h1 className="text-xl font-bold">{greeting}</h1>
          <p className="text-slate-500 text-sm">{ACTION_COPY.cHeaderWelcomeHint}</p>
        </div>
      </div>
      <button className="relative w-10 h-10 flex items-center justify-center rounded-full bg-slate-100">
        <Bell size={20} className="text-slate-700" />
        <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
      </button>
    </header>
  );
}
