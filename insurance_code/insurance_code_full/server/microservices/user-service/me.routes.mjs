import { authRequired } from '../../skeleton-c-v1/common/middleware.mjs';
import { formatUser, getBalance, persistState } from '../../skeleton-c-v1/common/state.mjs';
import { toTouchMeCommand } from '../../skeleton-c-v1/dto/write-commands.dto.mjs';
import { executeTouchMe } from '../../skeleton-c-v1/usecases/user-write.usecase.mjs';

const buildMePayload = (req) => ({
  user: formatUser(req.user),
  balance: getBalance(req.user.id),
  csrfToken: req.session?.csrfToken || null,
});

export function registerUserServiceMeRoutes(app) {
  app.get('/api/me', authRequired, (req, res) => {
    res.locals.userServiceUserId = Number(req.user?.id || 0) || null;
    res.locals.userServiceTenantId = Number(req.user?.tenantId || 0) || null;
    const command = toTouchMeCommand({ user: req.user, headers: req.headers, deps: { persistState } });

    executeTouchMe(command)
      .then(() => res.json(buildMePayload(req)))
      .catch((err) => {
        res.locals.userServiceResult = 'me_degraded_success';
        res.locals.userServiceErrorCode = String(err?.message || 'ME_TOUCH_FAILED');
        return res.json(buildMePayload(req));
      });
  });
}
