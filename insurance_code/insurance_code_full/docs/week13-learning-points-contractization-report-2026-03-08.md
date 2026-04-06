# Week13 learning-service -> points-service 契约化最终联调报告

更新时间：2026-03-08  
负责人：A 号（整合）

## 1. 本次执行入口

1. `npm run test:smoke:learning-points-contract:week13`
2. `npm run test:smoke:week13-learning-pilot`
3. `npm run gate:week13-learning-pilot`

## 2. 联调结论

结果：`PASS`

通过项：

1. `learning-complete.usecase` 不再直接调用 `appendPoints()`
2. `learning-complete.usecase` 不再直接 import `points-service` 契约文件
3. `learning-service` 兼容路由通过内部 HTTP 调 `points-service`
4. `points-service` 成功生成学习奖励积分流水
5. `points-service` 可观测日志可见同一条 `trace_id`
6. 重复完成课程不会重复发积分
7. Week11/Week13 既有 gate 没被打坏

## 3. 关键验证结果

### 3.1 contract smoke

已通过：

1. `learning-complete-http-success`
2. `points-summary-updated`
3. `points-observability-log-visible`
4. `duplicate-learning-complete-idempotent`

关键观测：

1. `points-service recentLogs.route = INTERNAL learning->points reward settlement`
2. `trace_id = week13-learning-http-reward-success`
3. `idempotencyKey = learning-reward:{tenantId}:{userId}:{courseId}`

### 3.2 total gate

已通过：

1. `week11-gate`
2. `week13-learning-service-boundary`
3. `week13-learning-service-route-ownership`
4. `week13-learning-service-smoke`
5. `week13-learning-points-contract-smoke`
6. `week13-learning-service-release-check`

## 4. 保持不变的口径

1. `Phase 1 通过范围 = 查询 + 管理端 CRUD`
2. `POST /api/learning/courses/:id/complete` 仍不计入 Phase 1 已通过范围
3. gateway route-map 仍不把 `complete` 记为 `learning-service owned route`
4. `complete` 的 gateway 演练口径仍然是：
   - 公开流量继续走 `v1-monolith`
   - learning-service 只保留试点兼容实现

## 5. 风险判断

当前没有新增业务风险，但仍有 2 个明确边界：

1. `complete` 只是 pilot compatibility，不应被误同步为“Week13 已通过能力”
2. 如果后续把 `complete` 切到 gateway owned route，必须先改：
   - 文档
   - gate
   - release-check
   - 再改 route-map

## 6. 最终判断

1. 本轮问题类型：`代码接线与契约执行路径问题`，已修复
2. `user-service / points-service` 既有边界：`未破坏`
3. Week13 learning -> points 契约化改造：`通过`
4. 可以作为后续 `activity-service -> points-service` 的统一模式基线
