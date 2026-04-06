import React from 'react';
import { NOTICE_COPY } from '../lib/noticeCopy';
import { ACTION_COPY } from '../lib/uiCopy';

interface Props {
  requireAuth: (action: () => void) => void;
}

export default function Activities({ requireAuth }: Props) {
  return (
    <section>
      <div className="flex justify-between items-end mb-3">
        <h2 className="text-lg font-bold">{ACTION_COPY.cHomeOngoingActivitiesTitle}</h2>
        <button className="text-xs text-blue-500 font-medium">{ACTION_COPY.viewAll}</button>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
        <div className="min-w-[260px] h-32 rounded-2xl bg-gradient-to-r from-orange-400 to-amber-300 p-4 relative overflow-hidden flex flex-col justify-center text-white shadow-sm">
          <h3 className="text-lg font-bold z-10">{ACTION_COPY.cHomeSignInEggTitle}</h3>
          <p className="text-sm opacity-90 z-10 mt-1">{ACTION_COPY.cHomeSignInEggDesc}</p>
          <button 
            onClick={() => requireAuth(() => alert(NOTICE_COPY.cSignInSuccess))}
            className="mt-3 bg-white/20 backdrop-blur-md w-fit px-4 py-1.5 rounded-full text-xs font-bold z-10 active:bg-white/30 transition-colors"
          >
            {ACTION_COPY.cActionSignNow}
          </button>
          <div className="absolute -bottom-6 -right-4 text-8xl opacity-20 font-serif">🥚</div>
        </div>
        
        <div className="min-w-[260px] h-32 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-400 p-4 relative overflow-hidden flex flex-col justify-center text-white shadow-sm">
          <h3 className="text-lg font-bold z-10">{ACTION_COPY.cHomeFamilyChallengeTitle}</h3>
          <p className="text-sm opacity-90 z-10 mt-1">{ACTION_COPY.cHomeFamilyChallengeDesc}</p>
          <button 
            onClick={() => requireAuth(() => alert(NOTICE_COPY.cSignUpSuccess))}
            className="mt-3 bg-white/20 backdrop-blur-md w-fit px-4 py-1.5 rounded-full text-xs font-bold z-10 active:bg-white/30 transition-colors"
          >
            {ACTION_COPY.cJoinNow}
          </button>
          <div className="absolute -bottom-6 -right-4 text-8xl opacity-20 font-serif">👨‍👩‍👧</div>
        </div>
      </div>
    </section>
  );
}
