import { permissionRequired, tenantContext } from '../common/access-control.mjs';
import { authOptional, authRequired } from '../common/middleware.mjs';
import { appendTrackEvent, persistCustomersByIds, persistTrackEventsByIds, reloadStateFromStorage } from '../common/state.mjs';
import { assignSharedCustomerOwner, buildShareCreateTrackContext, collectDashboardMetrics, createShareLink, getActivityParticipantList, getCustomerShareNetwork, getDashboardActivityParticipantList, getDashboardCustomerActivityFeed, getDashboardCustomerList, getShareParticipantList, getShareRecordDetail, listShareRecords, noteRecentShareRequestContext, resolveShareDetail, resolveShareTrackingContext } from '../services/share.service.mjs';

function createShareError(res, err) {
  const code = String(err?.message || err?.code || 'SHARE_CREATE_FAILED');
  if (code === 'INVALID_SHARE_TYPE') return res.status(400).json({ code, message: '分享类型不支持' });
  if (code === 'INVALID_SHARE_TARGET_ID') return res.status(400).json({ code, message: '分享目标无效' });
  if (code === 'TENANT_CONTEXT_REQUIRED') return res.status(400).json({ code, message: '缺少租户上下文' });
  if (code === 'SHARE_TARGET_NOT_FOUND') return res.status(404).json({ code, message: '分享目标不存在' });
  if (code === 'SHARE_TARGET_FORBIDDEN') return res.status(403).json({ code, message: '无权限分享该内容' });
  if (code === 'SHARE_TARGET_UNAVAILABLE') return res.status(409).json({ code, message: '分享目标未上架或暂不可分享' });
  return res.status(400).json({ code, message: '创建分享链接失败' });
}

function shareDetailError(res, err) {
  const code = String(err?.message || err?.code || 'SHARE_RESOLVE_FAILED');
  if (code === 'SHARE_RECORD_NOT_FOUND') return res.status(404).json({ code, message: '分享记录不存在' });
  if (code === 'SHARE_CODE_INVALID') return res.status(404).json({ code, message: '分享链接无效' });
  if (code === 'SHARE_CODE_EXPIRED') return res.status(410).json({ code, message: '分享链接已过期' });
  if (code === 'SHARE_TARGET_UNAVAILABLE') return res.status(404).json({ code, message: '分享内容已下线或不可访问' });
  return res.status(400).json({ code, message: '分享解析失败' });
}

async function appendShareTrack({ req, shareCode, eventName }) {
  await reloadStateFromStorage();
  const command = resolveShareTrackingContext({ shareCode, eventName, actor: req.actor, req });
  const trackRow = appendTrackEvent(command);
  await persistTrackEventsByIds([trackRow.id]);
}

async function bindSharedCustomerIfAuthenticated({ req, shareCode }) {
  const actorType = String(req?.actor?.actorType || req?.user?.actorType || '').trim().toLowerCase();
  const actorId = Number(req?.actor?.actorId || req?.user?.id || 0);
  if (actorType !== 'customer' || actorId <= 0) return null;
  const updatedCustomer = assignSharedCustomerOwner({ req, shareCode });
  if (updatedCustomer?.id) {
    await persistCustomersByIds([updatedCustomer.id]);
  }
  return updatedCustomer;
}

