import { buildBAdminRouteDeps } from '../../skeleton-c-v1/routes/b-admin.deps.mjs';
import { registerBAdminActivityRoutes } from '../../skeleton-c-v1/routes/b-admin-activity.routes.mjs';

export function registerActivityServiceBAdminRoutes(router) {
  registerBAdminActivityRoutes(router, buildBAdminRouteDeps());
}
