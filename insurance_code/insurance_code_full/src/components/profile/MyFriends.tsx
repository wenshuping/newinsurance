import React, { useEffect, useState } from 'react';
import { ChevronLeft, Share2, Users, UserRound, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { api, type CustomerShareNetworkResponse } from '../../lib/api';

interface Props {
  onClose: () => void;
}

function formatDate(value?: string | null) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.slice(0, 10);
}

function maskMobile(value?: string | null) {
  const text = String(value || '').trim();
  if (text.length < 7) return text || '-';
  return `${text.slice(0, 3)}****${text.slice(-4)}`;
}

export default function MyFriends({ onClose }: Props) {
  const [network, setNetwork] = useState<CustomerShareNetworkResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    api.myShareFriends()
      .then((res) => {
        if (!mounted) return;
        setNetwork(res);
      })
      .catch(() => {
        if (!mounted) return;
        setNetwork({
          ok: true,
          upstream: null,
          invitedFriends: [],
          stats: { invitedCount: 0, verifiedCount: 0 },
        });
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const invitedFriends = Array.isArray(network?.invitedFriends) ? network!.invitedFriends : [];
  const upstream = network?.upstream || null;
  const stats = network?.stats || { invitedCount: 0, verifiedCount: 0 };

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-50 flex flex-col bg-slate-50"
    >
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-4">
        <button onClick={onClose} className="rounded-full p-2 text-slate-700 transition-colors active:bg-slate-100">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold">我的朋友</h1>
        <div className="w-10" />
      </header>

      <main className="flex-1 space-y-4 overflow-y-auto p-4 pb-safe">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-r from-sky-500 to-blue-600 p-5 text-white shadow-lg shadow-sky-200/60">
          <p className="text-xs font-semibold tracking-[0.28em] text-white/80">MY FRIENDS</p>
          <h2 className="mt-3 text-[28px] font-black tracking-tight">{stats.invitedCount}</h2>
          <p className="mt-1 text-sm text-white/85">通过你的分享链接完成实名的朋友</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/15 px-4 py-3 backdrop-blur-sm">
              <p className="text-[11px] text-white/75">实名好友</p>
              <p className="mt-1 text-xl font-bold">{stats.verifiedCount}</p>
            </div>
            <div className="rounded-2xl bg-white/15 px-4 py-3 backdrop-blur-sm">
              <p className="text-[11px] text-white/75">上游来源</p>
              <p className="mt-1 text-sm font-semibold">{upstream?.name || '暂无标注'}</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-500">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">上游分享人</h3>
              <p className="text-xs text-slate-500">如果你是通过朋友分享进入的，这里会标记来源。</p>
            </div>
          </div>

          {upstream ? (
            <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-base font-bold text-slate-900">{upstream.name}</p>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-amber-600">
                      {upstream.label || '上游'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{maskMobile(upstream.mobile)}</p>
                </div>
                <div className="text-right text-[11px] text-slate-400">
                  <p>{formatDate(upstream.referredAt) || '已实名后绑定'}</p>
                  <p className="mt-1">分享来源</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              当前没有标记到上游分享人。
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-500">
              <Users size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">通过你实名的朋友</h3>
              <p className="text-xs text-slate-500">这里只展示通过你的分享链接完成实名的朋友。</p>
            </div>
          </div>

          {loading ? <div className="mt-4 text-sm text-slate-400">加载中...</div> : null}

          {!loading && invitedFriends.length ? (
            <div className="mt-4 space-y-3">
              {invitedFriends.map((friend) => (
                <article key={friend.id} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm">
                          <UserRound size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-bold text-slate-900">{friend.name || `朋友#${friend.id}`}</p>
                          <p className="text-xs text-slate-500">{maskMobile(friend.mobile)}</p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-600">
                      已实名
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <Share2 size={14} />
                      <span>{friend.shareCode ? `分享码 ${friend.shareCode.slice(0, 8)}...` : '来源已记录'}</span>
                    </div>
                    <span>{formatDate(friend.referredAt || friend.verifiedAt) || '已完成绑定'}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          {!loading && invitedFriends.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              还没有朋友通过你的分享链接完成实名。
            </div>
          ) : null}
        </section>
      </main>
    </motion.div>
  );
}
