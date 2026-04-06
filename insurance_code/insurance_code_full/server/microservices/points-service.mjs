import dotenv from 'dotenv';
import { createPointsServiceApp } from './points-service/app.mjs';
import { closeState, getStorageBackend, initializeState } from '../skeleton-c-v1/common/state.mjs';

dotenv.config();

const PORT = Number(process.env.API_POINTS_SERVICE_PORT || 4102);
const HOST = process.env.API_HOST || '127.0.0.1';

const main = async () => {
  await initializeState();
  const app = createPointsServiceApp({
    readiness: {
      isReady() {
        return true;
      },
    },
  });

  const server = app.listen(PORT, HOST, () => {
    console.log(`points-service listening on http://${HOST}:${PORT} (storage=${getStorageBackend()})`);
  });

  const shutdown = async () => {
    server.close(async () => {
      await closeState();
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

main().catch((err) => {
  console.error('[points-service] bootstrap failed:', err?.message || err);
  process.exit(1);
});
