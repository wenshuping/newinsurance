# Week17 Activity / Points Final Boundary (Points Perspective)

更新时间：2026-03-09  
负责人：C 号（points-service）  
状态：`WEEK17_FINAL_BOUNDARY`

## 1. points-service 永久保留的能力

1. `POST /api/sign-in`
2. `GET /api/points/summary`
3. `GET /api/points/transactions`
4. `GET /api/points/detail`
5. `GET /api/mall/items`
6. `GET /api/mall/activities`
7. `POST /api/mall/activities/:id/join`
8. `POST /api/mall/redeem`
9. `GET /api/orders`
10. `GET /api/orders/:id`
11. `POST /api/orders/:id/pay`
12. `POST /api/orders/:id/cancel`
13. `POST /api/orders/:id/refund`
14. `GET /api/redemptions`
15. `POST /api/redemptions/:id/writeoff`

## 2. points 主写表不变

1. `c_point_accounts`
2. `c_point_transactions`
3. `p_products`
4. `p_orders`
5. `c_redeem_records`
6. `c_sign_ins`

## 3. activity 与 points 的最终交叉边界

1. `activity-service` 可以主写：
   - `p_activities(source_domain='activity')`
   - `c_activity_completions`
2. `activity-service` 不得直写：
   - `c_point_accounts`
   - `c_point_transactions`
   - `p_orders`
   - `c_redeem_records`
   - `c_sign_ins`
3. 活动奖励最终只能通过：
   - `POST /internal/points-service/activity-rewards/settle`

## 4. 残留兼容层依赖

1. `server/skeleton-c-v1/routes/activities.routes.mjs`
   - 旧活动路由兼容层
2. `server/skeleton-c-v1/usecases/activity-complete.usecase.mjs`
   - 共享 complete usecase
3. `server/skeleton-c-v1/services/activity-reward.service.mjs`
   - legacy HTTP adapter

这些依赖当前不构成 points 主写边界回退，因为它们都不再允许直接调用 `recordPoints()` 或 `appendPoints()` 完成 activity 奖励落账。

## 5. Week17 最终结论

1. `activity-service` 已可按 activity 域稳定范围正式拆出处理
2. `mall activities / join / redeem / orders / writeoff / sign-in` 继续永久留在 `points-service`
3. 如果未来要迁这批链路，必须重新开 points 域边界任务，不能算在 activity 已拆出范围内

## 6. 验证入口

1. `node scripts/check_activity_points_final_boundary.mjs`
2. `node scripts/review_activity_points_legacy_routes_week17.mjs`
3. `node scripts/gate_activity_points_final_boundary.mjs`
