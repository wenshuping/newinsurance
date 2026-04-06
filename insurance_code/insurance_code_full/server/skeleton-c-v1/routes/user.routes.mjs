import { authOptional, authRequired } from '../common/middleware.mjs';
import { formatUser, getBalance, persistState } from '../common/state.mjs';
import { toTouchMeCommand } from '../dto/write-commands.dto.mjs';
import { executeTouchMe } from '../usecases/user-write.usecase.mjs';

export function registerUserRoutes(app) {
  app.get('/api/bootstrap', authOptional, (req, res) => {
    const user = req.user || null;
    return res.json({
      user: user ? formatUser(user) : null,
      balance: user ? getBalance(user.id) : 0,
      csrfToken: req.session?.csrfToken || null,
      tabs: ['home', 'learning', 'activities', 'insurance', 'profile'],
    });
  });

  app.get('/api/me', authRequired, (req, res) => {
    const command = toTouchMeCommand({ user: req.user, headers: req.headers, deps: { persistState } });
    executeTouchMe(command)
      .then(() =>
        res.json({
          user: formatUser(req.user),
          balance: getBalance(req.user.id),
          csrfToken: req.session?.csrfToken || null,
        })
      )
      .catch(() =>
        res.json({
          user: formatUser(req.user),
          balance: getBalance(req.user.id),
          csrfToken: req.session?.csrfToken || null,
        })
      );
  });
}
