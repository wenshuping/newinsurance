# Activity Service

更新时间：2026-03-09  
负责人：C 号  
状态：`WEEK17_FINAL_BOUNDARY`

Week17 把 `activity-service` 和 `points-service` 的最终边界收平：`POST /api/activities/:id/complete` 继续作为稳定能力，`sign-in / mall activities / join / redeem / orders / writeoff` 明确永久留在 `points-service`。

## 文档入口

1. Contract：`/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/activity-service/CONTRACT.md`
2. Boundary：`/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/activity-service/BOUNDARY.md`
3. Observability：`/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/activity-service/OBSERVABILITY.md`
4. Smoke / Gate：`/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/activity-service/SMOKE-GATE.md`
5. Complete stable：`/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/activity-service/COMPLETE-STABLE.md`
6. Release check：`/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/activity-service/RELEASE-CHECK.md`
7. Activity -> points acceptance：`/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/activity-service/ACTIVITY-POINTS-ACCEPTANCE.md`
8. Week17 final boundary：`/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/activity-service/WEEK17-FINAL-BOUNDARY.md`

## Runtime 文件

1. app：`/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/activity-service/app.mjs`
2. router：`/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/activity-service/router.mjs`
3. entry：`/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/activity-service.mjs`

## Reward settlement

1. caller：`activity-service`
2. provider：`points-service`
3. endpoint：`POST /internal/points-service/activity-rewards/settle`
4. compatibility adapter：`/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/skeleton-c-v1/services/activity-reward.service.mjs`

## Phase 2 verification

1. `node scripts/check_activity_service_boundary_phase2.mjs`
2. `node scripts/smoke_activity_complete_phase2.mjs`
3. `node scripts/smoke_activity_points_reward_phase2.mjs`
4. `node scripts/gate_activity_service_phase2.mjs`

## Week17 final boundary verification

1. `node scripts/check_activity_points_final_boundary.mjs`
2. `node scripts/review_activity_points_legacy_routes_week17.mjs`
3. `node scripts/gate_activity_points_final_boundary.mjs`
