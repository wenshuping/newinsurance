export const activityServiceOwnedRoutes = [
  '/api/activities',
  '/api/activities/:id/complete',
  '/api/p/activities',
  '/api/p/activities/reorder',
  '/api/p/activities/:id',
  '/api/b/activity-configs',
  '/api/b/activity-configs/:id',
];

export const activityServiceStableContracts = [
  'GET /api/activities',
  'POST /api/activities/:id/complete',
  'GET /api/p/activities',
  'POST /api/p/activities',
  'POST /api/p/activities/reorder',
  'PUT /api/p/activities/:id',
  'DELETE /api/p/activities/:id',
  'GET /api/b/activity-configs',
  'POST /api/b/activity-configs',
  'PUT /api/b/activity-configs/:id',
];

export const activityServiceMainWriteTables = [
  {
    table: 'p_activities',
    owner: 'activity-service',
    kind: 'physical',
    runtimeEquivalent: "state.activities where source_domain='activity'",
    stage: 'stable',
    note: 'Stable scope only owns activity-domain rows, not mall-domain rows.',
  },
  {
    table: 'c_activity_completions',
    owner: 'activity-service',
    kind: 'physical',
    runtimeEquivalent: 'state.activityCompletions',
    stage: 'stable',
  },
];

export const activityServiceRewardSettlementContract = {
  caller: 'activity-service',
  provider: 'points-service',
  transport: 'internal_http',
  endpoint: '/internal/points-service/activity-rewards/settle',
  sourceType: 'activity_task',
  pointsOwnedTables: ['c_point_accounts', 'c_point_transactions'],
};

export const activityServiceForbiddenPointsTables = [
  'c_point_accounts',
  'c_point_transactions',
  'p_orders',
  'c_redeem_records',
  'c_sign_ins',
];

export const pointsServicePermanentActivityAdjacentRoutes = [
  '/api/sign-in',
  '/api/mall/activities',
  '/api/mall/activities/:id/join',
  '/api/mall/redeem',
  '/api/orders',
  '/api/orders/:id',
  '/api/orders/:id/pay',
  '/api/orders/:id/cancel',
  '/api/orders/:id/refund',
  '/api/redemptions',
  '/api/redemptions/:id/writeoff',
];

export const activityServiceWriteWhitelist = {
  routes: [
    'server/microservices/activity-service/c-activity.routes.mjs',
    'server/microservices/activity-service/p-activity.routes.mjs',
    'server/microservices/activity-service/b-activity.routes.mjs',
  ],
  usecases: [
    'server/skeleton-c-v1/usecases/activity-complete.usecase.mjs',
    'server/skeleton-c-v1/usecases/p-activity-write.usecase.mjs',
    'server/skeleton-c-v1/usecases/b-activity-config-write.usecase.mjs',
  ],
  repositories: [
    'server/skeleton-c-v1/repositories/activity-write.repository.mjs',
    'server/skeleton-c-v1/repositories/p-activity-write.repository.mjs',
    'server/skeleton-c-v1/repositories/b-activity-config-write.repository.mjs',
  ],
  infra: [
    'server/microservices/activity-service/points-service.client.mjs',
    'server/skeleton-c-v1/services/activity-reward.service.mjs',
    'server/microservices/shared/auth-context.mjs',
    'server/skeleton-c-v1/routes/p-admin.deps.mjs',
    'server/skeleton-c-v1/routes/b-admin.deps.mjs',
    'server/skeleton-c-v1/common/state.mjs',
    'server/skeleton-c-v1/common/access-control.mjs',
    'server/skeleton-c-v1/common/template-visibility.mjs',
  ],
};

export const activityServiceWriteBindings = {
  routes: [
    {
      file: 'server/microservices/activity-service/c-activity.routes.mjs',
      requiredImports: [
        '../../skeleton-c-v1/usecases/activity-complete.usecase.mjs',
        './points-service.client.mjs',
      ],
    },
    {
      file: 'server/microservices/activity-service/p-activity.routes.mjs',
      requiredImports: [
        '../../skeleton-c-v1/routes/p-admin-activities.routes.mjs',
        '../../skeleton-c-v1/routes/p-admin.deps.mjs',
      ],
    },
    {
      file: 'server/microservices/activity-service/b-activity.routes.mjs',
      requiredImports: [
        '../../skeleton-c-v1/routes/b-admin-activity.routes.mjs',
        '../../skeleton-c-v1/routes/b-admin.deps.mjs',
      ],
    },
  ],
  usecases: [
    {
      file: 'server/skeleton-c-v1/usecases/activity-complete.usecase.mjs',
      requiredImports: [],
    },
  ],
};

export const activityServiceProtectedServiceRoots = [
  'server/microservices/activity-service',
  'server/microservices/activity-service.mjs',
];

export const activityServiceLegacyReviewRoots = [
  'server/skeleton-c-v1/routes/activities.routes.mjs',
  'server/skeleton-c-v1/usecases/activity-complete.usecase.mjs',
  'server/skeleton-c-v1/services/activity-reward.service.mjs',
];

export const activityServiceCompatibilityLayers = [
  {
    file: 'server/skeleton-c-v1/routes/activities.routes.mjs',
    purpose: 'legacy route adapter for /api/activities and /api/activities/:id/complete; file still contains /api/sign-in compatibility route',
  },
  {
    file: 'server/skeleton-c-v1/usecases/activity-complete.usecase.mjs',
    purpose: 'shared complete usecase reused by activity-service runtime and legacy route layer via injected settleReward dependency',
  },
  {
    file: 'server/skeleton-c-v1/services/activity-reward.service.mjs',
    purpose: 'legacy reward adapter that forwards settlement to activity-service points client instead of local points writes',
  },
  {
    file: 'server/microservices/activity-service/points-service.client.mjs',
    purpose: 'formal internal HTTP client for reward settlement into points-service',
  },
  {
    file: 'server/microservices/points-service/activity-reward.route.mjs',
    purpose: 'formal provider-side internal contract endpoint for activity reward settlement',
  },
];

export const activityServiceSplitConclusion = {
  status: 'split_for_stable_scope',
  meaning: 'activity-service can be treated as formally split for activity-domain stable routes only',
  caveat: 'mall-activity participation and points commerce routes remain permanently owned by points-service',
};

export const summarizeActivityServiceBoundary = () => ({
  mainWriteTables: activityServiceMainWriteTables,
  stableContracts: activityServiceStableContracts,
  rewardSettlementContract: activityServiceRewardSettlementContract,
  forbiddenPointsTables: activityServiceForbiddenPointsTables,
  permanentPointsRoutes: pointsServicePermanentActivityAdjacentRoutes,
  compatibilityLayers: activityServiceCompatibilityLayers,
  splitConclusion: activityServiceSplitConclusion,
  whitelist: {
    routes: activityServiceWriteWhitelist.routes.length,
    usecases: activityServiceWriteWhitelist.usecases.length,
    repositories: activityServiceWriteWhitelist.repositories.length,
    infra: activityServiceWriteWhitelist.infra.length,
  },
  phase1Notes: [
    'sign-in stays in points-service',
    'mall activities/join stay in points-service',
    'activity completion reward settlement is delegated to points-service',
    'activity complete route is now treated as a stable capability',
    'activity-service only owns source_domain=activity rows',
  ],
});
