import React from 'react';
import { Gamepad2, HelpCircle } from 'lucide-react';

interface Props {
  requireAuth: (action: () => void) => void;
}

export default function PopularGames({ requireAuth }: Props) {
  return (
    <section>
      <div className="flex justify-between items-end mb-3">
        <h2 className="text-lg font-bold">热门游戏</h2>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button 
          onClick={() => requireAuth(() => alert('正在加载幸运大转盘...'))}
          className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex flex-col items-center text-center active:scale-95 transition-transform"
        >
          <div className="w-14 h-14 bg-amber-400 rounded-full flex items-center justify-center text-white mb-3 shadow-md shadow-amber-200">
            <Gamepad2 size={28} />
          </div>
          <h4 className="font-bold text-amber-900 text-sm">幸运大转盘</h4>
          <p className="text-[10px] text-amber-600 mt-1">100%中奖 赢积分</p>
        </button>
        
        <button 
          onClick={() => requireAuth(() => alert('正在加载知识小考场...'))}
          className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 flex flex-col items-center text-center active:scale-95 transition-transform"
        >
          <div className="w-14 h-14 bg-indigo-500 rounded-full flex items-center justify-center text-white mb-3 shadow-md shadow-indigo-200">
            <HelpCircle size={28} />
          </div>
          <h4 className="font-bold text-indigo-900 text-sm">知识小考场</h4>
          <p className="text-[10px] text-indigo-600 mt-1">答对5题 翻倍奖励</p>
        </button>
      </div>
    </section>
  );
}
