export const learningServiceOwnedRoutes = [
  '/api/learning/courses',
  '/api/learning/games',
  '/api/learning/tools',
  '/api/learning/courses/:id',
  '/api/learning/courses/:id/complete',
  '/api/p/learning/courses',
  '/api/p/learning/courses/batch',
  '/api/p/learning/courses/:id',
];

export const learningServicePilotCompatibilityRoutes = [];

export const learningServiceBridgeCompatibilityRoutes = [
  '/api/b/content/items',
  '/api/b/content/items/:id',
];

export const learningServiceDeprecatedRoutes = [];

export const learningServiceStableContracts = [
  'GET /api/learning/courses',
  'GET /api/learning/games',
  'GET /api/learning/tools',
  'GET /api/learning/courses/:id',
  'POST /api/learning/courses/:id/complete',
  'GET /api/p/learning/courses',
  'POST /api/p/learning/courses',
  'POST /api/p/learning/courses/batch',
  'PUT /api/p/learning/courses/:id',
  'DELETE /api/p/learning/courses/:id',
];

export const learningServicePilotCompatibilityContracts = [];

export const learningServiceBridgeCompatibilityContracts = [
  'GET /api/b/content/items',
  'POST /api/b/content/items',
  'PUT /api/b/content/items/:id',
];

export const learningServiceDeprecatedContracts = [];

export const learningServiceMainWriteTables = [
  {
    table: 'p_learning_materials',
    owner: 'learning-service',
    kind: 'physical',
    runtimeEquivalent: 'state.learningCourses / state.pLearningMaterials',
    stage: 'stable',
  },
  {
    table: 'c_learning_records',
    owner: 'learning-service',
    kind: 'physical',
    runtimeEquivalent: 'state.courseCompletions',
    stage: 'stable',
    note: 'course completion writes stay in learning-service; reward settlement is delegated to points-service contract',
  },
];

export const learningServicePilotCompatibilityWriteTables = [];

export const learningServiceRewardSettlementContract = {
  caller: 'learning-service',
  provider: 'points-service',
  transport: 'internal_http',
  endpoint: '/internal/points-service/learning-rewards/settle',
  sourceType: 'course_complete',
  pointsOwnedTables: ['c_point_accounts', 'c_point_transactions'],
};

export const learningServiceForbiddenUserTables = ['app_users', 'c_customers', 'p_sessions'];

export const learningServiceWriteWhitelist = {
  routes: [
    'server/microservices/learning-service/c-learning.routes.mjs',
    'server/microservices/learning-service/p-learning.routes.mjs',
    'server/microservices/learning-service/b-learning.routes.mjs',
  ],
  usecases: [
    'server/skeleton-c-v1/usecases/learning-query.usecase.mjs',
    'server/skeleton-c-v1/usecases/learning-complete.usecase.mjs',
    'server/skeleton-c-v1/usecases/p-learning-course-write.usecase.mjs',
    'server/skeleton-c-v1/usecases/b-content-write.usecase.mjs',
  ],
  repositories: [
    'server/skeleton-c-v1/repositories/learning-write.repository.mjs',
    'server/skeleton-c-v1/repositories/p-learning-course-write.repository.mjs',
    'server/skeleton-c-v1/repositories/b-content-write.repository.mjs',
  ],
  infra: [
    'server/microservices/learning-service/points-service.client.mjs',
    'server/microservices/shared/auth-context.mjs',
    'server/skeleton-c-v1/common/state.mjs',
    'server/skeleton-c-v1/common/access-control.mjs',
    'server/skeleton-c-v1/common/template-visibility.mjs',
    'server/skeleton-c-v1/routes/p-admin.deps.mjs',
    'server/skeleton-c-v1/routes/b-admin.deps.mjs',
    'server/skeleton-c-v1/routes/b-admin.shared.mjs',
    'server/skeleton-c-v1/services/p-learning-course-admin-view.service.mjs',
  ],
};

