# Week11 User Service 灰度指标与阈值

更新时间：2026-03-08
负责人：B 号
范围：`user-service`

## 1. 目标

Week11 对 `user-service` 只做灰度观测口径，不改功能，不改 `auth / me` 契约。

本文件只回答 3 件事：

1. 灰度看哪些指标
2. 指标怎么计算
3. 到什么阈值应该继续、暂停或回退

## 2. 指标来源

优先来源：

1. `GET /internal/user-service/observability`
2. `GET /ready`
3. `user-service` 结构化日志

核心字段：

1. `trace_id`
2. `request_id`
3. `user_id`
4. `tenant_id`
5. `route`
6. `result`
7. `status`
8. `code`

## 3. 指标定义

### 3.1 login success rate

来源：

1. `metrics.login.success`
2. `metrics.login.attempts`

公式：

1. `loginSuccessRate = success / attempts`

口径：

1. 只看 `POST /api/auth/verify-basic`
2. 样本量不足时不做回退判定

### 3.2 `/api/me` 401 rate

来源：

1. `metrics.me.requests`
2. `errors.stats` 中 `UNAUTHORIZED`

公式：

1. `me401Rate = UNAUTHORIZED.count / metrics.me.requests`

说明：

1. 当前 `/internal/user-service/observability` 直接暴露的是 `/api/me` 4xx 计数
2. 灰度阶段需要 `401 rate` 时，应以 `UNAUTHORIZED.count` 为准，不要拿全部 4xx 粗算

### 3.3 token / session 异常

来源：

1. `metrics.tokenAnomalies.missingBearer`
2. `metrics.tokenAnomalies.invalidBearer`
3. `metrics.tokenAnomalies.sessionNotFound`
4. `metrics.tokenAnomalies.userNotFound`

解读：

1. `missingBearer`：调用方没带 token 或透传丢失
2. `invalidBearer`：token/session 无效
3. `sessionNotFound`：为预留分类，当前实现中不应长期非零
4. `userNotFound`：session 和 user 聚合不一致，优先级最高

## 4. 灰度阈值建议

### 4.1 放量前置条件

至少满足：

1. `attempts >= 20`
2. `metrics.me.requests >= 30`
3. `/health` 与 `/ready` 持续成功

### 4.2 继续放量

满足以下条件可继续放量：

1. `loginSuccessRate >= 0.95`
2. `me401Rate <= 0.10`
3. `invalidBearer / me.requests <= 0.05`
4. `userNotFound = 0`

### 4.3 暂停观察

满足任一条件，暂停继续放量：

1. `0.90 <= loginSuccessRate < 0.95`
2. `0.10 < me401Rate <= 0.20`
3. `0.05 < invalidBearer / me.requests <= 0.10`
4. `missingBearer` 突然高于最近稳定基线 2 倍以上

### 4.4 触发回退

满足任一条件，直接触发回退评估：

1. `loginSuccessRate < 0.90`
2. `me401Rate > 0.20`
3. `invalidBearer / me.requests > 0.10`
4. `userNotFound > 0` 且持续出现
5. `/api/me` 5xx 出现并持续
6. `/ready` 失败

## 5. 灰度时的诊断优先级

### 5.1 login success 下降

先看：

1. `CODE_NOT_FOUND`
2. `CODE_EXPIRED`
3. `TENANT_REQUIRED`
4. `VERIFY_BASIC_FAILED`

### 5.2 `/api/me` 401 升高

先看：

1. `missingBearer`
2. `invalidBearer`
3. `UNAUTHORIZED`

结论口径：

1. `missingBearer` 为主，优先查 gateway 和前端桥接
2. `invalidBearer` 为主，优先查 session 和 Postgres 运行状态

### 5.3 `userNotFound`

处理原则：

1. 不继续放量
2. 直接当成 user 聚合一致性问题处理
3. 必须由 user 域先定位

## 6. 灰度看板最少展示项

1. `login.attempts`
2. `login.success`
3. `login.failure`
4. `loginSuccessRate`
5. `me.requests`
6. `UNAUTHORIZED.count`
7. `me401Rate`
8. `missingBearer`
9. `invalidBearer`
10. `userNotFound`

## 7. Week11 结论

1. `user-service` 现有可观测性已足够支持 login、`/api/me`、token/session 三类灰度判定
2. 真正要补的不是新指标，而是把现有指标按灰度阈值收成统一判定口径
3. `/api/me 401 rate` 必须按 `UNAUTHORIZED.count / me.requests` 计算，不能直接拿全部 4xx 代替

## 8. 关联文档

1. `./week9-user-service-deployment-baseline-2026-03-07.md`
2. `./week10-user-service-postgres-validation-report-2026-03-07.md`
3. `./week11-user-service-gray-alert-caliber-2026-03-08.md`
4. `./week11-user-service-gray-observation-conclusion-2026-03-08.md`
5. `../server/microservices/user-service/OBSERVABILITY.md`
