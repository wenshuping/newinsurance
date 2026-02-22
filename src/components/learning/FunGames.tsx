import React from 'react';
import { Gamepad2, HelpCircle, Trophy, Star } from 'lucide-react';

export default function FunGames() {
  const games = [
    {
      id: 1,
      title: '风险大作战',
      desc: '识别生活中的潜在风险，保护你的小家',
      category: '风险认知',
      difficulty: 2,
      bestScore: '2500分',
      icon: Gamepad2,
      color: 'bg-orange-500',
      lightColor: 'bg-orange-50',
      textColor: 'text-orange-600'
    },
    {
      id: 2,
      title: '条款连连看',
      desc: '消除晦涩难懂的保险术语，轻松学知识',
      category: '产品理解',
      difficulty: 3,
      bestScore: '通关第5关',
      icon: HelpCircle,
      color: 'bg-indigo-500',
      lightColor: 'bg-indigo-50',
      textColor: 'text-indigo-600'
    }
  ];

  return (
    <div className="p-4 space-y-6">
      <div className="grid gap-4">
        {games.map(game => (
          <div key={game.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col">
            <div className="flex gap-4 mb-4">
              <div className={`w-16 h-16 rounded-2xl ${game.color} flex items-center justify-center text-white shadow-md flex-shrink-0`}>
                <game.icon size={32} />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <h3 className="text-lg font-bold text-slate-900">{game.title}</h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded text-white font-bold ${game.color}`}>
                    {game.category}
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-1">{game.desc}</p>
              </div>
            </div>
            
            <div className={`flex justify-between items-center p-3 rounded-xl ${game.lightColor} mb-4`}>
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-500 mr-1">难度:</span>
                {[...Array(3)].map((_, i) => (
                  <Star key={i} size={14} className={i < game.difficulty ? game.textColor : 'text-slate-300'} fill={i < game.difficulty ? 'currentColor' : 'none'} />
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <Trophy size={14} className={game.textColor} />
                <span className={`text-xs font-bold ${game.textColor}`}>最佳: {game.bestScore}</span>
              </div>
            </div>
            
            <button className={`w-full py-3 rounded-xl font-bold text-sm text-white shadow-sm active:scale-[0.98] transition-transform ${game.color}`}>
              开始游戏
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
