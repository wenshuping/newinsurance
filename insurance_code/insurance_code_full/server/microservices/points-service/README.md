# Points Service

Week6-Week17 points-and-commerce runtime, boundary, observability, launch baseline, and activity cross-boundary closure for C engineer ownership.

## Scope

- `/api/sign-in`
- `/api/points/*`
- `/api/mall/*`
- `/api/orders/*`
- `/api/redemptions/*`

## Main-write boundary

- `c_point_accounts`
- `c_point_transactions`
- `p_products`
- `p_orders`
- `c_redeem_records`
- `c_sign_ins`

Boundary source of truth:

- `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/points-service/BOUNDARY.md`
- `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/points-service/write-boundary-whitelist.json`

## Run

```bash
node server/microservices/points-service/index.mjs
```

Default host/port:

- `API_HOST=127.0.0.1`
- `POINTS_SERVICE_PORT=4102`
- `STORAGE_BACKEND=file` for local file-mode smoke, or provide a valid `DATABASE_URL` for Postgres mode

## Health

- `GET /health`
- `GET /ready`
- `GET /internal/points-service/health`
- `GET /internal/points-service/ready`
- `GET /internal/points-service/observability`
- `GET /metrics`
- `GET /internal/points-service/metrics`

## Auth

`points-service` follows the auth contract produced by `user-service` login:

- login endpoints stay in `user-service`
- frontend receives `token` and `csrfToken`
- read endpoints require `Authorization: Bearer <token>`
- write endpoints require:
  - `Authorization: Bearer <token>`
  - `x-csrf-token: <csrfToken>`

Do not change in this round:

- token structure
- session parsing
- csrf header name
- user identity resolution

## Smoke

```bash
node scripts/smoke_points_service_week5.mjs
```

```bash
node scripts/smoke_points_boundary_week5.mjs
```

```bash
node scripts/check_points_frontend_bridge_week6.mjs
```

```bash
node scripts/smoke_points_service_week7.mjs
```

```bash
node scripts/smoke_activity_points_reward_phase1.mjs
```

Smoke covers:

- health/ready
- sign-in reward
- points summary consistency
- mall redeem
- order detail
- redemption writeoff
- trace header echo
- observability metrics snapshot
- structured points request logs
- activity reward controlled settlement

Boundary smoke covers:

- points main-write table inventory
- route/usecase/repository whitelist existence
- non-whitelist files direct-write guard
- `gateway-service` direct-write guard
- `user-service` direct-write guard
- frontend points bridge guard

## Observability

Week7 observability baseline:

- `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/points-service/OBSERVABILITY.md`

This covers:

- points runtime metrics inventory
- normalized log field spec
- transaction error classification
- pending frontend order-bridge methods
- activity reward settlement metrics

## Week8 Launch Guard

Week8 launch-support documents:

- `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/points-service/TROUBLESHOOTING.md`
- `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/points-service/RISKS.md`
- `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/points-service/ALERTING.md`
- `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/points-service/BRIDGE-STATUS.md`

These documents are for online troubleshooting only:

- no new points runtime features
- no changed API semantics
- no enabling of frozen bridge methods during incident handling

## Week9-Week12 Productionization

Week9 deployment baseline:

- `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/points-service/WEEK9-DEPLOYMENT-BASELINE.md`

Week10 Postgres real-database validation:

- `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/points-service/WEEK10-POSTGRES-VALIDATION.md`

Week11 grayscale metrics and fallback interpretation:

- `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/points-service/WEEK11-GRAYSCALE-METRICS.md`
- `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/points-service/WEEK11-GRAYSCALE-REHEARSAL.md`

Week12 activity-service boundary review prep:

- `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/points-service/WEEK12-ACTIVITY-SERVICE-REVIEW.md`

Week15 activity-service Phase 1 cross-boundary delivery:

- `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/points-service/WEEK12-ACTIVITY-POINTS-BOUNDARY.md`
- `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/points-service/activity-reward.contract.mjs`

Week17 final activity/points boundary closure:

- `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/points-service/WEEK17-ACTIVITY-POINTS-FINAL-BOUNDARY.md`

Week18 final learning/points boundary review:

- `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/points-service/WEEK18-LEARNING-POINTS-FINAL-BOUNDARY.md`
