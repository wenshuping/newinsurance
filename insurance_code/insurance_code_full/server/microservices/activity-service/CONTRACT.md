# Activity Service Contract

更新时间：2026-03-18  
负责人：C 号  
状态：`WEEK17_FINAL_BOUNDARY`

## 1. Week17 稳定能力

### 1.1 C 端

1. `GET /api/activities`
2. `POST /api/activities/:id/complete`

### 1.2 P 端

1. `GET /api/p/activities`
2. `POST /api/p/activities`
3. `PUT /api/p/activities/:id`
4. `DELETE /api/p/activities/:id`

### 1.3 B 端

1. `GET /api/b/activity-configs`
2. `POST /api/b/activity-configs`
3. `PUT /api/b/activity-configs/:id`

## 2. 不在当前稳定范围且继续留在 points-service 的路由

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

## 3. 鉴权口径

### 3.1 C 端

1. 列表读取：`authOptional + tenantContext`
2. 活动完成：需要 `Authorization: Bearer <token>`
3. 活动完成：继续使用 `x-csrf-token: <csrfToken>`

### 3.2 P / B 端

1. 继续复用共享 admin session
2. 继续复用 `tenantContext + permissionRequired`
3. `POST /api/p/activities` 允许使用 `x-ops-api-key`
4. `x-ops-api-key` 模式下不需要 `Authorization` 与 `x-csrf-token`
5. 不新增 activity-service 自己的登录协议

## 4. 关键返回语义

### 4.1 `GET /api/activities`

1. 返回 `{ activities, balance, taskProgress }`
2. 只返回 `source_domain='activity'` 的活动
3. `completed` 继续按“当天是否已完成”判断

### 4.2 `POST /api/activities/:id/complete`

1. 成功返回 `{ ok: true, reward, duplicated, balance }`
2. 首次完成返回 `200`
3. 同用户同活动同日重复完成返回 `409 ALREADY_COMPLETED`
4. 奖励结算通过 `activity-service -> points-service` 内部 HTTP 契约完成
5. `activity-service` 本身不直写 `c_point_accounts / c_point_transactions`
6. 这条 complete 链路在 Week16 按稳定能力验收，不再按试点处理

### 4.3 `GET /api/p/activities`

1. 返回 `{ activities }`
2. 保持当前管理面字段语义

### 4.4 `POST /api/p/activities`

1. 成功返回 `{ ok: true, activity, idempotent }`
2. 支持 `media` 与 `uploadItems`
3. `uploadItems[].dataUrl` 允许直接内联传文件内容
4. `idempotencyKey` 可选；重复提交同一个 key 时返回第一次创建结果且 `idempotent=true`
5. 标题为空返回 `400 ACTIVITY_TITLE_REQUIRED`
6. 非法 `dataUrl` 返回 `400 INVALID_DATA_URL`
7. 单文件超过 12MB 返回 `413 FILE_TOO_LARGE`
8. 无权限返回 `403`

### 4.5 `PUT /api/p/activities/:id`

1. 成功返回 `{ ok: true, activity }`
2. 不存在返回 `404 ACTIVITY_NOT_FOUND`
3. 无权限返回 `403 NO_PERMISSION`

### 4.6 `DELETE /api/p/activities/:id`

1. 成功返回 `{ ok: true }`
2. 平台模板源数据不可删时返回 `403 PLATFORM_TEMPLATE_SOURCE_IMMUTABLE`

### 4.7 `GET /api/b/activity-configs`

1. 返回 `{ list }`
2. 只返回 `source_domain='activity'` 的业务活动配置

### 4.8 `POST /api/b/activity-configs`

1. 成功返回 `{ ok: true, item }`
2. 标题为空返回 `400 TITLE_REQUIRED`

### 4.9 `PUT /api/b/activity-configs/:id`

1. 成功返回 `{ ok: true, item }`
2. 不存在返回 `404 ACTIVITY_NOT_FOUND`
3. 无权限返回 `403 NO_PERMISSION`

## 5. 健康检查与 ready

1. `GET /health`
2. `GET /ready`
3. `GET /api/health`
4. `GET /internal/activity-service/health`
5. `GET /internal/activity-service/ready`
6. `GET /internal/activity-service/observability`

ready 输出要求：

1. `stableContracts` 必须包含 `POST /api/activities/:id/complete`
2. `mainWriteTables` 必须只包含 `p_activities / c_activity_completions`
3. `rewardSettlementContract.endpoint` 必须是 `/internal/points-service/activity-rewards/settle`

## 6. activity -> points 奖励契约

1. caller：`activity-service`
2. provider：`points-service`
3. endpoint：`POST /internal/points-service/activity-rewards/settle`
4. sourceType：`activity_task`
5. idempotencyKey：`activity-reward:{tenantId}:{userId}:{activityId}:{completionDate}`
6. completionDate 格式：`YYYY-MM-DD`

points-service 输出：

1. `ok`
2. `duplicated`
3. `reward`
4. `balance`
5. `transactionId`
6. `idempotencyKey`

错误码：

1. `INVALID_ACTIVITY_REWARD_USER`
2. `INVALID_ACTIVITY_REWARD_ACTIVITY_ID`
3. `INVALID_ACTIVITY_REWARD_DATE`
4. `INVALID_ACTIVITY_REWARD_POINTS`
5. `ACTIVITY_REWARD_SETTLEMENT_FAILED`

## 7. Week17 最终边界判断

1. 已稳定归 `activity-service`：
   - `GET /api/activities`
   - `POST /api/activities/:id/complete`
   - `GET /api/p/activities`
   - `POST /api/p/activities`
   - `PUT /api/p/activities/:id`
   - `DELETE /api/p/activities/:id`
   - `GET /api/b/activity-configs`
   - `POST /api/b/activity-configs`
   - `PUT /api/b/activity-configs/:id`
2. 永久归 `points-service`：
   - `POST /api/sign-in`
   - `GET /api/mall/activities`
   - `POST /api/mall/activities/:id/join`
   - `POST /api/mall/redeem`
   - `GET /api/orders`
   - `GET /api/orders/:id`
   - `POST /api/orders/:id/pay`
   - `POST /api/orders/:id/cancel`
   - `POST /api/orders/:id/refund`
   - `POST /api/redemptions/:id/writeoff`
3. 正式拆出结论：
   - `activity-service` 可以按“activity 域稳定范围已正式拆出”处理
   - 这不包含商城活动参与链路，也不包含积分交易链路
4. 残留兼容层是受控存在，不等于边界未拆：
   - `server/skeleton-c-v1/routes/activities.routes.mjs`
   - `server/skeleton-c-v1/usecases/activity-complete.usecase.mjs`
   - `server/skeleton-c-v1/services/activity-reward.service.mjs`

## 8. 边界红线

1. 不改 `auth / me`
2. 不改 `token / csrf` 协议
3. 不迁 `sign-in / mall activities / join / redeem / writeoff`
4. 不主写 `c_point_accounts / c_point_transactions / p_orders / c_redeem_records / c_sign_ins`
5. 奖励落账只允许通过 `points-service` 契约

## 9. 验证入口

1. `node scripts/check_activity_service_boundary_phase2.mjs`
2. `node scripts/smoke_activity_complete_phase2.mjs`
3. `node scripts/smoke_activity_points_reward_phase2.mjs`
4. `node scripts/gate_activity_service_phase2.mjs`
5. `node scripts/check_activity_points_final_boundary.mjs`
6. `node scripts/review_activity_points_legacy_routes_week17.mjs`
7. `node scripts/gate_activity_points_final_boundary.mjs`
