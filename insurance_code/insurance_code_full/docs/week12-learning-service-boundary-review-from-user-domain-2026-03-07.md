# Week12 Learning Service 边界评审输入（User 域视角）

更新时间：2026-03-08  
负责人：B 号  
视角：`user-service`

## 1. 目标

这份文档只提供 `learning-service` 边界评审时，来自 `user-service` 的约束输入。

不做的事：

1. 不直接开拆 `learning-service`
2. 不改 `user-service` 现有接口
3. 不讨论 points 域内部实现细节

配套设计文档：

1. `../server/microservices/learning-service/DESIGN.md`
2. `../server/microservices/learning-service/USER-BOUNDARY.md`
3. `../server/microservices/learning-service/SMOKE-GATE.md`
4. `../server/microservices/learning-service/RISKS.md`

## 2. 当前 learning 相关路由

现有候选路由：

1. `GET /api/learning/courses`
2. `GET /api/learning/courses/:id`
3. `POST /api/learning/courses/:id/complete`
4. `GET /api/learning/games`
5. `GET /api/learning/tools`
6. `GET /api/p/learning/courses`
7. `POST /api/p/learning/courses`
8. `PUT /api/p/learning/courses/:id`
9. `DELETE /api/p/learning/courses/:id`

当前额外要注意的兼容入口：

1. `GET /api/b/content/items`
2. `POST /api/b/content/items`
3. `PUT /api/b/content/items/:id`

结论：

1. `p/learning` 是 learning 域天然 owned routes
2. `b/content/items` 当前碰 learning 数据，但更适合作为后续桥接入口，不建议直接定义为 learning-service owned route

## 3. User 域必须保持不变的边界

`user-service` 继续主写：

1. `app_users` 逻辑身份聚合
2. `c_customers`
3. `p_sessions`

`learning-service` 不允许主写：

1. `app_users`
2. `c_customers`
3. `p_sessions`

以下接口不得划给 `learning-service`：

1. `POST /api/auth/send-code`
2. `POST /api/auth/verify-basic`
3. `GET /api/me`

## 4. 建议的 learning-service owned data

从现有仓库和 schema 看，`learning-service` 更适合主写：

1. `p_learning_materials`
2. `c_learning_records`

说明：

1. `c_learning_records.customer_id` 可以引用 `c_customers.id`
2. 这不改变 user 域对客户主档的所有权
3. 这只是“learning 记录引用 customer”，不是“learning 主写 customer”
4. `learningCourses` 只是当前运行态映射，不应替代 `p_learning_materials` 作为长期主写定义

## 5. 与 user-service 的集成方式

### 5.1 鉴权

`learning-service` 不应自行定义新登录协议，必须沿用当前冻结口径：

1. `Authorization: Bearer <token>`
2. `x-csrf-token: <csrfToken>`

### 5.2 身份来源

`learning-service` 只消费以下 identity context：

1. `user_id`
2. `tenant_id`
3. `actorType`
4. `org_id`
5. `team_id`

来源要求：

1. 通过 gateway/shared auth context 透传
2. 或通过 user 域既有鉴权中间件解析
3. 不允许在 `learning-service` 再造一套 session/token 存储
4. 不允许复制 `/api/me` 聚合

### 5.3 权限边界

Week12 阶段建议把“身份”和“权限主数据”分开看：

1. 身份与 session 仍由 `user-service` 及共享鉴权上下文控制
2. learning-service 可以复用现有 `tenantContext`、`permissionRequired`
3. 但不应主写 `userRoles`、`rolePermissions`、`permissions`
4. 不把 learning 拆分和权限体系重构绑在同一周处理

## 6. 当前设计里需要特别注意的点

### 6.1 完成课程当前直接记积分

当前 `POST /api/learning/courses/:id/complete` 会在学习完成后直接发积分。

从 user 域视角的要求是：

1. `learning-service` 可以拥有“完成课程”业务动作
2. 但它不能因此扩写 `user-service` 主写表
3. 身份仍然只从 user 域获得
4. 奖励发放不能倒逼 learning 域生成自己的登录态语义

### 6.2 匿名读取与登录读取要区分

当前学习域路由里同时存在：

1. `authOptional`
2. `authRequired`

评审时必须明确：

1. 匿名读课程列表/详情不依赖 user 主写
2. 登录后完成课程才依赖用户身份
3. 这类依赖应是“读身份上下文”，不是“写 user 主档”

### 6.3 b-admin 入口不能成为 user 边界绕行口

如果后续保留：

1. `POST /api/b/content/items`
2. `PUT /api/b/content/items/:id`

那也只能作为桥接层存在，不能让它继续绕过 learning-service 去直接碰 learning 主写对象，更不能顺带穿透 user 边界。

## 7. 建议的评审结论

从 user 域视角，Week12 可接受的边界是：

1. `learning-service` 主写 learning 自己的内容表和完成记录表
2. `user-service` 继续独占身份、客户、session
3. `learning-service` 通过共享鉴权上下文消费 `user_id / tenant_id`
4. `learning-service` 不新建 token/session 协议
5. `learning-service` 不接管 `/api/me`
6. `learning-service` 不主写权限主数据

## 8. smoke / gate 建议（User 域关心的最小集）

1. `smoke_learning_user_boundary.mjs`
   - 校验 learning 不暴露 `auth / me`
2. `check_learning_shared_auth_usage.mjs`
   - 校验 `Bearer + x-csrf-token` 口径不变
3. `check_learning_service_write_boundary.mjs`
   - 校验 learning 不写 `app_users / c_customers / p_sessions`

## 9. 评审时要问清的问题

1. `learning-service` 是否需要任何 user 主写权限
2. `learning-service` 的登录态解析是否复用现有 shared auth context
3. 学习完成后的积分发放是否会穿透 points 边界
4. `c_learning_records` 是否只引用 `customer_id`，而不复制 user 主档字段
5. 管理面 `p/learning` 是否与 C 端 `learning` 一起拆，还是分阶段
6. `b/content/items` 是否收敛为桥接层，而不是继续保留 learning 直写能力

## 10. 来自 B 号的结论

1. `learning-service` 可以设计
2. 但必须建立在 user 边界不被打穿的前提下
3. 只要 `auth / me / c_customers / p_sessions` 归属不动，B 号支持 Week12 进入设计评审
4. 如果评审里出现“learning 自己发 token / 自己存 session / 自己复制 me”的方案，B 号结论就是不通过
