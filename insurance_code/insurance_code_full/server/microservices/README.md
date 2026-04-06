# Microservices Runtime Split

This folder contains the Week5 executable runtime split for the first V2 decomposition phase.

## Structure

- `gateway/`: gateway route map, V1/V2 cutover, HTTP proxy forwarding
- `user-service/`: auth + profile domain routes
- `points-service/`: points + mall + redemption + order routes
- `learning-service/`: learning query + admin CRUD pilot routes
- `activity-service/`: activity query + admin CRUD + completion pilot routes
- `shared/`: cross-service auth/tenant context and runtime helpers

## Run

```bash
cd /Users/wenshuping/Documents/New\ project/insurance_code/insurance_code_full
npm run dev:api:skeleton
node server/microservices/user-service.mjs
node server/microservices/points-service.mjs
node server/microservices/learning-service.mjs
node server/microservices/activity-service.mjs
npm run dev:api:gateway
```

Default ports:

- `api-v1`: `4000`
- `gateway`: `4100`
- `user-service`: `4101`
- `points-service`: `4102`
- `learning-service`: `4103`
- `activity-service`: `4104`

## Smoke

```bash
npm run test:smoke:gateway-week1
npm run test:smoke:week5-runtime-split:e2e
npm run test:smoke:week5-runtime-split
npm run gate:week6-runtime-split
npm run test:smoke:user-service:week7-observability
npm run test:smoke:gateway:week7-observability
npm run gate:week7-runtime-split
```

Important env vars:

- `API_GATEWAY_PORT`
- `API_USER_SERVICE_PORT`
- `API_POINTS_SERVICE_PORT`
- `GATEWAY_ENABLE_V2`
- `GATEWAY_FORCE_V1`
- `GATEWAY_ENABLE_V1_FALLBACK`
- `GATEWAY_FORCE_V1_PATHS`
- `GATEWAY_FORCE_V2_PATHS`
- `GATEWAY_V2_TENANTS`
- `GATEWAY_V1_BASE_URL`
- `GATEWAY_USER_SERVICE_URL`
- `GATEWAY_POINTS_SERVICE_URL`
- `GATEWAY_LEARNING_SERVICE_URL`
- `GATEWAY_ACTIVITY_SERVICE_URL`
- `LEARNING_POINTS_SERVICE_URL`
- `ACTIVITY_POINTS_SERVICE_URL`
- `ACTIVITY_SERVICE_PORT`

Week13 learning -> points internal HTTP contract:

- `learning-service` does not import `points-service` reward code directly
- pilot compatibility route `POST /api/learning/courses/:id/complete` settles reward over internal HTTP:
  - `POST /internal/points-service/learning-rewards/settle`
- required propagated headers:
  - `x-internal-service: learning-service`
  - `x-trace-id`
  - `x-request-id`
  - `x-tenant-id`
  - `x-tenant-code` (when available)
- `LEARNING_POINTS_SERVICE_URL` controls the direct upstream base URL for this contract

Week9 DATABASE_URL authority:

- Always use `postgresql://`
- Do not use `postgres://`
- Do not put `sslmode` inside `DATABASE_URL`
- Control SSL only with `PGSSL`
- Canonical reference:
  - `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/docs/week9-runtime-database-url-authority-2026-03-07.md`

Frontend bridge:

- Gateway mode:
  - `VITE_API_BASE=http://127.0.0.1:4100`
  - `VITE_USER_SERVICE_BASE=http://127.0.0.1:4100`
  - `VITE_POINTS_SERVICE_BASE=http://127.0.0.1:4100`
- Direct user-service debug:
  - `VITE_USER_SERVICE_BASE=http://127.0.0.1:4101`
- Direct points-service debug:
  - `VITE_POINTS_SERVICE_BASE=http://127.0.0.1:4102`

## Week5 Unified Smoke

Single-service smokes:

- `npm run test:smoke:user-service`
- `npm run test:smoke:points-service`
- `npm run test:smoke:gateway`

Gateway end-to-end smoke:

- `npm run test:smoke:week5-runtime-split:e2e`

Unified suite entry:

- `npm run test:smoke:week5-runtime-split`

## Week6 Gate

Unified local and CI gate:

- `npm run gate:week6-runtime-split`
- `npm run ci:gate:week6-runtime-split`

Boundary-only check:

- `npm run lint:boundary:week6-runtime-split`

Week6 smoke suite:

- `npm run test:smoke:week6-runtime-split`

## Week7 Observability

Unified observability gate:

- `npm run gate:week7-runtime-split`

## Week13 Learning Pilot

Unified smoke:

- `npm run test:smoke:week13-learning-pilot`

Contract settlement smoke:

- `npm run test:smoke:learning-points-contract:week13`

Release-check:

- `npm run release-check:week13-learning-pilot`

Gate:

- `npm run gate:week13-learning-pilot`
- `npm run ci:gate:week13-learning-pilot`

## Week14 Learning Complete + Reward

Unified smoke:

- `npm run test:smoke:week14-learning-complete`

Contract settlement smoke:

- `npm run test:smoke:learning-points-contract:week14`

Release-check:

- `npm run release-check:week14-learning-complete`

Gate:

- `npm run gate:week14-learning-complete`
- `npm run ci:gate:week14-learning-complete`

Week14 calling convention:

- `learning-service -> points-service` uses direct internal HTTP
- complete route is now cut over by gateway when `GATEWAY_ENABLE_LEARNING_SERVICE=true`
- write path does not use automatic network fallback; rollback uses `GATEWAY_FORCE_V1_PATHS`
- `npm run ci:gate:week7-runtime-split`

Week7 observability smokes:

- `npm run test:smoke:user-service:week7-observability`
- `npm run test:smoke:gateway:week7-observability`

Runtime observability endpoints:

- `GET /metrics`
- `GET /internal/gateway/metrics`
- `GET /internal/ops/overview`
- `GET /internal/user-service/observability`
- `GET /internal/points-service/observability`

## Week15 Activity Pilot

Unified smoke:

- `npm run test:smoke:week15-activity-pilot`

Contract settlement smoke:

- `npm run test:smoke:activity-points-contract:week15`

Release-check:

- `npm run release-check:week15-activity-pilot`

Gate:

- `npm run gate:week15-activity-pilot`
- `npm run ci:gate:week15-activity-pilot`

Week15 calling convention:

- `activity-service -> points-service` uses direct internal HTTP
- activity Phase 1 owned routes are cut over by gateway only when `GATEWAY_ENABLE_ACTIVITY_SERVICE=true`
- read path allows automatic network fallback to `v1-monolith`
- write path does not use automatic network fallback; rollback uses `GATEWAY_FORCE_V1_PATHS`
