# Learning Service Boundary

更新时间：2026-03-18  
负责人：A 号 / B 号  
状态：`WEEK18_FORMAL_SPLIT`

## 1. 稳定主写表

1. `p_learning_materials`
2. `c_learning_records`

## 2. 稳定 owned routes

1. `GET /api/learning/courses`
2. `GET /api/learning/games`
3. `GET /api/learning/tools`
4. `GET /api/learning/courses/:id`
5. `POST /api/learning/courses/:id/complete`
6. `GET /api/p/learning/courses`
7. `POST /api/p/learning/courses`
8. `POST /api/p/learning/courses/batch`
9. `PUT /api/p/learning/courses/:id`
10. `DELETE /api/p/learning/courses/:id`

## 3. 保留桥接的兼容 routes

1. `GET /api/b/content/items`
2. `POST /api/b/content/items`
3. `PUT /api/b/content/items/:id`

说明：
这组路径仍由 monolith 对外暴露 legacy URL，但业务处理和 learning 主写都已经落在 `learning-service`。monolith 只剩 bridge adapter。

## 4. 奖励结算边界

1. `complete` 的完成判定和完成记录归 `learning-service`
2. 积分余额和积分流水归 `points-service`
3. `learning-service` 只能通过内部 HTTP 契约调用 `points-service`
4. `learning-service` 不得直接 import `points-service` 模块实现
5. `learning-service` 不得直接写 `c_point_accounts / c_point_transactions`

## 5. 不接管的 user 边界

1. 不接管 `POST /api/auth/send-code`
2. 不接管 `POST /api/auth/verify-basic`
3. 不接管 `GET /api/me`
4. 不主写 `app_users`
5. 不主写 `c_customers`
6. 不主写 `p_sessions`
7. 不新建 token / session / csrf 协议

## 6. 允许复用的共享能力

1. `unifiedAuthAndTenantContext`
2. `tenantContext`
3. `permissionRequired`
4. `canAccessTemplate`
5. `effectiveTemplateStatusForActor`

## 7. 兼容层归类

1. `server/skeleton-c-v1/services/learning-service.bridge.mjs`
   - monolith -> learning-service 统一 HTTP bridge
2. `server/skeleton-c-v1/routes/learning.routes.mjs`
   - 本地 v1 读 fallback（`courses / games / tools / detail`）+ `complete` bridge
3. `server/skeleton-c-v1/routes/p-admin-learning.routes.mjs`
   - stable P routes bridge
4. `server/skeleton-c-v1/routes/b-admin-content.routes.mjs`
   - compatibility `b-content` bridge

## 8. Formal Split 判定

满足以下条件即可视为 `formalSplitReady = true`：

1. monolith 只保留最小兼容面：v1 读 fallback 和 complete bridge
2. `b-content` 不再直接读写 monolith learning 状态
3. `games / tools` 已迁入稳定 owned scope
4. `learning-service` ready 明确输出 `formalSplitReady=true`
5. user 边界保持不变

当前结论：

1. `formalSplitReady = true`
2. `learning-service` 可按正式拆出处理
3. monolith 仅剩最小兼容层，不再算 learning 主运行时

## 9. Gate 最小要求

1. `mainWriteTables` 只认 `p_learning_materials / c_learning_records`
2. `stableContracts` 只认稳定 owned routes
3. `bridgeCompatibilityContracts` 必须声明 `b-content`
4. `deprecatedContracts` 当前必须为空
5. `learning-service` 不暴露 `auth / me`
6. `learning-service` 不写 `app_users / c_customers / p_sessions`
7. `learning-service` 不写 `c_point_accounts / c_point_transactions`
8. monolith learning routes 只允许保留最小 v1 读 fallback 和 complete bridge
