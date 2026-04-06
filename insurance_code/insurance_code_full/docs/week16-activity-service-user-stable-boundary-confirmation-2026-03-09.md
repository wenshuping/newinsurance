# Week16 Activity Service User 侧稳定边界确认

更新时间：2026-03-09  
负责人：B 号（user-service 视角）  
范围：只做 activity-service 的 user 侧稳定边界验收，不改 points-service，不扩 `auth / me`

## 1. 结论

Week16 当前可以把 activity 完成链路从“试点 user 侧兼容”提升为“稳定 user 侧边界已确认”。

已确认成立：

1. `activity-service` 不接管 `POST /api/auth/send-code`
2. `activity-service` 不接管 `POST /api/auth/verify-basic`
3. `activity-service` 不接管 `GET /api/me`
4. `activity-service` 不主写 `app_users / c_customers / p_sessions`
5. `tenant / owner / session / csrf` 口径和 user 基线保持一致
6. `POST /api/activities/:id/complete` 已属于稳定 user 侧边界内的合法能力

## 2. 稳定边界红线

activity-service 不得突破以下红线：

1. 不自建登录接口
2. 不自建 `Authorization` 解析
3. 不自建 `session` 生成逻辑
4. 不自建 `x-csrf-token` 协议
5. 不主写 `app_users`
6. 不主写 `c_customers`
7. 不主写 `p_sessions`

## 3. 当前代码证据

### 3.1 activity-service 继续复用共享身份与 csrf

1. `app.mjs` 继续挂 `unifiedAuthAndTenantContext`
2. `app.mjs` 继续挂全局 `csrfProtection`

证据：

1. `server/microservices/activity-service/app.mjs`

### 3.2 activity 完成链路继续走 tenant / owner 口径

1. `GET /api/activities`：`authOptional + tenantContext`
2. `POST /api/activities/:id/complete`：`authRequired + tenantContext`
3. `executeActivityComplete(...)`：继续用 `canDeliverTemplateToActor(...)`

证据：

1. `server/microservices/activity-service/c-activity.routes.mjs`
2. `server/skeleton-c-v1/usecases/activity-complete.usecase.mjs`

### 3.3 activity-service 不接管 auth / me

当前稳定路由只覆盖：

1. `GET /api/activities`
2. `POST /api/activities/:id/complete`
3. `GET/POST/PUT/DELETE /api/p/activities*`
4. `GET/POST/PUT /api/b/activity-configs*`

未发现：

1. `POST /api/auth/send-code`
2. `POST /api/auth/verify-basic`
3. `GET /api/me`

### 3.4 activity-service 不主写 user 主写表

当前 boundary / ready 只认：

1. `p_activities`
2. `c_activity_completions`

未声明也未扫描到：

1. `app_users`
2. `c_customers`
3. `p_sessions`

### 3.5 奖励链路不改变 user 边界

1. `activity-service` 只负责活动完成判定与 `c_activity_completions`
2. 奖励结算继续走 `activity-service -> points-service` 内部契约
3. 这不会改变 user 侧 `auth / me / session / csrf` 口径

## 4. 验收结果

本轮 user 侧验收通过以下检查：

1. `node scripts/check_activity_service_user_boundary_stable.mjs`
2. `node scripts/smoke_activity_service_user_boundary_stable.mjs`

验收通过标准：

1. `activity-service` 不暴露 `auth / me`
2. `activity-service` 不主写 `app_users / c_customers / p_sessions`
3. `/ready` 输出稳定声明必须包含 `POST /api/activities/:id/complete`
4. `/ready` 输出主写表必须只包含 `p_activities / c_activity_completions`
5. 客户可见性仍满足“无 owner 不可见、跨租户不外泄”
6. 活动完成仍要求共享 `Bearer + x-csrf-token`

## 5. Week16 结论

从 user 侧看，activity-service 当前结论是：

1. 稳定边界已确认
2. `complete` 不再只是试点兼容
3. user 红线未被打穿
4. 后续只需要继续防止 tenant / owner 守卫回退
