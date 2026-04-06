import { afterEach, describe, expect, it } from 'vitest';

import { resolveWechatH5AuthorizeUrl } from '../server/skeleton-c-v1/services/wechat-h5.service.mjs';

const originalEnv = {
  WECHAT_H5_OAUTH_ENABLED: process.env.WECHAT_H5_OAUTH_ENABLED,
  WECHAT_H5_APP_ID: process.env.WECHAT_H5_APP_ID,
  WECHAT_H5_APP_SECRET: process.env.WECHAT_H5_APP_SECRET,
};

afterEach(() => {
  process.env.WECHAT_H5_OAUTH_ENABLED = originalEnv.WECHAT_H5_OAUTH_ENABLED;
  process.env.WECHAT_H5_APP_ID = originalEnv.WECHAT_H5_APP_ID;
  process.env.WECHAT_H5_APP_SECRET = originalEnv.WECHAT_H5_APP_SECRET;
});

describe('wechat h5 oauth', () => {
  it('returns disabled when oauth switch is off', () => {
    process.env.WECHAT_H5_OAUTH_ENABLED = 'false';
    process.env.WECHAT_H5_APP_ID = 'wx-demo-appid';
    process.env.WECHAT_H5_APP_SECRET = 'demo-secret';

    const payload = resolveWechatH5AuthorizeUrl({
      redirectUrl: 'http://10.53.1.195:3003/?tenantId=2',
    });

    expect(payload).toMatchObject({
      ok: true,
      enabled: false,
      reason: 'wechat_h5_oauth_disabled',
    });
  });

  it('returns authorize url when oauth switch is on', () => {
    process.env.WECHAT_H5_OAUTH_ENABLED = 'true';
    process.env.WECHAT_H5_APP_ID = 'wx-demo-appid';
    process.env.WECHAT_H5_APP_SECRET = 'demo-secret';

    const payload = resolveWechatH5AuthorizeUrl({
      redirectUrl: 'http://10.53.1.195:3003/?tenantId=2',
    });

    expect(payload.ok).toBe(true);
    expect(payload.enabled).toBe(true);
    expect(payload.authorizeUrl).toContain('open.weixin.qq.com');
    expect(payload.authorizeUrl).toContain('snsapi_base');
  });
});
