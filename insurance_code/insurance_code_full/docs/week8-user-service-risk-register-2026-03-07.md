# Week8 User Service 风险清单

更新时间：2026-03-07
负责人：B 号

## 1. 使用方式

这份风险清单用于上线评审、值班交接、故障复盘。每个风险项都要能回答 4 件事：

1. 风险是什么
2. 会影响什么
3. 先看什么信号
4. 第一责任排查动作是什么

## 2. 风险项

| 风险项 | 影响 | 首要信号 | 第一排查动作 |
|---|---|---|---|
| `Authorization` 未透传或被覆盖 | `/api/me` 401 激增，C 端“我的”页不可用 | `TOKEN_MISSING` 上升 | 先核对 gateway 和前端桥接请求头 |
| session 丢失或重启后状态不一致 | 登录成功后立刻掉线 | `TOKEN_INVALID` 上升，`sessions` 计数异常 | 先看 `/ready` 和存储后端 |
| user 聚合与 session 不一致 | `/api/me` 401，且登录链路看似正常 | `USER_NOT_FOUND` 上升 | 先排查 user 主写边界和异常变更 |
| 登录失败率突增 | 大量用户无法登录 | `login.failureRate` 上升 | 先看失败错误码分布 |
| `/api/me` 5xx 或退化逻辑异常 | “我的”页直接报错或隐性数据不一致 | `me.serverError5xx` 上升 | 先查 `ME_TOUCH_FAILED` 和最近变更 |
| tenant 上下文缺失 | 某租户登录失败或登录后数据异常 | `TENANT_REQUIRED` 上升 | 先查调用方是否传 `tenantId` |
| 观测入口不可用 | 故障发生时无法快速定位 | `/internal/user-service/observability` 不可访问 | 先恢复观测入口，不直接盲改业务 |
| 日志字段不完整 | 无法按请求串联问题 | 日志缺 `trace_id` 或 `route` | 先阻断发布，恢复统一日志字段 |

## 3. 风险优先级

### P0

1. `/health` 或 `/ready` 不可用
2. `/api/me` 出现持续性 5xx
3. 登录成功后大面积掉 session

### P1

1. `/api/me` 401 激增
2. 登录失败率异常
3. `Authorization` 透传异常

### P2

1. 单租户 `TENANT_REQUIRED` 升高
2. 个别 `USER_NOT_FOUND`
3. 观测字段偶发缺失

## 4. 风险处置原则

1. 先判断是否是全量影响还是局部影响
2. 先看观测数据，再决定是否回退
3. 能通过切流或回退止血时，优先止血
4. 未定位前，不修改 `auth / me` 对外契约
5. 未评估前，不把 user 域问题转成 points 或 gateway 改动
