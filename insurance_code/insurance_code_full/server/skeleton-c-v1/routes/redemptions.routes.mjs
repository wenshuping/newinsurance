import { authRequired, validateBody, validateParams } from '../common/middleware.mjs';
import { getState } from '../common/state.mjs';
import { redemptionIdParamsSchema, writeoffBodySchema } from '../schemas/redemptions.schemas.mjs';
import { toRedemptionWriteoffCommand } from '../dto/write-commands.dto.mjs';
import { executeRedemptionWriteoff } from '../usecases/redemption-writeoff.usecase.mjs';
import { recordPointsOperationOutcome, setPointsRequestContext } from '../../microservices/points-service/observability.mjs';

function mediaToUrl(mediaItem) {
  if (!mediaItem) return '';
  if (typeof mediaItem === 'string') return mediaItem;
  return String(mediaItem.preview || mediaItem.url || mediaItem.path || mediaItem.name || '');
}

function toAbsoluteUrl(req, url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (!raw.startsWith('/')) return raw;
  return `${req.protocol}://${req.get('host')}${raw}`;
}

function resolveRedeemedProduct(state, req, itemId) {
  const targetId = Number(itemId || 0);
  if (targetId <= 0) return null;
  const product =
    (Array.isArray(state.pProducts) ? state.pProducts : []).find((row) => Number(row.id || 0) === targetId) ||
    (Array.isArray(state.mallItems) ? state.mallItems : []).find(
      (item) => Number(item.sourceProductId || item.id || 0) === targetId,
    ) ||
    null;
  if (!product) return null;
  const media = Array.isArray(product.media) ? product.media : [];
  const image = toAbsoluteUrl(req, mediaToUrl(media[0]) || String(product.image || ''));
  return {
    itemName: String(product.name || product.title || ''),
    itemImage: image || '',
  };
}

export function registerRedemptionsRoutes(app) {
  app.get('/api/redemptions', authRequired, (req, res) => {
    setPointsRequestContext({
      route: `${String(req.method || 'GET').toUpperCase()} ${String(req.path || '/api/redemptions')}`,
      user_id: Number(req.user?.id || 0),
    });
    const state = getState();
    const list = state.redemptions
      .filter((row) => row.userId === req.user.id)
      .map((row) => {
        const product = resolveRedeemedProduct(state, req, row.itemId);
        return {
          ...row,
          itemName: String(row.itemName || product?.itemName || ''),
          itemImage: String(product?.itemImage || ''),
        };
      })
      .sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));

    res.json({ list });
  });

  app.post('/api/redemptions/:id/writeoff', authRequired, validateParams(redemptionIdParamsSchema), validateBody(writeoffBodySchema), async (req, res) => {
    setPointsRequestContext({
      route: `${String(req.method || 'POST').toUpperCase()} ${String(req.path || '/api/redemptions/:id/writeoff')}`,
      user_id: Number(req.user?.id || 0),
      redemption_id: Number(req.params?.id || 0),
    });
    try {
      const command = toRedemptionWriteoffCommand({ params: req.params, body: req.body, user: req.user });
      const payload = await executeRedemptionWriteoff(command);
      recordPointsOperationOutcome('writeoff', {
        result: 'success',
        patch: {
          user_id: Number(req.user?.id || 0),
          redemption_id: Number(payload?.redemptionId || req.params?.id || 0),
          order_id: Number(payload?.orderId || 0),
        },
      });
      return res.json(payload);
    } catch (err) {
      const code = err?.message || 'WRITEOFF_FAILED';
      recordPointsOperationOutcome('writeoff', {
        result: 'fail',
        code,
        patch: {
          user_id: Number(req.user?.id || 0),
          redemption_id: Number(req.params?.id || 0),
        },
      });
      if (code === 'REDEMPTION_NOT_FOUND') return res.status(404).json({ code, message: '兑换记录不存在' });
      if (code === 'ALREADY_WRITTEN_OFF') return res.status(409).json({ code, message: '已核销' });
      if (code === 'INVALID_TOKEN') return res.status(400).json({ code, message: '核销码错误' });
      if (code === 'TOKEN_EXPIRED') return res.status(410).json({ code, message: '核销已过期' });
      if (code === 'UNAUTHORIZED') return res.status(401).json({ code, message: '请先登录' });
      return res.status(400).json({ code, message: '核销失败' });
    }
  });
}
