import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../lib/api';

declare global {
  interface Window {
    wx?: {
      config: (payload: Record<string, unknown>) => void;
      ready: (callback: () => void) => void;
      error: (callback: (error?: any) => void) => void;
    };
    __wechatOpenTagSdkPromise?: Promise<unknown>;
  }
}

const WECHAT_SDK_URL = 'https://res.wx.qq.com/open/js/jweixin-1.6.0.js';

function isWeChatBrowser() {
  if (typeof navigator === 'undefined') return false;
  return /micromessenger/i.test(String(navigator.userAgent || ''));
}

function escapeHtml(text: string) {
  return String(text || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function loadWechatSdk() {
  if (typeof window === 'undefined') return Promise.reject(new Error('wechat_window_missing'));
  if (window.wx) return Promise.resolve(window.wx);
  if (window.__wechatOpenTagSdkPromise) return window.__wechatOpenTagSdkPromise;
  window.__wechatOpenTagSdkPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${WECHAT_SDK_URL}"]`) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(window.wx), { once: true });
      existing.addEventListener('error', () => reject(new Error('wechat_sdk_load_failed')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = WECHAT_SDK_URL;
    script.async = true;
    script.onload = () => resolve(window.wx);
    script.onerror = () => reject(new Error('wechat_sdk_load_failed'));
    document.head.appendChild(script);
  });
  return window.__wechatOpenTagSdkPromise;
}

type Props = {
  appId: string;
  path: string;
  envVersion?: 'release' | 'trial' | 'develop';
  label?: string;
  helperText?: string;
  onLaunch?: () => void;
  onError?: (reason: string) => void;
};

export default function WeChatMiniProgramLaunch({
  appId,
  path,
  envVersion = 'release',
  label = '去视频号观看',
  helperText,
  onLaunch,
  onError,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<'loading' | 'ready' | 'fallback'>('loading');
  const [fallbackReason, setFallbackReason] = useState('');
  const inWeChat = useMemo(() => isWeChatBrowser(), []);

  useEffect(() => {
    if (!String(appId || '').trim() || !String(path || '').trim()) {
      setMode('fallback');
      setFallbackReason('launch_target_missing');
      return;
    }
    if (!inWeChat) {
      setMode('fallback');
      setFallbackReason('not_wechat_browser');
      return;
    }

    let disposed = false;
    const pageUrl = String(window.location.href || '').split('#')[0];

    loadWechatSdk()
      .then(async () => {
        const config = await api.wechatH5OpenTagConfig(pageUrl);
        if (disposed) return;
        if (!config.enabled || !window.wx) {
          setMode('fallback');
          setFallbackReason(String(config.reason || 'wechat_open_tag_disabled'));
          return;
        }
        window.wx.config({
          debug: false,
          appId: config.appId,
          timestamp: config.timestamp,
          nonceStr: config.nonceStr,
          signature: config.signature,
          jsApiList: [],
          openTagList: config.openTagList || ['wx-open-launch-weapp'],
        });
        window.wx.ready(() => {
          if (disposed) return;
          setMode('ready');
        });
        window.wx.error((error) => {
          if (disposed) return;
          const reason = String(error?.errMsg || 'wechat_open_tag_init_failed');
          setMode('fallback');
          setFallbackReason(reason);
          onError?.(reason);
        });
      })
      .catch((error) => {
        if (disposed) return;
        const reason = String(error?.message || 'wechat_sdk_load_failed');
        setMode('fallback');
        setFallbackReason(reason);
        onError?.(reason);
      });

    return () => {
      disposed = true;
    };
  }, [appId, inWeChat, onError, path]);

  useEffect(() => {
    if (mode !== 'ready' || !hostRef.current) return undefined;
    const safeAppId = escapeHtml(appId);
    const safePath = escapeHtml(path);
    const safeEnvVersion = escapeHtml(envVersion);
    const safeLabel = escapeHtml(label);
    hostRef.current.innerHTML = `
      <wx-open-launch-weapp appid="${safeAppId}" path="${safePath}" env-version="${safeEnvVersion}">
        <script type="text/wxtag-template">
          <style>
            .wechat-launch-btn {
              width: 100%;
              display: flex;
              align-items: center;
              justify-content: center;
              border: 0;
              border-radius: 999px;
              background: linear-gradient(135deg, #10b981 0%, #059669 100%);
              color: #ffffff;
              font-size: 16px;
              font-weight: 700;
              min-height: 52px;
              padding: 0 20px;
              box-shadow: 0 12px 24px -12px rgba(5, 150, 105, 0.55);
            }
          </style>
          <button class="wechat-launch-btn">${safeLabel}</button>
        </script>
      </wx-open-launch-weapp>
    `;
    const tag = hostRef.current.querySelector('wx-open-launch-weapp');
    if (!tag) return undefined;
    const handleLaunch = () => onLaunch?.();
    const handleError = (event: Event) => {
      const reason = String((event as CustomEvent)?.detail?.errMsg || 'launch:fail');
      setMode('fallback');
      setFallbackReason(reason);
      onError?.(reason);
    };
    tag.addEventListener('launch', handleLaunch);
    tag.addEventListener('error', handleError as EventListener);
    return () => {
      tag.removeEventListener('launch', handleLaunch);
      tag.removeEventListener('error', handleError as EventListener);
      if (hostRef.current) hostRef.current.innerHTML = '';
    };
  }, [appId, envVersion, label, mode, onError, onLaunch, path]);

  const fallbackCopy =
    fallbackReason === 'not_wechat_browser'
      ? '请在微信内打开当前 H5 页面后再进入视频号课程。'
      : helperText || '当前环境未启用微信开放标签，请检查公众号 JS 安全域名以及 appId/appSecret 配置。';

  if (mode === 'ready') {
    return <div ref={hostRef} />;
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => onError?.(fallbackReason || 'wechat_launch_unavailable')}
        className="w-full min-h-[52px] rounded-full bg-slate-200 text-slate-500 font-bold text-base px-5"
      >
        {label}
      </button>
      <p className="text-xs leading-5 text-slate-500">{fallbackCopy}</p>
    </div>
  );
}
