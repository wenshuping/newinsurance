# Activity Service Smoke / Gate

更新时间：2026-03-09  
负责人：C 号  
状态：`WEEK17_FINAL_BOUNDARY`

## 1. Phase 2 complete smoke

主 smoke：`scripts/smoke_activity_complete_phase2.mjs`

最小覆盖：

1. `/ready` 把 `complete` 列入 `stableContracts`
2. `GET /api/p/activities` / `POST /api/p/activities` 可用
3. `GET /api/b/activity-configs` / `POST /api/b/activity-configs` / `PUT /api/b/activity-configs/:id` 可用
4. `POST /api/activities/:id/complete` 未登录返回 `401`
5. `POST /api/activities/:id/complete` 缺 `x-csrf-token` 返回 `403`
6. 首次完成活动成功
7. 重复完成活动返回 `409 ALREADY_COMPLETED`
8. `activity-service` observability 有成功日志

## 2. activity -> points reward smoke

契约 smoke：`scripts/smoke_activity_points_reward_phase2.mjs`

最小覆盖：

1. `activity-complete.usecase` 不再直接 `recordPoints()`
2. `activity-service` route 使用 `points-service.client.mjs`
3. legacy 兼容入口使用 `activity-reward.service.mjs`
4. 完成活动后 points summary 增加
5. points observability 出现 `INTERNAL activity->points reward settlement`
6. 同一 `idempotencyKey` 只产生一条 points transaction

## 3. Gate 入口

主 gate：`scripts/gate_activity_service_phase2.mjs`

编排：

1. `check_activity_user_boundary_guard.mjs`
2. `check_activity_service_boundary_phase2.mjs`
3. `smoke_activity_complete_phase2.mjs`
4. `smoke_activity_points_reward_phase2.mjs`

## 4. Week17 final boundary guard

final boundary guard：`scripts/check_activity_points_final_boundary.mjs`

最小覆盖：

1. `activity-service` stable owned routes 不漂移
2. `sign-in / mall activities / join / redeem / orders / writeoff` 仍归 `points-service`
3. `activity-service` 奖励 caller 固定为 `points-service.client.mjs`
4. `points-service` provider 固定为 `/internal/points-service/activity-rewards/settle`
5. `activity-service` 与 legacy adapter 不得直写 points 主写表

## 5. Week17 legacy review

legacy review：`scripts/review_activity_points_legacy_routes_week17.mjs`

最小覆盖：

1. `server/skeleton-c-v1/routes/activities.routes.mjs` 仍只把 `complete` 转到 points 契约
2. `server/skeleton-c-v1/services/activity-reward.service.mjs` 仍只走 HTTP adapter
3. 显式列出残留兼容层文件
4. 给出 “activity 是否可视为正式拆出” 的最终判断

## 6. Week17 final gate

final gate：`scripts/gate_activity_points_final_boundary.mjs`

编排：

1. `check_activity_points_final_boundary.mjs`
2. `review_activity_points_legacy_routes_week17.mjs`
3. `gate_activity_service_phase2.mjs`
