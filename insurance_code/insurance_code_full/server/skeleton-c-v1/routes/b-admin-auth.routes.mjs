import { toBAdminLoginCommand } from '../dto/write-commands.dto.mjs';
import { executeBAdminLogin } from '../usecases/admin-auth-write.usecase.mjs';

function bAdminAuthWriteErrorResponse(res, err) {
  const code = String(err?.code || err?.message || '');
  if (code === 'LOGIN_PARAMS_REQUIRED') return res.status(400).json({ code, message: '请输入账号和密码' });
  if (code === 'LOGIN_FAILED') return res.status(401).json({ code, message: '账号或密码错误' });
  return res.status(400).json({ code: code || 'LOGIN_FAILED', message: '登录失败' });
}

export function registerBAdminAuthRoutes(app, deps) {
  app.post('/api/b/auth/login', (req, res) => {
    const command = toBAdminLoginCommand({ body: req.body, deps });
    executeBAdminLogin(command)
      .then((payload) => res.json(payload))
      .catch((err) => bAdminAuthWriteErrorResponse(res, err));
  });
}
