# SLO Guard Report

- Time: 2026-03-06T10:02:41.473Z
- Result: **PASS**
- Data Backend: dbjson
- Perf Source: docs/reports/perf-baseline-20260306-180230.json

## SLI Results

| Key | Name | Value | Target | Status | Note |
|---|---|---:|---|---|---|
| api_uptime_24h | API可用性（24h） | 99.3324% | >= 99% | PASS | 来源 metricHourlyCounters(api_total/api_success)，无聚合时回退 auditLogs |
| api_error_rate_1h | API错误率（1h） | 0% | <= 1% | PASS | 来源 metricHourlyCounters(api_total/api_fail)，无聚合时回退 auditLogs |
| api_perf_p95_ms | 核心接口P95（ms） | 24.6ms | <= 1200ms | PASS | 来源 /Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/docs/reports/perf-baseline-20260306-180230.json 的 endpointMetrics.p95Ms |

## Alert Events

- none

