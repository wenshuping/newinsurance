# Week6 Runtime Split Gate Runbook

Date: 2026-03-07
Owner: A / Integrator
Scope: `gateway-service` + `user-service` + `points-service`

## 1. Goal

Week6 only does integration and gate hardening:

1. provide one local run entry
2. provide one CI run entry
3. block route ownership drift between `gateway`, `user-service`, and `points-service`
4. keep the Week5 executable full-chain smoke alive

## 2. Unified Command

Local and CI use the same gate entry:

```bash
npm run gate:week6-runtime-split
```

CI alias:

```bash
npm run ci:gate:week6-runtime-split
```

## 3. Included Checks

### 3.1 Boundary gate

Command:

```bash
npm run lint:boundary:week6-runtime-split
```

Coverage:

1. `gateway` user owned routes must exactly match `user-service`
2. `gateway` points owned routes must exactly match `points-service`
3. `user-service` and `points-service` must not claim overlapping routes
4. `user-service` must not import `points-service` directly
5. `points-service` must not import `user-service` directly
6. `user-service` main-write boundary guard must pass
7. points frontend bridge must keep `points-service` routes behind `src/lib/api.ts`

### 3.2 Smoke suite

Command:

```bash
npm run test:smoke:week6-runtime-split
```

Coverage:

1. `user-service` contract smoke
2. `points-service` contract smoke
3. `gateway` smoke
4. `gateway -> user-service -> points-service` end-to-end smoke
5. V2 default forwarding
6. forced V1 cutover
7. switch back to V2
8. read-path fallback from V2 to V1

## 4. Environment Contract

Ports:

- `api-v1`: `4000`
- `gateway`: `4100`
- `user-service`: `4101`
- `points-service`: `4102`

Gateway:

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

Frontend bridge:

- `VITE_API_BASE`
- `VITE_USER_SERVICE_BASE`
- `VITE_POINTS_SERVICE_BASE`

Frozen auth protocol:

- `Authorization: Bearer <token>`
- `x-csrf-token: <csrfToken>`

## 5. CI Wiring

CI should call the same package entry:

```bash
npm run ci:gate:week6-runtime-split
```

This keeps local and CI behavior aligned. No separate CI-only shell composition is allowed for this gate.

## 6. Failure Interpretation

1. boundary gate fails:
   - ownership drift happened
   - route map and service contract are no longer aligned
   - or a direct cross-service import was introduced
2. smoke suite fails:
   - runtime split no longer behaves as executable system
   - or V1/V2 cutover/fallback broke

## 7. Expected Deliverables

1. one gate command
2. one smoke suite command
3. one report template
4. one final run result for the current day
