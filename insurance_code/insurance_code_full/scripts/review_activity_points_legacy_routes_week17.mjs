#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {
  activityServiceCompatibilityLayers,
  activityServiceSplitConclusion,
  pointsServicePermanentActivityAdjacentRoutes,
} from '../server/microservices/activity-service/boundary.mjs';

const ROOT = process.cwd();

function toAbsolute(relativePath) {
  return path.join(ROOT, relativePath);
}

function read(relativePath) {
  return fs.readFileSync(toAbsolute(relativePath), 'utf8');
}

function has(source, snippet) {
  return source.includes(snippet);
}

function main() {
  const activitiesRouteSource = read('server/skeleton-c-v1/routes/activities.routes.mjs');
  const activityUsecaseSource = read('server/skeleton-c-v1/usecases/activity-complete.usecase.mjs');
  const activityRewardServiceSource = read('server/skeleton-c-v1/services/activity-reward.service.mjs');

  const checks = {
    legacyRouteUsesPointsAdapter: has(activitiesRouteSource, 'settleActivityRewardViaPointsService'),
    legacyRouteStillContainsSignIn: has(activitiesRouteSource, "app.post('/api/sign-in'"),
    legacyRouteAvoidsLocalPointsWrite: !has(activitiesRouteSource, 'recordPoints(') && !has(activitiesRouteSource, 'appendPoints('),
    activityUsecaseUsesInjectedSettlement: has(activityUsecaseSource, 'resolveSettleReward(') && has(activityUsecaseSource, 'await settleReward('),
    activityUsecaseAvoidsLocalPointsWrite: !has(activityUsecaseSource, 'recordPoints(') && !has(activityUsecaseSource, 'appendPoints('),
    legacyRewardServiceUsesHttpAdapter: has(activityRewardServiceSource, 'settleActivityRewardOverHttp'),
    legacyRewardServiceAvoidsLocalPointsWrite: !has(activityRewardServiceSource, 'recordPoints(') && !has(activityRewardServiceSource, 'appendPoints('),
  };

  const ok = Object.values(checks).every(Boolean);

  console.log(
    JSON.stringify(
      {
        ok,
        compatibilityLayers: activityServiceCompatibilityLayers,
        residualCompatibilitySummary: [
          {
            file: 'server/skeleton-c-v1/routes/activities.routes.mjs',
            status: checks.legacyRouteUsesPointsAdapter && checks.legacyRouteAvoidsLocalPointsWrite ? 'controlled' : 'drift',
            residue: ['legacy route mount', 'contains /api/sign-in'],
          },
          {
            file: 'server/skeleton-c-v1/usecases/activity-complete.usecase.mjs',
            status: checks.activityUsecaseUsesInjectedSettlement && checks.activityUsecaseAvoidsLocalPointsWrite ? 'controlled' : 'drift',
            residue: ['shared usecase', 'depends on injected settleReward'],
          },
          {
            file: 'server/skeleton-c-v1/services/activity-reward.service.mjs',
            status: checks.legacyRewardServiceUsesHttpAdapter && checks.legacyRewardServiceAvoidsLocalPointsWrite ? 'controlled' : 'drift',
            residue: ['legacy reward adapter'],
          },
        ],
        pointsPermanentRoutes: pointsServicePermanentActivityAdjacentRoutes,
        splitConclusion: activityServiceSplitConclusion,
        checks,
      },
      null,
      2,
    ),
  );

  if (!ok) process.exit(1);
}

main();
