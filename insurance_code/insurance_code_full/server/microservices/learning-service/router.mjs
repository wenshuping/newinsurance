import express from 'express';
import { getState, getStorageBackend } from '../../skeleton-c-v1/common/state.mjs';
import {
  learningServiceBridgeCompatibilityContracts,
  learningServiceBridgeCompatibilityRoutes,
  learningServiceDeprecatedContracts,
  learningServiceDeprecatedRoutes,
  learningServiceMainWriteTables,
  learningServiceOwnedRoutes,
  learningServiceRewardSettlementContract,
  learningServiceSplitConclusion,
  learningServiceStableContracts,
  summarizeLearningServiceBoundary,
} from './boundary.mjs';
import { registerLearningServiceBAdminRoutes } from './b-learning.routes.mjs';
import { registerLearningServiceClientRoutes } from './c-learning.routes.mjs';
import { registerLearningServiceAdminRoutes } from './p-learning.routes.mjs';

export const buildLearningServiceHealth = () => ({
  ok: true,
  service: 'learning-service',
  storage: getStorageBackend(),
  stableContractCount: learningServiceStableContracts.length,
  bridgeCompatibilityCount: learningServiceBridgeCompatibilityContracts.length,
  deprecatedContractCount: learningServiceDeprecatedContracts.length,
});

export const buildLearningServiceReady = () => {
  const state = getState();
  return {
    ok: true,
    service: 'learning-service',
    storage: getStorageBackend(),
    boundary: summarizeLearningServiceBoundary(),
    stableContracts: learningServiceStableContracts,
    bridgeCompatibilityContracts: learningServiceBridgeCompatibilityContracts,
    deprecatedContracts: learningServiceDeprecatedContracts,
    ownedRoutes: learningServiceOwnedRoutes,
    bridgeCompatibilityRoutes: learningServiceBridgeCompatibilityRoutes,
    deprecatedRoutes: learningServiceDeprecatedRoutes,
    mainWriteTables: learningServiceMainWriteTables,
    rewardSettlementContract: learningServiceRewardSettlementContract,
    formalSplitReady: Boolean(learningServiceSplitConclusion?.formalSplitReady),
    splitConclusion: learningServiceSplitConclusion,
    ownership: {
      learningMaterials: Array.isArray(state.learningCourses) ? state.learningCourses.length : 0,
      learningRecords: Array.isArray(state.courseCompletions) ? state.courseCompletions.length : 0,
    },
  };
};

export const createLearningServiceRouter = () => {
  const router = express.Router();

  registerLearningServiceClientRoutes(router);
  registerLearningServiceAdminRoutes(router);
  registerLearningServiceBAdminRoutes(router);

  router.get('/internal/learning-service/health', (_req, res) => {
    res.json(buildLearningServiceHealth());
  });

  router.get('/internal/learning-service/ready', (_req, res) => {
    res.json(buildLearningServiceReady());
  });

  router.use((req, res) => {
    res.status(404).json({
      code: 'NOT_FOUND',
      message: 'learning-service route not found',
      path: req.originalUrl || req.url || '',
    });
  });

  return router;
};
