# Week14 Learning -> Points 奖励链路最终验收结论

更新时间：2026-03-08
负责人：C 号（points-service）
视角：`points-service`
结论状态：`partial_pass`

## 1. 本次验收范围

Week14 只验收 `learning -> points` 奖励链路，不扩 points 业务功能，不改 `user-service`，也不开拆 `activity-service`。

本次重点回答 5 件事：

1. `deps.settleReward` 最终是不是仍然走 `points-service`
2. `learning-reward.route.mjs` 是否是正式内部契约入口
3. `learning-service` 是否仍未直写 points 主写表
4. 幂等、错误码、observability、alerting 口径是否一致
5. 这版最新实现是否满足 Week14 要求；若不满足，缺哪一项

## 2. 验收证据

静态核对：

1. `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/skeleton-c-v1/usecases/learning-complete.usecase.mjs`
2. `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/skeleton-c-v1/routes/learning.routes.mjs`
3. `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/skeleton-c-v1/services/learning-reward.service.mjs`
4. `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/learning-service/c-learning.routes.mjs`
5. `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/learning-service/points-service.client.mjs`
6. `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/points-service/learning-reward.route.mjs`
7. `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/points-service/observability.mjs`
8. `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/points-service/CONTRACT.md`
9. `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/points-service/BOUNDARY.md`
10. `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/points-service/OBSERVABILITY.md`
11. `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/points-service/ALERTING.md`

实际验证：

1. `node scripts/smoke_learning_service_complete_phase2.mjs`
2. `node scripts/smoke_points_learning_reward_week13.mjs`
3. `node scripts/smoke_points_boundary_week5.mjs`

## 3. 对 5 个问题的正式回答

## 3.1 `deps.settleReward` 最终是不是仍然走 `points-service`

结论：`分场景`

### 3.1.1 稳定 `learning-service` 运行时

结论：`是`

证据：

1. `c-learning.routes.mjs` 给 `executeLearningComplete()` 注入的是 `settleLearningRewardOverHttp`
2. `points-service.client.mjs` 会调用：
   - `POST /internal/points-service/learning-rewards/settle`
3. 该调用会带：
   - `x-internal-service: learning-service`
   - `x-trace-id`
   - `x-request-id`
   - `x-tenant-id`

因此，独立 `learning-service` 运行时的奖励结算是走 `points-service` 内部 HTTP 契约的。

### 3.1.2 兼容 `skeleton-c-v1` 路由

结论：`否，不是 points-service 运行时入口`

证据：

1. `server/skeleton-c-v1/routes/learning.routes.mjs`
   - 注入的是 `settleLearningCourseRewardLocal`
2. `server/skeleton-c-v1/services/learning-reward.service.mjs`
   - 直接调用 `recordPoints()`

这说明：

1. 兼容入口仍然走 points 域服务逻辑
2. 但不是独立 `points-service` 运行时内部契约入口

严格按“只通过 points-service 运行时”来判，当前仓库并没有完全统一。

## 3.2 `learning-reward.route.mjs` 是否是正式内部契约入口

结论：`是`

证据：

1. `server/microservices/points-service/router.mjs`
   - 已注册 `registerLearningRewardContractRoute(router)`
2. `server/microservices/points-service/learning-reward.route.mjs`
   - 提供正式入口：
     - `POST /internal/points-service/learning-rewards/settle`
3. `server/microservices/learning-service/CONTRACT.md`
   - 已把该接口写成跨服务奖励契约
4. `server/microservices/README.md`
   - 已把该内部 HTTP 契约写入运行时拆分说明

因此，这不是临时脚手架，而是当前正式内部契约入口。

## 3.3 `learning-service` 是否仍未直写 points 主写表

结论：`是`

本次扫描未发现 `server/microservices/learning-service/**` 直接写：

1. `c_point_accounts`
2. `c_point_transactions`
3. `p_products`
4. `p_orders`
5. `c_redeem_records`
6. `c_sign_ins`

补充判断：

1. `learning-service` 当前是通过 HTTP 契约把奖励交给 `points-service`
2. 兼容层 `learning-reward.service.mjs` 也只是调用 `recordPoints()`
3. 没有发现 `appendPoints()`、`state.pointTransactions.push(...)`、`state.pointAccounts.push(...)` 这类 learning 域直写

所以“learning 直写 points 主写表”这条红线目前仍然守住。

## 3.4 幂等、错误码、observability、alerting 是否一致

结论：`大部分一致，但 alerting 和边界门禁未完全收平`

### 3.4.1 幂等

结论：`成立`

