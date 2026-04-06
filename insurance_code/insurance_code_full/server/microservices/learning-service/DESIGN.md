# Week12 Learning Service 设计文档

更新时间：2026-03-08  
负责人：B 号（user-service 评审输入）  
状态：`DESIGN_REVIEW`

Week14 注记：

1. `POST /api/learning/courses/:id/complete` 已在 Week14 提升为稳定能力
2. 奖励链路已改成 `learning-service -> points-service` 内部 HTTP 契约
3. 本文中涉及 Phase 1 试点兼容的表述，仅保留为历史评审背景；当前口径以 `CONTRACT.md / BOUNDARY.md / COMPLETE-STABLE.md` 为准

## 1. 目标

Week12 只做 `learning-service` 设计评审输入，不直接开拆生产代码。

这份文档要讲清 5 件事：

1. `learning-service` 应该接管哪些路由
2. `learning-service` 应该主写哪些表
3. 它和 `user-service`、`points-service` 的边界在哪里
4. 推荐的迁移顺序是什么
5. 现阶段最大的风险点是什么

## 2. 当前现状

当前 learning 能力还分散在单体运行时里，主要入口有两类：

### 2.1 C 端学习入口

1. `GET /api/learning/courses`
2. `GET /api/learning/courses/:id`
3. `POST /api/learning/courses/:id/complete`
4. `GET /api/learning/games`
5. `GET /api/learning/tools`

### 2.2 管理面学习入口

1. `GET /api/p/learning/courses`
2. `POST /api/p/learning/courses`
3. `PUT /api/p/learning/courses/:id`
4. `DELETE /api/p/learning/courses/:id`
5. `GET /api/b/content/items`
6. `POST /api/b/content/items`
7. `PUT /api/b/content/items/:id`

### 2.3 当前耦合点

当前 learning 域并不是纯内容域，至少还有 3 个明显耦合：

1. `POST /api/learning/courses/:id/complete` 的奖励结算依赖 `points-service` 契约
2. 学习内容当前有 `p-admin` 和 `b-admin` 两套写入口
3. 运行态同时存在 `learningCourses` 与 `p_learning_materials` 两套表达

## 3. 建议的 owned routes

## 3.1 Phase 1 主收口路由

这些路由是 learning 域的天然所有者，建议作为第一批 owned routes：

1. `GET /api/learning/courses`
2. `GET /api/learning/courses/:id`
3. `GET /api/p/learning/courses`
4. `POST /api/p/learning/courses`
5. `PUT /api/p/learning/courses/:id`
6. `DELETE /api/p/learning/courses/:id`

原因：

1. 这批接口都直接围绕“学习资料”和“学习完成记录”展开
2. 它们当前主要读写 `p_learning_materials`、`c_learning_records`
3. 从业务语义上不属于 user 域，也不属于 points 域

## 3.2 Week14 已提升为稳定能力的路由

1. `POST /api/learning/courses/:id/complete`

说明：

1. 完成判定和完成记录归 `learning-service`
2. 奖励结算归 `points-service`
3. 这条链路当前已经从试点兼容提升为稳定能力

## 3.3 Phase 2 再决定是否纳入的路由

下面两条路由建议先标记为 `phase_2_optional`：

1. `GET /api/learning/games`
2. `GET /api/learning/tools`

原因：

1. 当前仓库里没有看到与它们对应的稳定物理主表
2. 现阶段它们更像静态配置或轻量内容列表
3. 如果强行跟课程/完成记录一起拆，会把数据模型问题带进第一阶段

## 3.4 不建议作为 learning-service 直接对外 owned routes 的入口

下面这组路由当前会碰 learning 内容，但不建议直接定义为 learning-service 的对外 owned routes：

1. `GET /api/b/content/items`
2. `POST /api/b/content/items`
3. `PUT /api/b/content/items/:id`

建议定位：

1. `b-admin` 继续保留自己的页面语义和入口路径
2. 但底层写契约应逐步改成调用 `learning-service`
3. 也就是说，它们更适合作为 `b-admin-service` 或兼容桥接层，而不是 learning 域的主路由前缀

## 4. 主写表归属

## 4.1 learning-service 主写

建议 `learning-service` 只主写下面两张核心表：

1. `p_learning_materials`
2. `c_learning_records`

说明：

1. `p_learning_materials` 对应课程/资料主档
2. `c_learning_records` 对应用户学习完成记录
3. 这两张表已经在当前状态加载和增量同步里被当成 learning 域核心对象使用

## 4.2 learning-service 允许只读/引用

1. `c_customers`
   - 只允许按 `customer_id` 引用，不允许更新客户主档
2. `p_sessions`
   - 只允许通过共享鉴权上下文解析，不允许自行写 session
3. `c_point_accounts`
   - 只允许通过 `points-service` 间接影响，不允许直写
4. `c_point_transactions`
   - 不允许直写，只能由 `points-service` 落账

## 4.3 learning-service 不应主写

1. `app_users`
2. `c_customers`
3. `p_sessions`
4. `c_point_accounts`
5. `c_point_transactions`
6. `p_orders`
7. `c_redeem_records`
8. `c_sign_ins`

## 4.4 当前模型里的一个现实问题

当前运行态存在：

1. `learningCourses`
2. `pLearningMaterials`
3. `p_learning_materials`

评审结论必须明确：

1. 未来物理 owned table 以 `p_learning_materials` 为准
2. `learningCourses` 只是当前运行态投影视图，不应作为长期主写边界定义
3. `pLearningMaterials` 是历史兼容态，后续要么消失，要么退化成派生缓存

