#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { learningServiceSplitConclusion } from '../server/microservices/learning-service/boundary.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function has(source, snippet) {
  return source.includes(snippet);
}

function main() {
  const legacyRouteSource = read('server/skeleton-c-v1/routes/learning.routes.mjs');
  const pAdminLegacySource = read('server/skeleton-c-v1/routes/p-admin-learning.routes.mjs');
  const bAdminLegacySource = read('server/skeleton-c-v1/routes/b-admin-content.routes.mjs');
  const bridgeServiceSource = read('server/skeleton-c-v1/services/learning-service.bridge.mjs');
  const usecaseSource = read('server/skeleton-c-v1/usecases/learning-complete.usecase.mjs');
  const rewardServiceSource = read('server/skeleton-c-v1/services/learning-reward.service.mjs');

  const checks = {
    legacyClientRouteRetainsReadFallback: has(legacyRouteSource, 'listLearningCourses') && has(legacyRouteSource, 'getLearningCourseById') && has(legacyRouteSource, 'listLearningGames') && has(legacyRouteSource, 'listLearningTools'),
    legacyClientRouteBridgesComplete: has(legacyRouteSource, 'forwardLearningServiceRequest') && has(legacyRouteSource, "app.post('/api/learning/courses/:id/complete'"),
    legacyAdminRouteBridgesToLearning: has(pAdminLegacySource, 'forwardLearningServiceRequest'),
    legacyBContentRouteBridgesToLearning: has(bAdminLegacySource, 'forwardLearningServiceRequest'),
    bridgeServiceIsPresent: has(bridgeServiceSource, 'resolveLearningServiceBaseUrl') && has(bridgeServiceSource, 'forwardLearningServiceRequest') && has(bridgeServiceSource, 'respondLearningRouteDeprecated'),
    usecaseUsesInjectedSettlement: has(usecaseSource, 'resolveSettleReward(') && has(usecaseSource, 'await settleReward('),
    usecaseNoLocalPointsWrite: !has(usecaseSource, 'appendPoints(') && !has(usecaseSource, 'recordPoints('),
    rewardServiceUsesHttpAdapter: has(rewardServiceSource, 'settleLearningRewardOverHttp'),
    rewardServiceNoLocalPointsWrite: !has(rewardServiceSource, 'appendPoints(') && !has(rewardServiceSource, 'recordPoints('),
    formalSplitReady: Boolean(learningServiceSplitConclusion?.formalSplitReady) && learningServiceSplitConclusion?.status === 'formally_split',
  };

  const ok = Object.values(checks).every(Boolean);

  console.log(
    JSON.stringify(
      {
        ok,
        residualCompatibilitySummary: [
          {
            file: 'server/skeleton-c-v1/routes/learning.routes.mjs',
            status: checks.legacyClientRouteRetainsReadFallback && checks.legacyClientRouteBridgesComplete ? 'controlled' : 'drift',
            residue: ['local v1 read fallback for courses/detail/games/tools', 'complete bridge to learning-service'],
          },
          {
            file: 'server/skeleton-c-v1/routes/p-admin-learning.routes.mjs',
            status: checks.legacyAdminRouteBridgesToLearning ? 'controlled' : 'drift',
            residue: ['legacy p-admin bridge'],
          },
          {
            file: 'server/skeleton-c-v1/routes/b-admin-content.routes.mjs',
            status: checks.legacyBContentRouteBridgesToLearning ? 'controlled' : 'drift',
            residue: ['legacy b-admin compatibility bridge'],
          },
          {
            file: 'server/skeleton-c-v1/services/learning-service.bridge.mjs',
            status: checks.bridgeServiceIsPresent ? 'controlled' : 'drift',
            residue: ['shared learning bridge adapter'],
          },
          {
            file: 'server/skeleton-c-v1/services/learning-reward.service.mjs',
            status: checks.rewardServiceUsesHttpAdapter && checks.rewardServiceNoLocalPointsWrite ? 'controlled' : 'drift',
            residue: ['legacy reward safety adapter'],
          },
        ],
        finalConclusion: {
          status: ok ? 'pass' : 'drift',
          meaning: 'learning formal split keeps read fallback and bridge compatibility, while reward settlement remains controlled by points-service',
          splitConclusion: learningServiceSplitConclusion,
        },
        checks,
      },
      null,
      2,
    ),
  );

  if (!ok) process.exit(1);
}

main();
