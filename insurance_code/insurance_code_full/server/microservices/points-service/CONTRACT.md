# Points Service Contract

## Scope

This service owns the C-side points and commerce runtime for Week6 runtime split:

- `/api/sign-in`
- `/api/points/*`
- `/api/mall/*`
- `/api/orders/*`
- `/api/redemptions/*`

It does not own:

- `/api/auth/*`
- `/api/me`
- gateway route orchestration

## Auth compatibility baseline

Login remains owned by `user-service`:

- `POST /api/auth/send-code`
- `POST /api/auth/verify-basic`

After login succeeds, frontend receives:

- `token`
- `csrfToken`

`points-service` must keep using the same auth/session contract:

- Read endpoints:
  - `Authorization: Bearer <token>`
- Write endpoints:
  - `Authorization: Bearer <token>`
  - `x-csrf-token: <csrfToken>`

C engineer must not change in this round:

- token structure
- session parsing logic
- csrf header name
- user identity resolution path

Reference files:

- `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/skeleton-c-v1/common/state.mjs`
- `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/skeleton-c-v1/common/middleware.mjs`
- `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/shared/auth-context.mjs`
- `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/points-service/app.mjs`
- `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/points-service/sign-in.route.mjs`

## Main-write boundary

- `c_point_accounts`
- `c_point_transactions`
- `p_products`
- `p_orders`
- `c_redeem_records`
- `c_sign_ins`

Other services should treat these aggregates as read-only in Week6 single-database mode.

Boundary whitelist and scan baseline:

- `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/points-service/BOUNDARY.md`
- `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/points-service/write-boundary-whitelist.json`

Current Week6 boundary rule:

- only points-domain whitelist repositories may direct-write the 6 main-write tables
- `gateway-service` must not direct-write them
- `user-service` must not direct-write them
- cross-domain callers may only go through points-domain service API, not direct table mutations

## Runtime endpoints

Default runtime:

- `API_HOST=127.0.0.1`
- `POINTS_SERVICE_PORT=4102`

Service runtime:

- `GET /health`
- `GET /ready`
- `GET /api/health`
- `GET /internal/points-service/health`
- `GET /internal/points-service/ready`
- `GET /internal/points-service/observability`

Business endpoints:

- `POST /api/sign-in`
- `GET /api/points/summary`
- `GET /api/points/transactions`
- `GET /api/points/detail`
- `GET /api/mall/items`
- `GET /api/mall/activities`
- `POST /api/mall/redeem`
- `POST /api/mall/activities/:id/join`
- `GET /api/orders`
- `GET /api/orders/:id`
- `POST /api/orders`
- `POST /api/orders/:id/pay`
- `POST /api/orders/:id/cancel`
- `POST /api/orders/:id/refund`
- `GET /api/redemptions`
- `POST /api/redemptions/:id/writeoff`

## Internal controlled settlement contracts

Week13 and Week15 now add two points-owned internal settlement contracts:

### Learning reward

- File:
  - `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/points-service/learning-reward.contract.mjs`
- Contract:
  - `settleLearningCourseReward({ tenantId, userId, courseId, courseTitle, rewardPoints, traceId })`

Rules:

- learning reward accounting must go through this contract
- learning domain must not direct-call `appendPoints()`
- final posting still lands in `points-service -> recordPoints()`
- source type remains `course_complete` for compatibility

Output:

- `ok`
- `duplicated`
- `reward`
- `balance`
- `transactionId`
- `idempotencyKey`

Idempotency:

- key format:
  - `learning-reward:${tenantId}:${userId}:${courseId}`
- first successful settlement creates one `c_point_transactions` row
- repeated settlement with the same key returns `duplicated: true`

Current internal error codes:

- `INVALID_LEARNING_REWARD_USER`
- `INVALID_LEARNING_REWARD_COURSE_ID`
- `INVALID_LEARNING_REWARD_POINTS`
- `LEARNING_REWARD_SETTLEMENT_FAILED`

### Activity reward

- File:
  - `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/points-service/activity-reward.contract.mjs`
