import React from 'react';
import { PlusCircle, Stethoscope, ShieldAlert, Car, Baby, GraduationCap, CalendarClock, Gift, FileCheck } from 'lucide-react';

export default function OverviewTab() {
  return (
    <div className="p-4 space-y-6">
      {/* Global Summary Card */}
      <div className="bg-blue-500 rounded-2xl p-6 text-white shadow-lg shadow-blue-500/20 relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full"></div>
        <div className="flex justify-between items-start relative z-10">
          <div>
            <p className="text-white/80 text-sm font-medium">总保障额度 (元)</p>
            <h2 className="text-3xl font-extrabold mt-1 tracking-tight">2,500,000</h2>
          </div>
          <div className="relative flex items-center justify-center w-16 h-16">
            <svg className="w-full h-full transform -rotate-90">
              <circle className="text-white/20" cx="32" cy="32" fill="transparent" r="28" stroke="currentColor" strokeWidth="4"></circle>
              <circle className="text-white" cx="32" cy="32" fill="transparent" r="28" stroke="currentColor" strokeDasharray="175" strokeDashoffset="26" strokeLinecap="round" strokeWidth="4"></circle>
            </svg>
            <span className="absolute text-xs font-bold">85%</span>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/20 pt-4 relative z-10">
          <div>
            <p className="text-white/70 text-xs">有效保单</p>
            <p className="text-lg font-bold">12份</p>
          </div>
          <div>
            <p className="text-white/70 text-xs">年度总保费</p>
            <p className="text-lg font-bold">¥18,420</p>
          </div>
        </div>
      </div>

      {/* Family Members */}
      <section>
        <div className="flex justify-between items-end mb-4">
          <h3 className="text-lg font-bold">家庭成员保障</h3>
          <button className="text-blue-500 text-sm font-medium flex items-center gap-1">
            添加成员 <PlusCircle size={16} />
          </button>
        </div>
        <div className="flex overflow-x-auto gap-4 pb-2 scrollbar-hide -mx-4 px-4">
          {/* Member 1 */}
          <div className="min-w-[140px] bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center">
            <div className="relative">
              <img src="https://picsum.photos/seed/self/100/100" alt="本人" className="w-14 h-14 rounded-full bg-blue-50 object-cover" referrerPolicy="no-referrer" />
              <div className="absolute -bottom-1 -right-2 bg-green-500 text-white text-[10px] px-1.5 py-0.5 rounded-full border-2 border-white">85分</div>
            </div>
            <p className="mt-3 font-bold text-sm">本人</p>
            <div className="flex gap-2 mt-2">
              <Stethoscope size={16} className="text-blue-500" />
              <ShieldAlert size={16} className="text-blue-500" />
              <ShieldAlert size={16} className="text-slate-300" />
            </div>
          </div>
          {/* Member 2 */}
          <div className="min-w-[140px] bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center">
            <div className="relative">
              <img src="https://picsum.photos/seed/wife/100/100" alt="妻子" className="w-14 h-14 rounded-full bg-blue-50 object-cover" referrerPolicy="no-referrer" />
              <div className="absolute -bottom-1 -right-2 bg-yellow-500 text-white text-[10px] px-1.5 py-0.5 rounded-full border-2 border-white">72分</div>
            </div>
            <p className="mt-3 font-bold text-sm">妻子</p>
            <div className="flex gap-2 mt-2">
              <Stethoscope size={16} className="text-blue-500" />
              <ShieldAlert size={16} className="text-blue-500" />
              <Car size={16} className="text-slate-300" />
            </div>
          </div>
          {/* Member 3 */}
          <div className="min-w-[140px] bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center">
            <div className="relative">
              <img src="https://picsum.photos/seed/son/100/100" alt="儿子" className="w-14 h-14 rounded-full bg-blue-50 object-cover" referrerPolicy="no-referrer" />
              <div className="absolute -bottom-1 -right-2 bg-green-500 text-white text-[10px] px-1.5 py-0.5 rounded-full border-2 border-white">92分</div>
            </div>
            <p className="mt-3 font-bold text-sm">儿子</p>
            <div className="flex gap-2 mt-2">
              <Baby size={16} className="text-blue-500" />
              <Stethoscope size={16} className="text-blue-500" />
              <GraduationCap size={16} className="text-blue-500" />
            </div>
          </div>
        </div>
      </section>

      {/* Reminders */}
      <section>
        <h3 className="text-lg font-bold mb-3">近期提醒</h3>
        <div className="space-y-3">
          <div className="bg-white p-4 rounded-2xl flex items-center gap-4 border border-slate-100 shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
              <CalendarClock className="text-orange-500" size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start">
                <h4 className="font-bold text-sm truncate">车险续保提醒</h4>
                <span className="text-[10px] font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded">剩 5 天</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">您的沪A·*****保单即将到期</p>
            </div>
            <button className="bg-blue-500 text-white text-xs font-bold px-3 py-2 rounded-lg shrink-0">立即续保</button>
          </div>

          <div className="bg-white p-4 rounded-2xl flex items-center gap-4 border border-slate-100 shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-pink-50 flex items-center justify-center shrink-0">
              <Gift className="text-pink-500" size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start">
                <h4 className="font-bold text-sm truncate">儿子生日提醒</h4>
                <span className="text-[10px] font-medium text-slate-400">明天</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">别忘了为他准备生日礼物哦</p>
            </div>
            <button className="bg-blue-50 text-blue-500 text-xs font-bold px-3 py-2 rounded-lg shrink-0">查看福利</button>
          </div>

          <div className="bg-white p-4 rounded-2xl flex items-center gap-4 border border-slate-100 shadow-sm opacity-70">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <FileCheck className="text-blue-500" size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start">
                <h4 className="font-bold text-sm truncate">体检报告已生成</h4>
                <span className="text-[10px] font-medium text-slate-400">3天前</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">年度健康体检结果已更新</p>
            </div>
            <button className="text-slate-400 text-xs font-bold px-3 py-2 rounded-lg shrink-0 border border-slate-200">已读</button>
          </div>
        </div>
      </section>
    </div>
  );
}
