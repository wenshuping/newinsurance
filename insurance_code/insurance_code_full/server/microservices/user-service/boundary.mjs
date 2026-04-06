export const userServiceMainWriteTables = [
  {
    table: 'app_users',
    owner: 'user-service',
    kind: 'logical',
    runtimeEquivalent: 'customer identity fields on state.users',
  },
  {
    table: 'c_customers',
    owner: 'user-service',
    kind: 'physical',
    runtimeEquivalent: 'state.users',
  },
  {
    table: 'p_sessions',
    owner: 'user-service',
    kind: 'physical',
    runtimeEquivalent: 'state.sessions',
  },
];

export const userServiceWriteWhitelist = {
  routes: [
    'server/microservices/user-service/auth.routes.mjs',
    'server/microservices/user-service/me.routes.mjs',
  ],
  usecases: [
    'server/skeleton-c-v1/usecases/auth-write.usecase.mjs',
    'server/skeleton-c-v1/usecases/customer-assignment-write.usecase.mjs',
    'server/skeleton-c-v1/usecases/user-write.usecase.mjs',
  ],
  repositories: [
    'server/skeleton-c-v1/repositories/auth-write.repository.mjs',
    'server/skeleton-c-v1/repositories/user-write.repository.mjs',
  ],
  infra: [
    'server/skeleton-c-v1/common/state.mjs',
  ],
};

export const userServiceWriteBindings = {
  routes: [
    {
      file: 'server/microservices/user-service/auth.routes.mjs',
      requiredImports: [
        '../../skeleton-c-v1/usecases/auth-write.usecase.mjs',
      ],
    },
    {
      file: 'server/microservices/user-service/me.routes.mjs',
      requiredImports: [
        '../../skeleton-c-v1/usecases/user-write.usecase.mjs',
      ],
    },
  ],
  usecases: [
    {
      file: 'server/skeleton-c-v1/usecases/auth-write.usecase.mjs',
      requiredImports: [
        '../repositories/auth-write.repository.mjs',
      ],
    },
    {
      file: 'server/skeleton-c-v1/usecases/customer-assignment-write.usecase.mjs',
      requiredImports: [
        '../repositories/user-write.repository.mjs',
      ],
    },
    {
      file: 'server/skeleton-c-v1/usecases/user-write.usecase.mjs',
      requiredImports: [
        '../repositories/user-write.repository.mjs',
      ],
    },
  ],
};

export const userServiceProtectedServiceRoots = [
  'server/microservices/gateway',
  'server/microservices/points-service',
];

export const userServiceLegacyReviewRoots = [
  'server/skeleton-c-v1/routes',
  'server/skeleton-c-v1/services',
  'server/skeleton-c-v1/usecases',
  'server/skeleton-c-v1/repositories',
];

export const summarizeUserServiceBoundary = () => ({
  mainWriteTables: userServiceMainWriteTables,
  whitelist: {
    routes: userServiceWriteWhitelist.routes.length,
    usecases: userServiceWriteWhitelist.usecases.length,
    repositories: userServiceWriteWhitelist.repositories.length,
    infra: userServiceWriteWhitelist.infra.length,
  },
});