export const learningServiceWriteBindings = {
  routes: [
    {
      file: 'server/microservices/learning-service/c-learning.routes.mjs',
      requiredImports: [
        '../../skeleton-c-v1/usecases/learning-query.usecase.mjs',
        '../../skeleton-c-v1/usecases/learning-complete.usecase.mjs',
        './points-service.client.mjs',
      ],
    },
    {
      file: 'server/microservices/learning-service/p-learning.routes.mjs',
      requiredImports: [
        '../../skeleton-c-v1/dto/write-commands.dto.mjs',
        '../../skeleton-c-v1/usecases/p-learning-course-write.usecase.mjs',
        '../../skeleton-c-v1/routes/p-admin.deps.mjs',
      ],
    },
    {
      file: 'server/microservices/learning-service/b-learning.routes.mjs',
      requiredImports: [
        '../../skeleton-c-v1/dto/write-commands.dto.mjs',
        '../../skeleton-c-v1/usecases/b-content-write.usecase.mjs',
        '../../skeleton-c-v1/routes/b-admin.deps.mjs',
      ],
    },
  ],
  usecases: [
    {
      file: 'server/skeleton-c-v1/usecases/learning-complete.usecase.mjs',
      requiredImports: [],
    },
    {
      file: 'server/skeleton-c-v1/usecases/p-learning-course-write.usecase.mjs',
      requiredImports: ['../repositories/p-learning-course-write.repository.mjs'],
    },
    {
      file: 'server/skeleton-c-v1/usecases/b-content-write.usecase.mjs',
      requiredImports: ['../repositories/b-content-write.repository.mjs'],
    },
  ],
};

export const learningServiceProtectedServiceRoots = [
  'server/microservices/learning-service',
  'server/microservices/learning-service.mjs',
];

export const learningServiceLegacyReviewRoots = [
  'server/skeleton-c-v1/routes/learning.routes.mjs',
  'server/skeleton-c-v1/routes/p-admin-learning.routes.mjs',
  'server/skeleton-c-v1/routes/b-admin-content.routes.mjs',
  'server/skeleton-c-v1/services/learning-service.bridge.mjs',
];

export const learningServiceCompatibilityLayers = [
  {
    file: 'server/skeleton-c-v1/services/learning-service.bridge.mjs',
    purpose: 'shared monolith bridge adapter that forwards legacy learning routes to learning-service over HTTP',
    kind: 'bridge_adapter',
  },
  {
    file: 'server/skeleton-c-v1/routes/learning.routes.mjs',
    purpose: 'legacy c-app entry retains local v1 read fallback for courses/games/tools/detail and bridges complete to learning-service',
    kind: 'legacy_bridge',
  },
  {
    file: 'server/skeleton-c-v1/routes/p-admin-learning.routes.mjs',
    purpose: 'legacy p-admin learning entry downgraded to bridge toward learning-service owned routes',
    kind: 'legacy_bridge',
  },
  {
    file: 'server/skeleton-c-v1/routes/b-admin-content.routes.mjs',
    purpose: 'legacy b-admin content entry downgraded to bridge toward learning-service compatibility routes',
    kind: 'legacy_bridge',
  },
  {
    file: 'server/microservices/learning-service/points-service.client.mjs',
    purpose: 'formal reward settlement client from learning-service to points-service',
    kind: 'cross_service_contract',
  },
];

export const learningServiceSplitConclusion = {
  status: 'formally_split',
  formalSplitReady: true,
  meaning: 'learning-service can be treated as formally split; monolith only retains explicit read fallback compatibility and bridge adapters',
  caveat: 'b-admin content remains a compatibility route served by learning-service via legacy bridge',
};

export const summarizeLearningServiceBoundary = () => ({
  mainWriteTables: learningServiceMainWriteTables,
  pilotCompatibilityWriteTables: learningServicePilotCompatibilityWriteTables,
  forbiddenUserTables: learningServiceForbiddenUserTables,
  stableContracts: learningServiceStableContracts,
  pilotCompatibilityContracts: learningServicePilotCompatibilityContracts,
  bridgeCompatibilityContracts: learningServiceBridgeCompatibilityContracts,
  deprecatedContracts: learningServiceDeprecatedContracts,
  rewardSettlementContract: learningServiceRewardSettlementContract,
  compatibilityLayers: learningServiceCompatibilityLayers,
  splitConclusion: learningServiceSplitConclusion,
  whitelist: {
    routes: learningServiceWriteWhitelist.routes.length,
    usecases: learningServiceWriteWhitelist.usecases.length,
    repositories: learningServiceWriteWhitelist.repositories.length,
    infra: learningServiceWriteWhitelist.infra.length,
  },
  phase18Notes: [
    'auth / me remains outside learning-service',
    'stable learning routes are owned by learning-service',
    'games/tools are now part of stable learning-service read scope',
    'b-admin content remains a compatibility route but is served by learning-service',
    'skeleton learning route file remains only for v1 read fallback / force-v1 compatibility and complete bridge',
    'course reward settlement is delegated to points-service contract',
  ],
});
