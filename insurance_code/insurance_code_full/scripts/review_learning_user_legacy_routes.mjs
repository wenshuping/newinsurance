#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {
  learningServiceBridgeCompatibilityContracts,
  learningServiceCompatibilityLayers,
  learningServiceDeprecatedContracts,
  learningServiceSplitConclusion,
  learningServiceStableContracts,
} from '../server/microservices/learning-service/boundary.mjs';

const ROOT = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function has(source, snippet) {
  return source.includes(snippet);
}

function main() {
  const learningLegacySource = read('server/skeleton-c-v1/routes/learning.routes.mjs');
  const pLearningLegacySource = read('server/skeleton-c-v1/routes/p-admin-learning.routes.mjs');
  const bContentLegacySource = read('server/skeleton-c-v1/routes/b-admin-content.routes.mjs');
  const bridgeServiceSource = read('server/skeleton-c-v1/services/learning-service.bridge.mjs');
  const cAppSource = read('server/skeleton-c-v1/routes/c-app.routes.mjs');
  const pAdminSource = read('server/skeleton-c-v1/routes/p-admin.routes.mjs');
  const learningAppSource = read('server/microservices/learning-service/app.mjs');
  const learningClientRouteSource = read('server/microservices/learning-service/c-learning.routes.mjs');
  const learningAdminRouteSource = read('server/microservices/learning-service/p-learning.routes.mjs');
  const learningBRouteSource = read('server/microservices/learning-service/b-learning.routes.mjs');

  const checks = {
    bridgeServiceExists: has(bridgeServiceSource, 'forwardLearningServiceRequest') && has(bridgeServiceSource, 'respondLearningRouteDeprecated'),
    clientReadRoutesRetainedForFallback:
      has(learningLegacySource, 'listLearningCourses(')
      && has(learningLegacySource, 'getLearningCourseById(')
      && has(learningLegacySource, 'listLearningGames(')
      && has(learningLegacySource, 'listLearningTools(')
      && has(learningLegacySource, "'/api/learning/courses'")
      && has(learningLegacySource, "'/api/learning/games'")
      && has(learningLegacySource, "'/api/learning/tools'"),
    completeRouteBridgedToLearningService:
      has(learningLegacySource, 'forwardLearningServiceRequest')
      && has(learningLegacySource, "'/api/learning/courses/:id/complete'")
      && !has(learningLegacySource, 'executeLearningComplete('),
    pAdminRoutesBridged:
      has(pLearningLegacySource, 'forwardLearningServiceRequest')
      && !has(pLearningLegacySource, 'executeCreatePLearningCourse(')
      && !has(pLearningLegacySource, 'executeUpdatePLearningCourse(')
      && !has(pLearningLegacySource, 'executeDeletePLearningCourse('),
    bAdminRoutesBridged:
      has(bContentLegacySource, 'forwardLearningServiceRequest')
      && !has(bContentLegacySource, 'executeCreateBContentItem(')
      && !has(bContentLegacySource, 'executeUpdateBContentItem(')
      && !has(bContentLegacySource, 'state.learningCourses'),
    monolithRegistrationStillExists: has(cAppSource, 'registerLearningRoutes(app);') && has(pAdminSource, 'registerPAdminLearningRoutes(app, deps.learning);'),
    learningServiceReusesSharedAuth: has(learningAppSource, 'unifiedAuthAndTenantContext') && has(learningAppSource, 'csrfProtection'),
    learningServiceStableClientRoutes:
      has(learningClientRouteSource, "'/api/learning/courses'")
      && has(learningClientRouteSource, "'/api/learning/games'")
      && has(learningClientRouteSource, "'/api/learning/tools'")
      && has(learningClientRouteSource, "'/api/learning/courses/:id'")
      && has(learningClientRouteSource, "'/api/learning/courses/:id/complete'"),
    learningServiceStableAdminRoutes:
      has(learningAdminRouteSource, "'/api/p/learning/courses'")
      && has(learningAdminRouteSource, 'executeCreatePLearningCourse')
      && has(learningAdminRouteSource, 'executeDeletePLearningCourse'),
    learningServiceCompatibilityRoutes:
      has(learningBRouteSource, "'/api/b/content/items'")
      && has(learningBRouteSource, 'executeCreateBContentItem')
      && has(learningBRouteSource, 'executeUpdateBContentItem'),
  };

  const bridgeCandidates = [];
  const residualLegacyRoutes = [];
  const directUserBoundaryViolations = [];
  const formalSplitReady = Object.values(checks).every(Boolean) && Boolean(learningServiceSplitConclusion?.formalSplitReady);

  console.log(
    JSON.stringify(
      {
        ok: formalSplitReady,
        routeDisposition: {
          migratedToLearningService: learningServiceStableContracts,
          retainedBridgeContracts: learningServiceBridgeCompatibilityContracts,
          formallyDeprecatedContracts: learningServiceDeprecatedContracts,
        },
        compatibilityLayers: learningServiceCompatibilityLayers,
        bridgeCandidates,
        residualLegacyRoutes,
        monolithRegistrationPoints: [
          {
            file: 'server/skeleton-c-v1/routes/c-app.routes.mjs',
            stillRegistered: true,
            detail: 'legacy c-app keeps local v1 read fallback and complete bridge adapter',
          },
          {
            file: 'server/skeleton-c-v1/routes/p-admin.routes.mjs',
            stillRegistered: true,
            detail: 'legacy p-admin keeps learning admin routes only as bridge adapter',
          },
        ],
        directUserBoundaryViolations,
        compatDependencies: [
          {
            file: 'server/microservices/learning-service/app.mjs',
            detail: 'reuses unifiedAuthAndTenantContext + csrfProtection',
            ok: checks.learningServiceReusesSharedAuth,
          },
          {
            file: 'server/microservices/learning-service/c-learning.routes.mjs',
            detail: 'owns formal split client learning routes while monolith only keeps read fallback + complete bridge',
            ok: checks.learningServiceStableClientRoutes,
          },
          {
            file: 'server/microservices/learning-service/p-learning.routes.mjs',
            detail: 'owns stable p-admin learning routes',
            ok: checks.learningServiceStableAdminRoutes,
          },
          {
            file: 'server/microservices/learning-service/b-learning.routes.mjs',
            detail: 'owns legacy b-admin compatibility routes without touching user boundary',
            ok: checks.learningServiceCompatibilityRoutes,
          },
        ],
        formalSplitReady,
        splitConclusion: learningServiceSplitConclusion,
        checks,
        verdict: formalSplitReady
          ? 'learning_can_be_treated_as_formally_split_with_explicit_read_fallback_and_complete_bridge_layers'
          : 'learning_formal_split_still_blocked_by_legacy_route_drift',
      },
      null,
      2,
    ),
  );

  if (!formalSplitReady) process.exit(1);
}

main();
