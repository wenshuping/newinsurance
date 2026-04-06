# Week8 User Service 告警建议

更新时间：2026-03-07
负责人：B 号

## 1. 告警目标

`user-service` 的告警只覆盖上线保障最需要的 4 类问题：

1. 服务不可用
2. 登录异常
3. `/api/me` 异常
4. token / session 异常

## 2. 建议告警项

| 告警名 | 建议级别 | 触发条件 | 说明 | 第一查看项 |
|---|---|---|---|---|
| `user_service_health_failed` | P0 | `GET /health` 连续失败 | 进程或服务入口不可用 | 服务进程、端口、启动日志 |
| `user_service_ready_failed` | P0 | `GET /ready` 连续失败 | 服务活着但不 ready | 存储、依赖、runtime 初始化 |
| `user_service_login_failure_rate_high` | P1 | 5 分钟内 `login.failureRate > 0.30` 且 `attempts >= 20` | 登录异常 | `errors.stats` 中失败错误码分布 |
| `user_service_me_4xx_ratio_high` | P1 | 5 分钟内 `/api/me` 4xx 占比 > 0.20 且 `requests >= 30` | 登录态问题 | `TOKEN_MISSING` vs `TOKEN_INVALID` |
| `user_service_me_5xx_detected` | P0 | 任意窗口出现 `/api/me` 5xx 且持续 | 真实用户直接受影响 | 最近变更、`ME_TOUCH_FAILED`、日志 |
| `user_service_token_missing_spike` | P1 | 5 分钟内 `missingBearer` 明显高于基线 | 请求头丢失 | 前端桥接、gateway 透传 |
| `user_service_token_invalid_spike` | P1 | 5 分钟内 `invalidBearer` 明显高于基线 | session/token 问题 | session 状态、服务重启 |
| `user_service_user_not_found_detected` | P1 | `USER_NOT_FOUND` 连续出现 | user 聚合和 session 不一致 | user 主写边界、异常数据 |
| `user_service_observability_unavailable` | P1 | `/internal/user-service/observability` 连续失败 | 无法排查 | 观测路由和服务状态 |

## 3. 指标来源

建议从以下来源取数：

1. `GET /internal/user-service/observability`
2. 结构化日志中的 `route / result / code / trace_id / user_id / tenant_id`
3. `GET /ready`

## 4. 告警处置顺序

### 4.1 P0

1. 先确认是否需要切流或回退
2. 再确认是否是全量故障
3. 再组织服务恢复与根因定位

### 4.2 P1

1. 先查 `errors.stats`
2. 再查最近 10 到 20 条相关日志
3. 再按 `trace_id` 串联 gateway 与 user-service

## 5. 阈值说明

1. 比例类阈值必须带最小样本量，避免低流量误报
2. `missingBearer` 和 `invalidBearer` 要按历史基线调，不建议只写死绝对值
3. `/api/me` 5xx 建议零容忍
4. `USER_NOT_FOUND` 建议低阈值告警，因为它更像数据一致性问题，不应长期存在

## 6. 不建议直接告警的项

1. 单次 `CODE_NOT_FOUND`
2. 单次 `INVALID_PARAMS`
3. 低流量下的单次 `/api/me` 401

这些更适合做 dashboard 观察，不适合直接打人。
