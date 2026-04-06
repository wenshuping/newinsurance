import express from 'express';
import { corsMiddleware, csrfProtection } from '../../skeleton-c-v1/common/middleware.mjs';
import { unifiedAuthAndTenantContext } from './auth-context.mjs';

export function createMicroserviceRuntimeApp({ serviceName, router }) {
  const app = express();

  app.use(express.json({ limit: '30mb' }));
  app.use(corsMiddleware);
  app.use(unifiedAuthAndTenantContext);
  app.use(csrfProtection);

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: serviceName });
  });

  app.get('/ready', (_req, res) => {
    res.json({ ok: true, service: serviceName, ready: true });
  });

  app.use(router);

  app.use((req, res) => {
    res.status(404).json({
      code: 'NOT_FOUND',
      message: `${serviceName} route not found`,
      path: req.originalUrl || req.url || '',
    });
  });

  return app;
}
