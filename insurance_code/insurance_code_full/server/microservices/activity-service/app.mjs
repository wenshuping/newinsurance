import express from 'express';
import { corsMiddleware, csrfProtection } from '../../skeleton-c-v1/common/middleware.mjs';
import { getState, getStorageBackend } from '../../skeleton-c-v1/common/state.mjs';
import { unifiedAuthAndTenantContext } from '../shared/auth-context.mjs';
import { createActivityObservabilityMiddleware, resetActivityObservability } from './observability.mjs';
import { createActivityServiceRouter, buildActivityServiceHealth, buildActivityServiceReady } from './router.mjs';

function getReadinessSnapshot() {
  const state = getState();
  return {
    activities: Array.isArray(state.activities),
    activityCompletions: Array.isArray(state.activityCompletions),
  };
}

export const createActivityServiceApp = ({ readiness } = {}) => {
  resetActivityObservability();
  const app = express();

  app.use(express.json({ limit: '30mb' }));
  app.use(corsMiddleware);
  app.use(unifiedAuthAndTenantContext);
  app.use(createActivityObservabilityMiddleware());
  app.use(csrfProtection);

  app.get('/health', (_req, res) => {
    res.json(buildActivityServiceHealth());
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'activity-service',
      storage: getStorageBackend(),
    });
  });

  app.get('/ready', (_req, res) => {
    const checks = getReadinessSnapshot();
    const stateReady = Object.values(checks).every(Boolean);
    const payload = buildActivityServiceReady({ readiness });
    payload.ok = Boolean(payload.ok) && stateReady;
    payload.checks = checks;
    if (!payload.ok) return res.status(503).json(payload);
    return res.json(payload);
  });

  app.use(createActivityServiceRouter({ readiness }));

  return app;
};
