import { registerActivitiesRoutes } from './activities.routes.mjs';
import { registerCAdvisorRoutes } from './advisor.routes.mjs';
import { registerAuthRoutes } from './auth.routes.mjs';
import { registerHealthRoutes } from './health.routes.mjs';
import { registerInsuranceRoutes } from './insurance.routes.mjs';
import { registerLearningRoutes } from './learning.routes.mjs';
import { registerMallRoutes } from './mall.routes.mjs';
import { registerOrdersRoutes } from './orders.routes.mjs';
import { registerPointsRoutes } from './points.routes.mjs';
import { registerRedemptionsRoutes } from './redemptions.routes.mjs';
import { registerUserRoutes } from './user.routes.mjs';
import { registerWechatH5Routes } from './wechat-h5.routes.mjs';

export function registerCAppRoutes(app) {
  registerHealthRoutes(app);
  registerWechatH5Routes(app);
  registerAuthRoutes(app);
  registerUserRoutes(app);
  registerCAdvisorRoutes(app);
  registerActivitiesRoutes(app);
  registerPointsRoutes(app);
  registerMallRoutes(app);
  registerRedemptionsRoutes(app);
  registerOrdersRoutes(app);
  registerLearningRoutes(app);
  registerInsuranceRoutes(app);
}
