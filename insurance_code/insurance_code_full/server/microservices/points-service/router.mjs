import express from 'express';
import { registerPointsRoutes } from '../../skeleton-c-v1/routes/points.routes.mjs';
import { registerMallRoutes } from '../../skeleton-c-v1/routes/mall.routes.mjs';
import { registerRedemptionsRoutes } from '../../skeleton-c-v1/routes/redemptions.routes.mjs';
import { registerOrdersRoutes } from '../../skeleton-c-v1/routes/orders.routes.mjs';
import { registerActivityRewardContractRoute } from './activity-reward.route.mjs';
import { getPointsObservabilitySnapshot } from './observability.mjs';
import { registerLearningRewardContractRoute } from './learning-reward.route.mjs';
import { registerPointsSignInRoute } from './sign-in.route.mjs';

export const pointsServiceOwnedRoutes = [
  '/api/sign-in',
  '/api/points/summary',
  '/api/points/transactions',
  '/api/points/detail',
  '/api/mall/items',
  '/api/mall/activities',
  '/api/mall/redeem',
  '/api/mall/activities/:id/join',
  '/api/redemptions',
  '/api/redemptions/:id/writeoff',
  '/api/orders',
  '/api/orders/:id',
  '/api/orders/:id/pay',
  '/api/orders/:id/cancel',
  '/api/orders/:id/refund',
];

export const createPointsServiceRouter = ({ readiness } = {}) => {
  const router = express.Router();
  registerPointsSignInRoute(router);
  registerPointsRoutes(router);
  registerMallRoutes(router);
  registerRedemptionsRoutes(router);
  registerOrdersRoutes(router);
  registerActivityRewardContractRoute(router);
  registerLearningRewardContractRoute(router);

  router.get('/internal/points-service/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'points-service',
      ownedRouteCount: pointsServiceOwnedRoutes.length,
    });
  });

  router.get('/internal/points-service/ready', (_req, res) => {
    const ok = typeof readiness?.isReady === 'function' ? Boolean(readiness.isReady()) : true;
    const payload = {
      ok,
      service: 'points-service',
      ownedRouteCount: pointsServiceOwnedRoutes.length,
    };
    if (!ok) return res.status(503).json(payload);
    return res.json(payload);
  });

  router.get('/internal/points-service/observability', (_req, res) => {
    return res.json(getPointsObservabilitySnapshot());
  });

  const handleMetrics = (_req, res) => {
    return res.json(getPointsObservabilitySnapshot());
  };

  router.get('/metrics', handleMetrics);
  router.get('/internal/points-service/metrics', handleMetrics);

  return router;
};
