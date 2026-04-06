# Week11 User Service 灰度告警判断口径

更新时间：2026-03-08
负责人：B 号
范围：`user-service`

## 1. 目标

这份文档只定义 Week11 灰度期间 `user-service` 的告警判断口径，不新增业务指标，不改 `auth / me` 契约。

本文件解决 4 件事：

1. 哪些指标该告警
2. 何时告警
3. 告警级别如何分
4. 先看什么，再决定是否回退

## 2. 统一判断原则

1. 先按灰度租户或灰度路径看，不先看全量
2. 比例类指标必须带最小样本量
3. 单次异常不直接打 P0，持续窗口才升级
4. `userNotFound` 这类一致性异常优先级高于普通 401
5. 告警是给演练和灰度决策用，不是替代根因分析

## 3. 指标来源

1. `GET /internal/user-service/observability`
2. `GET /ready`
3. `user-service` 结构化日志

灰度期间重点使用：

1. `metrics.login.attempts`
2. `metrics.login.success`
3. `metrics.login.failure`
4. `metrics.me.requests`
5. `metrics.tokenAnomalies.missingBearer`
6. `metrics.tokenAnomalies.invalidBearer`
7. `metrics.tokenAnomalies.sessionNotFound`
8. `metrics.tokenAnomalies.userNotFound`
9. `errors.stats.UNAUTHORIZED`

## 4. 告警分级

### 4.1 P0

满足任一条件，直接触发回退评估：

1. `/ready` 失败
2. `/api/me` 5xx 持续出现
3. `userNotFound > 0` 且连续 2 个观察窗口存在
4. `loginSuccessRate < 0.90` 且 `attempts >= 20`
5. `me401Rate > 0.20` 且 `requests >= 30`

### 4.2 P1

满足任一条件，暂停放量并人工确认：

1. `0.90 <= loginSuccessRate < 0.95` 且 `attempts >= 20`
2. `0.10 < me401Rate <= 0.20` 且 `requests >= 30`
3. `invalidBearer / me.requests > 0.05` 且 `requests >= 30`
4. `missingBearer` 高于稳定基线 2 倍以上
5. `sessionNotFound` 连续出现

### 4.3 P2

只做观察，不直接回退：

1. `CODE_NOT_FOUND` 单窗口升高，但 `loginSuccessRate` 仍正常
2. `INVALID_PARAMS` 单窗口升高，但无真实用户影响
3. `TOKEN_MISSING` 偶发升高，但未形成连续窗口

## 5. 关键公式

### 5.1 login success rate

```text
loginSuccessRate = metrics.login.success / metrics.login.attempts
```

### 5.2 `/api/me` 401 rate

```text
me401Rate = UNAUTHORIZED.count / metrics.me.requests
```

说明：

1. 不能直接拿 `clientError4xx / requests` 代替 401 rate
2. 灰度判断必须优先用 `UNAUTHORIZED.count`

### 5.3 token/session 异常率

```text
missingBearerRate = metrics.tokenAnomalies.missingBearer / metrics.me.requests
invalidBearerRate = metrics.tokenAnomalies.invalidBearer / metrics.me.requests
userNotFoundRate = metrics.tokenAnomalies.userNotFound / metrics.me.requests
```

## 6. 告警后的第一排查动作

### 6.1 login success 异常

1. 先看 `errors.stats`
2. 再区分 `CODE_NOT_FOUND / CODE_EXPIRED / TENANT_REQUIRED / VERIFY_BASIC_FAILED`
3. 再判断是租户问题、参数问题、还是服务内部异常

### 6.2 `/api/me` 401 异常

1. 先看 `UNAUTHORIZED.count`
2. 再比对 `missingBearer` 和 `invalidBearer`
3. `missingBearer` 为主时，优先查 gateway 和前端桥接
4. `invalidBearer` 为主时，优先查 session 与 Postgres 运行状态

### 6.3 `userNotFound` 出现

1. 不继续放量
2. 先看同一 `trace_id` 的 `verify-basic -> /api/me`
3. 再查 `c_customers / p_sessions` 的一致性

## 7. 灰度演练时的窗口建议

建议用统一窗口，不要每个人各看各的：

1. 观察窗口：5 分钟
2. 升级条件：连续 2 个窗口异常
3. 放量前置：至少 1 个窗口稳定
4. 发布后前 5 分钟允许启动噪音，不直接按 P1/P0 判断

## 8. Week11 结论

1. `user-service` 已具备告警判断所需数据源
2. 现在缺的不是指标，而是统一按灰度窗口解释这些指标
3. B 号建议 A 号的灰度演练直接复用这份判断口径，不要另起一套

## 9. 关联文档

1. `./week11-user-service-gray-metrics-thresholds-2026-03-07.md`
2. `./week11-user-service-gray-observation-conclusion-2026-03-08.md`
3. `../server/microservices/user-service/OBSERVABILITY.md`
