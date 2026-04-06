# Week18 Learning / Points Final Boundary

更新时间：2026-03-09  
负责人：C 号（points-service）  
视角：`points-service`  
状态：`WEEK18_FINAL_REVIEW_PASS`

## 1. 复审目标

Week18 只复审 `learning-service` 正式拆出后的奖励链路边界，不改 `learning-service` 主线实现，不扩 points 功能。

本次只回答 3 件事：

1. 学习完成奖励是否仍然只通过 `points-service` 契约落账
2. 是否出现回退到本地积分写入
3. 是否出现新的跨服务直写 points 主写表

## 2. 最终结论

结论：`PASS`

1. `learning complete -> points` 奖励链路仍然只通过 `points-service` 内部契约落账
2. 未发现回退到本地积分写入
3. 未发现新的跨服务直写 points 主写表
4. legacy 兼容层仍存在，但当前处于受控状态，不构成边界回退

## 3. 关键证据

### 3.1 正式运行时入口

1. `server/microservices/learning-service/c-learning.routes.mjs`
   - `executeLearningComplete(..., { settleReward: settleLearningRewardOverHttp })`
2. `server/microservices/learning-service/points-service.client.mjs`
   - 调用 `POST /internal/points-service/learning-rewards/settle`
   - 固定带 `x-internal-service: learning-service`
3. `server/microservices/points-service/learning-reward.route.mjs`
   - 只允许 `learning-service` 作为内部 caller
4. `server/microservices/points-service/learning-reward.contract.mjs`
   - 负责最终积分落账、幂等和错误码

### 3.2 受控 legacy 兼容层

1. `server/skeleton-c-v1/routes/learning.routes.mjs`
   - `complete` 仍通过 `settleLearningCourseRewardViaPointsService`
   - 不再允许回到 `settleLearningCourseRewardLocal`
2. `server/skeleton-c-v1/usecases/learning-complete.usecase.mjs`
   - 只接受注入式 `settleReward`
3. `server/skeleton-c-v1/services/learning-reward.service.mjs`
   - 只允许转发到 `settleLearningRewardOverHttp`

## 4. 本地积分写入回退复审

本次复审没有发现以下回退：

1. `appendPoints()`
2. `recordPoints()` 出现在 learning 域路由、usecase、legacy reward adapter 中
3. `state.pointAccounts` / `state.pointTransactions` 直接写入

说明：

1. `points-service/learning-reward.contract.mjs` 内部使用 `recordPoints()` 仍是合法 points 域主写
2. 本次禁止的是 learning 域自己回退到这些写法

## 5. 跨服务直写 points 主写表复审

本次复审未发现 `learning-service` 或 learning legacy 兼容层直写以下表：

1. `c_point_accounts`
2. `c_point_transactions`
3. `p_products`
4. `p_orders`
5. `c_redeem_records`
6. `c_sign_ins`

## 6. 残留兼容层清单

这些文件仍存在，但当前都属于受控兼容层：

1. `server/skeleton-c-v1/routes/learning.routes.mjs`
2. `server/skeleton-c-v1/usecases/learning-complete.usecase.mjs`
3. `server/skeleton-c-v1/services/learning-reward.service.mjs`

受控含义：

1. 允许作为旧挂载方式兼容层存在
2. 不允许重新引入 `appendPoints()` / `recordPoints()` 本地落账
3. 不允许直接写 points 主写表

## 7. 验证入口

1. `node scripts/check_learning_points_final_boundary.mjs`
2. `node scripts/review_learning_points_legacy_routes_week18.mjs`
3. `node scripts/gate_learning_points_final_boundary.mjs`
