import express from 'express';
import { corsMiddleware, csrfProtection } from '../../skeleton-c-v1/common/middleware.mjs';
import { createUserServiceObservabilityMiddleware, resetUserServiceObservability } from './observability.mjs';
import { buildUserServiceHealth, buildUserServiceReady, createUserServiceRouter } from './router.mjs';

export const createUserServiceApp = () => {
  resetUserServiceObservability();
  const app = express();

  app.use(createUserServiceObservabilityMiddleware());
  app.use(express.json({ limit: '30mb' }));
  app.use(corsMiddleware);
  app.use(csrfProtection);

  app.get('/health', (_req, res) => {
    res.json(buildUserServiceHealth());
  });

  app.get('/ready', (_req, res) => {
    res.json(buildUserServiceReady());
  });

  app.use(createUserServiceRouter());

  return app;
};