export function registerShareRoutes(app) {
  app.post('/api/c/shares', authRequired, tenantContext, async (req, res) => {
    try {
      await reloadStateFromStorage();
      const payload = createShareLink({
        req,
        actor: {
          ...(req.actor || {}),
          ownerUserId: Number(req.user?.ownerUserId || req.tenantContext?.ownerUserId || 0) || null,
        },
        body: req.body || {},
      });
      const trackRow = appendTrackEvent(
        buildShareCreateTrackContext({
          req,
          actor: { ...(req.actor || {}), actorType: 'customer', actorId: Number(req.user?.id || req.actor?.actorId || 0) },
          body: req.body || {},
          share: payload,
        })
      );
      await persistTrackEventsByIds([trackRow.id]);
      return res.json(payload);
    } catch (err) {
      return createShareError(res, err);
    }
  });

  app.post('/api/b/shares', tenantContext, permissionRequired('customer:read'), async (req, res) => {
    try {
      await reloadStateFromStorage();
      const payload = createShareLink({ req, actor: req.actor, body: req.body || {} });
      const trackRow = appendTrackEvent(buildShareCreateTrackContext({ req, actor: req.actor, body: req.body || {}, share: payload }));
      await persistTrackEventsByIds([trackRow.id]);
      return res.json(payload);
    } catch (err) {
      return createShareError(res, err);
    }
  });

  app.get('/api/c/share-friends', authRequired, tenantContext, async (req, res) => {
    try {
      await reloadStateFromStorage();
      return res.json({
        ok: true,
        ...getCustomerShareNetwork({
          customerId: Number(req.user?.id || 0),
          tenantId: Number(req.user?.tenantId || req.tenantContext?.tenantId || 0),
        }),
      });
    } catch (_err) {
      return res.status(400).json({ code: 'CUSTOMER_SHARE_NETWORK_FAILED', message: '我的朋友获取失败' });
    }
  });

  app.get('/api/b/shares', tenantContext, permissionRequired('customer:read'), async (req, res) => {
    try {
      await reloadStateFromStorage();
      return res.json(listShareRecords({ actor: { ...(req.actor || {}), user: req.user || null }, query: req.query || {} }));
    } catch (err) {
      return res.status(400).json({ code: 'SHARE_LIST_FAILED', message: '分享记录获取失败' });
    }
  });

  app.get('/api/b/shares/:shareCode', tenantContext, permissionRequired('customer:read'), async (req, res) => {
    try {
      await reloadStateFromStorage();
      return res.json(getShareRecordDetail({ actor: { ...(req.actor || {}), user: req.user || null }, shareCode: req.params.shareCode }));
    } catch (err) {
      return shareDetailError(res, err);
    }
  });

  app.get('/api/p/metrics/activity-effect', tenantContext, permissionRequired('customer:read'), async (req, res) => {
    try {
      await reloadStateFromStorage();
      return res.json(
        listShareRecords({
          actor: { ...(req.actor || {}), user: req.user || null },
          query: { ...(req.query || {}), shareType: 'activity' },
        })
      );
    } catch (err) {
      return res.status(400).json({ code: 'ACTIVITY_EFFECT_FAILED', message: '活动效果指标获取失败' });
    }
  });

  app.get('/api/p/metrics/learning-effect', tenantContext, permissionRequired('customer:read'), async (req, res) => {
    try {
      await reloadStateFromStorage();
      return res.json(
        listShareRecords({
          actor: { ...(req.actor || {}), user: req.user || null },
          query: { ...(req.query || {}), shareType: 'learning_course' },
        })
      );
    } catch (err) {
      return res.status(400).json({ code: 'LEARNING_EFFECT_FAILED', message: '学习效果指标获取失败' });
    }
  });

  app.get('/api/b/activity-effect/participants', tenantContext, permissionRequired('customer:read'), async (req, res) => {
    try {
      await reloadStateFromStorage();
      return res.json(getActivityParticipantList({ actor: { ...(req.actor || {}), user: req.user || null }, query: req.query || {} }));
    } catch (err) {
      const metric = String(req.query?.metric || 'signup').trim().toLowerCase();
      return res.status(400).json({
        code: 'ACTIVITY_PARTICIPANTS_FAILED',
        message: metric === 'attended' ? '活动参加客户获取失败' : '活动报名客户获取失败',
      });
    }
  });

  app.get('/api/b/dashboard/metrics', tenantContext, permissionRequired('customer:read'), async (req, res) => {
    try {
      await reloadStateFromStorage();
      return res.json(collectDashboardMetrics({ actor: { ...(req.actor || {}), user: req.user || null }, days: req.query?.days || 7 }));
    } catch (err) {
      return res.status(400).json({ code: 'DASHBOARD_METRICS_FAILED', message: '工作台指标获取失败' });
    }
  });

  app.get('/api/b/dashboard/activity-participants', tenantContext, permissionRequired('customer:read'), async (req, res) => {
    try {
      await reloadStateFromStorage();
      return res.json(getDashboardActivityParticipantList({ actor: { ...(req.actor || {}), user: req.user || null }, query: req.query || {} }));
    } catch (err) {
      return res.status(400).json({ code: 'DASHBOARD_ACTIVITY_PARTICIPANTS_FAILED', message: '活动参与客户获取失败' });
    }
  });

  app.get('/api/b/dashboard/customer-list', tenantContext, permissionRequired('customer:read'), async (req, res) => {
    try {
      await reloadStateFromStorage();
      return res.json(getDashboardCustomerList({ actor: { ...(req.actor || {}), user: req.user || null }, query: req.query || {} }));
    } catch (err) {
      return res.status(400).json({ code: 'DASHBOARD_CUSTOMER_LIST_FAILED', message: '客户列表获取失败' });
    }
  });

  app.get('/api/b/dashboard/customer-activity-feed', tenantContext, permissionRequired('customer:read'), async (req, res) => {
    try {
      await reloadStateFromStorage();
      return res.json(getDashboardCustomerActivityFeed({ actor: { ...(req.actor || {}), user: req.user || null }, query: req.query || {} }));
    } catch (err) {
      return res.status(400).json({ code: 'DASHBOARD_CUSTOMER_ACTIVITY_FEED_FAILED', message: '今日用户动态获取失败' });
    }
  });

  app.get('/api/b/share-effect/participants', tenantContext, permissionRequired('customer:read'), async (req, res) => {
    try {
      await reloadStateFromStorage();
      return res.json(getShareParticipantList({ actor: { ...(req.actor || {}), user: req.user || null }, query: req.query || {} }));
    } catch (err) {
      const shareType = String(req.query?.shareType || 'activity');
      const metric = String(req.query?.metric || 'signup').trim().toLowerCase();
      const message =
        shareType === 'learning_course'
          ? '学习参与客户获取失败'
          : shareType === 'mall_item'
            ? '商品参与客户获取失败'
            : shareType === 'mall_activity'
              ? '商城活动参与客户获取失败'
              : metric === 'attended'
                ? '活动参加客户获取失败'
                : '活动报名客户获取失败';
      return res.status(400).json({ code: 'SHARE_EFFECT_PARTICIPANTS_FAILED', message });
    }
  });

  app.get('/api/share/:shareCode', authOptional, tenantContext, (req, res) => {
    try {
      noteRecentShareRequestContext({ req, shareCode: req.params.shareCode });
      return res.json(resolveShareDetail({ req, shareCode: req.params.shareCode }));
    } catch (err) {
      return shareDetailError(res, err);
    }
  });

  app.post('/api/share/:shareCode/view', authOptional, tenantContext, async (req, res) => {
    try {
      noteRecentShareRequestContext({ req, shareCode: req.params.shareCode });
      await bindSharedCustomerIfAuthenticated({ req, shareCode: req.params.shareCode });
      await appendShareTrack({ req, shareCode: req.params.shareCode, eventName: 'share_h5_view' });
      return res.json({ ok: true });
    } catch (err) {
      return shareDetailError(res, err);
    }
  });

  app.post('/api/share/:shareCode/click', authOptional, tenantContext, async (req, res) => {
    try {
      noteRecentShareRequestContext({ req, shareCode: req.params.shareCode });
      await bindSharedCustomerIfAuthenticated({ req, shareCode: req.params.shareCode });
      await appendShareTrack({ req, shareCode: req.params.shareCode, eventName: 'share_h5_click_cta' });
      return res.json({ ok: true });
    } catch (err) {
      return shareDetailError(res, err);
    }
  });

  app.post('/api/share/:shareCode/identify', authOptional, tenantContext, async (req, res) => {
    try {
      const updatedCustomer = assignSharedCustomerOwner({ req, shareCode: req.params.shareCode });
      if (updatedCustomer?.id) {
        await persistCustomersByIds([updatedCustomer.id]);
      }
      await appendShareTrack({ req, shareCode: req.params.shareCode, eventName: 'share_customer_identified' });
      return res.json({ ok: true });
    } catch (err) {
      return shareDetailError(res, err);
    }
  });
}
