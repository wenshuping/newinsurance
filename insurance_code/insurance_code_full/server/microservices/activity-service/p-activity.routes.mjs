import { buildActivityDeps } from '../../skeleton-c-v1/routes/p-admin.deps.mjs';
import { registerPAdminActivityRoutes } from '../../skeleton-c-v1/routes/p-admin-activities.routes.mjs';

export function registerActivityServicePAdminRoutes(router) {
  registerPAdminActivityRoutes(router, buildActivityDeps());
}
