# Week15 Activity Service 与 User Service 交叉边界确认

更新时间：2026-03-09
负责人：B 号（user-service 视角）
范围：只做 user 侧交叉边界审计，不实现 activity-service 生产代码

## 1. 结论

当前仓库里，activity Phase 1 没有打穿 `user-service` 的主写边界，tenant / owner / session 口径也已经和 user 侧基线对齐。

已确认成立：

1. activity 当前没有接管 `auth / me`
2. activity 当前没有直接主写 `app_users / c_customers / p_sessions`
3. activity 当前没有新建 `token / session / csrf` 协议
4. `GET /api/activities` 的客户可见性仍走 `owner -> tenant` 链路
5. `GET /api/p/activities` / `GET /api/b/activity-configs` 仍走 `tenantContext + canAccessTemplate`
6. `POST /api/activities/:id/complete` 已挂 `tenantContext`
7. activity 完成奖励已走 `activity -> points-service` 契约，不再本地落账

## 2. user 红线

activity Phase 1 不得突破以下红线：

1. 不接管 `POST /api/auth/send-code`
2. 不接管 `POST /api/auth/verify-basic`
3. 不接管 `GET /api/me`
4. 不主写 `app_users`
5. 不主写 `c_customers`
6. 不主写 `p_sessions`
7. 不自建 `Authorization` 解析逻辑
8. 不自建 `session` 生成逻辑
9. 不自建 `x-csrf-token` 协议

## 3. 当前代码证据

### 3.1 activity 没有接管 auth / me

activity 路由当前只暴露：

1. `GET /api/activities`
2. `POST /api/activities/:id/complete`
3. `POST /api/sign-in`

证据：

1. `server/skeleton-c-v1/routes/activities.routes.mjs`

### 3.2 activity 没有直接主写 user 表

当前 activity 相关写路径写的是：

1. `state.activities`
2. `state.pActivities`
3. `state.activityCompletions`

未发现：

1. `state.users.push(...)`
2. `state.sessions.push(...)`
3. `createSession(...)`
4. `app_users / c_customers / p_sessions` SQL 写入

证据范围：

1. `server/skeleton-c-v1/routes/activities.routes.mjs`
2. `server/skeleton-c-v1/routes/p-admin-activities.routes.mjs`
3. `server/skeleton-c-v1/routes/b-admin-activity.routes.mjs`
4. `server/skeleton-c-v1/usecases/activity-complete.usecase.mjs`
5. `server/skeleton-c-v1/usecases/p-activity-write.usecase.mjs`
6. `server/skeleton-c-v1/usecases/b-activity-config-write.usecase.mjs`
7. `server/skeleton-c-v1/repositories/activity-write.repository.mjs`
8. `server/skeleton-c-v1/repositories/p-activity-write.repository.mjs`
9. `server/skeleton-c-v1/repositories/b-activity-config-write.repository.mjs`

### 3.3 token / session / csrf 口径未改

当前 activity 仍复用共享中间件：

1. `authOptional`
2. `authRequired`
3. `csrfProtection`

证据：

1. `server/skeleton-c-v1/routes/activities.routes.mjs`
2. `server/skeleton-c-v1/app.mjs`
3. `server/skeleton-c-v1/common/middleware.mjs`

## 4. tenant / owner 口径确认

### 4.1 活动列表

`GET /api/activities` 当前链路：

1. `authOptional`
2. `tenantContext`
3. `canDeliverTemplateToActor(state, req.actor, activity)`

其中客户视角会进入：

1. `resolveCustomerOwnerActor(state, actor)`
2. 用客户的 `ownerUserId / tenantId / orgId / teamId` 还原 owner actor
3. 再按 owner actor 的可见性规则判断活动是否可下发

结论：

1. 列表可见性仍按 owner / tenant 规则走

### 4.2 管理面活动配置

`GET /api/p/activities` 与 `GET /api/b/activity-configs` 当前链路：

1. `tenantContext`
2. `permissionRequired(...)`
3. `canAccessTemplate(...)`

结论：

1. 管理面仍按 tenant 口径和模板继承口径过滤

### 4.3 活动完成

当前 `POST /api/activities/:id/complete`：

1. 只挂了 `authRequired`
2. 已挂 `tenantContext`
3. `toActivityCompleteCommand(...)` 接 `user` 和 `actor`
4. `actor` 当前来自 `req.actor`
5. 路由还会把 `req.tenantContext.tenantCode` 透传到 reward settlement

这意味着：

1. `command.actor` 在当前路由里是显式 tenant / owner 上下文
2. `executeActivityComplete()` 继续用 `canDeliverTemplateToActor(...)`
3. 完成链路和列表链路一致，都会先固定 tenant / owner 口径
4. 奖励结算通过 `settleActivityRewardViaPointsService(...)` 调 `points-service` 契约

结论：

1. 活动完成链路满足 Week15 的 user 侧强口径要求
2. 这条链路当前不是 user 边界 blocker

## 5. Week15 评审结论

从 user 侧看，activity Phase 1 当前结论是：

1. 红线未被打穿
2. 列表与完成链路的 owner / tenant 口径一致
3. session / csrf 口径没有漂移
4. 从 user 侧看，activity 与 user 的交叉边界已收口

## 6. 建议动作

进入后续 activity-service 演进前，继续保持：

1. activity complete 相关 guard 持续检查 `tenantContext` 不缺失
2. owner / tenant 可见性 smoke 持续覆盖“无 owner 不可见、跨租户不外泄”
3. 不允许 activity 侧新增 `auth / me`、`session`、`csrf` 自定义协议
