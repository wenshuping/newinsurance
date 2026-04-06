import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Info, Search, ShieldPlus, ShoppingBasket, Ticket } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { api } from '../../lib/api';
import PointsDetailPage from './PointsDetailPage';
import MyExchanges from '../profile/MyExchanges';
import { trackCEvent } from '../../lib/track';
import { getApiErrorMessage, isAuthRequiredError, showApiError } from '../../lib/ui-error';

interface Props {
  onClose: () => void;
  requireAuth: (action: () => void) => void;
  balance: number;
  onBalanceChange?: (balance: number) => void;
  initialItemId?: number | null;
  initialActivityId?: number | null;
  onItemChange?: (itemId: number | null) => void;
  onActivityChange?: (activityId: number | null) => void;
}

type MallItem = {
  id: number;
  name: string;
  pointsCost: number;
  stock: number;
  image?: string;
  media?: any[];
  description?: string;
};

type HotActivity = {
  id: number;
  title: string;
  subtitle: string;
  badge: string;
  image?: string;
  media?: any[];
  rewardPoints?: number;
  status?: string;
  joined?: boolean;
};

type RedeemSuccess = {
  orderNo: string;
  itemName: string;
  pointsCost: number;
  balance: number;
};

function resolveMediaUrl(raw?: string) {
  const url = String(raw || '').trim();
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/')) {
    const base = (import.meta as any).env?.VITE_API_BASE || 'http://127.0.0.1:4100';
    return `${String(base).replace(/\/$/, '')}${url}`;
  }
  return url;
}

const categoryCards = [
  { id: 1, label: '生活百货', icon: ShoppingBasket, iconClass: 'text-sky-500 bg-sky-50' },
  { id: 2, label: '健康服务', icon: ShieldPlus, iconClass: 'text-green-600 bg-green-100' },
  { id: 3, label: '虚拟卡券', icon: Ticket, iconClass: 'text-orange-600 bg-orange-100' },
];

