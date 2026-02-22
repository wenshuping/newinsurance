import React from 'react';
import { ChevronLeft, Search, ChevronRight, Info, ShoppingBasket, ShieldPlus, Ticket } from 'lucide-react';
import { motion } from 'motion/react';

interface Props {
  onClose: () => void;
}

export default function PointsMall({ onClose }: Props) {
  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-50 bg-slate-50 flex flex-col"
    >
      {/* Header */}
      <header className="bg-white sticky top-0 z-10 px-4 py-4 flex items-center justify-between border-b border-slate-100">
        <button onClick={onClose} className="p-2 -ml-2 text-slate-700 active:bg-slate-100 rounded-full transition-colors">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold">积分商城</h1>
        <button className="p-2 -mr-2 text-slate-700 active:bg-slate-100 rounded-full transition-colors">
          <Search size={24} />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto pb-safe">
        {/* Points Summary Card */}
        <div className="p-4">
          <div className="bg-blue-500 rounded-2xl p-6 shadow-lg shadow-blue-500/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
            <div className="flex justify-between items-start relative z-10">
              <div>
                <p className="text-white/80 text-sm font-medium">我的可用积分</p>
                <h2 className="text-white text-4xl font-bold mt-1">12,850</h2>
              </div>
              <button className="bg-white/20 backdrop-blur-md border border-white/30 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 text-xs font-bold active:bg-white/30 transition-colors">
                积分明细
                <ChevronRight size={14} />
              </button>
            </div>
            <div className="mt-6 flex items-center gap-1.5 text-white/90 text-xs bg-black/10 w-fit px-2.5 py-1 rounded-full">
              <Info size={14} />
              <span>350 积分将于 2024-12-31 到期</span>
            </div>
          </div>
        </div>

        {/* Hero Carousel Section */}
        <div className="px-4 mb-6">
          <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-blue-500 rounded-full"></span>
            热门活动
          </h3>
          <div className="flex overflow-x-auto gap-4 pb-2 snap-x scrollbar-hide -mx-4 px-4">
            <div className="min-w-[85%] snap-center relative aspect-[21/9] rounded-2xl overflow-hidden shadow-sm">
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent z-10"></div>
              <img src="https://picsum.photos/seed/rice/800/400" alt="Rice" className="absolute inset-0 w-full h-full object-cover" referrerPolicy="no-referrer" />
              <div className="absolute inset-0 z-20 p-5 flex flex-col justify-center">
                <span className="bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded w-fit mb-2">限时抢兑</span>
                <h4 className="text-white text-lg font-bold">五常有机新米</h4>
                <p className="text-white/90 text-xs mt-1">500积分起兑 | 产地直供</p>
              </div>
            </div>
            <div className="min-w-[85%] snap-center relative aspect-[21/9] rounded-2xl overflow-hidden shadow-sm">
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent z-10"></div>
              <img src="https://picsum.photos/seed/health/800/400" alt="Health" className="absolute inset-0 w-full h-full object-cover" referrerPolicy="no-referrer" />
              <div className="absolute inset-0 z-20 p-5 flex flex-col justify-center">
                <span className="bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded w-fit mb-2">健康守护</span>
                <h4 className="text-white text-lg font-bold">全身体检套装</h4>
                <p className="text-white/90 text-xs mt-1">专业机构 | 为长辈定制</p>
              </div>
            </div>
          </div>
        </div>

        {/* Category Grid */}
        <div className="px-4 mb-6 grid grid-cols-3 gap-3">
          <div className="flex flex-col items-center gap-2 p-4 bg-white rounded-2xl shadow-sm border border-slate-100 active:scale-95 transition-transform">
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
              <ShoppingBasket size={24} />
            </div>
            <span className="text-sm font-bold">生活百货</span>
          </div>
          <div className="flex flex-col items-center gap-2 p-4 bg-white rounded-2xl shadow-sm border border-slate-100 active:scale-95 transition-transform">
            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center text-green-600">
              <ShieldPlus size={24} />
            </div>
            <span className="text-sm font-bold">健康服务</span>
          </div>
          <div className="flex flex-col items-center gap-2 p-4 bg-white rounded-2xl shadow-sm border border-slate-100 active:scale-95 transition-transform">
            <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center text-orange-500">
              <Ticket size={24} />
            </div>
            <span className="text-sm font-bold">虚拟卡券</span>
          </div>
        </div>

        {/* Product Grid */}
        <div className="px-4 mb-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span className="w-1.5 h-5 bg-blue-500 rounded-full"></span>
            猜你喜欢
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { id: 1, name: '特级有机大米 5kg', points: 1000, sales: '1.2w', img: 'https://picsum.photos/seed/p1/400/400' },
              { id: 2, name: '智能家用血压计', points: 5000, sales: '856', img: 'https://picsum.photos/seed/p2/400/400' },
              { id: 3, name: '非转基因调和油 5L', points: 800, sales: '3k+', img: 'https://picsum.photos/seed/p3/400/400' },
              { id: 4, name: '助老健康智能手环', points: 3500, sales: '420', img: 'https://picsum.photos/seed/p4/400/400' },
            ].map(product => (
              <div key={product.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 active:scale-[0.98] transition-transform">
                <div className="aspect-square w-full relative bg-slate-50">
                  <img src={product.img} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <div className="p-3">
                  <h5 className="text-sm font-bold line-clamp-2 leading-tight h-10 mb-2">{product.name}</h5>
                  <div className="flex flex-col gap-0.5">
                    <p className="text-blue-500 text-base font-bold">{product.points} <span className="text-[10px]">积分</span></p>
                    <p className="text-slate-400 text-[10px]">{product.sales} 人已兑换</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </motion.div>
  );
}
