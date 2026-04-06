import { authOptional, authRequired } from '../common/middleware.mjs';
import { hasActivityRewardTransaction } from '../common/activity-reward-state.mjs';
import { buildActivityWriteoffToken, isActivityCompletionWrittenOff, toActivityOrderId } from '../common/activity-writeoff.mjs';
import { tenantContext } from '../common/access-control.mjs';
import { sortRowsByEffectiveTimeDesc } from '../common/effective-time-sort.mjs';
import { dateOnly, getBalance, getState } from '../common/state.mjs';
import { canDeliverTemplateToActor } from '../common/template-visibility.mjs';
import { toActivityCompleteCommand, toSignInCommand } from '../dto/write-commands.dto.mjs';
import { executeActivityComplete } from '../usecases/activity-complete.usecase.mjs';
import { executeSignIn } from '../usecases/signin.usecase.mjs';
import { settleActivityRewardViaPointsService } from '../services/activity-reward.service.mjs';
import { resolveSharedActivityByShare } from '../services/share.service.mjs';

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
  const completion = activityCompletions.find(
    (row) => Number(row.userId || 0) === Number(userId) && Number(row.activityId || 0) === Number(activityId)
  );
  if (!completion) return false;
  return hasActivityRewardTransaction(state, {
    tenantId: Number(completion.tenantId || 1),
    userId,
    activityId,
    completionDate: String(completion.completedDate || ''),
  });
}

