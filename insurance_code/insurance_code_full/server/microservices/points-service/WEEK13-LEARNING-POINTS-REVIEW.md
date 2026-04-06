# Week13 Learning -> Points 奖励链路评审结论

更新时间：2026-03-08
负责人：C 号（points-service）
视角：`points-service`
状态：历史阻塞快照，已由 `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/points-service/WEEK13-LEARNING-POINTS-BLOCKER-CLOSEOUT.md` 收口

## 1. 目标

Week13 不拆 `activity-service`，也不改生产代码。

这份文档只回答 4 个问题：

1. `learning-service` 的课程完成奖励，是否仍然通过 `points-service` 落账
2. `appendPoints()` 或等价积分落账路径，是否仍归 `points-service`
3. 是否出现了新的跨服务直写 points 主写表
4. 当前实现，是否满足后续复制到 `activity-service`

## 2. 本次评审范围

本次只检查学习完成奖励链路相关实现和现有设计文档：

1. `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/skeleton-c-v1/routes/learning.routes.mjs`
2. `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/skeleton-c-v1/usecases/learning-complete.usecase.mjs`
3. `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/skeleton-c-v1/common/state.mjs`
4. `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/skeleton-c-v1/services/points.service.mjs`
5. `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/learning-service/DESIGN.md`
6. `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/learning-service/RISKS.md`

不在本次范围内：

1. `user-service`
2. 公共 `package.json`
3. `activity-service` 生产代码
4. 积分、订单、核销新功能扩展

## 3. points 主写边界基线

Week13 继续沿用已冻结的 points 主写边界：

1. `c_point_accounts`
2. `c_point_transactions`
3. `p_products`
4. `p_orders`
5. `c_redeem_records`
6. `c_sign_ins`

结论口径不变：

1. 上述对象只允许 `points-service` 主写
2. 其他服务不得直接写上述对象
3. 奖励最终落账必须通过 `points-service` 契约或等价受控入口完成

## 4. 当前实际链路

当前学习完成入口仍然是：

1. `POST /api/learning/courses/:id/complete`

当前实现路径是：

1. `learning.routes.mjs` 接收请求
2. `executeLearningComplete()` 判断课程是否存在、是否重复完成
3. 先写课程完成记录
4. 再直接调用 `appendPoints()` 追加积分流水和余额

关键证据：

1. `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/skeleton-c-v1/usecases/learning-complete.usecase.mjs`
   - 直接 `import { appendPoints, getBalance, runInStateTransaction }`
   - 在 `createCourseCompletion(...)` 之后直接执行 `appendPoints(...)`
2. `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/skeleton-c-v1/common/state.mjs`
   - `appendPoints()` 会直接写 `state.pointTransactions`
   - `appendPoints()` 还会直接写 `state.pointAccounts`
3. `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/skeleton-c-v1/services/points.service.mjs`
   - 已存在 `recordPoints(...)`
   - 这才是 points 域自己的受控积分落账入口

## 5. 逐项判断

## 5.1 课程完成奖励是否仍然通过 points-service 落账

结论：`否`

原因：

1. 当前学习完成奖励不是通过 `points.service.recordPoints(...)` 落账
2. 奖励逻辑仍然写在 `learning-complete.usecase` 里
3. 这条链路本质上还是 learning 侧直接触达 points 账务状态

## 5.2 `appendPoints()` 或等价积分落账路径是否仍归 points-service

结论：`否`

原因：

1. `appendPoints()` 定义在共享 `common/state.mjs`
2. 调用方是 `learning-complete.usecase`
3. 这不是 `points-service` 自己暴露的服务边界
4. 也没有经过 `points-service` 既有的 `recordPoints(...)` 入口

## 5.3 是否出现新的跨服务直写 points 主写表

结论：`未发现新增路径，但已存在一条旧的直写路径`

具体判断：

1. 本次扫描未发现 `learning-service` 目录下新增其它直写 `c_point_accounts`、`c_point_transactions`、`p_orders`、`c_redeem_records`、`c_sign_ins` 的实现
2. 但现有 `executeLearningComplete() -> appendPoints()` 仍然直接改 points 账务状态
3. 这条路径虽然不是 Week13 新引入，但它本身仍然是边界问题，不能当成可复制模式

## 5.4 是否满足后续复制到 activity-service

结论：`不满足`

原因：

1. 如果把“完成即直接 appendPoints”复制到 `activity-service`，会再次打穿 points 主写边界
2. `activity-service` 的正确模式应当是：
   - activity 自己判定完成
   - activity 自己写完成记录
   - 奖励结算通过 `points-service` 契约执行
3. Week12 已经明确：
   - `activity-service` 不得直写 `c_point_accounts`
   - `activity-service` 不得直写 `c_point_transactions`

## 6. 与既有设计文档的一致性

当前评审结论与既有设计文档一致，没有出现口径冲突：

1. `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/learning-service/RISKS.md`
   - 已把“学习完成直接积分落账”标为 `P0`
2. `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/learning-service/DESIGN.md`
   - 已明确 learning 奖励最终入账必须通过 `points-service`
   - 已明确当前 `appendPoints()` 做法后续必须改成跨服务调用或事件驱动
3. `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/points-service/WEEK12-ACTIVITY-POINTS-BOUNDARY.md`
   - 已明确 activity 奖励最终必须通过 `points-service` 落账

## 7. C 号最终评审结论

Week13 从 points 视角给出的正式结论如下：

1. `learning -> points` 奖励链路当前`不满足`“通过 points-service 落账”的目标口径
2. 当前 `appendPoints()` 仍是共享状态直写，不属于 `points-service` 受控服务边界
3. 未发现 Week13 新增的其它跨服务直写路径
4. 但现有 `appendPoints()` 旧路径仍然构成边界风险，不能视为转绿
5. 因此，当前实现`不满足`后续复制到 `activity-service`

## 8. Week13 后续建议

Week13 本周不改代码，只给评审建议：

1. `learning-service` 真正试点前，必须把奖励落账从 `appendPoints()` 切到 `points-service` 契约
2. `activity-service` 试点时不得复用“完成后直接 appendPoints”模式
3. 后续如果要转绿，最小验收应补 3 条：
   - 学习完成只写 learning 自己的完成记录
   - 奖励最终由 `points-service` 产生积分流水
   - 重复完成课程不会重复发点，且幂等 key 可追踪