## 5. 与 user-service 的身份/权限边界

## 5.1 身份边界

`learning-service` 不能接管以下 user 域能力：

1. `POST /api/auth/send-code`
2. `POST /api/auth/verify-basic`
3. `GET /api/me`
4. `app_users`
5. `c_customers`
6. `p_sessions`

## 5.2 协议边界

必须沿用已经冻结的登录态协议：

1. `Authorization: Bearer <token>`
2. `x-csrf-token: <csrfToken>`

不能做的事：

1. 不新造 token 格式
2. 不新造 session 表
3. 不在 learning 域缓存第二套登录态
4. 不改 Bearer 或 CSRF 头名

## 5.3 learning-service 可消费的身份上下文

1. `user_id`
2. `tenant_id`
3. `org_id`
4. `team_id`
5. `actor_type`
6. `actor_id`

来源要求：

1. 通过 gateway/shared auth context 透传
2. 或复用现有共享鉴权/租户上下文中间件
3. 不能让 learning-service 自己维护身份真相源

## 5.4 权限边界

learning 域只应消费上游给出的权限判断结果或共享权限中间件，不应拥有权限主数据。

因此不建议让 learning-service 主写或维护：

1. `userRoles`
2. `rolePermissions`
3. `permissions`

Week12 阶段建议：

1. learning-service 继续复用现有 `permissionRequired` / `tenantContext` 能力
2. 如果后续权限体系单独拆服务，再单独迁移
3. 本轮不要把“学习拆分”和“权限治理”绑成一个问题

## 6. 与 points-service 的边界

learning-service 可以拥有“学习完成”动作，但不能直接完成“积分入账”。

红线如下：

1. `learning-service` 不直写 `c_point_accounts`
2. `learning-service` 不直写 `c_point_transactions`
3. `learning-service` 不调用 points 域内部 repository
4. 学习奖励最终入账必须通过 `points-service` 契约完成

Week14 当前状态：`executeLearningComplete()` 已不再直接 `appendPoints()`，而是通过内部 HTTP 契约调用 `points-service`。

## 7. 迁移顺序建议

## 7.1 Step 0：冻结边界，不先改业务语义

先冻结下面 3 条：

1. `auth / me` 不动
2. `points` 账务语义不动
3. `learning` 先只做设计和门禁模板

## 7.2 Step 1：先迁 C 端读接口和 P 端课程管理

第一批建议先迁：

1. `GET /api/learning/courses`
2. `GET /api/learning/courses/:id`
3. `GET /api/p/learning/courses`
4. `POST /api/p/learning/courses`
5. `PUT /api/p/learning/courses/:id`
6. `DELETE /api/p/learning/courses/:id`

原因：

1. 这些接口的边界最清楚
2. 不直接涉及积分账本
3. 容易先建立 `owned routes + owned tables + smoke`

## 7.3 Step 2：学习完成接口在 Week14 已正式收口

当前口径：

1. `POST /api/learning/courses/:id/complete` 已进入当前稳定能力清单
2. 奖励链路已契约化到 `points-service`

真正收口前提：

1. 课程完成仍由 learning-service 主写 `c_learning_records`
2. 奖励积分已改成调用 `points-service` 契约
3. 后续只需要决定是否从同步 HTTP 升级成事件通道

## 7.4 Step 3：清理 b-admin 对 learning 表的直写入口

1. 保留 `b-admin` 页面和路由语义可以
2. 但不应继续让 `b-admin` 直接写 learning 主写表
3. 应改成 B 端桥接到 learning-service

## 7.5 Step 4：最后处理 games/tools 和报表依赖

1. 先确认 `games/tools` 是否需要稳定主表
2. 再评估 `b-admin-customers`、`p-admin-metrics` 等报表读取是否走查询契约
3. 避免在服务刚拆时把运营报表一并拆坏

## 8. 风险点

## 8.1 最高风险：points-service 上游可用性

Week14 当前代码里，学习完成逻辑已经通过内部 HTTP 契约调用 `points-service`。

风险：

1. 如果 `points-service` 上游不可用，`complete` 会返回契约错误
2. 需要保持 observability、idempotency 和回滚行为稳定

## 8.2 中高风险：学习内容存在双写入口

当前至少有：

1. `/api/p/learning/courses*`
2. `/api/b/content/items*`

风险：

1. 如果不先收口入口，会在拆分后出现 ownership 不一致
2. 同一张表会继续被两个服务语义争抢

## 8.3 中风险：运行态与物理表表达不一致

当前同时有：

1. `learningCourses`
2. `pLearningMaterials`
3. `p_learning_materials`

风险：

1. 评审时说清楚了，落地时不一定真能对上
2. 如果不先统一术语，后面 gate 很难写准

## 8.4 中风险：学习域报表和客户画像依赖学习记录

`b-admin-customers`、`p-admin-metrics` 等读取 learning 数据。

风险：

1. 拆分 learning-service 后，这些读取路径可能失效
2. 如果没有过渡查询契约，运营页会先出问题

## 9. Week12 建议结论

1. 允许 `learning-service` 进入设计评审
2. 第一批只收口课程主档和学习完成记录
3. `user-service` 继续独占身份/客户/session
4. `points-service` 继续独占积分账本
5. `b-admin` 的 learning 入口视为后续桥接改造对象，不直接定义为 learning-service owned route
6. Week12 只定边界、smoke、gate 模板，不拆生产代码
