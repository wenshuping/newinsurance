import { authRequired } from '../../skeleton-c-v1/common/middleware.mjs';
import { toSignInCommand } from '../../skeleton-c-v1/dto/write-commands.dto.mjs';
import { executeSignIn } from '../../skeleton-c-v1/usecases/signin.usecase.mjs';
import { recordPointsOperationOutcome, setPointsRequestContext } from './observability.mjs';

export function registerPointsSignInRoute(app) {
  app.post('/api/sign-in', authRequired, async (req, res) => {
    setPointsRequestContext({
      route: `${String(req.method || 'POST').toUpperCase()} ${String(req.path || '/api/sign-in')}`,
      user_id: Number(req.user?.id || 0),
    });

    try {
      const command = toSignInCommand({ user: req.user, actor: req.actor });
      const result = await executeSignIn(command);
      recordPointsOperationOutcome('sign-in', {
        result: 'success',
        patch: {
          user_id: Number(req.user?.id || 0),
        },
      });
      return res.json(result);
    } catch (err) {
      const code = err?.message || 'SIGN_IN_FAILED';
      recordPointsOperationOutcome('sign-in', {
        result: 'fail',
        code,
        patch: {
          user_id: Number(req.user?.id || 0),
        },
      });
      if (code === 'NEED_BASIC_VERIFY') return res.status(403).json({ code, message: '请先完成基础身份确认' });
      if (code === 'ALREADY_SIGNED') return res.status(409).json({ code, message: '今日已签到' });
      if (code === 'UNAUTHORIZED') return res.status(401).json({ code, message: '请先登录' });
      return res.status(400).json({ code, message: '签到失败' });
    }
  });
}
