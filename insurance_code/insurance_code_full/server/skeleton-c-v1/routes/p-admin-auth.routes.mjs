import { toPAdminLoginCommand } from '../dto/write-commands.dto.mjs';
import { executePAdminLogin } from '../usecases/admin-auth-write.usecase.mjs';

function pAdminAuthWriteErrorResponse(res, err) {
  const code = String(err?.code || err?.message || '');
  if (code === 'LOGIN_PARAMS_REQUIRED') return res.status(400).json({ code, message: '请输入账号和密码' });
  if (code === 'LOGIN_FAILED') return res.status(401).json({ code, message: '账号或密码错误' });
  return res.status(400).json({ code: code || 'LOGIN_FAILED', message: '登录失败' });
}

export function registerPAdminAuthRoutes(app, deps) {
  app.post('/api/p/auth/login', (req, res) => {
    const command = toPAdminLoginCommand({ body: req.body, deps });
    executePAdminLogin(command)
      .then((payload) => res.json(payload))
      .catch((err) => pAdminAuthWriteErrorResponse(res, err));
  });
}
