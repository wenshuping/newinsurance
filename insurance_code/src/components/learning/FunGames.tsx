import React from 'react';
import { Gamepad2, HelpCircle, Trophy, Star } from 'lucide-react';
import { ACTION_COPY } from '../../lib/uiCopy';

export default function FunGames() {
  const games = [
    {
      id: 1,
      title: ACTION_COPY.cDemoGame1Title,
      desc: ACTION_COPY.cDemoGame1Desc,
      category: ACTION_COPY.cDemoGame1Category,
      difficulty: 2,
      bestScore: ACTION_COPY.cDemoGame1BestScore,
      icon: Gamepad2,
      color: 'bg-orange-500',
      lightColor: 'bg-orange-50',
      textColor: 'text-orange-600'
    },
    {
      id: 2,
      title: ACTION_COPY.cDemoGame2Title,
      desc: ACTION_COPY.cDemoGame2Desc,
      category: ACTION_COPY.cDemoGame2Category,
      difficulty: 3,
      bestScore: ACTION_COPY.cDemoGame2BestScore,
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
                <span className="text-xs text-slate-500 mr-1">{ACTION_COPY.cFunGameDifficulty}</span>
                {[...Array(3)].map((_, i) => (
                  <Star key={i} size={14} className={i < game.difficulty ? game.textColor : 'text-slate-300'} fill={i < game.difficulty ? 'currentColor' : 'none'} />
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <Trophy size={14} className={game.textColor} />
                <span className={`text-xs font-bold ${game.textColor}`}>{ACTION_COPY.cFunGameBestPrefix}{game.bestScore}</span>
              </div>
            </div>
            
            <button className={`w-full py-3 rounded-xl font-bold text-sm text-white shadow-sm active:scale-[0.98] transition-transform ${game.color}`}>
              {ACTION_COPY.cFunGameStart}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
