import express from 'express';
import { getState, getStorageBackend } from '../../skeleton-c-v1/common/state.mjs';
import {
  activityServiceMainWriteTables,
  activityServiceOwnedRoutes,
  activityServiceRewardSettlementContract,
  activityServiceStableContracts,
  summarizeActivityServiceBoundary,
} from './boundary.mjs';
import { registerActivityServiceBAdminRoutes } from './b-activity.routes.mjs';
import { registerActivityServiceClientRoutes } from './c-activity.routes.mjs';
import { getActivityObservabilitySnapshot } from './observability.mjs';
import { registerActivityServicePAdminRoutes } from './p-activity.routes.mjs';

export const buildActivityServiceHealth = () => ({
  ok: true,
  service: 'activity-service',
  storage: getStorageBackend(),
  stableContractCount: activityServiceStableContracts.length,
});

export const buildActivityServiceReady = ({ readiness } = {}) => {
  const state = getState();
  const lifecycleReady = typeof readiness?.isReady === 'function' ? Boolean(readiness.isReady()) : true;
  return {
    ok: lifecycleReady,
    service: 'activity-service',
    storage: getStorageBackend(),
    boundary: summarizeActivityServiceBoundary(),
    stableContracts: activityServiceStableContracts,
    ownedRoutes: activityServiceOwnedRoutes,
    mainWriteTables: activityServiceMainWriteTables,
    rewardSettlementContract: activityServiceRewardSettlementContract,
    ownership: {
      activityRows: Array.isArray(state.activities)
        ? state.activities.filter((row) => String(row?.sourceDomain || row?.source_domain || 'activity').trim().toLowerCase() === 'activity').length
        : 0,
      activityCompletions: Array.isArray(state.activityCompletions) ? state.activityCompletions.length : 0,
    },
  };
};

export const createActivityServiceRouter = ({ readiness } = {}) => {
  const router = express.Router();

  registerActivityServiceClientRoutes(router);
  registerActivityServicePAdminRoutes(router);
  registerActivityServiceBAdminRoutes(router);

  router.get('/internal/activity-service/health', (_req, res) => {
    res.json(buildActivityServiceHealth());
  });

  router.get('/internal/activity-service/ready', (_req, res) => {
    const payload = buildActivityServiceReady({ readiness });
    if (!payload.ok) return res.status(503).json(payload);
    return res.json(payload);
  });

  router.get('/internal/activity-service/observability', (_req, res) => {
    return res.json(getActivityObservabilitySnapshot());
  });

  router.get('/metrics', (_req, res) => {
    return res.json(getActivityObservabilitySnapshot());
  });

  router.get('/internal/activity-service/metrics', (_req, res) => {
    return res.json(getActivityObservabilitySnapshot());
  });

  router.use((req, res) => {
    res.status(404).json({
      code: 'NOT_FOUND',
      message: 'activity-service route not found',
      path: req.originalUrl || req.url || '',
    });
  });

  return router;
};
