# Week13 learning-service -> points-service 契约化改造总说明

更新时间：2026-03-08  
负责人：A 号（整合）

> Week14 追加收口说明：`server/skeleton-c-v1/routes/learning.routes.mjs` 与
> `server/skeleton-c-v1/services/learning-reward.service.mjs` 已统一切到
> `learning-service -> points-service` 运行时 HTTP 契约；下面 `5.3 v1-monolith 兼容`
> 仅保留 Week13 历史背景，不再代表当前运行时事实。

## 1. 本轮目标

本轮只做 `learning-service -> points-service` 契约化落账接线，不扩学习业务能力，也不调整 `gateway` 对外 Phase 1 口径。

目标有 4 个：

1. 固定服务间调用方式
2. 固定 header / trace / tenant 透传口径
3. 把契约化链路接进 Week13 总 smoke / gate
4. 不打坏 `user-service / points-service` 已冻结边界

## 2. 最终决定的调用方式

统一口径：`learning-service` 调 `points-service` 一律走 `内部 HTTP`，不走：

1. gateway 转发
2. 共享 usecase 直接 import `points-service` 模块
3. 直接写 `pointAccounts / pointTransactions`

当前固定入口：

1. `learning-service` 兼容路由：
   - `POST /api/learning/courses/:id/complete`
2. `points-service` 内部契约路由：
   - `POST /internal/points-service/learning-rewards/settle`

## 3. 透传口径

### 3.1 header

learning -> points 内部 HTTP 必带：

1. `x-internal-service: learning-service`
2. `x-trace-id`
3. `x-request-id`
4. `x-tenant-id`
5. `x-tenant-code`（有则透传）
6. `x-service-name: learning-service`

### 3.2 body

请求体固定字段：

1. `tenantId`
2. `userId`
3. `courseId`
4. `courseTitle`
5. `rewardPoints`

### 3.3 trace

1. `learning-service` 读取上游 `x-trace-id / x-request-id`
2. 内部 HTTP 原样透传给 `points-service`
3. `points-service` 可观测日志继续以 `INTERNAL learning->points reward settlement` 作为 route

## 4. 边界口径

1. `POST /api/learning/courses/:id/complete` 仍然只算 `pilot compatibility route`
2. `Phase 1 通过范围` 仍然只包含：
   - 查询
   - 管理端 CRUD
3. gateway route-map 仍然不把 `complete` 记为 `learning-service owned route`
4. `complete` 现已完成契约化接线，但这不等于它进入了 Phase 1 已通过范围

## 5. 代码落点

### 5.1 learning-service

1. `server/microservices/learning-service/points-service.client.mjs`
   - 新增内部 HTTP client
2. `server/microservices/learning-service/c-learning.routes.mjs`
   - `complete` 改为注入 HTTP settlement handler
3. `server/skeleton-c-v1/usecases/learning-complete.usecase.mjs`
   - 改为依赖注入 `settleReward`

### 5.2 points-service

1. `server/microservices/points-service/learning-reward.route.mjs`
   - 新增内部契约路由
2. `server/microservices/points-service/router.mjs`
   - 注册内部契约路由

### 5.3 v1-monolith 兼容

1. `server/skeleton-c-v1/services/learning-reward.service.mjs`
   - 保留 v1 本地兼容结算
2. `server/skeleton-c-v1/routes/learning.routes.mjs`
   - v1 complete 继续走本地兼容结算，不影响既有流程

## 6. 门禁与验证

新增 / 更新入口：

1. `npm run test:smoke:learning-points-contract:week13`
2. `npm run test:smoke:week13-learning-pilot`
3. `npm run gate:week13-learning-pilot`

当前 gate 已包含：

1. Week11 既有 gate
2. learning-service 边界检查
3. learning-service route ownership 检查
4. learning-service Phase 1 smoke
5. learning -> points contract smoke
6. Week13 release-check

## 7. 结论

1. `learning-service -> points-service` 奖励结算路径已从“进程内直接 import”收口为“内部 HTTP 契约”
2. `tenant / trace / request_id` 已有固定透传口径
3. `complete` 仍不计入 Week13 Phase 1 已通过范围
4. Week13 对外口径保持不变，但内部契约链路已可验证、可复跑
