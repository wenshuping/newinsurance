# Week8 User Service 故障排查手册

更新时间：2026-03-07
负责人：B 号
范围：`user-service`

## 1. 适用范围

本手册只用于 `user-service` 上线保障与运行排查，覆盖：

1. `POST /api/auth/send-code`
2. `POST /api/auth/verify-basic`
3. `GET /api/me`
4. `GET /health`
5. `GET /ready`
6. `GET /internal/user-service/observability`

约束：

1. 不扩 `auth / me` 业务语义
2. 不改对外契约
3. `/api/me` 对外 `401` 仍是 `UNAUTHORIZED`
4. `TOKEN_MISSING / TOKEN_INVALID / SESSION_NOT_FOUND / USER_NOT_FOUND` 只用于内部观测

## 2. 排查总顺序

出现故障时，统一按下面顺序查，不要跳步：

1. 先确认服务是否存活
2. 再确认 `user-service` 是否 ready
3. 再确认问题发生在 `send-code`、`verify-basic` 还是 `/api/me`
4. 再看 `GET /internal/user-service/observability`
5. 再按同一 `trace_id` 查结构化日志
6. 最后再判断是网关透传问题、前端桥接问题，还是 user-service 自身问题

## 3. 快速检查命令

### 3.1 直连 user-service

```bash
curl -s http://127.0.0.1:4101/health
curl -s http://127.0.0.1:4101/ready
curl -s http://127.0.0.1:4101/internal/user-service/observability
```

### 3.2 走 gateway

```bash
curl -i http://127.0.0.1:4100/api/me
```

重点看响应头：

1. `x-trace-id`
2. `x-request-id`
3. `x-service-name`
4. `x-gateway-mode`
5. `x-gateway-target-service`

## 4. 核心观测点

### 4.1 指标

看 `GET /internal/user-service/observability`：

1. `metrics.login.attempts`
2. `metrics.login.success`
3. `metrics.login.failure`
4. `metrics.login.successRate`
5. `metrics.login.failureRate`
6. `metrics.me.requests`
7. `metrics.me.clientError4xx`
8. `metrics.me.serverError5xx`
9. `metrics.tokenAnomalies.missingBearer`
10. `metrics.tokenAnomalies.invalidBearer`
11. `metrics.tokenAnomalies.sessionNotFound`
12. `metrics.tokenAnomalies.userNotFound`

### 4.2 日志

结构化日志统一看这些字段：

1. `trace_id`
2. `request_id`
3. `user_id`
4. `tenant_id`
5. `route`
6. `result`
7. `status`
8. `code`
9. `duration_ms`

### 4.3 错误码

常用错误码：

1. 登录前置：`INVALID_PARAMS`
2. 发送验证码：`SMS_LIMIT_REACHED`、`SEND_CODE_FAILED`
3. 登录校验：`CODE_NOT_FOUND`、`CODE_EXPIRED`、`TENANT_REQUIRED`、`VERIFY_BASIC_FAILED`
4. `/api/me` 对外：`UNAUTHORIZED`
5. `/api/me` 内部观测：`TOKEN_MISSING`、`TOKEN_INVALID`、`SESSION_NOT_FOUND`、`USER_NOT_FOUND`

## 5. 故障场景一：token 问题

### 5.1 常见表现

1. `GET /api/me` 返回 `401`
2. 前端声称“刚登录成功，立刻掉登录态”
3. `metrics.tokenAnomalies.missingBearer` 或 `invalidBearer` 异常升高

### 5.2 排查步骤

1. 确认请求头里是否有 `Authorization: Bearer <token>`
2. 确认响应头里是否有 `x-trace-id`
3. 去 `GET /internal/user-service/observability` 看最近错误统计
4. 按同一 `trace_id` 查 `user-service` 日志
5. 判断是以下哪类：
   - `TOKEN_MISSING`：前端没带 token，或 gateway 没透传
   - `TOKEN_INVALID`：token 不存在、过期、格式错、或 session 查不到
   - `USER_NOT_FOUND`：session 在，但 user 聚合异常

### 5.3 定位口径

