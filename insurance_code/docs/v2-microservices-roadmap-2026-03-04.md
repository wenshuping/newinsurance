# V2 Microservices Roadmap (2026-03-04)

## Document Purpose
This document is the execution baseline for V2 architecture migration. New contributors should follow this file directly.

## Current Overall Status
- Scope: C/B/P frontend + API backend + Postgres migration path
- Progress: ~45% complete toward V2 microservices target
- Remaining: ~55%
- Last validated: 2026-03-04 (`npm run release:verify` passed)

## Status Legend
- `TODO`: not started
- `DOING`: in progress
- `DONE`: completed and verified
- `BLOCKED`: waiting dependency/decision

## P0 Must-Finish (Release Gate)
1. `TODO` Switch business source-of-truth to formal tables only (`c_/b_/p_`), no runtime_state write path
2. `TODO` Eliminate points inconsistency in signin/redeem/activity flows
3. `DONE` Add unified release verification command (`npm run release:verify`)
4. `DONE` Add C copy guard + contract freeze checks in CI
5. `TODO` Enforce FK precheck in API prestart and block on orphan data

## P1 Next
1. `TODO` Introduce event bus for points/commerce domain events
2. `TODO` Add tracing + metrics dashboard + alerting
3. `TODO` Consolidate RBAC policy center for platform/company/manager/advisor roles

## 4-Week Execution Plan

### Week 1 - Service Boundaries and Baseline
- Status: `DONE`
- Goal: establish clear service decomposition and run minimal two-service setup
- Tasks:
  1. Define service boundaries: user/content/points/order
  2. Create API gateway routing map
  3. Scaffold `user-service` and `points-service`
  4. Standardize auth middleware (JWT + tenant context)
- Exit Criteria:
  1. Login + points summary path can run through new service routing
  2. Existing regression suite remains green

- Execution Evidence (2026-03-04):
  1. Added executable gateway + user-service + points-service skeleton under `insurance_code_full/server/microservices/`
  2. Added unified auth/tenant middleware: `insurance_code_full/server/microservices/shared/auth-context.mjs`
  3. Added route ownership map endpoint: `GET /internal/gateway/routes`
  4. Added smoke: `npm run test:smoke:gateway-week1` (pass)
  5. Verified `npm run test:smoke:api-core` remains pass

### Week 2 - Data Layer and Consistency
- Status: `DOING`
- Goal: replace full-table rewrite behavior with repository + transaction model
- Tasks:
  1. Implement repository + DTO layering for write paths
  2. Add transaction boundaries for signin/redeem/order/activity completion
  3. Integrate FK precheck and orphan repair into startup/deploy pipeline
  4. Remove remaining runtime_state business writes
- Exit Criteria:
  1. No delayed rollback-to-zero behavior in points/policy counters
  2. Data mutation traceable by transaction and audit record

- Progress (2026-03-04):
  1. Added transaction runner: `runInStateTransaction` in `insurance_code_full/server/skeleton-c-v1/common/state.mjs`
  2. Added DTO layer for write commands: `insurance_code_full/server/skeleton-c-v1/dto/write-commands.dto.mjs`
  3. Added repository layer:
     - `insurance_code_full/server/skeleton-c-v1/repositories/signin-write.repository.mjs`
     - `insurance_code_full/server/skeleton-c-v1/repositories/commerce-write.repository.mjs`
  4. Added use case layer:
     - `insurance_code_full/server/skeleton-c-v1/usecases/signin.usecase.mjs`
     - `insurance_code_full/server/skeleton-c-v1/usecases/redeem.usecase.mjs`
     - `insurance_code_full/server/skeleton-c-v1/usecases/order-create.usecase.mjs`
  5. Routes migrated to DTO + UseCase with transaction boundary:
     - `/api/sign-in`
     - `/api/mall/redeem`
     - `/api/orders`
  6. Validation:
     - `npm run test:smoke:api-core` pass
     - `npm run test:smoke:gateway-week1` pass

### Week 3 - Eventization and Observability
- Status: `TODO`
- Goal: decouple core flows and make behavior observable
- Tasks:
  1. Implement outbox/event bus (DB outbox or Redis stream)
  2. Emit and consume `SIGNIN_COMPLETED`, `REDEEM_CREATED`, `POINTS_CHANGED`
  3. Add trace id propagation and cross-service log correlation
  4. Fix metric semantics mismatch (`sys_api_uptime` to true 24h window)
- Exit Criteria:
  1. Points changes can be traced request -> event -> write
  2. Dashboard covers success rate/latency/error rate

### Week 4 - Progressive Rollout and Ops Closure
- Status: `TODO`
- Goal: production-grade deployment and rollback readiness
- Tasks:
  1. Blue-green/canary deployment scripts
  2. Rollback automation and runbook
  3. Backup + restore drill report
  4. SLO thresholds + alert routing + on-call checklist
- Exit Criteria:
  1. Canary 10% -> 50% -> 100% executed safely
  2. Rollback achievable within 15 minutes

## Execution Order (for new contributors)
1. Complete all P0 items first
2. Execute Week 1 -> Week 4 in sequence
3. At end of each week, update this file:
   - change week status (`TODO`/`DOING`/`DONE`)
   - append verification evidence (commands + outputs summary)

## Verification Checklist (every milestone)
1. `npm run release:verify`
2. CI workflows green:
   - C: copy guard + contract freeze + build
   - B: typecheck + build
   - P: typecheck + build
3. Manual smoke in browser for:
   - C: learning/activity/mall/profile points consistency
   - B: shelf visibility and status mapping
   - P: metrics config and governance pages

## Change Log
- 2026-03-04: Initial roadmap baseline created.
- 2026-03-04: Week1 marked DONE with executable skeleton and smoke evidence.
