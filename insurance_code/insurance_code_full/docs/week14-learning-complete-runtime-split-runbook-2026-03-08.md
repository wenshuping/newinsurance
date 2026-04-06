# Week14 Learning Complete + Reward Runbook

更新时间：2026-03-08  
负责人：A 号（整合 / gateway / gate / release-check）

## 1. 目标

Week14 只做总收口，不扩新服务，不改 `user-service / points-service` 主写边界。

本轮目标：

1. 把 `learning complete + reward` 正式纳入 runtime split 总编排
2. 把 gateway 对学习完成链路的切流、手工回退、观测口径纳入统一验收
3. 保持 `user-service / points-service` 既有 gate 不回归

## 2. 当前固定口径

### 2.1 服务间调用

`learning-service -> points-service` 一律走内部 HTTP：

1. 入口：`POST /internal/points-service/learning-rewards/settle`
2. 不走 gateway
3. 不允许 direct import `points-service` 模块
4. 不允许 learning 直写 `c_point_accounts / c_point_transactions`

### 2.2 header / trace / tenant 透传

必须透传：

1. `x-internal-service: learning-service`
2. `x-service-name: learning-service`
3. `x-trace-id`
4. `x-request-id`
5. `x-tenant-id`
6. `x-tenant-code`

### 2.3 gateway 路由

Week14 起，gateway 将以下路径视为 `learning-service` owned routes：

1. `GET /api/learning/courses`
2. `GET /api/learning/courses/:id`
3. `POST /api/learning/courses/:id/complete`
4. `GET /api/p/learning/courses`
5. `POST /api/p/learning/courses`
6. `PUT /api/p/learning/courses/:id`
7. `DELETE /api/p/learning/courses/:id`

## 3. 统一入口

### 3.1 总 smoke

```bash
npm run test:smoke:week14-learning-complete
```

### 3.2 release-check

```bash
npm run release-check:week14-learning-complete
```

### 3.3 总 gate

```bash
npm run gate:week14-learning-complete
```

## 4. Week14 release-check 覆盖项

1. learning 默认关闭时，读路径走 `v1-monolith`
2. 打开 learning cutover 后，`complete` 经 gateway 走 `learning-service`
3. 奖励链路通过 `points-service` 内部契约落账
4. points summary 能反映奖励变化
5. points observability 能按 `trace_id` 看见奖励结算日志
6. gateway metrics 能看见 `complete` 的目标服务与 trace
7. `force-v1` 时，`complete` 可手工回退到 `v1-monolith`
8. 清空 `force-v1` 后，`complete` 能回到 `learning-service`
9. 读路径上游异常时，可自动 fallback 到 `v1-monolith`
10. 写路径上游异常时，不做自动网络 fallback，只返回 `502`
11. 写路径需要人工/路径级回退时，通过 `GATEWAY_FORCE_V1_PATHS` 回 `v1-monolith`

## 5. 切流与回退口径

### 5.1 打开 Week14 试点

1. `GATEWAY_ENABLE_LEARNING_SERVICE=true`
2. `GATEWAY_V2_TENANTS=<试点租户>`
3. 保持 `GATEWAY_ENABLE_V1_FALLBACK=true`

### 5.2 写路径人工回退

当学习完成链路需要回退时，使用：

```bash
GATEWAY_FORCE_V1_PATHS=/api/learning/courses
```

说明：

1. 这是路径级强制回 V1
2. 会覆盖学习 C 端路径前缀，包括 `complete`
3. 这是 Week14 对写路径的正式回退机制

### 5.3 自动 fallback 边界

1. 读路径允许自动 fallback
2. 写路径不允许自动网络 fallback
3. 原因：避免把 V2 写请求静默落回 V1，造成双写和语义漂移

## 6. 观测口径

### 6.1 gateway

检查入口：

1. `GET /internal/gateway/metrics`
2. `GET /internal/ops/overview`

必看字段：

1. `recentRequests[*].trace_id`
2. `recentRequests[*].target_service`
3. `recentRequests[*].gateway_mode`
4. `recentRequests[*].fallback_count`
5. `metrics.fallbackTotal`

### 6.2 points-service

检查入口：

1. `GET /internal/points-service/observability`

必看字段：

1. `recentLogs[*].route = INTERNAL learning->points reward settlement`
2. `recentLogs[*].trace_id`
3. `metrics.learningReward.success`

## 7. 验收通过标准

Week14 转绿要求：

1. `npm run test:smoke:week14-learning-complete` 通过
2. `npm run release-check:week14-learning-complete` 通过
3. `npm run gate:week14-learning-complete` 通过
4. `week11-gate` 在 Week14 gate 内继续通过
5. `complete + reward` 的 cutover、手工回退、观测链路都能复跑验证

## 8. 边界声明

1. 不扩 gateway 新业务能力
2. 不改 `user-service / points-service` 主写边界
3. Week14 正式纳入的是“学习完成 + 奖励结算的 runtime split 试点链路”
4. 这不回写 `Week13 Phase 1 = 查询 + 管理端 CRUD` 的历史口径
