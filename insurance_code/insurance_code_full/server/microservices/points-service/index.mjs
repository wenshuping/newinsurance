import dotenv from 'dotenv';
import { createPointsServiceApp } from './app.mjs';
import { closeState, getStorageBackend, initializeState } from '../../skeleton-c-v1/common/state.mjs';

dotenv.config();

const PORT = Number(process.env.POINTS_SERVICE_PORT || 4102);
const HOST = process.env.API_HOST || '127.0.0.1';

const readiness = {
  ready: false,
  isReady() {
    return this.ready;
  },
};

async function main() {
  await initializeState();
  readiness.ready = true;

  const app = createPointsServiceApp({ readiness });
  const server = app.listen(PORT, HOST, () => {
    // eslint-disable-next-line no-console
    console.log(`points-service listening on http://${HOST}:${PORT} (storage=${getStorageBackend()})`);
  });

  const shutdown = async () => {
    readiness.ready = false;
    server.close(async () => {
      await closeState();
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[points-service] bootstrap failed:', err?.message || err);
  process.exit(1);
});
