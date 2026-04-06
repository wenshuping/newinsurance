# Week7 Runtime Split Runbook

更新时间：2026-03-07

## 1. 执行目标

Week7 只做统一可观测性入口收口：

1. gateway -> user-service -> points-service 统一 `trace_id`
2. 统一响应头链路标识
3. 暴露 gateway 基础运行指标
4. 统一 Week7 gate 入口

## 2. 统一执行入口

### 2.1 本地

```bash
cd /Users/wenshuping/Documents/New\ project/insurance_code/insurance_code_full
npm run gate:week7-runtime-split
```

### 2.2 CI

```bash
npm run ci:gate:week7-runtime-split
```

## 3. Week7 gate 包含内容

1. `gate_week6_runtime_split.mjs`
   - Week6 边界门禁
   - Week6 总 smoke
2. `smoke_user_service_week7_observability.mjs`
   - user-service trace / headers / observability 校验
3. `smoke_gateway_week7_observability.mjs`
   - gateway -> user-service -> points-service trace 校验
   - gateway metrics 校验
   - fallback 指标校验

## 4. 关键环境变量

### 4.1 gateway

1. `GATEWAY_V1_BASE_URL`
2. `GATEWAY_USER_SERVICE_URL`
3. `GATEWAY_POINTS_SERVICE_URL`
4. `GATEWAY_ENABLE_V2`
5. `GATEWAY_FORCE_V1`
6. `GATEWAY_ENABLE_V1_FALLBACK`
7. `GATEWAY_FORCE_V1_PATHS`
8. `GATEWAY_FORCE_V2_PATHS`
9. `GATEWAY_V2_TENANTS`

### 4.2 前端桥接

1. `VITE_API_BASE`
2. `VITE_USER_SERVICE_BASE`
3. `VITE_POINTS_SERVICE_BASE`

### 4.3 运行时

1. `API_GATEWAY_PORT`
2. `API_USER_SERVICE_PORT`
3. `API_POINTS_SERVICE_PORT`
4. `STORAGE_BACKEND`

## 5. 标准排障路径

### 5.1 gateway 起不来

1. 看 `GET /health`
2. 看 `GET /ready`
3. 看 `GET /internal/gateway/routes`

### 5.2 链路不通

1. 先看响应头：
   1. `x-trace-id`
   2. `x-request-id`
   3. `x-service-name`
   4. `x-gateway-mode`
   5. `x-gateway-target-service`
2. 再看 `GET /internal/ops/overview`
3. 对照相同 `trace_id` 去查：
   1. `GET /internal/user-service/observability`
   2. `GET /internal/points-service/observability`

### 5.3 fallback 异常

1. 查 `GET /internal/gateway/metrics`
2. 重点看：
   1. `fallbackTotal`
   2. `recentRequests[].fallback_count`
   3. `recentRequests[].fallback_reasons`
3. 再确认当前切流变量：
   1. `GATEWAY_ENABLE_V2`
   2. `GATEWAY_FORCE_V1`
   3. `GATEWAY_ENABLE_V1_FALLBACK`

## 6. Week7 收口标准

满足以下条件即可视为 Week7 当前范围收口：

1. `npm run gate:week7-runtime-split` 通过
2. 三服务响应头统一带链路标识
3. gateway metrics 可读
4. fallback 次数可观测
5. `internal/ops/overview` 可用

## 7. 关联文档

1. `./week7-trace-log-spec-2026-03-07.md`
2. `./week7-gateway-metrics-2026-03-07.md`
3. `./week6-runtime-split-runbook-2026-03-07.md`
4. `./week6-write-ownership-matrix-2026-03-07.md`
