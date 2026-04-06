# Week7 Gateway 运行指标说明

更新时间：2026-03-07

## 1. 指标目标

Week7 先提供最小可执行指标，不接外部监控系统，先保证：

1. 本地可看
2. smoke 可校验
3. gateway 能作为统一运维入口聚合 user/points 状态

## 2. gateway 指标入口

### 2.1 直接看 gateway

1. `GET /metrics`
2. `GET /internal/gateway/metrics`

两者返回相同内容。

### 2.2 统一运维总览

1. `GET /internal/ops/overview`

返回：

1. gateway 自身指标
2. upstream health
3. user-service observability 快照
4. points-service observability 快照

## 3. 指标字段

`/internal/gateway/metrics` 当前输出：

1. `requestTotal`
   - gateway 已处理请求总数
2. `errorTotal`
   - `status >= 400` 的请求数
3. `errorRate`
   - `errorTotal / requestTotal`
4. `avgLatencyMs`
   - 平均耗时
5. `maxLatencyMs`
   - 当前窗口最大耗时
6. `inFlight`
   - 正在处理中的请求数
7. `fallbackTotal`
   - `V2 -> V1` 回退累计次数
8. `statusBuckets`
   - `2xx / 3xx / 4xx / 5xx / other`
9. `recentRequests`
   - 最近请求窗口，包含：
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

## 4. upstream 聚合规则

`/internal/ops/overview` 中 upstream 统一来自：

1. health：
   1. `v1-monolith -> /api/health`
   2. `user-service -> /health`
   3. `points-service -> /health`
2. observability：
   1. `user-service -> /internal/user-service/observability`
   2. `points-service -> /internal/points-service/observability`

## 5. 排障顺序

### 5.1 先看 gateway

1. `GET /health`
2. `GET /ready`
3. `GET /internal/gateway/routes`
4. `GET /internal/gateway/metrics`

### 5.2 再看 upstream

1. `GET /internal/ops/overview`
2. 看 `upstreams.health`
3. 看 `upstreams.observability`
4. 用同一个 `trace_id` 去 user/points 的 recent logs 追请求

## 6. Week7 smoke 覆盖

1. trace 头透传
2. `x-service-name` 统一返回
3. gateway -> user-service 日志链路命中
4. gateway -> points-service 日志链路命中
5. `internal/ops/overview` 可用
6. fallback 次数可观测

执行：

```bash
npm run test:smoke:gateway:week7-observability
```
