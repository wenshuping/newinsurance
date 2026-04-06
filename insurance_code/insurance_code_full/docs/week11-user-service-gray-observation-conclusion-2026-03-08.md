# Week11 User Service 灰度演练观测结论

更新时间：2026-03-08
负责人：B 号
范围：`user-service`

## 1. 结论

从 B 号负责的 `user-service` 视角看，当前已经具备 Week11 灰度演练所需的 user 域观测能力。

本次结论是：

1. `login success rate` 可观测
2. `/api/me 401 rate` 可按 `UNAUTHORIZED.count / me.requests` 计算
3. `missingBearer / invalidBearer / userNotFound` 可观测
4. `trace_id / request_id / user_id / tenant_id / route / result` 可用于链路核对

## 2. 本次核对输入

本次核对基于以下事实：

1. `user-service` observability endpoint 已存在
2. Postgres 模式下 `user-service` contract smoke 通过
3. Postgres 模式下 `user-service` observability smoke 通过
4. Postgres 模式下 `user-service` boundary smoke 单独运行通过

## 3. 核对结果

### 3.1 user 域指标可用性

已确认可直接提供给灰度演练的指标：

1. `metrics.login.attempts`
2. `metrics.login.success`
3. `metrics.login.failure`
4. `metrics.me.requests`
5. `metrics.me.clientError4xx`
6. `metrics.me.serverError5xx`
7. `metrics.tokenAnomalies.missingBearer`
8. `metrics.tokenAnomalies.invalidBearer`
9. `metrics.tokenAnomalies.sessionNotFound`
10. `metrics.tokenAnomalies.userNotFound`
11. `errors.stats.UNAUTHORIZED`

### 3.2 user 域日志核对能力

已确认可用于灰度演练串联的字段：

1. `trace_id`
2. `request_id`
3. `user_id`
4. `tenant_id`
5. `route`
6. `result`
7. `status`
8. `code`

### 3.3 实库侧辅助结论

本机实库核对结果：

1. `c_customers = 62`
2. `p_sessions = 104`
3. `app_users` 当前仍按逻辑聚合验收，不是独立物理表

## 4. 本次观察到的风险

### 4.1 已确认可接受

1. `user-service` 单独启动与自检链路正常
2. `auth / me` 语义未变化
3. user 域指标口径足够支撑灰度判断

### 4.2 需要带入演练的提醒

1. Postgres 模式下 shared runtime 的启动窗口比 file 模式更窄
2. 并发跑多个 Postgres smoke 时，出现过一次 `gateway -> user-service /api/auth/verify-basic = 502 upstream unavailable`
3. 单独运行 `user-service` boundary smoke 时该问题未复现

当前判断：

1. 这更像 shared runtime 启动节奏问题
2. 暂不定性为 user 域业务缺陷
3. 灰度演练时如果再出现同类 `502`，应先按启动窗口问题处理，再决定是否升级为 user 域异常

## 5. 给 A 号的对接口径

灰度演练期间，如需 B 号核 user 域，只看这 4 类：

1. `loginSuccessRate`
2. `me401Rate`
3. `missingBearer / invalidBearer`
4. `userNotFound`

判断顺序：

1. 先看 `UNAUTHORIZED.count`
2. 再看 `missingBearer` 还是 `invalidBearer`
3. 再按同一 `trace_id` 对齐 gateway 与 user-service

## 6. B 号结论

1. `user-service` 已具备 Week11 灰度指标支撑能力
2. 现阶段不需要扩 `auth / me` 新功能
3. 灰度期间若 user 域指标异常，可直接按：
   - `week11-user-service-gray-metrics-thresholds-2026-03-07.md`
   - `week11-user-service-gray-alert-caliber-2026-03-08.md`
   这两份文档判定
