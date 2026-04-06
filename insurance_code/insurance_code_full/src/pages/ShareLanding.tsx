import React from 'react';
import { ArrowRight, Home, ShieldAlert } from 'lucide-react';
import { api, setTenantContext, type ShareDetailResponse, type User } from '../lib/api';
import { canOpenProtectedShareTarget } from '../lib/share-access';
import { trackCEvent } from '../lib/track';

interface Props {
  shareCode: string;
  isAuthenticated: boolean;
  viewerUser?: User | null;
  authLoading?: boolean;
  requireAuth: (action: (nextUser?: User) => void) => void;
  onNavigate: (path: string, options?: { replace?: boolean }) => void;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-CN', { hour12: false });
}

export default function ShareLanding({
  shareCode,
  isAuthenticated,
  viewerUser = null,
  authLoading = false,
  requireAuth,
  onNavigate,
}: Props) {
  const [detail, setDetail] = React.useState<ShareDetailResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<{ code: string; message: string } | null>(null);
  const [viewer, setViewer] = React.useState<{ id?: number; name?: string; mobile?: string } | null>(null);
  const [viewerResolved, setViewerResolved] = React.useState(false);
  const trackedViewRef = React.useRef('');
  const autoOpenRef = React.useRef('');

  React.useEffect(() => {
    if (authLoading) {
      setViewerResolved(false);
      return;
    }
    if (!isAuthenticated || !viewerUser?.is_verified_basic) {
      setViewer(null);
      setViewerResolved(true);
      return;
    }

    setViewer({
      id: Number(viewerUser.id || 0) || undefined,
      name: String(viewerUser.name || '').trim() || undefined,
      mobile: String(viewerUser.mobile || '').trim() || undefined,
    });
    setViewerResolved(true);
  }, [authLoading, isAuthenticated, viewerUser]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetail(null);
    trackedViewRef.current = '';
    autoOpenRef.current = '';

    api.shareDetail(shareCode)
      .then((resp) => {
        if (cancelled) return;
        setTenantContext({ tenantId: resp.tenantId });
        setDetail(resp);
        trackCEvent('c_share_landing_load_success', { shareCode: resp.shareCode, shareType: resp.shareType });
      })
      .catch((err: any) => {
        if (cancelled) return;
        setError({ code: String(err?.code || 'SHARE_INVALID'), message: String(err?.message || '分享内容不可用') });
        trackCEvent('c_share_landing_load_failed', { shareCode, code: String(err?.code || 'SHARE_INVALID') });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [shareCode]);

  React.useEffect(() => {
    if (authLoading) return;
    if (!detail || !viewerResolved) return;
    if (trackedViewRef.current === detail.shareCode) return;
    trackedViewRef.current = detail.shareCode;
    api.shareView(detail.shareCode, viewer || undefined).catch(() => {
      // ignore view metric failures on landing page
    });
  }, [authLoading, detail, viewer, viewerResolved]);

  const canOpenTarget = (viewerOverride?: User | null) =>
    canOpenProtectedShareTarget({
      loginRequired: Boolean(detail?.loginRequired),
      isAuthenticated: Boolean(viewerOverride) || isAuthenticated,
      isVerifiedBasic: Boolean(viewerOverride?.is_verified_basic) || Boolean(viewerUser?.is_verified_basic),
    });

  React.useEffect(() => {
    if (authLoading) return;
    if (!detail || !viewerResolved) return;
    if (!canOpenTarget()) {
      return;
    }
    if (autoOpenRef.current === detail.shareCode) return;
    autoOpenRef.current = detail.shareCode;
    void handleOpenTarget();
  }, [authLoading, detail, viewerResolved, isAuthenticated, viewerUser?.is_verified_basic]);

  const handleOpenTarget = async (viewerOverride?: User | null) => {
    if (!detail || submitting) return;
    if (!canOpenTarget(viewerOverride)) {
      requireAuth((nextUser) => {
        void handleOpenTarget(nextUser || viewerOverride || viewerUser);
      });
      return;
    }
    setSubmitting(true);
    api.shareClick(detail.shareCode, viewer || undefined).catch(() => {
      // click metric failure should not block user jump
    });

    onNavigate(detail.targetCPath, { replace: true });
    setSubmitting(false);
  };

  if (loading || authLoading) {
    return (
      <div className="flex min-h-[100svh] items-center justify-center bg-[#f7f6f1] px-5 text-slate-900">
        <div className="w-full max-w-sm rounded-[32px] border border-[#e5dccb] bg-white px-6 py-8 text-center shadow-[0_24px_80px_-48px_rgba(74,50,20,0.45)]">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-[#f1dcc0] border-t-[#c76b2a]" />
          <p className="mt-5 text-base font-bold text-slate-900">{authLoading ? '正在恢复登录态' : '正在打开分享内容'}</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {authLoading ? '已检测到你之前登录过，正在校验实名状态。' : '马上为你跳转到对应的课程或活动页面。'}
          </p>
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="min-h-[100svh] overflow-x-hidden bg-[#f7f6f1] px-5 py-8 text-slate-900">
        <div className="mx-auto max-w-md rounded-[32px] border border-[#eadfce] bg-white p-8 text-center shadow-[0_24px_80px_-48px_rgba(74,50,20,0.45)]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#fff3ea] text-[#c76b2a]">
            <ShieldAlert size={28} />
          </div>
          <h1 className="mt-5 text-2xl font-black tracking-tight">分享内容不可用</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">{error?.message || '该分享已失效、已过期或对应内容已下线。'}</p>
          <div className="mt-6 rounded-2xl bg-[#f8f3ea] px-4 py-3 text-left text-xs text-slate-500">
            <p>错误码：{error?.code || 'SHARE_INVALID'}</p>
            <p className="mt-1 break-all">shareCode：{shareCode}</p>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-3">
            <button
              type="button"
              onClick={() => onNavigate('/', { replace: true })}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#c76b2a] px-4 py-3 text-sm font-bold text-white"
            >
              <Home size={18} />
              去首页
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100svh] items-center justify-center bg-[#f7f6f1] px-5 text-slate-900">
      <div className="w-full max-w-sm rounded-[32px] border border-[#e7ddcd] bg-white px-6 py-8 text-center shadow-[0_30px_90px_-52px_rgba(74,50,20,0.5)]">
        <div
          className={`mx-auto h-12 w-12 rounded-full border-4 ${
            canOpenTarget()
              ? 'animate-spin border-[#f1dcc0] border-t-[#c76b2a]'
              : 'border-[#f1dcc0] border-t-[#f1dcc0] bg-[#fff3ea] flex items-center justify-center text-[#c76b2a]'
          }`}
        >
          {!canOpenTarget() ? <ShieldAlert size={20} /> : null}
        </div>
        <p className="mt-5 text-base font-bold text-slate-900">
          {canOpenTarget() ? '正在跳转到分享页面' : '完成实名认证后查看分享内容'}
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-500">{detail.targetTitle || detail.previewPayload.title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-400">
          {`有效期至 ${formatDate(detail.expiresAt)}`}
        </p>

        <div className="mt-6 grid grid-cols-1 gap-3">
          <button
            type="button"
            onClick={() => void handleOpenTarget()}
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#c76b2a] px-4 py-3.5 text-sm font-bold text-white disabled:opacity-60"
          >
            <span>
              {submitting
                ? '打开中...'
                : canOpenTarget()
                  ? detail.previewPayload.ctaText || '继续打开'
                  : '先完成认证'}
            </span>
            <ArrowRight size={18} />
          </button>
          <button
            type="button"
            onClick={() => onNavigate(detail.fallbackCPath, { replace: true })}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#e5dccb] px-4 py-3 text-sm font-semibold text-slate-700"
          >
            <Home size={18} />
            去频道页
          </button>
        </div>
      </div>
    </div>
  );
}
