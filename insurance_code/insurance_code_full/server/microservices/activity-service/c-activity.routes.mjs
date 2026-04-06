import { authOptional, authRequired } from '../../skeleton-c-v1/common/middleware.mjs';
import { tenantContext } from '../../skeleton-c-v1/common/access-control.mjs';
import { sortRowsByEffectiveTimeDesc } from '../../skeleton-c-v1/common/effective-time-sort.mjs';
import { dateOnly, getBalance, getState } from '../../skeleton-c-v1/common/state.mjs';
import { canDeliverTemplateToActor } from '../../skeleton-c-v1/common/template-visibility.mjs';
import { toActivityCompleteCommand } from '../../skeleton-c-v1/dto/write-commands.dto.mjs';
import { executeActivityComplete } from '../../skeleton-c-v1/usecases/activity-complete.usecase.mjs';
import { recordActivityOperationOutcome, setActivityRequestContext } from './observability.mjs';
import { settleActivityRewardOverHttp } from './points-service.client.mjs';

function mediaToUrl(mediaItem) {
  if (!mediaItem) return '';
  if (typeof mediaItem === 'string') return mediaItem;
  return String(mediaItem.preview || mediaItem.url || mediaItem.path || mediaItem.name || '');
}

function normalizeActivity(activity = {}) {
  const media = Array.isArray(activity.media) ? activity.media : [];
  const cover = mediaToUrl(media[0]) || String(activity.image || activity.cover || '');
  return {
    ...activity,
    image: cover,
    cover,
    media,
    participants: Number(activity.participants || 0),
    rewardPoints: Number(activity.rewardPoints || 0),
    description: String(activity.content || activity.description || activity.desc || ''),
  };
}

function isActivityDomain(activity = {}) {
  const domain = String(activity.sourceDomain || activity.source_domain || 'activity').trim().toLowerCase();
  return domain === 'activity' || domain === '';
}

function hasCompletedActivity(state, userId, activityId) {
  const activityCompletions = Array.isArray(state.activityCompletions) ? state.activityCompletions : [];
  return activityCompletions.some(
    (row) => Number(row.userId || 0) === Number(userId) && Number(row.activityId || 0) === Number(activityId)
  );
}

function errorResponse(res, err) {
  const code = err?.message || 'ACTIVITY_COMPLETE_FAILED';
  if (code === 'ACTIVITY_NOT_FOUND') return res.status(404).json({ code, message: '活动不存在' });
  if (code === 'USE_SIGN_IN') return res.status(409).json({ code, message: '签到任务请使用签到接口' });
  if (code === 'MANUAL_FLOW_REQUIRED') return res.status(409).json({ code, message: '该活动需通过活动页参与，不支持直接完成' });
  if (code === 'ACTIVITY_NOT_AVAILABLE') return res.status(409).json({ code, message: '活动未上架或已下线' });
  if (code === 'NO_PERMISSION') return res.status(403).json({ code, message: '暂无权限，请联系管理员' });
  if (code === 'NEED_BASIC_VERIFY') return res.status(403).json({ code, message: '请先完成基础身份确认' });
  if (code === 'ALREADY_COMPLETED') return res.status(409).json({ code, message: '该活动已参与' });
  if (code === 'INVALID_ACTIVITY_ID') return res.status(400).json({ code, message: '活动ID无效' });
  if (code === 'INVALID_ACTIVITY_REWARD_USER') return res.status(401).json({ code, message: '活动奖励落账用户无效' });
  if (code === 'INVALID_ACTIVITY_REWARD_ACTIVITY_ID') return res.status(400).json({ code, message: '活动奖励落账活动ID无效' });
  if (code === 'INVALID_ACTIVITY_REWARD_POINTS') return res.status(409).json({ code, message: '活动奖励配置无效' });
  if (code === 'INVALID_ACTIVITY_REWARD_DATE') return res.status(400).json({ code, message: '活动奖励日期无效' });
  if (code === 'ACTIVITY_REWARD_SETTLEMENT_HANDLER_REQUIRED') return res.status(500).json({ code, message: '活动奖励结算处理器未配置' });
  if (code === 'ACTIVITY_POINTS_UPSTREAM_UNAVAILABLE') return res.status(502).json({ code, message: '积分服务暂时不可用' });
  if (code === 'ACTIVITY_POINTS_CONTRACT_REJECTED') return res.status(502).json({ code, message: '积分结算契约调用失败' });
  if (code === 'UNAUTHORIZED') return res.status(401).json({ code, message: '请先登录' });
  return res.status(400).json({ code, message: '活动完成失败' });
}

export function registerActivityServiceClientRoutes(router) {
  router.get('/api/activities', authOptional, tenantContext, (req, res) => {
    const state = getState();
    const source = Array.isArray(state.activities) ? state.activities : [];
    const list = sortRowsByEffectiveTimeDesc(
      source
        .filter((activity) => isActivityDomain(activity))
        .filter((activity) => canDeliverTemplateToActor(state, req.actor, activity))
        .map((activity) => normalizeActivity(activity))
    );

    const today = dateOnly(new Date());
    const activities = list.map((activity) => {
      const completed = req.user
        ? activity.category === 'sign'
          ? (Array.isArray(state.signIns) ? state.signIns : []).some(
              (row) => Number(row.userId || 0) === Number(req.user.id) && String(row.signDate || '') === today
            )
          : hasCompletedActivity(state, req.user.id, activity.id)
        : false;

      return {
        ...activity,
        completed,
        canComplete: activity.category !== 'competition' && activity.category !== 'sign',
      };
    });

    const taskActivities = activities.filter((activity) => activity.canComplete);
    const completedTasks = taskActivities.filter((activity) => activity.completed).length;

    return res.json({
      activities,
      balance: req.user ? getBalance(req.user.id) : 0,
      taskProgress: {
        total: taskActivities.length,
        completed: completedTasks,
      },
    });
  });

  router.post('/api/activities/:id/complete', authRequired, tenantContext, async (req, res) => {
    setActivityRequestContext({
      route: `${String(req.method || 'POST').toUpperCase()} /api/activities/:id/complete`,
      user_id: Number(req.user?.id || 0),
      activity_id: Number(req.params?.id || 0),
    });

    try {
      const command = {
        ...toActivityCompleteCommand({ params: req.params, user: req.user, actor: req.actor }),
        traceId: String(req.headers['x-trace-id'] || req.traceId || '').trim() || null,
        requestId: String(req.headers['x-request-id'] || req.requestId || req.traceId || '').trim() || null,
        tenantCode: String(req.tenantContext?.tenantCode || '').trim() || null,
      };
      const payload = await executeActivityComplete(command, {
        settleReward: settleActivityRewardOverHttp,
      });
      recordActivityOperationOutcome('activity-complete', {
        result: 'success',
        patch: {
          user_id: Number(req.user?.id || 0),
          activity_id: Number(req.params?.id || 0),
        },
      });
      return res.json(payload);
    } catch (err) {
      recordActivityOperationOutcome('activity-complete', {
        result: 'fail',
        code: err?.message || 'ACTIVITY_COMPLETE_FAILED',
        patch: {
          user_id: Number(req.user?.id || 0),
          activity_id: Number(req.params?.id || 0),
        },
      });
      return errorResponse(res, err);
    }
  });
}
