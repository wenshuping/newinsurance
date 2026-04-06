import React from 'react';
import { Gamepad2, HelpCircle } from 'lucide-react';
import { NOTICE_COPY } from '../lib/noticeCopy';
import { ACTION_COPY } from '../lib/uiCopy';

interface Props {
  requireAuth: (action: () => void) => void;
}

export default function PopularGames({ requireAuth }: Props) {
  return (
    <section>
      <div className="flex justify-between items-end mb-3">
        <h2 className="text-lg font-bold">{ACTION_COPY.cPopularGamesTitle}</h2>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button 
          onClick={() => requireAuth(() => alert(NOTICE_COPY.cLoadingLuckyWheel))}
          className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex flex-col items-center text-center active:scale-95 transition-transform"
        >
          <div className="w-14 h-14 bg-amber-400 rounded-full flex items-center justify-center text-white mb-3 shadow-md shadow-amber-200">
            <Gamepad2 size={28} />
          </div>
          <h4 className="font-bold text-amber-900 text-sm">{ACTION_COPY.cPopularGameLuckyWheelTitle}</h4>
          <p className="text-[10px] text-amber-600 mt-1">{ACTION_COPY.cPopularGameLuckyWheelDesc}</p>
        </button>
        
        <button 
          onClick={() => requireAuth(() => alert(NOTICE_COPY.cLoadingQuiz))}
          className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 flex flex-col items-center text-center active:scale-95 transition-transform"
        >
          <div className="w-14 h-14 bg-indigo-500 rounded-full flex items-center justify-center text-white mb-3 shadow-md shadow-indigo-200">
            <HelpCircle size={28} />
          </div>
          <h4 className="font-bold text-indigo-900 text-sm">{ACTION_COPY.cPopularGameQuizTitle}</h4>
          <p className="text-[10px] text-indigo-600 mt-1">{ACTION_COPY.cPopularGameQuizDesc}</p>
        </button>
      </div>
    </section>
  );
}