export default function PointsMall({
  onClose,
  requireAuth,
  balance,
  onBalanceChange,
  initialItemId = null,
  initialActivityId = null,
  onItemChange,
  onActivityChange,
}: Props) {
  const [items, setItems] = useState<MallItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPointsDetail, setShowPointsDetail] = useState(false);
  const [showMyExchanges, setShowMyExchanges] = useState(false);
  const [redeemingItemId, setRedeemingItemId] = useState<number | null>(null);
  const [redeemSuccess, setRedeemSuccess] = useState<RedeemSuccess | null>(null);
  const [hotActivities, setHotActivities] = useState<HotActivity[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<MallItem | null>(null);
  const [selectedHotActivity, setSelectedHotActivity] = useState<HotActivity | null>(null);
  const [joiningActivityId, setJoiningActivityId] = useState<number | null>(null);
  const previousRouteItemIdRef = React.useRef<number | null>(initialItemId ?? null);
  const previousRouteActivityIdRef = React.useRef<number | null>(initialActivityId ?? null);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [mallResult, mallActivitiesResult, pointsSummaryResult] = await Promise.allSettled([
        api.mallItems(),
        api.mallActivities(),
        api.pointsSummary(),
      ]);

      if (mallResult.status !== 'fulfilled') {
        throw mallResult.reason;
      }

      const mall = mallResult.value;
      setItems(mall.items || []);
      trackCEvent('c_mall_items_load_success', { total: Number((mall.items || []).length) });

      if (mallActivitiesResult.status === 'fulfilled') {
        setHotActivities((mallActivitiesResult.value.list || []) as HotActivity[]);
        trackCEvent('c_mall_activities_load_success', { total: Number((mallActivitiesResult.value.list || []).length) });
      } else {
        setHotActivities([]);
        trackCEvent('c_mall_activities_load_failed', {});
      }

      if (pointsSummaryResult.status === 'fulfilled') {
        onBalanceChange?.(pointsSummaryResult.value.balance);
      } else {
        const e: any = pointsSummaryResult.reason;
        // Mall should be browsable without login; points summary is best-effort.
        if (!isAuthRequiredError(e?.code)) {
          throw e;
        }
      }
    } catch (e: any) {
      setItems([]);
      setHotActivities([]);
      setError(getApiErrorMessage(e, '商品获取失败'));
      trackCEvent('c_mall_items_load_failed', {});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const products = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        image: resolveMediaUrl(item.image) || '',
      })),
    [items]
  );

  const hotActivityCards = useMemo(
    () =>
      hotActivities.map((activity) => ({
        ...activity,
        image: resolveMediaUrl(activity.image) || '',
      })),
    [hotActivities]
  );

  useEffect(() => {
    if (!initialItemId && previousRouteItemIdRef.current) {
      setSelectedProduct(null);
    }
    previousRouteItemIdRef.current = initialItemId ?? null;
    if (!initialItemId || !products.length) return;
    if (Number(selectedProduct?.id || 0) === Number(initialItemId)) return;
    const matched = products.find((item) => Number(item.id || 0) === Number(initialItemId));
    if (matched) setSelectedProduct(matched);
  }, [initialItemId, products, selectedProduct]);

  useEffect(() => {
    if (!initialActivityId && previousRouteActivityIdRef.current) {
      setSelectedHotActivity(null);
    }
    previousRouteActivityIdRef.current = initialActivityId ?? null;
    if (!initialActivityId || !hotActivityCards.length) return;
    if (Number(selectedHotActivity?.id || 0) === Number(initialActivityId)) return;
    const matched = hotActivityCards.find((item) => Number(item.id || 0) === Number(initialActivityId));
    if (matched) setSelectedHotActivity(matched);
  }, [initialActivityId, hotActivityCards, selectedHotActivity]);

  const handleRedeem = async (itemId: number) => {
    if (redeemingItemId) return;
    try {
      setRedeemingItemId(itemId);
      trackCEvent('c_mall_redeem_start', { itemId });
      const res = await api.redeem(itemId);
      onBalanceChange?.(res.balance);
      await loadData();
      trackCEvent('c_mall_redeem_success', {
        itemId,
        pointsCost: Number(res.redemption?.pointsCost || 0),
        balance: Number(res.balance || 0),
      });
      if (Number(selectedProduct?.id || 0) === Number(itemId)) {
        setSelectedProduct(null);
        onItemChange?.(null);
      }
      setRedeemSuccess({
        orderNo: res.redemption?.orderNo || `EX${res.redemption?.id || ''}`,
        itemName: res.redemption?.itemName || '兑换商品',
        pointsCost: res.redemption?.pointsCost || 0,
        balance: res.balance,
      });
    } catch (e: any) {
      if (isAuthRequiredError(e?.code)) {
        trackCEvent('c_mall_redeem_need_auth', { itemId, code: String(e?.code || '') });
        requireAuth(() => {
          handleRedeem(itemId).catch(() => undefined);
        });
        return;
      }
      trackCEvent('c_mall_redeem_failed', { itemId, code: String(e?.code || 'UNKNOWN') });
      showApiError(e, '兑换失败');
    } finally {
      setRedeemingItemId(null);
    }
  };

  const handleJoinMallActivity = async (activity: HotActivity) => {
    if (joiningActivityId) return;
    const id = Number(activity.id);
    if (!Number.isFinite(id) || id <= 0) return;
    if (activity.joined) return;
    try {
      setJoiningActivityId(id);
      trackCEvent('c_mall_activity_join_start', { activityId: id });
      const res = await api.joinMallActivity(id);
      setHotActivities((prev) =>
        (prev || []).map((row) => (Number(row.id || 0) === id ? { ...row, joined: true } : row))
      );
      setSelectedHotActivity((prev) => (Number(prev?.id || 0) === id ? { ...prev, joined: true } : prev));
      onBalanceChange?.(res.balance);
      trackCEvent('c_mall_activity_join_success', {
        activityId: id,
        reward: Number(res.reward || 0),
        duplicated: Boolean(res.duplicated),
      });
      void loadData();
      alert(res.duplicated ? '您已参与过该活动' : `参与成功，获得 ${Number(res.reward || 0)} 积分`);
    } catch (e: any) {
      if (isAuthRequiredError(e?.code)) {
        trackCEvent('c_mall_activity_join_need_auth', { activityId: id, code: String(e?.code || '') });
        requireAuth(() => {
          handleJoinMallActivity(activity).catch(() => undefined);
        });
        return;
      }
      trackCEvent('c_mall_activity_join_failed', { activityId: id, code: String(e?.code || 'UNKNOWN') });
      showApiError(e, '参与失败');
    } finally {
      setJoiningActivityId(null);
    }
  };

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-[10080] bg-[#f6f7f8] flex flex-col"
    >
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-4 flex items-center justify-between">
        <button onClick={onClose} className="text-[#13a4ec] p-1">
          <ChevronLeft size={28} />
        </button>
        <h1 className="text-xl font-bold text-slate-900">积分商城</h1>
        <button className="text-slate-500 p-1">
          <Search size={24} />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        <div className="p-4">
          <div className="bg-[#13a4ec] rounded-xl p-6 shadow-lg shadow-sky-500/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
            <div className="flex justify-between items-start relative z-10">
              <div>
                <p className="text-white/80 text-lg font-medium">我的可用积分</p>
                <h2 className="text-white text-5xl font-bold mt-2">{balance.toLocaleString()}</h2>
              </div>
              <button
                onClick={() =>
                  requireAuth(() => {
                    trackCEvent('c_mall_open_points_detail', {});
                    setShowPointsDetail(true);
                  })
                }
                className="bg-white/20 backdrop-blur-md border border-white/30 text-white px-4 py-2 rounded-lg flex items-center gap-1"
              >
                <span className="text-base font-bold">积分明细</span>
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="mt-6 flex items-center gap-2 text-white/90 text-sm bg-black/10 w-fit px-3 py-1 rounded-full">
              <Info size={14} />
              <span>350 积分将于 2024-12-31 到期</span>
            </div>
          </div>
        </div>

        <section className="px-4 mb-6">
          <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
            <span className="w-1 h-5 bg-[#13a4ec] rounded-full" />
            热门活动
          </h3>
          <div className="flex overflow-x-auto gap-4 pb-2 snap-x no-scrollbar">
            {hotActivityCards.map((activity) => (
              <button
                key={activity.id}
                onClick={() => {
                  trackCEvent('c_mall_open_activity_detail', { activityId: activity.id });
                  setSelectedHotActivity(activity);
                  onActivityChange?.(Number(activity.id || 0));
                }}
                className="min-w-[85%] snap-center relative aspect-[21/9] rounded-xl overflow-hidden shadow-md text-left"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent z-10" />
                <img className="absolute inset-0 w-full h-full object-cover" src={activity.image} alt={activity.title} />
                <div className="absolute inset-0 z-20 p-5 flex flex-col justify-center">
                  <span className="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded w-fit mb-2">{activity.badge}</span>
                  <h4 className="text-white text-xl font-bold">{activity.title}</h4>
                  <p className="text-white/90 text-sm mt-1">{activity.subtitle}</p>
                </div>
              </button>
            ))}
          </div>
          {!loading && hotActivityCards.length === 0 ? <p className="text-sm text-slate-500 mt-2">暂无活动</p> : null}
        </section>

        <section className="px-4 mb-8 grid grid-cols-3 gap-4">
          {categoryCards.map(({ id, label, icon: Icon, iconClass }) => (
            <div key={id} className="flex flex-col items-center gap-2 p-3 bg-white rounded-xl shadow-sm border border-slate-100">
              <div className={`size-14 rounded-full flex items-center justify-center ${iconClass}`}>
                <Icon size={28} />
              </div>
              <span className="text-base font-bold">{label}</span>
            </div>
          ))}
        </section>

        <section className="px-4 mb-8">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span className="w-1 h-5 bg-[#13a4ec] rounded-full" />
            猜你喜欢
          </h3>

          {loading && <p className="text-sm text-slate-500">加载中...</p>}
          {error && <p className="text-sm text-rose-500">{error}</p>}

          <div className="grid grid-cols-2 gap-4">
            {products.map((item) => {
              const disabled = item.stock <= 0 || balance < item.pointsCost || redeemingItemId === item.id;
              return (
                <article key={item.id} className="bg-white rounded-xl overflow-hidden shadow-sm border border-slate-100">
                  <div className="aspect-square w-full relative">
                    {item.image ? (
                      <img className="w-full h-full object-cover" src={item.image} alt={item.name} />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-sky-50 to-slate-100 text-sky-500">
                        <ShoppingBasket size={32} />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <h5 className="text-lg font-bold line-clamp-2 leading-tight h-10 mb-2">{item.name}</h5>
                    <div className="flex flex-col gap-1">
                      <p className="text-[#13a4ec] text-xl font-bold">
                        {item.pointsCost} <span className="text-sm">积分</span>
                      </p>
                      <p className="text-slate-500 text-sm">库存 {Math.max(0, Number(item.stock || 0))}</p>
                      <button
                        onClick={() => handleRedeem(item.id)}
                        disabled={disabled}
                        className="mt-2 w-full rounded-lg py-2 text-sm font-bold text-white bg-[#13a4ec] disabled:bg-sky-200"
                      >
                        {item.stock <= 0 ? '已兑完' : balance < item.pointsCost ? '积分不足' : redeemingItemId === item.id ? '兑换中...' : '立即兑换'}
                      </button>
                      <button
                        onClick={() => {
                          trackCEvent('c_mall_open_product_detail', { itemId: item.id });
                          setSelectedProduct(item);
                          onItemChange?.(Number(item.id || 0));
                        }}
                        className="mt-2 w-full rounded-lg py-2 text-sm font-semibold text-slate-700 border border-slate-200"
                      >
                        查看详情
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          {!loading && products.length === 0 ? <p className="text-sm text-slate-500 mt-3">暂无商品</p> : null}
        </section>
      </main>

      <AnimatePresence>
        {showPointsDetail && <PointsDetailPage onClose={() => setShowPointsDetail(false)} initialBalance={balance} />}
      </AnimatePresence>

      <AnimatePresence>
        {redeemSuccess && (
          <div className="fixed inset-0 z-[65] bg-black/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              className="w-full max-w-md bg-white rounded-2xl p-6"
            >
              <div className="flex items-center gap-2 text-emerald-600 mb-4">
                <CheckCircle2 size={22} />
                <h3 className="text-lg font-bold">兑换成功</h3>
              </div>
              <div className="space-y-2 text-sm mb-6">
                <p className="text-slate-700">商品：{redeemSuccess.itemName}</p>
                <p className="text-slate-700">订单号：{redeemSuccess.orderNo}</p>
                <p className="text-slate-700">消耗积分：-{redeemSuccess.pointsCost}</p>
                <p className="text-slate-700">剩余积分：{redeemSuccess.balance}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setRedeemSuccess(null)}
                  className="py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold"
                >
                  继续逛
                </button>
                <button
                  onClick={() => {
                    setRedeemSuccess(null);
                    trackCEvent('c_mall_open_redemption_list', {});
                    setShowMyExchanges(true);
                  }}
                  className="py-2.5 rounded-xl bg-[#13a4ec] text-white font-semibold"
                >
                  查看我的兑换
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showMyExchanges && <MyExchanges onClose={() => setShowMyExchanges(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {selectedProduct && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 210 }}
            className="fixed inset-0 z-[68] bg-[#f6f7f8] flex flex-col"
          >
            <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-4 flex items-center justify-between">
              <button
                onClick={() => {
                  setSelectedProduct(null);
                  onItemChange?.(null);
                }}
                className="text-[#13a4ec] p-1"
              >
                <ChevronLeft size={28} />
              </button>
              <h1 className="text-lg font-bold text-slate-900">商品详情</h1>
              <div className="w-7" />
            </header>
            <main className="flex-1 overflow-y-auto p-4 pb-28">
              <section className="mx-auto flex w-full max-w-3xl flex-col gap-4">
                <div className="overflow-hidden rounded-[28px] border border-sky-100 bg-white shadow-[0_18px_40px_-24px_rgba(14,165,233,0.35)]">
                  <div className="aspect-[4/3] bg-[linear-gradient(180deg,#EAF6FF_0%,#F8FCFF_100%)]">
                    {selectedProduct.image ? (
                      <img className="h-full w-full object-cover" src={selectedProduct.image || ''} alt={selectedProduct.name} />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sky-500">
                        <div className="flex size-20 items-center justify-center rounded-full bg-white/80 shadow-[0_12px_30px_-20px_rgba(14,165,233,0.5)]">
                          <ShoppingBasket size={40} />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-4 px-5 py-5">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-sky-700">
                        积分好物
                      </span>
                    </div>
                    <div>
                      <h3 className="text-[26px] font-bold leading-tight text-slate-950">{selectedProduct.name}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        {selectedProduct.description || '可直接使用积分兑换，兑换成功后可在“我的兑换”中查看记录。'}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-sky-100 bg-sky-50/75 px-4 py-4">
                      <p className="text-xs font-medium tracking-[0.16em] text-sky-600">所需积分</p>
                      <p className="mt-2 text-4xl font-bold leading-none text-[#13a4ec]">
                        {selectedProduct.pointsCost}
                        <span className="ml-2 text-lg font-semibold text-sky-500">积分</span>
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-sky-100 bg-sky-50/70 px-4 py-4">
                        <p className="text-xs font-medium tracking-[0.16em] text-sky-600">兑换说明</p>
                        <p className="mt-2 text-sm leading-6 text-slate-700">兑换成功后将自动生成兑换记录，后续可在个人中心查看。</p>
                      </div>
                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-4">
                        <p className="text-xs font-medium tracking-[0.16em] text-emerald-600">温馨提示</p>
                        <p className="mt-2 text-sm leading-6 text-slate-700">提交兑换后将即时扣减积分，请确认后再继续操作。</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </main>
            <footer className="fixed bottom-0 left-0 right-0 z-10 border-t border-slate-200 bg-white/96 px-4 py-3 backdrop-blur">
              <div className="mx-auto max-w-3xl">
                <button
                  onClick={() => handleRedeem(selectedProduct.id)}
                  disabled={balance < Number(selectedProduct.pointsCost || 0) || redeemingItemId === Number(selectedProduct.id)}
                  className="w-full rounded-2xl bg-[#13a4ec] px-5 py-4 text-base font-bold text-white shadow-[0_16px_30px_-18px_rgba(19,164,236,0.9)] disabled:bg-sky-200 disabled:shadow-none"
                >
                  {balance < Number(selectedProduct.pointsCost || 0)
                    ? '积分不足'
                    : redeemingItemId === Number(selectedProduct.id)
                      ? '兑换中...'
                      : '立即兑换'}
                </button>
              </div>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedHotActivity && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 210 }}
            className="fixed inset-0 z-[68] bg-[#f6f7f8] flex flex-col"
          >
            <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-4 flex items-center justify-between">
              <button
                onClick={() => {
                  setSelectedHotActivity(null);
                  onActivityChange?.(null);
                }}
                className="text-[#13a4ec] p-1"
              >
                <ChevronLeft size={28} />
              </button>
              <h1 className="text-lg font-bold text-slate-900">活动详情</h1>
              <div className="w-7" />
            </header>
            <main className="flex-1 overflow-y-auto p-4 pb-24">
              <article className="bg-white rounded-xl overflow-hidden border border-slate-100">
                <div className="aspect-[21/10] bg-slate-100">
                  {selectedHotActivity.image ? (
                    <img className="w-full h-full object-cover" src={selectedHotActivity.image || ''} alt={selectedHotActivity.title} />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-50 to-slate-100 text-orange-500">
                      <Ticket size={36} />
                    </div>
                  )}
                </div>
                <div className="p-4 space-y-3">
                  <span className="inline-flex bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded">{selectedHotActivity.badge || '商城活动'}</span>
                  <h3 className="text-xl font-bold text-slate-900">{selectedHotActivity.title}</h3>
                  <p className="text-sm text-slate-600">{selectedHotActivity.subtitle || '参与活动可获得积分奖励。'}</p>
                  <div className="rounded-lg bg-sky-50 p-3">
                    <p className="text-xs text-slate-500">奖励积分</p>
                    <p className="text-xl font-bold text-[#13a4ec]">{Number(selectedHotActivity.rewardPoints || 0)}</p>
                  </div>
                </div>
              </article>
            </main>
            <footer className="fixed bottom-0 left-0 right-0 z-10 bg-white border-t border-slate-200 p-4">
              <button
                onClick={() => handleJoinMallActivity(selectedHotActivity)}
                disabled={Boolean(selectedHotActivity.joined) || joiningActivityId === Number(selectedHotActivity.id)}
                className="w-full rounded-xl py-3 text-sm font-bold text-white bg-[#13a4ec] disabled:bg-slate-300 disabled:text-white"
              >
                {selectedHotActivity.joined ? '已报名' : joiningActivityId === Number(selectedHotActivity.id) ? '参与中...' : '立即报名'}
              </button>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
