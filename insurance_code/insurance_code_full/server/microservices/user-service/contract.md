# user-service contract

## Owned routes

1. `POST /api/auth/send-code`
2. `POST /api/auth/verify-basic`
3. `GET /api/me`

## Runtime endpoints

1. `GET /health`
2. `GET /ready`
3. `GET /internal/user-service/health`
4. `GET /internal/user-service/ready`
5. `GET /internal/user-service/observability`

## Observability baseline

1. Metrics, log fields, and error catalog are defined in `server/microservices/user-service/OBSERVABILITY.md`
2. `/api/me` public 401 contract remains `UNAUTHORIZED`
3. Token anomaly classification is internal-only and exposed through metrics, logs, and observability snapshot

## Operations docs

1. `docs/week8-user-service-troubleshooting-runbook-2026-03-07.md`
2. `docs/week8-user-service-risk-register-2026-03-07.md`
3. `docs/week8-user-service-alerting-recommendations-2026-03-07.md`
4. `docs/week8-user-service-preflight-checklist-2026-03-07.md`
5. `docs/week9-user-service-deployment-baseline-2026-03-07.md`
6. `docs/week10-user-service-postgres-validation-report-2026-03-07.md`
7. `docs/week11-user-service-gray-metrics-thresholds-2026-03-07.md`
8. `docs/week11-user-service-gray-alert-caliber-2026-03-08.md`
9. `docs/week11-user-service-gray-observation-conclusion-2026-03-08.md`
10. `docs/week12-learning-service-boundary-review-from-user-domain-2026-03-07.md`

## Primary write boundary

1. Logical identity aggregate: `app_users` / runtime equivalent `state.users`
2. Customer profile aggregate: `c_customers` / runtime `state.users`
3. Session aggregate: `p_sessions` / runtime `state.sessions`
4. Identity verification state carried by the same customer aggregate

## Whitelist

Routes:

1. `server/microservices/user-service/auth.routes.mjs`
2. `server/microservices/user-service/me.routes.mjs`

Usecases:

1. `server/skeleton-c-v1/usecases/auth-write.usecase.mjs`
2. `server/skeleton-c-v1/usecases/customer-assignment-write.usecase.mjs`
3. `server/skeleton-c-v1/usecases/user-write.usecase.mjs`

Repositories:

1. `server/skeleton-c-v1/repositories/auth-write.repository.mjs`
2. `server/skeleton-c-v1/repositories/user-write.repository.mjs`

## Compatibility rules

1. `verify-basic` response fields stay stable: `token`, `csrfToken`, `user`
2. `me` response fields stay stable: `user`, `balance`, `csrfToken`
3. `user` fields stay stable for C-end login and profile page:
   1. `id`
   2. `name`
   3. `mobile`
   4. `nick_name`
   5. `avatar_url`
   6. `is_verified_basic`
   7. `verified_at`

## Smoke

```bash
node scripts/smoke_user_service_contract.mjs
```

```bash
node scripts/smoke_user_service_boundary.mjs
```

```bash
node scripts/check_user_service_boundary_guard.mjs
```

```bash
node scripts/smoke_user_service_week7_observability.mjs
```

## Standalone run

```bash
STORAGE_BACKEND=dbjson API_USER_SERVICE_PORT=4101 node server/microservices/user-service.mjs
```
