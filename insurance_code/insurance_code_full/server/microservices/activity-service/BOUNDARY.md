# Activity Service Boundary

更新时间：2026-03-09  
负责人：C 号  
状态：`WEEK17_FINAL_BOUNDARY`

## 1. Week17 主写表

1. `p_activities(source_domain='activity')`
2. `c_activity_completions`

## 2. 已稳定归 activity-service 的 owned routes

1. `GET /api/activities`
2. `POST /api/activities/:id/complete`
3. `GET /api/p/activities`
4. `POST /api/p/activities`
5. `PUT /api/p/activities/:id`
6. `DELETE /api/p/activities/:id`
7. `GET /api/b/activity-configs`
8. `POST /api/b/activity-configs`
9. `PUT /api/b/activity-configs/:id`

## 3. 奖励结算边界

1. `activity-service` 负责：
   - 活动可见性与可完成性判断
   - 重复完成判断
   - `c_activity_completions` 写入
   - 发起 reward settlement request
2. `points-service` 负责：
   - 积分余额
   - 积分流水
   - 奖励幂等
   - 奖励可观测性

## 4. 不允许直写的 points 主写表

1. `c_point_accounts`
2. `c_point_transactions`
3. `p_orders`
4. `c_redeem_records`
5. `c_sign_ins`

## 5. 永久留在 points-service 的链路

1. `POST /api/sign-in`
2. `GET /api/mall/activities`
3. `POST /api/mall/activities/:id/join`
4. `POST /api/mall/redeem`
5. `GET /api/orders`
6. `GET /api/orders/:id`
7. `POST /api/orders/:id/pay`
8. `POST /api/orders/:id/cancel`
9. `POST /api/orders/:id/refund`
10. `POST /api/redemptions/:id/writeoff`
11. `POST /api/auth/send-code`
12. `POST /api/auth/verify-basic`
13. `GET /api/me`

## 6. 残留兼容层依赖

这些文件仍存在，但当前都属于受控兼容层，不再允许回退成本地点数写入：

1. `server/skeleton-c-v1/routes/activities.routes.mjs`
   - 兼容老挂载方式
   - 仍混合了 `/api/sign-in`
   - `complete` 已通过 `settleActivityRewardViaPointsService` 转发到 points 契约
2. `server/skeleton-c-v1/usecases/activity-complete.usecase.mjs`
   - 共享 usecase
   - 只接受注入式 `settleReward`
3. `server/skeleton-c-v1/services/activity-reward.service.mjs`
   - legacy adapter
   - 只允许转发到 `points-service.client.mjs`
4. `server/microservices/activity-service/points-service.client.mjs`
   - 正式内部 HTTP caller
5. `server/microservices/points-service/activity-reward.route.mjs`
   - 正式 provider 契约入口

## 7. Week17 定版结论

1. `activity-service` 已正式拆出，但只限 activity 域稳定范围
2. 商城活动参与、积分交易、订单、核销仍是 points 域能力，不属于 activity-service
3. 如果后续要动 `mall activities / join / redeem / orders / writeoff`，必须作为 points 域任务处理
4. 当前残留兼容层不再阻塞“activity 已拆出”的结论，因为奖励结算仍只通过 `points-service` 契约

## 8. Gate 最小要求

1. `mainWriteTables` 只认 `p_activities / c_activity_completions`
2. `stableContracts` 必须包含 `POST /api/activities/:id/complete`
3. `activity-complete.usecase` 不得再出现 `recordPoints()`
4. `activity-service` 代码不得直接 import `microservices/points-service/*`
5. `activity` 奖励必须通过 `points-service.client.mjs` 走内部 HTTP 契约
6. `activity-service` 不暴露 `auth / me / sign-in / mall activities / redeem / writeoff`
7. `activity-service` 不写 points 主写表
8. `POST /api/activities/:id/complete` 作为稳定能力验收，不再按试点能力口径处理
9. `activity-service` final boundary review 必须点名永久留在 points 的链路
10. legacy review 必须确认 `activities.routes.mjs` 和 `activity-reward.service.mjs` 仍只走 points 契约
