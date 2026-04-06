# Week7 Trace / Log 规范

更新时间：2026-03-07

## 1. 目标

Week7 开始，`gateway-service -> user-service -> points-service` 统一使用同一条请求链路标识，便于：

1. 跨服务排查单个请求
2. 统一 smoke / gate 验证
3. 后续接 Prometheus / Sentry / ELK 时保持口径稳定

## 2. 请求头约定

### 2.1 入口头

客户端可传：

1. `x-trace-id`
2. `x-request-id`

解析规则：

1. 优先使用 `x-trace-id` 作为链路标识
2. 若无 `x-trace-id`，则使用 `x-request-id`
3. 若两者都没有，则由首个接入服务生成

### 2.2 透传规则

`gateway-service` 向下游统一透传：

1. `x-trace-id`
2. `x-request-id`
3. `x-service-name=api-gateway`
4. `x-gateway-mode`
5. `x-gateway-target-service`

`user-service` / `points-service` 读取上游 `x-trace-id`，不重置链路标识。

## 3. 响应头约定

三服务统一返回：

1. `x-trace-id`
2. `x-request-id`
3. `x-service-name`

gateway 额外返回：

1. `x-gateway-mode`
2. `x-gateway-target-service`

说明：

1. `x-trace-id`：用于跨服务串联日志和 metrics
2. `x-request-id`：当前请求标识。当前实现默认与 `x-trace-id` 同值，后续可独立拆分
3. `x-service-name`：最终返回该响应的服务名；网关出口统一固定为 `api-gateway`

## 4. 日志字段

### 4.1 gateway

每次请求输出结构化日志，核心字段：

1. `trace_id`
2. `request_id`
3. `method`
4. `path`
5. `status_code`
6. `duration_ms`
7. `gateway_mode`
8. `target_service`
9. `fallback_count`
10. `fallback_reasons`

### 4.2 user-service

当前核心字段：

1. `trace_id`
2. `request_id`
3. `user_id`
4. `tenant_id`
5. `route`
6. `result`

### 4.3 points-service

当前核心字段：

1. `trace_id`
2. `request_id`
3. `user_id`
4. `order_id`
5. `redemption_id`
6. `route`
7. `result`

## 5. fallback 链路规则

当 `gateway-service` 从 `V2` 回退到 `V1 monolith` 时：

1. 保留原始 `x-trace-id`
2. 保留原始 `x-request-id`
3. 更新响应头：
   1. `x-gateway-mode=v1`
   2. `x-gateway-target-service=v1-monolith`
4. gateway metrics 中 `fallbackTotal` 增加
5. gateway recent request 中 `fallback_count >= 1`

## 6. 当前运维入口

1. `GET /internal/gateway/metrics`
2. `GET /internal/ops/overview`
3. `GET /internal/user-service/observability`
4. `GET /internal/points-service/observability`

## 7. 验证入口

```bash
npm run test:smoke:user-service:week7-observability
npm run test:smoke:gateway:week7-observability
npm run gate:week7-runtime-split
```
