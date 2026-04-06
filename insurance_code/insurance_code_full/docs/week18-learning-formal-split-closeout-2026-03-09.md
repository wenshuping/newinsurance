# Week18 Learning 域正式拆出收口

更新时间：2026-03-09  
负责人：B 号

## 1. 路由处置结果

### 1.1 迁到 learning-service 的稳定能力

1. `GET /api/learning/courses`
2. `GET /api/learning/games`
3. `GET /api/learning/tools`
4. `GET /api/learning/courses/:id`
5. `POST /api/learning/courses/:id/complete`
6. `GET /api/p/learning/courses`
7. `POST /api/p/learning/courses`
8. `PUT /api/p/learning/courses/:id`
9. `DELETE /api/p/learning/courses/:id`

### 1.2 保留桥接

1. `GET /api/b/content/items`
2. `POST /api/b/content/items`
3. `PUT /api/b/content/items/:id`

### 1.3 保留的最小 monolith 兼容层

1. `GET /api/learning/courses`
2. `GET /api/learning/games`
3. `GET /api/learning/tools`
4. `GET /api/learning/courses/:id`
5. `POST /api/learning/courses/:id/complete`

说明：

1. `courses / games / tools / detail` 保留 v1 读 fallback
2. `complete` 保留 bridge 到 `learning-service`
3. 这些路径不再代表 learning 主写归属

## 2. formalSplitReady = true 的依据

1. monolith 不再保留 learning 主写逻辑
2. monolith `p-admin-learning.routes.mjs` 不再保留 stable learning 本地写逻辑
3. monolith `b-admin-content.routes.mjs` 不再直接读写 learning 状态
4. `learning-service /ready` 直接输出 `formalSplitReady=true`
5. `review_learning_user_legacy_routes.mjs` 输出 `formalSplitReady=true`

## 3. 仍然成立的边界红线

1. 不接管 `auth / me`
2. 不主写 `app_users / c_customers / p_sessions`
3. 不主写 `c_point_accounts / c_point_transactions`
4. 不新建 token / session / csrf 协议
