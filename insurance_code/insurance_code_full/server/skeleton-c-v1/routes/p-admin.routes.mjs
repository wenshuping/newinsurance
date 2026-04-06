import { registerPAdminAuthRoutes } from './p-admin-auth.routes.mjs';
import { registerPAdminActivityRoutes } from './p-admin-activities.routes.mjs';
import { registerPAdminEventRoutes } from './p-admin-events.routes.mjs';
import { registerPAdminGovernanceRoutes } from './p-admin-governance.routes.mjs';
import { registerPAdminLearningRoutes } from './p-admin-learning.routes.mjs';
import { registerPAdminMallRoutes } from './p-admin-mall.routes.mjs';
import { registerPAdminMetricRoutes } from './p-admin-metrics.routes.mjs';
import { registerPAdminOpsRoutes } from './p-admin-ops.routes.mjs';
import { registerPAdminPointsRuleRoutes } from './p-admin-points-rules.routes.mjs';
import { registerPAdminTagRoutes } from './p-admin-tags.routes.mjs';
import { registerPAdminWorkforceRoutes } from './p-admin-workforce.routes.mjs';
import { buildPAdminRouteDeps } from './p-admin.deps.mjs';

export function registerPAdminRoutes(app) {
  const deps = buildPAdminRouteDeps();

  registerPAdminAuthRoutes(app, deps.auth);
  registerPAdminGovernanceRoutes(app, deps.governance);
  registerPAdminOpsRoutes(app, deps.ops);
  registerPAdminActivityRoutes(app, deps.activity);
  registerPAdminLearningRoutes(app, deps.learning);
  registerPAdminWorkforceRoutes(app, deps.workforce);
  registerPAdminMallRoutes(app, deps.mall);
  registerPAdminPointsRuleRoutes(app, deps.pointsRules);
  registerPAdminTagRoutes(app, deps.tags);
  registerPAdminMetricRoutes(app, deps.metrics);
  registerPAdminEventRoutes(app, deps.events);
}
