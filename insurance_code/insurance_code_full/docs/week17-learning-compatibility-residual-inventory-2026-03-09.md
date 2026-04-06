# Week17 Learning 兼容层残留清单

更新时间：2026-03-09  
负责人：B 号（user-service 视角）

## 1. 可直接降级为桥接的 legacy 路由

1. `server/skeleton-c-v1/routes/learning.routes.mjs`
   - `GET /api/learning/courses`
   - `GET /api/learning/courses/:id`
   - `POST /api/learning/courses/:id/complete`
2. `server/skeleton-c-v1/routes/p-admin-learning.routes.mjs`
   - `GET /api/p/learning/courses`
   - `POST /api/p/learning/courses`
   - `PUT /api/p/learning/courses/:id`
   - `DELETE /api/p/learning/courses/:id`

说明：

1. 这组路由已经在 `learning-service` 里有稳定等价实现
2. skeleton 继续保留它们的意义只剩兼容/桥接，不应再继续被当成主实现

## 2. 仍需保留 review 的 legacy 入口

1. `server/skeleton-c-v1/routes/learning.routes.mjs`
   - `GET /api/learning/games`
   - `GET /api/learning/tools`
2. `server/skeleton-c-v1/routes/b-admin-content.routes.mjs`
   - `GET /api/b/content/items`
   - `POST /api/b/content/items`
   - `PUT /api/b/content/items/:id`
3. `server/skeleton-c-v1/repositories/b-content-write.repository.mjs`
   - 仍直接写 `state.learningCourses / state.pLearningMaterials`

## 3. 仍存在的 monolith 注册点

1. `server/skeleton-c-v1/routes/c-app.routes.mjs`
   - 仍调用 `registerLearningRoutes(app)`
2. `server/skeleton-c-v1/routes/p-admin.routes.mjs`
   - 仍调用 `registerPAdminLearningRoutes(app, deps.learning)`

## 4. 与 user 的兼容层依赖

当前 learning 继续复用：

1. `unifiedAuthAndTenantContext`
2. `authOptional / authRequired`
3. `tenantContext`
4. `csrfProtection`

这几项属于共享鉴权上下文依赖，不是 user 边界越权。

## 5. Week17 判断

1. 核心 stable routes：可以继续推进桥接化
2. learning 全域：仍有 residual legacy，不能直接宣布“完全拆净”
