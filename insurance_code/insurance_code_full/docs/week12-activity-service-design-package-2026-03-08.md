# Week12 Activity Service 设计包（C 号输入）

更新时间：2026-03-08
负责人：C 号
视角：`points-service` + 跨服务边界评审

## 1. 目标

这份文档只提供 `activity-service` 的设计评审输入，不直接开拆生产代码。

本文件明确：

1. `activity-service` 候选 owned routes
2. `activity-service` 主写表归属
3. 与 `points-service` 的奖励/参与链路边界
4. 推荐迁移顺序
5. smoke / gate 建议
6. 风险清单

不做的事：

1. 不改 `user-service`
2. 不改公共 `package.json`
3. 不改 gateway 公共入口
4. 不新建 `activity-service` 生产代码
5. 不改变 `points-service` 已冻结接口语义

## 2. 当前活动域现状

当前活动相关能力散落在现有单体/共享 runtime 中，主要包括：

### 2.1 C 端活动路由

1. `GET /api/activities`
2. `POST /api/activities/:id/complete`

### 2.2 管理面活动配置路由

1. `GET /api/p/activities`
2. `POST /api/p/activities`
3. `PUT /api/p/activities/:id`
4. `DELETE /api/p/activities/:id`
5. `GET /api/b/activity-configs`
6. `POST /api/b/activity-configs`
7. `PUT /api/b/activity-configs/:id`

### 2.3 当前仍挂在 points 域的活动相关路由

1. `GET /api/mall/activities`
2. `POST /api/mall/activities/:id/join`
3. `POST /api/sign-in`

结论：

1. 现在“活动定义/完成”和“积分奖励/商城参与”还没有完全拆开
2. `activity-service` 设计时必须先把“活动域动作”和“账务落账动作”切开

## 3. 建议的 owned routes

### 3.1 Phase 1 建议直接归 `activity-service`

首批建议 owned routes：

1. `GET /api/activities`
2. `POST /api/activities/:id/complete`
3. `GET /api/p/activities`
4. `POST /api/p/activities`
5. `PUT /api/p/activities/:id`
6. `DELETE /api/p/activities/:id`
7. `GET /api/b/activity-configs`
8. `POST /api/b/activity-configs`
9. `PUT /api/b/activity-configs/:id`

原因：

1. 这些路由的核心语义是“活动定义、活动展示、活动完成、活动配置”
2. 这些属于活动域，而不是 points 账务域
3. 这批路由迁出后，对 `points-service` 的订单/核销语义影响最小

### 3.2 Phase 1 明确不迁出的路由

以下路由本阶段不建议迁到 `activity-service`：

1. `POST /api/sign-in`
2. `GET /api/mall/activities`
3. `POST /api/mall/activities/:id/join`
4. `POST /api/mall/redeem`
5. `GET /api/orders/*`
6. `POST /api/redemptions/:id/writeoff`

原因：

1. `sign-in` 已被 `points-service` 固化进签到记账链路
2. `mall/activities/join` 当前直接耦合积分奖励与商城体验
3. `redeem / orders / writeoff` 是高风险交易链路，不属于活动域首批拆分范围

### 3.3 Phase 2 候选路由

在 Phase 1 稳定后，再评估是否迁移：

1. `GET /api/mall/activities`
2. `POST /api/mall/activities/:id/join`

前提：

1. 先把奖励结算协议固化成 `activity-service -> points-service`
2. 先补活动参与与奖励落账的幂等协议
3. 先补跨服务 smoke / gate

## 4. 主写表归属建议

## 4.1 `activity-service` 建议主写

1. `p_activities`
2. `c_activity_completions`

说明：

1. `p_activities` 承载活动定义、规则、展示信息、状态
2. `c_activity_completions` 承载用户完成记录
3. 活动是否可完成、是否重复完成，应由 `activity-service` 判定

## 4.2 `points-service` 必须继续主写

1. `c_point_accounts`
2. `c_point_transactions`
3. `p_products`
4. `p_orders`
5. `c_redeem_records`
6. `c_sign_ins`

说明：

1. 所有积分余额、积分流水、兑换、订单、核销仍由 `points-service` 主写
2. `activity-service` 不得直接写这些表

## 4.3 当前需要特别说明的表

### 4.3.1 `p_activities`

当前 `p_activities` 实际上同时承载两类数据：

1. `source_domain='activity'`
2. `source_domain='mall'`

Week12 评审建议：

1. `activity-service` 只接管 `source_domain='activity'` 的活动定义
2. `source_domain='mall'` 继续留在 `points-service` 所在域，直到商城活动链路单独拆评审
3. 这是“同表分域”的过渡方案，不是长期理想形态

### 4.3.2 `b_customer_activities`

当前更像 B 端互动/行为/运营统计相关表，不建议在 Week12 直接划给 `activity-service` 主写。

评审建议：

1. 暂不纳入 `activity-service` 首批主写表
2. 先作为 legacy read dependency 看待
3. 后续单独评估是归活动运营域、B 端运营域，还是统一事件域

## 5. 与 points-service 的奖励/参与链路边界

### 5.1 活动完成链路

建议拆分后职责如下：

1. `activity-service`
   - 查询活动
   - 判断是否可完成
   - 判断是否重复完成
   - 写 `c_activity_completions`
   - 发起“奖励落账请求”