- Contract:
  - `settleActivityReward({ tenantId, userId, activityId, activityTitle, rewardPoints, completionDate, traceId })`

Rules:

- activity reward accounting must go through this contract
- activity domain must not direct-call `recordPoints()` or `appendPoints()`
- final posting still lands in `points-service -> recordPoints()`
- source type remains `activity_task` for compatibility

Output:

- `ok`
- `duplicated`
- `reward`
- `balance`
- `transactionId`
- `idempotencyKey`
- `completionDate`

Idempotency:

- key format:
  - `activity-reward:${tenantId}:${userId}:${activityId}:${completionDate}`
- `completionDate` format:
  - `YYYY-MM-DD`
- first successful settlement creates one `c_point_transactions` row
- repeated settlement with the same key returns `duplicated: true`

Current internal error codes:

- `INVALID_ACTIVITY_REWARD_USER`
- `INVALID_ACTIVITY_REWARD_ACTIVITY_ID`
- `INVALID_ACTIVITY_REWARD_DATE`
- `INVALID_ACTIVITY_REWARD_POINTS`
- `ACTIVITY_REWARD_SETTLEMENT_FAILED`

## Compatibility rules

- Keep C-end points field semantics unchanged:
  - `/api/points/summary` returns `balance`
  - `/api/sign-in` returns `ok`, `reward`, `balance`
  - `/api/mall/redeem` returns `ok`, `token`, `balance`, `redemption`
- Keep sign-in idempotency unchanged:
  - second same-day `POST /api/sign-in` returns `409 ALREADY_SIGNED`
- Keep writeoff idempotency unchanged:
  - second `POST /api/redemptions/:id/writeoff` returns `409 ALREADY_WRITTEN_OFF`
- Keep insufficient points behavior unchanged:
  - `POST /api/mall/redeem` returns `409 INSUFFICIENT_POINTS`
- Keep learning complete reward semantics aligned with points ownership:
  - learning completion reward posting must go through `settleLearningCourseReward()`
  - repeated learning completion must not duplicate points settlement
- Keep activity complete reward semantics aligned with points ownership:
  - activity completion reward posting must go through `settleActivityReward()`
  - repeated same-day activity completion must not duplicate points settlement

## Frontend bridge expectation

Frontend should bridge the following paths to `VITE_POINTS_SERVICE_BASE`:

- `/api/sign-in`
- `/api/points/*`
- `/api/mall/*`
- `/api/orders/*`
- `/api/redemptions/*`

Current bridge implementation is in:

- `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/src/lib/api.ts`

Bridge guard:

- `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/scripts/check_points_frontend_bridge_week6.mjs`

## Smoke

Week6 points-service smoke baseline:

- `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/scripts/smoke_points_service_week5.mjs`
- `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/scripts/smoke_points_boundary_week5.mjs`
- `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/scripts/check_points_frontend_bridge_week6.mjs`
- `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/scripts/smoke_points_service_week7.mjs`
- `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/scripts/smoke_points_learning_reward_week13.mjs`
- `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/scripts/smoke_activity_points_reward_phase1.mjs`

Coverage:

- service health and readiness
- sign-in success
- sign-in duplicate protection
- points summary balance consistency
- mall redeem success
- order detail visibility
- orders list visibility
- redemptions list visibility
- writeoff success
- writeoff duplicate protection
- boundary whitelist existence
- non-whitelist direct-write guard
- gateway/user direct-write guard
- frontend points bridge guard
- learning reward controlled settlement and idempotency
- activity reward controlled settlement and idempotency

## Observability baseline

Week7 observability source of truth:

- `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/points-service/OBSERVABILITY.md`

This baseline defines:

- sign-in / redeem / writeoff success-rate metrics
- order status transition counters
- points credit/debit counters
- normalized request log fields
- points transaction error taxonomy
- pending frontend bridge methods

## Current dependency notes

- End-to-end browser flow still depends on gateway wiring from A.
- Real login entry still depends on user-service routing from B, but auth compatibility is already confirmed.
- points-service can already be started and smoke-tested independently in file mode.