证据：

1. 幂等 key 仍是：
   - `learning-reward:${tenantId}:${userId}:${courseId}`
2. `smoke_learning_service_complete_phase2.mjs` 通过
3. `smoke_points_learning_reward_week13.mjs` 通过
4. 实际验证中：
   - 首次完成只生成一条积分流水
   - 重复完成不重复发奖励

### 3.4.2 错误码

结论：`points 侧成立`

当前 points 侧约定仍一致：

1. `INVALID_LEARNING_REWARD_USER`
2. `INVALID_LEARNING_REWARD_COURSE_ID`
3. `INVALID_LEARNING_REWARD_POINTS`
4. `LEARNING_REWARD_SETTLEMENT_FAILED`

并且：

1. `learning-reward.route.mjs` 会返回这些 points 契约错误码
2. `observability.mjs` 已收录这些错误码
3. `CONTRACT.md`、`OBSERVABILITY.md` 已写明这些错误码

### 3.4.3 Observability

结论：`成立`

当前 points 侧观测口径一致：

1. `learningReward.successRate`
2. `recentLogs`
3. `errorCounts`
4. 内部日志 route：
   - `INTERNAL learning->points reward settlement`

两个 smoke 都验证到了：

1. 成功结算后 `recentLogs` 有对应 trace
2. `metrics.learningReward.success` 会增长

### 3.4.4 Alerting

结论：`原先不一致，本次文档已补齐`

Week14 审计时发现：

1. `OBSERVABILITY.md` 已有 `learningReward.successRate`
2. 但 `ALERTING.md` 之前没有对应 learning reward 告警项

这意味着观测口径和告警口径之前不完全一致。

本次 Week14 文档收口后，已补上 learning reward 告警建议。

### 3.4.5 边界门禁

结论：`还不完全一致`

问题在：

1. `write-boundary-whitelist.json` 当前仍用旧模式去匹配 learning 间接调用
2. 最新实现里 `learning-complete.usecase` 使用的是依赖注入 `settleReward(...)`
3. 因此 `smoke_points_boundary_week5.mjs` 当前不会把 learning 奖励链路显示成最新间接调用证据

这不影响实际运行，但说明边界门禁还没有完全跟上最新实现。

## 3.5 这版最新实现是否满足 Week14 要求

结论：`部分满足，不是完全转绿`

### 已满足

1. 稳定 `learning-service` 运行时的奖励结算已通过 `points-service` 内部契约
2. `learning-service` 仍未直写 points 主写表
3. 幂等稳定
4. points 侧错误码与 observability 成立
5. smoke 已验证真实 `learning-service -> points-service` HTTP 链路
6. 这套模式已经可以作为 `activity-service` 的复制参考

### 仍未完全满足

1. 仓库里仍有兼容入口 `server/skeleton-c-v1/routes/learning.routes.mjs`
   - 它不是通过 `points-service` 运行时 HTTP 契约
   - 所以严格按“奖励落账只通过 points-service”来判，当前不是全仓统一
2. `write-boundary-whitelist.json` / `smoke_points_boundary_week5.mjs`
   - 还没按最新 `deps.settleReward` 注入式实现更新门禁匹配口径
   - 所以门禁证据链不完整

因此，Week14 更准确的结论不是 `full_pass`，而是：

1. `learning-service` 稳定试点链路：`pass`
2. 全仓严格统一口径：`not_yet`

## 4. 对 activity-service 的复制建议

Week14 从 points 视角，已经可以抽出 4 条可复制规则给后续 `activity-service`：

1. activity 完成逻辑不要直接 import points 结算实现
2. activity 只注入 `settleReward` 接口，不掌握 points 主写逻辑
3. 正式运行时一律走 `points-service` 内部 HTTP 契约
4. 幂等 key 必须由业务主键稳定生成，不能依赖前端临时传值

推荐复制顺序：

1. 先复制 `deps.settleReward` 注入式 usecase 结构
2. 再复制 `points-service` 内部契约
3. 再补 observability / error code / alerting
4. 最后补 boundary smoke / gate

## 5. C 号 Week14 正式验收结论

最终结论：

1. `learning-service` 稳定链路已经满足“学习完成奖励通过 points-service 契约落账”
2. points 侧幂等、错误码、observability 已经基本成立
3. 这套模式可以作为 `activity-service` 的复制基线
4. 但如果 Week14 要求的是“所有入口都只通过 points-service 运行时，且门禁/告警完全收平”，当前还差两项：
   - legacy 兼容入口未统一
   - boundary guard 未更新到注入式实现