2. `points-service`
   - 校验奖励落账请求
   - 执行积分入账
   - 写 `c_point_transactions`
   - 返回最新余额/落账结果

### 5.2 商城活动参与链路

Week12 建议先不迁。

当前口径：

1. 活动展示仍可依赖 mall 视图
2. `POST /api/mall/activities/:id/join` 继续留在 `points-service`
3. 等 `activity-service` 的“活动完成 + 奖励结算”模式稳定后，再评估商城活动参与是否复用同一协议

### 5.3 签到链路

签到继续留在 `points-service`。

原因：

1. 当前 `POST /api/sign-in` 已冻结
2. `c_sign_ins` 已在 points 主写边界中冻结
3. 签到本质上已经是积分账务域稳定链路，不适合在 Week12 再切走

## 6. 推荐交互模式

### 6.1 Phase 1 推荐：同步命令式结算

推荐 `activity-service` 完成活动后，同步调用 `points-service` 的奖励结算能力。

原因：

1. 改造成本最低
2. 失败边界最清楚
3. 便于补 smoke 和 gate
4. 适合 Week12 只做设计准备、不引入新基础设施的约束

### 6.2 暂不推荐直接事件化落地

事件驱动是后续候选，不作为本阶段落地前提。

原因：

1. 当前没有为 activity reward 单独准备 outbox/consumer/reconciliation 模板
2. 直接事件化会把 Week12 设计评审变成基础设施专题
3. 当前首要目标是边界清晰，不是把技术栈做复杂

## 7. 推荐迁移顺序

### Phase 0：冻结当前边界

1. 保持 `sign-in / mall / orders / redemptions` 在 `points-service`
2. 保持 `user-service` 身份边界不动
3. 不动公共入口和公共 gate

### Phase 1：先拆活动定义与完成判定

1. 迁 `GET /api/activities`
2. 迁 `POST /api/activities/:id/complete`
3. 迁 `p/b` 管理面活动配置路由
4. `activity-service` 主写：
   - `p_activities(source_domain='activity')`
   - `c_activity_completions`
5. 奖励结算继续调用 `points-service`

### Phase 2：补跨服务门禁与观测

1. 增 activity-service own routes guard
2. 增 activity -> points reward boundary smoke
3. 增 activity-service readiness / metrics / observability baseline

### Phase 3：再评估商城活动链路

1. 评估 `GET /api/mall/activities`
2. 评估 `POST /api/mall/activities/:id/join`
3. 如果迁移，先落统一 reward settlement contract，再迁入口

## 8. smoke / gate 建议

### 8.1 建议的 smoke

1. `smoke_activity_service_contract.mjs`
   - `GET /health`
   - `GET /ready`
   - `GET /api/activities`
   - `POST /api/activities/:id/complete`
   - `GET /api/p/activities`
   - `POST /api/p/activities`
   - `PUT /api/p/activities/:id`
   - `DELETE /api/p/activities/:id`

2. `smoke_activity_points_reward_chain.mjs`
   - 完成活动成功
   - `c_activity_completions` 写入成功
   - 积分奖励由 `points-service` 落账成功
   - 幂等重复完成不重复发点

3. `smoke_activity_boundary_week12.mjs`
   - `activity-service` 不直写 points 主写表
   - `points-service` 不再主写 `source_domain='activity'` 的活动定义

### 8.2 建议的 gate

1. `check_activity_service_owned_routes.mjs`
   - 校验 `activity-service` owned routes 与 gateway route-map 一致
2. `check_activity_points_boundary_guard.mjs`
   - 校验 activity usecase/repository 不直写 `c_point_transactions / c_sign_ins / p_orders / c_redeem_records`
3. `check_activity_source_domain_guard.mjs`
   - 校验 `p_activities` 的 `source_domain='activity'` 写路径归 `activity-service`
   - 校验 `source_domain='mall'` 写路径仍归 `points-service`
4. `gate:week12-activity-boundary`
   - 统一编排以上静态检查与 smoke

## 9. 风险清单

### 9.1 行级 ownership 风险

`p_activities` 当前是同一张物理表承载 `activity` 和 `mall` 两类 source domain。

风险：

1. 如果没有 source-domain 级门禁，很容易再次出现双边都能写
2. 这不是长期理想边界，只是过渡方案

### 9.2 奖励双写风险

如果 `activity-service` 在完成活动时自己直接改积分，又让 `points-service` 再落账，会造成双发积分。

结论：

1. 奖励结算只能由 `points-service` 最终执行
2. `activity-service` 不能直接写 `c_point_transactions`

### 9.3 幂等与补偿风险

活动完成和积分发放分到两个服务后，必须明确：

1. completion idempotency key
2. reward settlement idempotency key
3. 失败重试归谁负责

否则会出现：

1. 活动完成成功但未发点
2. 重试后重复发点

### 9.4 商城活动链路混拆风险

如果在 Phase 1 就把 `/api/mall/activities/:id/join` 一起迁走，会把“商城参与 + 奖励 + points 可见性”一次性打散。

Week12 不建议这么做。

## 10. 评审结论建议

C 号建议本周评审结论收成下面 5 条：

1. `activity-service` 可以进入设计评审，但本周不拆生产代码
2. 首批只接活动定义、活动配置、活动完成判定、完成记录
3. 奖励落账继续由 `points-service` 执行
4. `sign-in` 与商城活动参与先留在 `points-service`
5. 所有跨域写路径先补文档、smoke、gate，再改代码
