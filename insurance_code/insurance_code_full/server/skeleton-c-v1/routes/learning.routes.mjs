import { authOptional, authRequired } from '../common/middleware.mjs';
import { tenantContext } from '../common/access-control.mjs';
import { toLearningCompleteCommand } from '../dto/write-commands.dto.mjs';
import {
  getLearningCourseById,
  listLearningCourses,
  listLearningGames,
  listLearningTools,
} from '../usecases/learning-query.usecase.mjs';
import { executeLearningComplete } from '../usecases/learning-complete.usecase.mjs';
import { settleLearningCourseRewardViaPointsService } from '../services/learning-reward.service.mjs';
import { resolveSharedLearningCourseByShare } from '../services/share.service.mjs';

function errorResponse(res, err) {
  const code = err?.message || 'UNKNOWN_ERROR';
  if (code === 'COURSE_NOT_FOUND') return res.status(404).json({ code, message: '课程不存在' });
  if (code === 'COURSE_NOT_AVAILABLE') return res.status(409).json({ code, message: '课程未上架或已下线' });
  if (code === 'NO_PERMISSION') return res.status(403).json({ code, message: '暂无权限，请联系管理员' });
  if (code === 'INVALID_COURSE_ID') return res.status(400).json({ code, message: '课程ID无效' });
  if (code === 'COURSE_VIDEO_NOT_COMPLETED') return res.status(409).json({ code, message: '视频需看完后才可领取积分' });
  if (code === 'COURSE_ARTICLE_NOT_FINISHED') return res.status(409).json({ code, message: '请完整浏览文案后再领取积分' });
  if (code === 'COURSE_ARTICLE_DWELL_TOO_SHORT') return res.status(409).json({ code, message: '文案停留至少30秒后才可领取积分' });
  if (code === 'TENANT_CONTEXT_REQUIRED') return res.status(400).json({ code, message: '缺少租户上下文' });
  return res.status(400).json({ code, message: '请求处理失败' });
}

export function registerLearningRoutes(app) {
  app.get('/api/learning/courses', authOptional, tenantContext, (req, res) => {
    return res.json(listLearningCourses({ actor: req.actor, req }));
  });

  app.get('/api/learning/courses/:id', authOptional, tenantContext, (req, res) => {
    try {
      return res.json(
        getLearningCourseById({
          courseId: Number(req.params.id),
          actor: req.actor,
          req,
        }),
      );
    } catch (err) {
      const code = err?.message || 'UNKNOWN_ERROR';
      if (code === 'COURSE_NOT_FOUND') return res.status(404).json({ code, message: '课程不存在' });
      return res.status(400).json({ code, message: '请求处理失败' });
    }
  });

  app.post('/api/learning/courses/:id/complete', authRequired, tenantContext, async (req, res) => {
    try {
      const command = {
        ...toLearningCompleteCommand({ params: req.params, body: req.body, query: req.query, user: req.user, actor: req.actor }),
        traceId: String(req.headers['x-trace-id'] || req.traceId || '').trim() || null,
        requestId: String(req.headers['x-request-id'] || req.requestId || req.traceId || '').trim() || null,
        tenantCode: String(req.tenantContext?.tenantCode || '').trim() || null,
      };
      const payload = await executeLearningComplete(command, {
        settleReward: settleLearningCourseRewardViaPointsService,
        resolveSharedCourseByShare: ({ shareCode, courseId }) =>
          resolveSharedLearningCourseByShare({ req, shareCode, courseId }),
      });
      return res.json({ ok: true, ...payload });
    } catch (err) {
      if (err?.message === 'LEARNING_POINTS_UPSTREAM_UNAVAILABLE') {
        return res.status(502).json({ code: err.message, message: '积分服务暂时不可用' });
      }
      if (err?.message === 'LEARNING_POINTS_CONTRACT_REJECTED') {
        return res.status(502).json({ code: err.message, message: '积分结算契约调用失败' });
      }
      return errorResponse(res, err);
    }
  });
  app.get('/api/learning/games', (_req, res) => {
    return res.json(listLearningGames());
  });
  app.get('/api/learning/tools', (_req, res) => {
    return res.json(listLearningTools());
  });
}
