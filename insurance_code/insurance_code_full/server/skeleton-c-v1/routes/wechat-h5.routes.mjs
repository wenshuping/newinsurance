import { resolveWechatH5AuthorizeUrl, resolveWechatH5OpenTagConfig } from '../services/wechat-h5.service.mjs';

export function registerWechatH5Routes(app) {
  app.get('/api/wechat/h5/oauth-url', async (req, res) => {
    const redirectUrl = String(req.query?.redirectUrl || req.query?.url || '').trim();
    if (!redirectUrl) {
      return res.status(400).json({
        ok: false,
        code: 'WECHAT_H5_URL_REQUIRED',
        message: 'redirectUrl is required',
      });
    }
    try {
      const payload = resolveWechatH5AuthorizeUrl({
        redirectUrl,
        state: String(req.query?.state || 'insurance_h5_auth'),
      });
      return res.json(payload);
    } catch (error) {
      const code = String(error?.message || 'WECHAT_H5_OAUTH_URL_FAILED');
      const status = code.includes('INVALID') || code.includes('REQUIRED') ? 400 : 500;
      return res.status(status).json({
        ok: false,
        code,
        message: code,
      });
    }
  });

  app.get('/api/wechat/h5/open-tag-config', async (req, res) => {
    const rawUrl = String(req.query?.url || '').trim();
    if (!rawUrl) {
      return res.status(400).json({
        ok: false,
        code: 'WECHAT_H5_URL_REQUIRED',
        message: 'url is required',
      });
    }
    try {
      const payload = await resolveWechatH5OpenTagConfig({
        url: rawUrl,
      });
      return res.json(payload);
    } catch (error) {
      const code = String(error?.message || 'WECHAT_H5_CONFIG_FAILED');
      const status = code.includes('INVALID') || code.includes('REQUIRED') ? 400 : 500;
      return res.status(status).json({
        ok: false,
        code,
        message: code,
      });
    }
  });
}
