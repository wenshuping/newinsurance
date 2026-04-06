# Week17 Learning / User 最终边界确认

更新时间：2026-03-09  
负责人：B 号（user-service 视角）  
范围：只做 `learning-service` 与 `user-service` 最终边界收口，不改 points-service，不扩课程新业务功能

## 1. 结论先行

Week17 的最终结论分两层：

1. 从 user 边界看，`learning-service` 已经稳定
2. 从 learning 全域是否“正式完全拆出”看，当前还不能直接判绿

已确认成立：

1. `learning-service` 不接管 `auth / me`
2. `learning-service` 不主写 `app_users / c_customers / p_sessions`
3. `Bearer + x-csrf-token` 口径不变
4. `POST /api/learning/courses/:id/complete` 已是稳定能力
5. `learning-service` 与 user 之间不存在新的直接兼容写路径

## 2. user 红线最终状态

Week17 仍冻结以下红线：

1. `POST /api/auth/send-code`
2. `POST /api/auth/verify-basic`
3. `GET /api/me`
4. `app_users`
5. `c_customers`
6. `p_sessions`
7. 自定义 token / session / csrf 协议

当前检查结果：

1. 未发现 `learning-service` 直接暴露 `auth / me`
2. 未发现 `learning-service` 直接写 `app_users / c_customers / p_sessions`
3. 未发现 `learning-service` 单独实现新的登录态协议

## 3. 仍存在的兼容层依赖

当前还残留的兼容层依赖主要有 3 类：

1. `learning-service/app.mjs` 继续复用共享 `unifiedAuthAndTenantContext + csrfProtection`
2. `learning-service/c-learning.routes.mjs` 继续复用共享 `authOptional / authRequired + tenantContext`
3. `learning-service/p-learning.routes.mjs` 仍通过 `registerPAdminLearningRoutes(...)` 复用 skeleton 管理面注册逻辑

这 3 类依赖都属于“共享鉴权/共享桥接层依赖”，不是 user 边界越权。

## 4. skeleton-c-v1 里已经可以降级为桥接的入口

下面这些 legacy learning 入口，已经具备降级为 bridge / cutover entry 的条件：

1. `GET /api/learning/courses`
2. `GET /api/learning/courses/:id`
3. `POST /api/learning/courses/:id/complete`
4. `GET /api/p/learning/courses`
5. `POST /api/p/learning/courses`
6. `PUT /api/p/learning/courses/:id`
7. `DELETE /api/p/learning/courses/:id`

原因：

1. `learning-service` 已声明这些 stable owned routes
2. `learning-service` ready/boundary 已固化这些 stable contracts
3. 旧 skeleton 路由只是兼容层，不再应该继续承担主实现角色

## 5. 仍不能降级/仍需 review 的 legacy 入口

下面这些入口还不能算“已正式拆净”：

1. `GET /api/learning/games`
2. `GET /api/learning/tools`
3. `GET /api/b/content/items`
4. `POST /api/b/content/items`
5. `PUT /api/b/content/items/:id`

原因：

1. `games / tools` 不在 `learning-service` 当前 stable owned routes 内
2. `b-admin` 的 `/api/b/content/items*` 仍直接碰 learning 内容
3. `b-content-write.repository.mjs` 仍有 learning 写入痕迹

## 6. Week17 最终判断

最终判断：

1. 如果只看核心 stable routes，`learning-service` 已可按“主线已拆出”处理
2. 如果看 learning 域整体，当前还不能按“正式完全拆出”处理

原因：

1. monolith 里还保留同名 stable 路由注册
2. `games / tools` 仍留在 skeleton
3. `b-admin` 的 learning 内容入口还没收成 bridge

因此 Week17 对外最准确的话术是：

1. `learning-service` 核心能力已稳定拆出
2. learning 全域仍处于“核心已拆、legacy 未清”的状态