1. 如果 `TOKEN_MISSING` 升高，先查前端桥接和 gateway
2. 如果 `TOKEN_INVALID` 升高，先查 session 数据和服务重启后的状态
3. 如果 `USER_NOT_FOUND` 升高，先查 user 主写边界是否被破坏

## 6. 故障场景二：session 丢失

### 6.1 常见表现

1. `verify-basic` 成功，但紧接着 `/api/me` 返回 `401`
2. 用户反馈“登录成功后刷新页面就掉线”
3. `ready.ownership.sessions` 突然下降，或登录成功与 `/api/me` 成功不一致

### 6.2 排查步骤

1. 先复现一条完整链路：
   - `POST /api/auth/send-code`
   - `POST /api/auth/verify-basic`
   - `GET /api/me`
2. 记录 `verify-basic` 返回的 `token`
3. 立即用该 token 直连 `user-service` 调 `GET /api/me`
4. 如果直连成功、走 gateway 失败，优先查 gateway 透传
5. 如果直连也失败，优先查 session 运行时状态、初始化、重启、存储后端
6. 对照 `/ready` 中的 `ownership.sessions`

### 6.3 判断原则

1. 登录成功但 `/api/me` 立刻失败，先看 session 是否落成功
2. 大量用户同时掉线，优先怀疑存储后端或服务重启
3. 单租户或单终端异常，优先怀疑桥接层或请求头丢失

## 7. 故障场景三：`/api/me` 401 激增

### 7.1 常见表现

1. `metrics.me.clientError4xx` 快速升高
2. `errors.stats` 中 `UNAUTHORIZED`、`TOKEN_MISSING`、`TOKEN_INVALID` 同时上涨
3. C 端“我的”页大量不可用

### 7.2 排查步骤

1. 看 `metrics.me.requests` 总量是否同时升高
2. 对比 `TOKEN_MISSING` 和 `TOKEN_INVALID` 哪个增幅更大
3. 看是否只发生在 gateway 路径
4. 看同一时间段 `verify-basic.successRate` 是否正常
5. 用新登录 token 直连 `user-service` 再调一次 `/api/me`

### 7.3 结论判断

1. `TOKEN_MISSING` 为主：请求头丢失，先查桥接层和 gateway
2. `TOKEN_INVALID` 为主：session 不可用，先查存储与服务状态
3. 登录成功率也下降：问题可能在 auth 链路，不只是 `/api/me`
4. 只有 gateway 异常：先查网关切流、fallback、头透传

## 8. 故障场景四：登录失败率异常

### 8.1 常见表现

1. `metrics.login.failureRate` 明显高于平时
2. `verify-basic` 大量返回 `400`
3. 用户反馈“验证码正确但登录不上”

### 8.2 排查步骤

1. 看 `metrics.login.attempts` 是否真的有量
2. 看 `errors.stats` 里失败主要集中在哪个 code
3. 重点区分：
   - `CODE_NOT_FOUND`
   - `CODE_EXPIRED`
   - `TENANT_REQUIRED`
   - `VERIFY_BASIC_FAILED`
   - `INVALID_PARAMS`
4. 再看 `send-code` 是否成功
5. 用固定测试号码跑一次手工链路

### 8.3 判断原则

1. `CODE_NOT_FOUND` 激增：验证码链路或测试方式有问题
2. `CODE_EXPIRED` 激增：用户操作慢，或验证码时效配置异常
3. `TENANT_REQUIRED` 激增：调用方没传租户上下文
4. `VERIFY_BASIC_FAILED` 激增：服务内部异常，优先看日志和变更

## 9. 升级条件

满足以下任一条件，直接升级给整合人或值班负责人：

1. `/health` 或 `/ready` 失败
2. `/api/me` 5xx 出现且持续
3. `login.failureRate` 持续异常且已影响真实用户
4. 无法判断是 gateway、front bridge、还是 user-service 自身问题
5. 怀疑 user 主写边界被破坏

## 10. 关联文档

1. `./week8-user-service-risk-register-2026-03-07.md`
2. `./week8-user-service-alerting-recommendations-2026-03-07.md`
3. `./week8-user-service-preflight-checklist-2026-03-07.md`
4. `./week7-runtime-split-runbook-2026-03-07.md`
5. `../server/microservices/user-service/OBSERVABILITY.md`
