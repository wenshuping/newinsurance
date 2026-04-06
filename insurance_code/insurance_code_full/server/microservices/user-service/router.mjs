import express from 'express';
import { getState, getStorageBackend } from '../../skeleton-c-v1/common/state.mjs';
import { summarizeUserServiceBoundary } from './boundary.mjs';
import { buildUserServiceObservabilitySnapshot } from './observability.mjs';
import { registerUserServiceAuthRoutes } from './auth.routes.mjs';
import { registerUserServiceMeRoutes } from './me.routes.mjs';

export const userServiceOwnedRoutes = ['/api/auth/send-code', '/api/auth/verify-basic', '/api/me'];

export const buildUserServiceHealth = () => ({
  ok: true,
  service: 'user-service',
  storage: getStorageBackend(),
});

export const buildUserServiceReady = () => {
  const state = getState();
  return {
    ok: true,
    service: 'user-service',
    storage: getStorageBackend(),
    boundary: summarizeUserServiceBoundary(),
    observability: buildUserServiceObservabilitySnapshot().metrics,
    contracts: ['POST /api/auth/send-code', 'POST /api/auth/verify-basic', 'GET /api/me'],
    ownedRoutes: userServiceOwnedRoutes,
    ownership: {
      customerProfiles: Array.isArray(state.users) ? state.users.length : 0,
      sessions: Array.isArray(state.sessions) ? state.sessions.length : 0,
    },
  };
};

export const createUserServiceRouter = () => {
  const router = express.Router();

  registerUserServiceAuthRoutes(router);
  registerUserServiceMeRoutes(router);

  router.get('/internal/user-service/health', (_req, res) => {
    res.json(buildUserServiceHealth());
  });

  router.get('/internal/user-service/ready', (_req, res) => {
    res.json(buildUserServiceReady());
  });

  router.get('/internal/user-service/observability', (_req, res) => {
    res.json({
      ok: true,
      service: 'user-service',
      ...buildUserServiceObservabilitySnapshot(),
    });
  });

  const handleMetrics = (_req, res) => {
    res.json({
      ok: true,
      service: 'user-service',
      ...buildUserServiceObservabilitySnapshot(),
    });
  };

  router.get('/metrics', handleMetrics);
  router.get('/internal/user-service/metrics', handleMetrics);

  return router;
};
