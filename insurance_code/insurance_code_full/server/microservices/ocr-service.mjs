import dotenv from 'dotenv';
import { createOcrServiceApp } from './ocr-service/app.mjs';

dotenv.config();

const PORT = Number(process.env.OCR_SERVICE_PORT || 4105);
const HOST = process.env.API_HOST || '127.0.0.1';

async function main() {
  const app = createOcrServiceApp();
  const server = app.listen(PORT, HOST, () => {
    console.log(`ocr-service listening on http://${HOST}:${PORT} (provider=${String(process.env.POLICY_OCR_PROVIDER || 'local')})`);
  });

  const shutdown = async () => {
    server.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[ocr-service] bootstrap failed:', err?.message || err);
  process.exit(1);
});
