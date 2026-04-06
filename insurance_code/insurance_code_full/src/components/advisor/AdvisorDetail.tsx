import React from 'react';
import { ArrowLeft, BadgeCheck, Copy, Headset, MessageCircle, Phone, UserRound, X } from 'lucide-react';

import { api, type AdvisorProfile } from '../../lib/api';
import { resolveAdvisorAvatarUrl } from '../../lib/advisor-avatar';
import { resolveRuntimeAssetUrl } from '../../lib/runtime-asset-url';

interface Props {
  onClose: () => void;
  isAuthenticated: boolean;
  requireAuth: (action: () => void) => void;
}

function getAdvisorAvatar(profile: AdvisorProfile | null) {
  return resolveAdvisorAvatarUrl(profile);
}

function resolveWechatQrUrl(profile: AdvisorProfile | null) {
  return resolveRuntimeAssetUrl(String(profile?.wechatQrUrl || '').trim());
}

export default function AdvisorDetail({ onClose, isAuthenticated, requireAuth }: Props) {
  const [advisor, setAdvisor] = React.useState<AdvisorProfile | null>(null);
  const [loading, setLoading] = React.useState(isAuthenticated);
  const [error, setError] = React.useState('');
  const [wechatSheetOpen, setWechatSheetOpen] = React.useState(false);
  const [wechatCopied, setWechatCopied] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    if (!isAuthenticated) {
      setAdvisor(null);
      setLoading(false);
      setError('');
      return () => {
        mounted = false;
      };
    }

    setLoading(true);
    setError('');
    api
      .advisorProfile()
      .then((res) => {
        if (!mounted) return;
        setAdvisor(res.advisor || null);
      })
      .catch((err: any) => {
        if (!mounted) return;
        setAdvisor(null);
        setError(String(err?.message || '顾问资料加载失败'));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [isAuthenticated]);

  const avatarUrl = getAdvisorAvatar(advisor);
  const wechatQrUrl = resolveWechatQrUrl(advisor);
  const wechatId = String(advisor?.wechatId || '').trim();
  const hasWechatContact = Boolean(wechatQrUrl || wechatId);

  const handleCopyWechatId = async () => {
    if (!wechatId || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(wechatId);
      setWechatCopied(true);
      window.setTimeout(() => setWechatCopied(false), 1800);
    } catch {
      setWechatCopied(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#f6f7f8] min-h-screen pb-24">
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 py-4 flex items-center">
        <button onClick={onClose} className="p-2 -ml-2 rounded-full active:bg-slate-100">
          <ArrowLeft size={26} className="text-slate-900" />
        </button>
        <h1 className="ml-4 text-xl font-black text-slate-900">专属顾问</h1>
      </header>

      <main className="flex-1 overflow-y-auto pb-8">
        {!isAuthenticated ? (
          <section className="mx-4 mt-4 rounded-3xl border border-slate-100 bg-white p-6 text-center shadow-sm">
            <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border-4 border-[#13a4ec]/15 bg-[#13a4ec]/8 text-[#13a4ec]">
              <Headset size={40} />
            </div>
            <h2 className="mt-4 text-2xl font-black text-slate-900">登录后查看专属顾问</h2>
            <p className="mt-2 text-sm leading-7 text-slate-500">登录后可查看对应业务员的简介、职级和联系方式。</p>
            <button
              type="button"
              onClick={() => requireAuth(() => undefined)}
              className="mt-6 inline-flex items-center justify-center rounded-2xl bg-[#13a4ec] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-[#13a4ec]/20"
            >
              立即登录
            </button>
          </section>
        ) : null}

        {isAuthenticated && loading ? (
          <section className="mx-4 mt-4 animate-pulse rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mx-auto h-28 w-28 rounded-full bg-slate-100" />
            <div className="mx-auto mt-4 h-8 w-32 rounded bg-slate-100" />
            <div className="mx-auto mt-3 h-5 w-40 rounded bg-slate-100" />
            <div className="mt-8 h-32 rounded-3xl bg-slate-100" />
          </section>
        ) : null}

        {isAuthenticated && !loading && advisor ? (
          <>
            <section className="mx-4 mt-4 rounded-3xl border border-slate-100 bg-white p-6 text-center shadow-sm">
              <div className="mx-auto flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-4 border-[#13a4ec]/15 bg-[#13a4ec]/8 text-4xl font-black text-[#13a4ec]">
                <img src={avatarUrl} alt={advisor.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <h2 className="mt-4 text-3xl font-black text-slate-900">{advisor.name}</h2>
              <p className="mt-1 text-lg font-bold text-[#13a4ec]">{advisor.title || '保险顾问'}</p>
              {advisor.mobile ? (
                <p className="mt-3 text-base font-medium text-slate-500">手机号：{advisor.mobile}</p>
              ) : null}
            </section>

            <section className="mt-6 px-4">
              <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                <h3 className="flex items-center text-lg font-black text-slate-900">
                  <BadgeCheck size={20} className="mr-2 text-[#13a4ec]" />
                  顾问简介
                </h3>
                <p className="mt-4 whitespace-pre-wrap text-base leading-8 text-slate-600">
                  {advisor.bio || '这位顾问暂未填写个人简介，您可以先通过手机号与他联系。'}
                </p>
              </div>
            </section>

            <section className="mt-6 px-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  className={`flex items-center justify-center rounded-3xl px-5 py-4 text-base font-black shadow-lg ${
                    hasWechatContact
                      ? 'bg-[#13a4ec] text-white shadow-[#13a4ec]/20'
                      : 'cursor-not-allowed bg-slate-200 text-slate-400 shadow-none'
                  }`}
                  onClick={() => {
                    if (!hasWechatContact) return;
                    setWechatCopied(false);
                    setWechatSheetOpen(true);
                  }}
                >
                  <MessageCircle size={19} className="mr-2" />
                  {hasWechatContact ? '微信联系' : '暂未配置微信'}
                </button>
                <a
                  href={advisor.mobile ? `tel:${advisor.mobile}` : undefined}
                  className={`flex items-center justify-center rounded-3xl border px-5 py-4 text-base font-black ${
                    advisor.mobile
                      ? 'border-[#13a4ec]/20 bg-white text-[#13a4ec]'
                      : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                  }`}
                  onClick={(event) => {
                    if (!advisor.mobile) event.preventDefault();
                  }}
                >
                  <Phone size={19} className="mr-2" />
                  {advisor.mobile ? '电话联系' : '暂未配置电话'}
                </a>
              </div>
              <p className="mt-3 text-center text-xs leading-5 text-slate-400">
                微信按钮会展示顾问微信二维码；电话按钮直接发起拨号。
              </p>
            </section>
          </>
        ) : null}

        {isAuthenticated && !loading && !advisor ? (
          <section className="mx-4 mt-4 rounded-3xl border border-slate-100 bg-white p-6 text-center shadow-sm">
            <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border-4 border-slate-200 bg-slate-50 text-slate-400">
              <UserRound size={40} />
            </div>
            <h2 className="mt-4 text-2xl font-black text-slate-900">暂未匹配专属顾问</h2>
            <p className="mt-2 text-sm leading-7 text-slate-500">
              {error || '当前账号还没有绑定对应业务员，后续通过分享链路或人工分配后会在这里显示。'}
            </p>
          </section>
        ) : null}
      </main>

      {wechatSheetOpen ? (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-slate-950/35 px-4 pb-6 pt-16" onClick={() => setWechatSheetOpen(false)}>
          <div
            className="w-full max-w-md rounded-[32px] bg-white p-6 shadow-2xl shadow-slate-900/15"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#13a4ec]/65">WECHAT</p>
                <h3 className="mt-1 text-xl font-black text-slate-900">添加顾问微信</h3>
              </div>
              <button
                type="button"
                onClick={() => setWechatSheetOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500"
              >
                <X size={18} />
              </button>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              可截图或长按保存二维码后，在微信中扫码添加。若二维码暂未配置，也可以直接复制微信号。
            </p>

            <div className="mt-5 rounded-[28px] border border-slate-200 bg-slate-50 p-5 text-center">
              {wechatQrUrl ? (
                <img
                  src={wechatQrUrl}
                  alt={`${advisor?.name || '顾问'}微信二维码`}
                  className="mx-auto h-56 w-56 rounded-[24px] border border-slate-200 bg-white object-cover p-2"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="mx-auto flex h-56 w-56 items-center justify-center rounded-[24px] border border-dashed border-slate-300 bg-white text-sm leading-6 text-slate-400">
                  暂未上传微信二维码
                </div>
              )}

              {wechatId ? (
                <div className="mt-5 rounded-2xl bg-white px-4 py-3 text-left">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">微信号</p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate text-base font-bold text-slate-900">{wechatId}</p>
                    <button
                      type="button"
                      onClick={handleCopyWechatId}
                      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#13a4ec]/15 bg-[#13a4ec]/5 px-3 py-1.5 text-xs font-bold text-[#13a4ec]"
                    >
                      <Copy size={14} />
                      {wechatCopied ? '已复制' : '复制'}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
