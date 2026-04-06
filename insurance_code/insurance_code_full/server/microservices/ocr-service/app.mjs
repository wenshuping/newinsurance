import express from 'express';
import { corsMiddleware } from '../../skeleton-c-v1/common/middleware.mjs';
import { createOcrServiceRouter } from './router.mjs';

export const createOcrServiceApp = () => {
  const app = express();

  app.use(express.json({ limit: '30mb' }));
  app.use(corsMiddleware);

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'ocr-service', provider: String(process.env.POLICY_OCR_PROVIDER || 'local') });
  });

  app.get('/ready', (_req, res) => {
    res.json({ ok: true, service: 'ocr-service', ready: true, provider: String(process.env.POLICY_OCR_PROVIDER || 'local') });
  });

  app.use(createOcrServiceRouter());

  app.use((req, res) => {
    res.status(404).json({
      code: 'NOT_FOUND',
      message: 'ocr-service route not found',
      path: req.originalUrl || req.url || '',
    });
  });

  return app;
};
