import React from 'react';
import { MessageCircleMore } from 'lucide-react';

interface Props {
  avatarUrl: string;
  onOpen: () => void;
}

export default function FloatingAdvisorButton({ avatarUrl, onOpen }: Props) {
  return (
    <div className="fixed bottom-24 right-4 z-[10065] flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={onOpen}
        aria-label="打开专属顾问页面"
        className="inline-flex h-16 w-16 items-center justify-center rounded-full border border-sky-100 bg-white p-1.5 shadow-[0_16px_36px_rgba(15,23,42,0.16)] transition-transform active:scale-95"
      >
        <div className="relative h-full w-full overflow-hidden rounded-full bg-sky-50">
          <img src={avatarUrl} alt="专属顾问头像" className="h-full w-full object-cover" />
          <span className="absolute -bottom-0.5 -right-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-[#0ea5e9] text-white shadow-sm">
            <MessageCircleMore size={13} />
          </span>
        </div>
      </button>
      <span className="rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-sm">
        您的顾问
      </span>
    </div>
  );
}
