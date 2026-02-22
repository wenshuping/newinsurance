import React from 'react';
import { Play } from 'lucide-react';

export default function LatestNews() {
  return (
    <section>
      <div className="flex justify-between items-end mb-3">
        <h2 className="text-lg font-bold">最新资讯</h2>
        <button className="text-xs text-slate-500 font-medium">换一批</button>
      </div>
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100">
        <div className="relative aspect-video">
          <img 
            src="https://picsum.photos/seed/senior/800/450" 
            alt="Senior couple" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
            <button className="w-12 h-12 bg-white/30 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/50">
              <Play fill="currentColor" size={24} className="ml-1" />
            </button>
          </div>
          <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded">03:45</span>
        </div>
        <div className="p-4">
          <h3 className="font-bold text-base mb-1.5">2024年养老保险新政策解读</h3>
          <p className="text-sm text-slate-500 line-clamp-2">详细了解最新推出的居家养老补助计划，帮助您更好地规划晚年生活，享受无忧的退休时光...</p>
        </div>
      </div>
    </section>
  );
}
