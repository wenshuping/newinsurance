import { buildBAdminRouteDeps } from './b-admin.deps.mjs';
import { registerBAdminActivityRoutes } from './b-admin-activity.routes.mjs';
import { registerBAdvisorRoutes } from './advisor.routes.mjs';
import { registerBAdminAuthRoutes } from './b-admin-auth.routes.mjs';
import { registerBAdminContentRoutes } from './b-admin-content.routes.mjs';
import { registerBAdminCustomerRoutes } from './b-admin-customers.routes.mjs';
import { registerBAdminMallRoutes } from './b-admin-mall.routes.mjs';
import { registerBAdminOrderRoutes } from './b-admin-orders.routes.mjs';
import { registerBAdminPermissionRoutes } from './b-admin-permissions.routes.mjs';

export function registerBAdminRoutes(app, customDeps = {}) {
  const deps = { ...buildBAdminRouteDeps(), ...customDeps };

  registerBAdminAuthRoutes(app, deps);
  registerBAdvisorRoutes(app);
  registerBAdminCustomerRoutes(app, deps);
  registerBAdminPermissionRoutes(app, deps);
  registerBAdminContentRoutes(app, deps);
  registerBAdminActivityRoutes(app, deps);
  registerBAdminMallRoutes(app, deps);
  registerBAdminOrderRoutes(app, deps);
}
