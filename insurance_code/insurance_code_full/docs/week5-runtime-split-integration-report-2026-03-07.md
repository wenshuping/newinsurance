# Week5 Runtime Split Final Integration Report

Date: 2026-03-07
Owner: Integrator
Scope: `gateway-service` + `user-service` + `points-service`

## 1. Unified Run Entry

Single-service smoke:

```bash
npm run test:smoke:user-service
npm run test:smoke:points-service
npm run test:smoke:gateway
```

Gateway full-chain smoke:

```bash
npm run test:smoke:week5-runtime-split:e2e
```

Unified suite entry:

```bash
npm run test:smoke:week5-runtime-split
```

## 2. Unified Environment Contract

Service ports:

- `api-v1`: `4000`
- `gateway`: `4100`
- `user-service`: `4101`
- `points-service`: `4102`

Gateway env:

- `API_GATEWAY_PORT`
- `GATEWAY_ENABLE_V2`
- `GATEWAY_FORCE_V1`
- `GATEWAY_ENABLE_V1_FALLBACK`
- `GATEWAY_FORCE_V1_PATHS`
- `GATEWAY_FORCE_V2_PATHS`
- `GATEWAY_V2_TENANTS`
- `GATEWAY_V1_BASE_URL`
- `GATEWAY_USER_SERVICE_URL`
- `GATEWAY_POINTS_SERVICE_URL`

Frontend bridge env:

- `VITE_API_BASE`
- `VITE_USER_SERVICE_BASE`
- `VITE_POINTS_SERVICE_BASE`

Bridge rule:

- gateway mode:
  - `VITE_API_BASE=http://127.0.0.1:4100`
  - `VITE_USER_SERVICE_BASE=http://127.0.0.1:4100`
  - `VITE_POINTS_SERVICE_BASE=http://127.0.0.1:4100`
- direct debug:
  - `VITE_USER_SERVICE_BASE=http://127.0.0.1:4101`
  - `VITE_POINTS_SERVICE_BASE=http://127.0.0.1:4102`

Frozen protocol:

- `Authorization: Bearer <token>`
- `x-csrf-token: <csrfToken>`

## 3. Executed Validation

Executed:

1. `npm run test:smoke:user-service`
2. `npm run test:smoke:points-service`
3. `npm run test:smoke:gateway`
4. `npm run test:smoke:week5-runtime-split:e2e`
5. `npm run test:smoke:week5-runtime-split`

## 4. Final Smoke Result

### 4.1 Service-level result

- `user-service`: PASS
- `points-service`: PASS
- `gateway`: PASS

### 4.2 End-to-end result

Gateway path `gateway -> user-service -> points-service` passed for:

1. `POST /api/auth/send-code`
2. `POST /api/auth/verify-basic`
3. `GET /api/me`
4. `POST /api/sign-in`
5. `GET /api/points/summary`
6. `GET /api/points/detail`
7. `GET /api/mall/items`
8. `GET /api/mall/activities`
9. `POST /api/mall/redeem`
10. `GET /api/orders`
11. `GET /api/orders/:id`
12. `POST /api/orders`
13. `POST /api/orders/:id/pay`
14. `POST /api/orders/:id/cancel`
15. `POST /api/orders/:id/refund`
16. `POST /api/redemptions/:id/writeoff`
17. repeat `POST /api/sign-in` idempotency
18. repeat `POST /api/redemptions/:id/writeoff` idempotency

### 4.3 Cutover / fallback result

Validated:

1. V2 default forwarding:
   - `x-gateway-mode=v2`
   - `x-gateway-target-service=user-service|points-service`
2. forced V1:
   - `GATEWAY_FORCE_V1=true`
   - response switched to `x-gateway-mode=v1`
   - `x-gateway-target-service=v1-monolith`
3. switch back to V2:
   - response switched back to `x-gateway-mode=v2`
4. read-path fallback:
   - when `points-service` upstream was intentionally invalidated for `GET /api/mall/items`
   - gateway successfully fell back to V1
   - response headers reflected `v1-monolith`

## 5. Pass / Fail / Risk

### 5.1 Pass

- Unified smoke entry exists and passes.
- Service boundaries are executable as independent processes.
- `internal/gateway/routes` returns correct owned routes.
- `VITE_USER_SERVICE_BASE` and `VITE_POINTS_SERVICE_BASE` are wired into the frontend bridge layer.
- `Bearer + CSRF` contract remained unchanged.
- Sign-in and writeoff idempotency remained unchanged.

### 5.2 Not Passed

- None in current Week5 integration scope.

### 5.3 Risk

1. Current validation is in `file/dbjson` local mode; shared Postgres mode still depends on valid local `DATABASE_URL` or `.env` credentials.
2. `gateway` fallback is intentionally only validated on read-path GET requests. Mutating requests do not auto-fallback to avoid double write risk.
3. Runtime split is process-level only. `user-service` and `points-service` still share the same state/storage implementation and are not yet physically isolated databases.

## 6. Final Conclusion

Conclusion:

- Week5 first-stage runtime split is integrated and executable.
- Current result is sufficient to enter Week6.

Entry condition for Week6:

1. keep service ownership frozen
2. keep `Authorization + x-csrf-token` frozen
3. do not widen gateway owned routes without smoke update
4. if moving to shared Postgres validation, fix environment credentials first
