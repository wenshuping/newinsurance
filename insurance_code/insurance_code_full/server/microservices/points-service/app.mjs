import express from 'express';
import { corsMiddleware, csrfProtection } from '../../skeleton-c-v1/common/middleware.mjs';
import { getState, getStorageBackend } from '../../skeleton-c-v1/common/state.mjs';
import { unifiedAuthAndTenantContext } from '../shared/auth-context.mjs';
import { createPointsObservabilityMiddleware, resetPointsObservability } from './observability.mjs';
import { createPointsServiceRouter, pointsServiceOwnedRoutes } from './router.mjs';

function getReadinessSnapshot() {
  const state = getState();
  return {
    users: Array.isArray(state.users),
    pointAccounts: Array.isArray(state.pointAccounts),
    pointTransactions: Array.isArray(state.pointTransactions),
    products: Array.isArray(state.pProducts),
    orders: Array.isArray(state.orders),
    redemptions: Array.isArray(state.redemptions),
    signIns: Array.isArray(state.signIns),
  };
}

export const createPointsServiceApp = ({ readiness } = {}) => {
  resetPointsObservability();
  const app = express();

  app.use(express.json({ limit: '30mb' }));
  app.use(corsMiddleware);
  app.use(unifiedAuthAndTenantContext);
  app.use(createPointsObservabilityMiddleware());
  app.use(csrfProtection);

  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'points-service',
      storage: getStorageBackend(),
      ownedRouteCount: pointsServiceOwnedRoutes.length,
    });
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'points-service',
      storage: getStorageBackend(),
    });
  });

  app.get('/ready', (_req, res) => {
    const checks = getReadinessSnapshot();
    const stateReady = Object.values(checks).every(Boolean);
    const lifecycleReady = typeof readiness?.isReady === 'function' ? Boolean(readiness.isReady()) : true;
    const ok = stateReady && lifecycleReady;
    const payload = {
      ok,
      service: 'points-service',
      storage: getStorageBackend(),
      checks,
      ownedRouteCount: pointsServiceOwnedRoutes.length,
    };
    if (!ok) return res.status(503).json(payload);
    return res.json(payload);
  });

  app.use(createPointsServiceRouter({ readiness }));

  return app;
};
