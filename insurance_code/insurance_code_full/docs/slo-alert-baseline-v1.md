# SLO 与告警基线（v1）

更新时间：2026-03-06  
状态：`ACTIVE`  
适用范围：P/B/C/API 一体化发布门禁（`release:preflight`）

## 1. 目标

1. 给出可执行的 3 个关键 SLI。
2. 在发布前自动判定阈值并产出可追溯报告。
3. 将失败直接转化为告警级别（`warning` / `critical`）。

## 2. 关键 SLI 与阈值

| SLI Key | 名称 | 口径公式 | 统计窗口 | 阈值 | 告警分级规则 |
| --- | --- | --- | --- | --- | --- |
| `api_uptime_24h` | API可用性（24h） | `success_24h / total_24h * 100%` | 近24小时 | `>= 99%` | `< 99%` warning；`< 98%` critical |
| `api_error_rate_1h` | API错误率（1h） | `fail_1h / total_1h * 100%` | 近1小时 | `<= 1%` | `> 1%` warning；`> 2%` critical |
| `api_perf_p95_ms` | 核心接口P95（ms） | `max(p95_ms(endpoint_i))` | 最新 perf 基线批次 | `<= 1200ms` | `> 1200ms` warning；`> 1500ms` critical |

## 3. 数据来源与表口径

1. `api_uptime_24h` / `api_error_rate_1h`
   1. 主来源：`metricHourlyCounters`
   2. 使用指标键：
      1. `api_total`
      2. `api_success`
      3. `api_fail`
   3. 回退来源（聚合为空时）：`auditLogs`（按 `result=success/fail`）
2. `api_perf_p95_ms`
   1. 来源：`docs/reports/perf-baseline-*.json`
   2. 字段：`endpointMetrics[].p95Ms`
   3. 聚合方式：取最大值作为门禁值（最差端点约束）

## 4. 执行命令

```bash
npm run slo:guard
```

产物：

1. `docs/reports/slo-guard-YYYYMMDD-HHMMSS.json`
2. `docs/reports/slo-guard-YYYYMMDD-HHMMSS.md`
3. `docs/reports/slo-guard-latest.json`
4. `docs/reports/slo-guard-latest.md`

## 5. 与 preflight 的关系

`release:preflight` 已内置执行 `slo:guard`，并以非 0 退出阻断发布流程。

执行顺序（核心节选）：

1. `test:smoke:api-core`
2. `test:perf:baseline`
3. `ci:gate:core:report`
4. `slo:guard`
5. 生成 `release-preflight-*` 与 `release-dashboard-latest.*`

## 6. 环境变量

可按环境覆盖阈值：

1. `SLO_API_UPTIME_MIN`（默认 `99`）
2. `SLO_API_ERROR_RATE_MAX`（默认 `1`）
3. `SLO_API_P95_MAX_MS`（默认 `1200`）
4. `SLO_GUARD_STRICT`（默认开启；设为 `0` 可只报不拦）

## 7. 失败处置

1. `api_uptime_24h` 失败：
   1. 核查 `auditLogs` 近24h `fail` 明细来源接口。
   2. 对比 `metricHourlyCounters` 聚合是否断档。
2. `api_error_rate_1h` 失败：
   1. 拉取最近1h 失败接口与错误码分布。
   2. 优先处理 5xx 与高频 4xx 配置错误。
3. `api_perf_p95_ms` 失败：
   1. 读取 `perf-baseline` 中最慢 endpoint。
   2. 对该接口执行 SQL 慢查询和序列化链路排查。
