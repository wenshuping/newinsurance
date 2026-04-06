import express from 'express';
import { validateBody } from '../../skeleton-c-v1/common/middleware.mjs';
import { respondInsurancePolicyScanError } from '../../skeleton-c-v1/routes/insurance-scan-error.mjs';
import { scanPolicyBodySchema } from '../../skeleton-c-v1/schemas/insurance.schemas.mjs';
import { scanInsurancePolicyLocal } from '../../skeleton-c-v1/services/insurance-ocr.service.mjs';

function requireOcrServiceToken(req, res, next) {
  const expected = String(process.env.POLICY_OCR_SERVICE_TOKEN || '').trim();
  if (!expected) return next();
  const actual = String(req.headers['x-ocr-service-token'] || '').trim();
  if (actual !== expected) {
    return res.status(401).json({ code: 'OCR_SERVICE_UNAUTHORIZED', message: 'OCR service token invalid' });
  }
  return next();
}

export function createOcrServiceRouter() {
  const router = express.Router();

  router.post('/internal/ocr/policies/scan', requireOcrServiceToken, validateBody(scanPolicyBodySchema), async (req, res) => {
    try {
      const payload = await scanInsurancePolicyLocal({
        uploadItem: req.body.uploadItem,
        ocrText: req.body.ocrText,
      });
      return res.json(payload);
    } catch (err) {
      return respondInsurancePolicyScanError(res, err);
    }
  });

  router.get('/internal/ocr-service/health', (_req, res) => {
    res.json({ ok: true, service: 'ocr-service', provider: String(process.env.POLICY_OCR_PROVIDER || 'local') });
  });

  router.get('/internal/ocr-service/ready', (_req, res) => {
    res.json({ ok: true, service: 'ocr-service', ready: true, provider: String(process.env.POLICY_OCR_PROVIDER || 'local') });
  });

  return router;
}