function prependSharedActivity({ req, source, state }) {
  const shareCode = String(req?.query?.shareCode || '').trim();
  const activityId = Number(req?.query?.activityId || 0);
  if (!shareCode || !activityId) return Array.isArray(source) ? source : [];
  const sharedActivity = resolveSharedActivityByShare({ req, shareCode, activityId });
  if (!sharedActivity) return Array.isArray(source) ? source : [];
  const seen = new Set();
  return [sharedActivity, ...(Array.isArray(source) ? source : [])].filter((activity) => {
    const id = Number(activity?.id || 0);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function listActivitiesResponse({ actor, user = null, req = {} }) {
  const state = getState();
  const source = Array.isArray(state.activities) ? state.activities : [];
  const enrichedSource = prependSharedActivity({ req, source, state });
  const list = sortRowsByEffectiveTimeDesc(
    enrichedSource
      .filter((activity) => isActivityDomain(activity))
      .filter((activity) => {
        if (canDeliverTemplateToActor(state, actor, activity)) return true;
        const shareCode = String(req?.query?.shareCode || '').trim();
        const activityId = Number(req?.query?.activityId || 0);
        return Boolean(shareCode && activityId && Number(activity?.id || 0) === activityId);
      })
      .map((activity) => normalizeActivity(activity))
  );

  const today = dateOnly(new Date());
  const activities = list.map((activity) => {
    const completed = user
      ? activity.category === 'sign'
        ? state.signIns.some((row) => row.userId === user.id && row.signDate === today)
        : hasCompletedActivity(state, user.id, activity.id)
      : false;

    return {
      ...activity,
      completed,
      canComplete: activity.category !== 'competition',
    };
  });

  const taskActivities = activities.filter((a) => a.canComplete);
  const completedTasks = taskActivities.filter((a) => a.completed).length;

  return {
    activities,
    balance: user ? getBalance(user.id) : 0,
    taskProgress: {
      total: taskActivities.length,
      completed: completedTasks,
    },
  };
}

export function listActivityHistoryResponse({ user }) {
  const state = getState();
  const activityMap = new Map(
    (Array.isArray(state.activities) ? state.activities : [])
      .filter((activity) => isActivityDomain(activity))
      .map((activity) => [Number(activity.id || 0), normalizeActivity(activity)])
  );

  const list = (Array.isArray(state.activityCompletions) ? state.activityCompletions : [])
    .filter((row) => Number(row.userId || 0) === Number(user?.id || 0))
    .map((row) => {
      const activity = activityMap.get(Number(row.activityId || 0));
      if (!activity) return null;
      const completedAt = String(row.completedAt || row.createdAt || '');
      const createdAt = String(row.createdAt || row.completedAt || '');
      const completedDate = String(row.completedDate || completedAt.slice(0, 10) || createdAt.slice(0, 10) || '');
      const writtenOffAt = String(row.writtenOffAt || '').trim();
      return {
        id: Number(row.id || 0),
        activityId: Number(row.activityId || 0),
        orderId: toActivityOrderId(Number(row.id || 0)),
        title: String(activity.title || '活动'),
        description: String(activity.description || ''),
        image: String(activity.image || ''),
        cover: String(activity.cover || ''),
        rewardPoints: Number(row.pointsAwarded || activity.rewardPoints || 0),
        completedDate,
        completedAt,
        createdAt,
        writeoffToken: buildActivityWriteoffToken(row),
        writtenOffAt: writtenOffAt || null,
        writeoffStatus: isActivityCompletionWrittenOff(row) ? 'written_off' : 'pending',
        status: String(activity.status || ''),
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(String(b.completedAt || b.createdAt || 0)).getTime() - new Date(String(a.completedAt || a.createdAt || 0)).getTime());

  return {
    list,
    total: list.length,
  };
}

export function registerActivitiesRoutes(app) {
  app.get('/api/activities', authOptional, tenantContext, (req, res) => {
    return res.json(
      listActivitiesResponse({
        actor: req.actor,
        user: req.user || null,
        req,
      })
    );
  });

  app.get('/api/activities/history', authRequired, tenantContext, (req, res) => {
    return res.json(
      listActivityHistoryResponse({
        user: req.user || null,
      })
    );
  });

  app.post('/api/activities/:id/complete', authRequired, tenantContext, async (req, res) => {
    try {
      const command = {
        ...toActivityCompleteCommand({ params: req.params, query: req.query, user: req.user, actor: req.actor }),
        traceId: String(req.headers['x-trace-id'] || req.traceId || '').trim() || null,
        requestId: String(req.headers['x-request-id'] || req.requestId || req.traceId || '').trim() || null,
        tenantCode: String(req.tenantContext?.tenantCode || '').trim() || null,
      };
      const result = await executeActivityComplete(command, {
        settleReward: settleActivityRewardViaPointsService,
        resolveSharedActivityByShare: ({ shareCode, activityId }) =>
          resolveSharedActivityByShare({ req, shareCode, activityId }),
      });
      return res.json(result);
    } catch (err) {
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
      if (code === 'ACTIVITY_REWARD_SETTLEMENT_HANDLER_REQUIRED') {
        return res.status(500).json({ code, message: '活动奖励结算处理器未配置' });
      }
      if (code === 'ACTIVITY_POINTS_UPSTREAM_UNAVAILABLE') {
        return res.status(502).json({ code, message: '积分服务暂时不可用' });
      }
      if (code === 'ACTIVITY_POINTS_CONTRACT_REJECTED') {
        return res.status(502).json({ code, message: '积分结算契约调用失败' });
      }
      if (code === 'UNAUTHORIZED') return res.status(401).json({ code, message: '请先登录' });
      return res.status(400).json({ code, message: '活动完成失败' });
    }
  });

  app.post('/api/sign-in', authRequired, tenantContext, async (req, res) => {
    try {
      const command = toSignInCommand({ user: req.user, actor: req.actor });
      const result = await executeSignIn(command);
      return res.json(result);
    } catch (err) {
      const code = err?.message || 'SIGN_IN_FAILED';
      if (code === 'NEED_BASIC_VERIFY') return res.status(403).json({ code, message: '请先完成基础身份确认' });
      if (code === 'ALREADY_SIGNED') return res.status(409).json({ code, message: '今日已签到' });
      if (code === 'UNAUTHORIZED') return res.status(401).json({ code, message: '请先登录' });
      return res.status(400).json({ code, message: '签到失败' });
    }
  });
}
