# Week12 Activity 与 Points 交叉边界说明

更新时间：2026-03-09
负责人：C 号（points-service）
视角：`points-service`

## 1. 目标

这份文档只回答 `activity-service` 与 `points-service` 的交叉边界，不讨论 `user-service`。

Week12 它是设计评审输入；到 Week15，Phase 1 已按这份边界正式落地；到 Week16，`activity complete -> points` 奖励链路已按稳定能力验收。

重点是把以下问题讲清楚：

1. 哪些能力一定留在 `points-service`
2. 哪些活动能力可以迁到 `activity-service`
3. 两个服务之间不能碰的红线是什么
4. 奖励/参与链路如何分工

## 2. points-service 必须继续主写的对象

以下主写边界在 Week12 不变：

1. `c_point_accounts`
2. `c_point_transactions`
3. `p_products`
4. `p_orders`
5. `c_redeem_records`
6. `c_sign_ins`

结论：

1. `activity-service` 不得直接写上述任一对象
2. 任何活动奖励最终都只能经 `points-service` 落账

## 3. activity-service 可主写的对象

从 points 视角可接受 `activity-service` 主写：

1. `p_activities(source_domain='activity')`
2. `c_activity_completions`

前提：

1. 只处理 activity 自己的活动定义和完成记录
2. 不把 `source_domain='mall'` 的活动一起拿走

## 4. 交叉边界红线

### 4.1 绝对红线

`activity-service` 不得直写：

1. `c_point_accounts`
2. `c_point_transactions`
3. `p_orders`
4. `c_redeem_records`
5. `c_sign_ins`

`points-service` 不得继续主写：

1. `c_activity_completions`
2. `p_activities(source_domain='activity')`

### 4.2 协议红线

Week12 不允许变更：

1. `Authorization: Bearer <token>`
2. `x-csrf-token: <csrfToken>`
3. `sign-in / points / mall / orders / redemptions` 已冻结语义

### 4.3 范围红线

Week12 不允许：

1. 顺手把 `sign-in` 切给 `activity-service`
2. 顺手把 `redeem / writeoff` 切给 `activity-service`
3. 顺手把商城活动参与整条链路一起迁走

## 5. 奖励链路边界

### 5.1 活动完成奖励

建议职责：

1. `activity-service`
   - 判断活动能否完成
   - 判断是否重复完成
   - 写 `c_activity_completions`
   - 发起 reward settlement request
2. `points-service`
   - 落积分流水
   - 返回余额
   - 保证幂等不重复发点

### 5.2 商城活动参与奖励

Week12 先不迁，继续留在 `points-service`：

1. `GET /api/mall/activities`
2. `POST /api/mall/activities/:id/join`

原因：

1. 当前它同时承载商城视图和奖励发放
2. 贸然迁移会打穿 points 域观测和交易边界

### 5.3 签到奖励

签到继续留在 `points-service`：

1. `POST /api/sign-in`
2. `c_sign_ins`
3. `signIn.successRate`

理由：

1. 这条链路已经有 observability、smoke、Week11 灰度口径
2. 再迁会直接打破已冻结边界

## 6. 已落地交互契约

Week15 Phase 1 已采用这条契约：

1. endpoint：
   - `POST /internal/points-service/activity-rewards/settle`
2. caller：
   - `activity-service`
3. request：
   - `tenantId`
   - `userId`
   - `activityId`
   - `activityTitle`
   - `rewardPoints`
   - `completionDate`
   - `traceId`
4. response：
   - `ok`
   - `duplicated`
   - `reward`
   - `balance`
   - `transactionId`
   - `idempotencyKey`
   - `completionDate`

幂等规则：

1. key 格式：
   - `activity-reward:{tenantId}:{userId}:{activityId}:{completionDate}`
2. `completionDate` 固定使用 `YYYY-MM-DD`
3. 同一 key 重试只允许返回 `duplicated=true`，不得重复发点

## 7. cross-boundary smoke / gate

1. `activity.complete.reward.success`
   - 完成活动成功
   - `c_activity_completions` 写入成功
   - `c_point_transactions` 增加一条入账
2. `activity.complete.reward.idempotent`
   - 同一用户同一活动同日重复完成
   - 不重复发点
3. `activity.domain.cannot.write.points.tables`
   - 静态扫描 activity 写路径
   - 禁止直写 points 主写表
4. `activity.reward.contract.idempotent`
   - points 内部契约重复调用
   - 不重复新增积分流水

落地脚本：

1. `scripts/check_activity_service_boundary_phase1.mjs`
2. `scripts/smoke_activity_service_phase1.mjs`
3. `scripts/smoke_activity_points_reward_phase1.mjs`
4. `scripts/gate_activity_service_phase1.mjs`

## 8. C 号评审结论

从 points 视角，Week16 Phase 2 当前结论是：

1. `activity-service` Phase 2 已把 `complete` 收成稳定能力
2. points 账务主写边界保持不变
3. 活动奖励只能通过 `points-service` 结算
4. `sign-in` 和商城活动参与仍未迁移
5. Phase 2 guard / smoke / gate 已具备独立验证入口

## 9. Week17 收口补充

Week17 最终边界不再新增设计结论，只把这份 Week12-Week16 路径正式定版为：

1. `activity-service` 已可按 activity 域稳定范围正式拆出处理
2. `sign-in / mall activities / join / redeem / orders / writeoff` 继续永久留在 `points-service`
3. 最终定版入口见：
   - `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/points-service/WEEK17-ACTIVITY-POINTS-FINAL-BOUNDARY.md`
