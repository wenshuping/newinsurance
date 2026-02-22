import React, { useEffect, useState } from 'react';
import { HelpCircle, ShoppingBag, CheckCircle2, BookOpen, Share2, Shield, Users } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import ActivityDetail from '../components/activities/ActivityDetail';
import { api } from '../lib/api';

interface Props {
  requireAuth: (action: () => void) => void;
  onOpenMall: () => void;
}

export default function Activities({ requireAuth, onOpenMall }: Props) {
  const [points, setPoints] = useState(0);
  const [tasksCompleted, setTasksCompleted] = useState(2);
  const [selectedActivity, setSelectedActivity] = useState<any>(null);

  useEffect(() => {
    api.pointsSummary()
      .then((res) => setPoints(res.balance))
      .catch(() => undefined);
  }, []);

  const handleActivityClick = (activity: any) => {
    setSelectedActivity(activity);
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md px-4 py-4 flex items-center justify-between border-b border-slate-100">
        <div className="w-10"></div>
        <h1 className="text-xl font-bold tracking-tight">活动中心</h1>
        <button className="w-10 h-10 flex items-center justify-center text-slate-700">
          <HelpCircle size={24} />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto">
        {/* Top Activity Banner */}
        <section className="p-4">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 p-6 text-white shadow-lg">
            <div className="relative z-10">
              <span className="inline-block px-3 py-1 bg-white/20 rounded-full text-xs font-bold uppercase tracking-wider mb-2">限时福利</span>
              <h2 className="text-2xl font-bold leading-tight mb-2">连续签到7天<br/>领30枚新鲜鸡蛋</h2>
              <p className="text-white/90 text-sm mb-4 font-medium italic">健康生活，好礼相送</p>
              
              <div className="flex items-center gap-2 mb-6">
                <span className="text-sm font-medium">距离结束还剩:</span>
                <div className="flex gap-1">
                  <span className="bg-white/20 px-2 py-1 rounded font-bold">23</span>
                  <span>:</span>
                  <span className="bg-white/20 px-2 py-1 rounded font-bold">59</span>
                  <span>:</span>
                  <span className="bg-white/20 px-2 py-1 rounded font-bold">45</span>
                </div>
              </div>
              
              <button 
                onClick={() =>
                  requireAuth(async () => {
                    try {
                      const res = await api.signIn();
                      setPoints(res.balance);
                      alert(`签到成功，获得${res.reward}积分！`);
                    } catch (e: any) {
                      alert(e?.message || '签到失败');
                    }
                  })
                }
                className="w-full bg-white text-red-500 py-3.5 rounded-xl font-bold text-lg shadow-md active:scale-95 transition-transform"
              >
                立即签到领奖
              </button>
            </div>
            
            {/* Decorative background elements */}
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
            <div className="absolute top-4 right-4 text-8xl opacity-20 font-serif">🥚</div>
          </div>
        </section>

        {/* Task & Points Section */}
        <section className="px-4 py-2">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-slate-500 text-sm font-medium mb-1">我的积分</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-blue-500">{points}</span>
                  <span className="text-xs text-slate-400 font-bold">分</span>
                </div>
              </div>
              <button 
                onClick={onOpenMall}
                className="flex items-center gap-2 bg-blue-500 text-white px-5 py-2.5 rounded-full font-bold shadow-md shadow-blue-500/20 active:scale-95 transition-all"
              >
                <ShoppingBag size={18} />
                <span>积分商城</span>
              </button>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-base font-bold">今日任务进度</span>
                <span className="text-sm font-bold text-blue-500">{tasksCompleted}/5 已完成</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div 
                  className="bg-blue-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${(tasksCompleted / 5) * 100}%` }}
                ></div>
              </div>
            </div>

            {/* Task List */}
            <div className="mt-6 space-y-3">
              {/* Task 1 */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-sm">每日签到</p>
                    <p className="text-[10px] text-slate-500">+10 积分</p>
                  </div>
                </div>
                <span className="text-slate-400 text-xs font-medium">已完成</span>
              </div>
              
              {/* Task 2 */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                    <BookOpen size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-sm">阅读1篇文章</p>
                    <p className="text-[10px] text-slate-500">+20 积分</p>
                  </div>
                </div>
                <button 
                  onClick={() => requireAuth(() => {
                    setTasksCompleted(prev => Math.min(prev + 1, 5));
                    setPoints(prev => prev + 20);
                    alert('任务完成，获得20积分！');
                  })}
                  className="bg-blue-500 text-white px-4 py-1.5 rounded-lg text-xs font-bold active:scale-95 transition-transform"
                >
                  去完成
                </button>
              </div>
              
              {/* Task 3 */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                    <Share2 size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-sm">分享给好友</p>
                    <p className="text-[10px] text-slate-500">+50 积分</p>
                  </div>
                </div>
                <button 
                  onClick={() => requireAuth(() => alert('请选择分享渠道'))}
                  className="bg-blue-500 text-white px-4 py-1.5 rounded-lg text-xs font-bold active:scale-95 transition-transform"
                >
                  去完成
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Activity List */}
        <section className="px-4 py-6">
          <h3 className="text-lg font-bold mb-4">热门活动</h3>
          <div className="grid grid-cols-1 gap-4">
            
            {/* Category: Competition */}
            <div 
              onClick={() => handleActivityClick({ title: '保险知识王者赛', image: 'https://picsum.photos/seed/comp/800/450' })}
              className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 flex h-32 cursor-pointer active:scale-[0.98] transition-transform"
            >
              <div className="w-32 bg-slate-800 relative flex items-center justify-center">
                <img src="https://picsum.photos/seed/comp/200/200" alt="Competition" className="absolute inset-0 w-full h-full object-cover opacity-50" referrerPolicy="no-referrer" />
                <span className="relative z-10 text-4xl">👑</span>
              </div>
              <div className="flex-1 p-4 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded uppercase">智力竞赛</span>
                  <h4 className="font-bold text-sm mt-1">保险知识王者赛</h4>
                  <p className="text-[10px] text-slate-500 mt-1">10,230人正在参与中</p>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex -space-x-2">
                    <div className="w-6 h-6 rounded-full border-2 border-white bg-slate-200"></div>
                    <div className="w-6 h-6 rounded-full border-2 border-white bg-slate-300"></div>
                    <div className="w-6 h-6 rounded-full border-2 border-white bg-slate-400"></div>
                  </div>
                  <button className="text-blue-500 text-xs font-bold">参与排行榜 &gt;</button>
                </div>
              </div>
            </div>

            {/* Category: Task */}
            <div 
              onClick={() => handleActivityClick({ title: '完善保障信息', image: 'https://picsum.photos/seed/shield/800/450' })}
              className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 flex h-32 cursor-pointer active:scale-[0.98] transition-transform"
            >
              <div className="w-32 bg-blue-50 flex items-center justify-center">
                <Shield className="text-blue-500" size={40} />
              </div>
              <div className="flex-1 p-4 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded uppercase">资料完善</span>
                  <h4 className="font-bold text-sm mt-1">完善保障信息</h4>
                  <p className="text-[10px] text-slate-500 mt-1">最高可领100积分</p>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    requireAuth(() => alert('正在跳转完善信息页面...'));
                  }}
                  className="bg-slate-900 text-white py-1.5 rounded-lg text-xs font-bold w-full active:scale-95 transition-transform"
                >
                  立即完善
                </button>
              </div>
            </div>

            {/* Category: Invitation */}
            <div 
              onClick={() => handleActivityClick({ title: '推荐好友加入', image: 'https://picsum.photos/seed/invite/800/450' })}
              className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 flex h-32 cursor-pointer active:scale-[0.98] transition-transform"
            >
              <div className="w-32 bg-green-50 flex items-center justify-center relative">
                <img src="https://picsum.photos/seed/invite/200/200" alt="Invite" className="absolute inset-0 w-full h-full object-cover opacity-50" referrerPolicy="no-referrer" />
                <Users className="text-green-600 relative z-10" size={40} />
              </div>
              <div className="flex-1 p-4 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded uppercase">有奖推荐</span>
                  <h4 className="font-bold text-sm mt-1">推荐好友加入</h4>
                  <p className="text-[10px] text-slate-500 mt-1">每成功邀请一位得500积分</p>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    requireAuth(() => alert('正在生成专属邀请海报...'));
                  }}
                  className="bg-blue-500 text-white py-1.5 rounded-lg text-xs font-bold w-full active:scale-95 transition-transform"
                >
                  立即邀请
                </button>
              </div>
            </div>

          </div>
        </section>
      </main>

      {/* Activity Detail Overlay */}
      <AnimatePresence>
        {selectedActivity && (
          <ActivityDetail 
            activity={selectedActivity} 
            onClose={() => setSelectedActivity(null)} 
            requireAuth={requireAuth}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
