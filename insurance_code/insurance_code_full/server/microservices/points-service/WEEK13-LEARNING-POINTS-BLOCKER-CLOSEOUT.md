# Week13 Learning -> Points 阻塞解除确认

更新时间：2026-03-08
负责人：C 号（points-service）
状态：`resolved`

## 1. 原阻塞项

Week13 原阻塞项来源：

1. `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/points-service/WEEK13-LEARNING-POINTS-REVIEW.md`

原阻塞点是：

1. `executeLearningComplete()` 直接调用 `appendPoints()`
2. 学习完成奖励没有通过 `points-service` 受控落账
3. 这条路径不能复制到后续 `activity-service`

## 2. 当前解除结果

当前阻塞项已解除。

解除依据：

1. 学习完成奖励已改为通过 `points-service` 受控契约落账
2. `learning-complete.usecase` 不再直接调用 `appendPoints()`
3. 积分记账统一仍落到 `points-service -> recordPoints()`
4. 重复结算不会重复发奖励
5. 记账结果已进入 `points-service` 可观测快照

## 3. 受控落账契约

实现文件：

1. `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/points-service/learning-reward.contract.mjs`

契约名：

1. `settleLearningCourseReward(...)`

输入：

1. `tenantId`
2. `userId`
3. `courseId`
4. `courseTitle`
5. `rewardPoints`
6. `traceId`

输出：

1. `ok`
2. `duplicated`
3. `reward`
4. `balance`
5. `transactionId`
6. `idempotencyKey`

幂等 key 规则：

1. `learning-reward:${tenantId}:${userId}:${courseId}`

## 4. 当前调用关系

当前学习奖励调用关系已经变成：

1. `learning.routes.mjs`
2. `executeLearningComplete()`
3. `settleLearningCourseReward()`
4. `recordPoints()`
5. `points.repository`

关键文件：

1. `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/skeleton-c-v1/usecases/learning-complete.usecase.mjs`
2. `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/points-service/learning-reward.contract.mjs`
3. `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/skeleton-c-v1/services/points.service.mjs`

## 5. 幂等与错误码

幂等：

1. 首次学习完成：成功入账
2. 重复学习完成：由学习完成记录先挡住，不重复发奖励
3. 如果重复调用 `settleLearningCourseReward()`：由 `recordPoints()` 的幂等 key 再挡一次

当前约定错误码：

1. `INVALID_LEARNING_REWARD_USER`
2. `INVALID_LEARNING_REWARD_COURSE_ID`
3. `INVALID_LEARNING_REWARD_POINTS`
4. `LEARNING_REWARD_SETTLEMENT_FAILED`

这些错误码已进入：

1. `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/points-service/CONTRACT.md`
2. `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/points-service/OBSERVABILITY.md`

## 6. 可观测性

当前 learning reward 已进入 `points-service` 可观测口径：

1. `learningReward.successRate`
2. `recentLogs`
3. `errorCounts`

内部观测路由仍然是：

1. `GET /internal/points-service/observability`

内部日志 route 固定为：

1. `INTERNAL learning->points reward settlement`

## 7. Smoke 与验证

新增 Week13 smoke：

1. `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/scripts/smoke_points_learning_reward_week13.mjs`

覆盖：

1. 学习完成调用 points 受控契约
2. 首次完成只生成一条积分流水
3. 重复完成不重复发奖励
4. points 受控契约自身幂等
5. learning reward 观测指标与 recentLogs 可见

## 8. C 号最终确认

从 points 视角，Week13 阻塞项现在可以正式解除：

1. 奖励落账只通过 `points-service`
2. `learning-service` 不再直写 points 主写表
3. 记账结果可观测
4. 重复完成不重复发奖励
5. 当前实现已经满足后续 `activity-service` 继续沿用“points 统一结算”模式
