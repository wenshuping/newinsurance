# Week8 User Service 上线前检查项

更新时间：2026-03-07
负责人：B 号

## 1. 发布范围确认

发布前先明确：

1. 本次不扩 `auth / me` 功能
2. 本次不改 `user-service` 对外契约
3. 本次不改 `Authorization + x-csrf-token` 约定
4. 本次只允许做上线保障、观测、文档、门禁接线类改动

## 2. 服务启动检查

1. `user-service` 可独立启动
2. `GET /health` 返回 `200`
3. `GET /ready` 返回 `200`
4. `GET /internal/user-service/observability` 可读

## 3. 契约检查

1. `POST /api/auth/send-code` 可用
2. `POST /api/auth/verify-basic` 可用
3. `GET /api/me` 可用
4. `verify-basic` 返回仍包含 `token`、`csrfToken`、`user`
5. `/api/me` 返回仍包含 `user`、`balance`、`csrfToken`
6. `/api/me` 未登录时仍返回 `401 + UNAUTHORIZED`

## 4. 观测检查

1. 日志字段存在：
   - `trace_id`
   - `request_id`
   - `user_id`
   - `tenant_id`
   - `route`
   - `result`
2. 观测指标存在：
   - 登录成功率/失败率
   - `/api/me` 4xx/5xx
   - token anomaly 统计
3. 结构化日志可按 `trace_id` 串联

## 5. 回归检查

按顺序跑：

```bash
node scripts/smoke_user_service_contract.mjs
node scripts/smoke_user_service_boundary.mjs
node scripts/smoke_user_service_week7_observability.mjs
npm run gate:week7-runtime-split
```

## 6. 联调检查

1. 走 gateway 登录成功
2. 走 gateway `GET /api/me` 成功
3. 登录后 token 能被 points-service 继续识别
4. `gateway -> user-service -> points-service` 全链路保持可用

## 7. 发布阻断条件

满足以下任一条件，不允许发布：

1. 任一 smoke 失败
2. `gate:week7-runtime-split` 失败
3. 日志字段缺失
4. `observability` 入口不可用
5. `/api/me` 的公开语义被改动
6. `Authorization + x-csrf-token` 协议被改动

## 8. 发布后 30 分钟观察项

1. `login.failureRate` 是否异常
2. `/api/me` 4xx 是否异常
3. `missingBearer` 是否异常
4. `invalidBearer` 是否异常
5. 是否出现 `USER_NOT_FOUND`
