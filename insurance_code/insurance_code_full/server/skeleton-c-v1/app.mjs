import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { adminApiAuthRequired, corsMiddleware, csrfProtection } from './common/middleware.mjs';
import { registerBAdminRoutes } from './routes/b-admin.routes.mjs';
import { registerCAppRoutes } from './routes/c-app.routes.mjs';
import { registerPAdminRoutes } from './routes/p-admin.routes.mjs';
import { registerShareRoutes } from './routes/share.routes.mjs';
import { registerTrackRoutes } from './routes/track.routes.mjs';
import { registerUploadsRoutes } from './routes/uploads.routes.mjs';

export function createSkeletonApp() {
  const app = express();
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const uploadsDir = path.resolve(__dirname, '../data/uploads');

  app.use(express.json({ limit: '30mb' }));
  app.use(corsMiddleware);
  app.use(adminApiAuthRequired);
  app.use(csrfProtection);
  app.use('/uploads', express.static(uploadsDir));

  registerCAppRoutes(app);
  registerBAdminRoutes(app);
  registerPAdminRoutes(app);
  registerShareRoutes(app);
  registerTrackRoutes(app);
  registerUploadsRoutes(app);

  return app;
}
