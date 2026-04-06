# Week17 Activity / Points Final Boundary

更新时间：2026-03-09  
负责人：C 号  
状态：`WEEK17_FINAL_BOUNDARY`

## 1. 结论

1. `activity-service` 可以正式按“activity 域已拆出”处理
2. 这个结论只覆盖 activity 域稳定范围，不覆盖商城活动参与和积分交易链路
3. `points-service` 继续永久拥有 `sign-in / mall activities / join / redeem / orders / writeoff`
4. `activity.complete` 奖励结算继续只允许通过 `points-service` 契约

## 2. 已稳定归 activity-service 的链路

1. `GET /api/activities`
2. `POST /api/activities/:id/complete`
3. `GET /api/p/activities`
4. `POST /api/p/activities`
5. `PUT /api/p/activities/:id`
6. `DELETE /api/p/activities/:id`
7. `GET /api/b/activity-configs`
8. `POST /api/b/activity-configs`
9. `PUT /api/b/activity-configs/:id`

主写表：

1. `p_activities(source_domain='activity')`
2. `c_activity_completions`

## 3. 永久留在 points-service 的链路

1. `POST /api/sign-in`
2. `GET /api/mall/activities`
3. `POST /api/mall/activities/:id/join`
4. `POST /api/mall/redeem`
5. `GET /api/orders`
6. `GET /api/orders/:id`
7. `POST /api/orders/:id/pay`
8. `POST /api/orders/:id/cancel`
9. `POST /api/orders/:id/refund`
10. `GET /api/redemptions`
11. `POST /api/redemptions/:id/writeoff`

永久留在 points 的原因：

1. 它们直接主写或强依赖 `c_point_accounts / c_point_transactions / p_orders / c_redeem_records / c_sign_ins`
2. 它们已经绑定 Week6-Week8 冻结的交易语义、observability 和回退口径
3. 它们不是 activity 域稳定拆分范围，而是 points + commerce 范围

## 4. 残留兼容层依赖清单

这些依赖仍存在，但当前都属于受控兼容层：

1. `server/skeleton-c-v1/routes/activities.routes.mjs`
   - 作用：旧挂载方式下的活动路由兼容层
   - 当前状态：`complete` 通过 `settleActivityRewardViaPointsService` 转发；文件内仍混有 `/api/sign-in`
2. `server/skeleton-c-v1/usecases/activity-complete.usecase.mjs`
   - 作用：共享 complete usecase
   - 当前状态：只接受注入式 `settleReward`，不允许本地 `recordPoints()`
3. `server/skeleton-c-v1/services/activity-reward.service.mjs`
   - 作用：legacy reward adapter
   - 当前状态：只允许转发到 `settleActivityRewardOverHttp`
4. `server/microservices/activity-service/points-service.client.mjs`
   - 作用：activity -> points 正式内部 HTTP caller
5. `server/microservices/points-service/activity-reward.route.mjs`
   - 作用：points provider 侧正式内部契约入口
6. `server/microservices/points-service/activity-reward.contract.mjs`
   - 作用：points 落账、幂等和错误码的权威实现

## 5. 奖励链路最终边界

1. `activity-service` 负责：
   - 活动可见性判断
   - 活动可完成性判断
   - 重复完成判断
   - `c_activity_completions` 写入
   - 发起 reward settlement request
2. `points-service` 负责：
   - `c_point_accounts`
   - `c_point_transactions`
   - 奖励幂等
   - 奖励 observability
   - 奖励错误码
3. 内部契约固定为：
   - `POST /internal/points-service/activity-rewards/settle`
4. 幂等 key 固定为：
   - `activity-reward:{tenantId}:{userId}:{activityId}:{completionDate}`

## 6. 是否可正式视为 activity 已拆出

结论：`可以，但只限稳定 activity 域范围`

解释：

1. activity 域 own routes 和主写表已经独立收口到 `activity-service`
2. 奖励落账已经通过 `points-service` 契约受控完成
3. `activity-service` 不再直写 points 主写表
4. 当前残留的是兼容层和共享 usecase，不再改变服务归属结论
5. 但商城活动参与、积分交易、订单、核销仍不属于 activity 域拆分成果

## 7. 验证入口

1. `node scripts/check_activity_points_final_boundary.mjs`
2. `node scripts/review_activity_points_legacy_routes_week17.mjs`
3. `node scripts/gate_activity_points_final_boundary.mjs`
