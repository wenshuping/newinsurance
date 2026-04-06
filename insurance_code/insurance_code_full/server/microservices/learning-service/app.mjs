import express from 'express';
import { corsMiddleware, csrfProtection } from '../../skeleton-c-v1/common/middleware.mjs';
import { unifiedAuthAndTenantContext } from '../shared/auth-context.mjs';
import { createLearningServiceRouter, buildLearningServiceHealth, buildLearningServiceReady } from './router.mjs';

export const createLearningServiceApp = () => {
  const app = express();

  app.use(express.json({ limit: '30mb' }));
  app.use(corsMiddleware);
  app.use(unifiedAuthAndTenantContext);
  app.use(csrfProtection);

  app.get('/health', (_req, res) => {
    res.json(buildLearningServiceHealth());
  });

  app.get('/ready', (_req, res) => {
    res.json(buildLearningServiceReady());
  });

  app.use(createLearningServiceRouter());

  return app;
};
