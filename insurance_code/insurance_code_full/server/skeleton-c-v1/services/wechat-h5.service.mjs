import crypto from 'node:crypto';

const DEFAULT_OPEN_TAG_LIST = ['wx-open-launch-weapp'];
const CACHE_SKEW_MS = 60 * 1000;
const DEFAULT_H5_OAUTH_SCOPE = 'snsapi_base';

const accessTokenCache = {
  value: '',
  expiresAt: 0,
};

const jsapiTicketCache = {
  value: '',
  expiresAt: 0,
};

function nowMs() {
  return Date.now();
}

function getWechatH5Credentials() {
  const appId = String(
    process.env.WECHAT_H5_APP_ID
      || process.env.WECHAT_SERVICE_APP_ID
      || process.env.WX_SERVICE_APP_ID
      || '',
  ).trim();
  const appSecret = String(
    process.env.WECHAT_H5_APP_SECRET
      || process.env.WECHAT_SERVICE_APP_SECRET
      || process.env.WX_SERVICE_APP_SECRET
      || '',
  ).trim();
  return {
    appId,
    appSecret,
  };
}

async function fetchWechatJson(url) {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`WECHAT_HTTP_${response.status}`);
  }
  const payload = await response.json();
  if (Number(payload?.errcode || 0) !== 0) {
    throw new Error(`WECHAT_API_${payload?.errcode || 'UNKNOWN'}:${payload?.errmsg || 'unknown'}`);
  }
  return payload;
}

async function getAccessToken({ appId, appSecret }) {
  if (accessTokenCache.value && accessTokenCache.expiresAt > nowMs() + CACHE_SKEW_MS) {
    return accessTokenCache.value;
  }
  const url = new URL('https://api.weixin.qq.com/cgi-bin/token');
  url.searchParams.set('grant_type', 'client_credential');
  url.searchParams.set('appid', appId);
  url.searchParams.set('secret', appSecret);
  const payload = await fetchWechatJson(url.toString());
  accessTokenCache.value = String(payload.access_token || '');
  accessTokenCache.expiresAt = nowMs() + Number(payload.expires_in || 7200) * 1000;
  return accessTokenCache.value;
}

async function getJsapiTicket(credentials) {
  if (jsapiTicketCache.value && jsapiTicketCache.expiresAt > nowMs() + CACHE_SKEW_MS) {
    return jsapiTicketCache.value;
  }
  const accessToken = await getAccessToken(credentials);
  const url = new URL('https://api.weixin.qq.com/cgi-bin/ticket/getticket');
  url.searchParams.set('access_token', accessToken);
  url.searchParams.set('type', 'jsapi');
  const payload = await fetchWechatJson(url.toString());
  jsapiTicketCache.value = String(payload.ticket || '');
  jsapiTicketCache.expiresAt = nowMs() + Number(payload.expires_in || 7200) * 1000;
  return jsapiTicketCache.value;
}

function normalizePageUrl(rawUrl) {
  const value = String(rawUrl || '').trim();
  if (!value) throw new Error('WECHAT_H5_URL_REQUIRED');
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('WECHAT_H5_URL_INVALID');
  }
  url.hash = '';
  return url.toString();
}

function getWechatH5OauthScope() {
  const scope = String(process.env.WECHAT_H5_OAUTH_SCOPE || DEFAULT_H5_OAUTH_SCOPE)
    .trim()
    .toLowerCase();
  return scope || DEFAULT_H5_OAUTH_SCOPE;
}

function isWechatH5OauthEnabled() {
  const value = String(process.env.WECHAT_H5_OAUTH_ENABLED || '')
    .trim()
    .toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(value);
}

function signWechatJsapiTicket({ jsapiTicket, nonceStr, timestamp, url }) {
  const raw = `jsapi_ticket=${jsapiTicket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${url}`;
  return crypto.createHash('sha1').update(raw).digest('hex');
}

export async function resolveWechatH5OpenTagConfig({ url, openTagList = DEFAULT_OPEN_TAG_LIST }) {
  const normalizedUrl = normalizePageUrl(url);
  const credentials = getWechatH5Credentials();
  if (!credentials.appId || !credentials.appSecret) {
    return {
      ok: true,
      enabled: false,
      reason: 'wechat_h5_credentials_missing',
    };
  }

  try {
    const jsapiTicket = await getJsapiTicket(credentials);
    const nonceStr = crypto.randomBytes(8).toString('hex');
    const timestamp = Math.floor(nowMs() / 1000);
    return {
      ok: true,
      enabled: true,
      appId: credentials.appId,
      timestamp,
      nonceStr,
      signature: signWechatJsapiTicket({
        jsapiTicket,
        nonceStr,
        timestamp,
        url: normalizedUrl,
      }),
      openTagList: Array.isArray(openTagList) && openTagList.length ? openTagList : DEFAULT_OPEN_TAG_LIST,
    };
  } catch (error) {
    return {
      ok: true,
      enabled: false,
      reason: String(error?.message || 'wechat_h5_upstream_unavailable'),
    };
  }
}

export function resolveWechatH5AuthorizeUrl({ redirectUrl, state = 'insurance_h5_auth', scope = getWechatH5OauthScope() }) {
  const normalizedRedirectUrl = normalizePageUrl(redirectUrl);
  const credentials = getWechatH5Credentials();
  if (!isWechatH5OauthEnabled()) {
    return {
      ok: true,
      enabled: false,
      reason: 'wechat_h5_oauth_disabled',
    };
  }
  if (!credentials.appId || !credentials.appSecret) {
    return {
      ok: true,
      enabled: false,
      reason: 'wechat_h5_credentials_missing',
    };
  }

  const authorizeUrl = new URL('https://open.weixin.qq.com/connect/oauth2/authorize');
  authorizeUrl.searchParams.set('appid', credentials.appId);
  authorizeUrl.searchParams.set('redirect_uri', normalizedRedirectUrl);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('scope', scope);
  authorizeUrl.searchParams.set('state', String(state || 'insurance_h5_auth'));

  return {
    ok: true,
    enabled: true,
    appId: credentials.appId,
    scope,
    authorizeUrl: `${authorizeUrl.toString()}#wechat_redirect`,
  };
}

export async function resolveWechatH5IdentityByCode({ code }) {
  const normalizedCode = String(code || '').trim();
  if (!normalizedCode) throw new Error('WECHAT_H5_CODE_REQUIRED');
  const credentials = getWechatH5Credentials();
  if (!credentials.appId || !credentials.appSecret) throw new Error('WECHAT_H5_CREDENTIALS_MISSING');

  const url = new URL('https://api.weixin.qq.com/sns/oauth2/access_token');
  url.searchParams.set('appid', credentials.appId);
  url.searchParams.set('secret', credentials.appSecret);
  url.searchParams.set('code', normalizedCode);
  url.searchParams.set('grant_type', 'authorization_code');

  const payload = await fetchWechatJson(url.toString());
  return {
    openId: String(payload.openid || '').trim(),
    unionId: String(payload.unionid || '').trim(),
    appType: 'h5',
    scope: String(payload.scope || '').trim(),
  };
}
