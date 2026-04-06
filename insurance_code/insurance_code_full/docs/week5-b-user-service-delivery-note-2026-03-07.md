# Week5 B号交付说明（user-service）

更新时间：2026-03-07  
负责人：B 号  
状态：`READY_FOR_A_INTEGRATION`

## 1. 本次交付范围

本次只覆盖 `user-service` 负责边界：

1. `POST /api/auth/send-code`
2. `POST /api/auth/verify-basic`
3. `GET /api/me`

不包含：

1. 商城
2. 积分
3. 订单
4. 核销
5. gateway 主路由文件

## 2. 已完成内容

### 2.1 独立服务运行入口

已新增：

1. `server/microservices/user-service.mjs`
2. `server/microservices/user-service/app.mjs`

能力：

1. `user-service` 可独立启动
2. 支持单独指定 `HOST / PORT / STORAGE_BACKEND / DATABASE_URL / PGSSL`

默认端口：

1. `4101`

当前集成方式：

1. 已接入统一 `createMicroserviceRuntimeApp`
2. 可被 gateway 直接转发

### 2.2 user-service 内部路由收口

已收进 `server/microservices/user-service/`：

1. `auth.routes.mjs`
2. `me.routes.mjs`
3. `router.mjs`

说明：

1. `auth / me` 现在由 user-service 目录内的服务级路由提供
2. user-service 当前主写边界已明确为用户资料与会话边界

### 2.3 健康检查与就绪检查

已提供：

1. `GET /health`
2. `GET /ready`
3. `GET /internal/user-service/health`
4. `GET /internal/user-service/ready`

`/ready` 当前返回：

1. 服务名
2. 存储后端
3. 对外契约清单
4. 当前 user/session 载入数量

### 2.4 对外契约文档

已新增：

1. `server/microservices/user-service/contract.md`
2. `server/microservices/user-service/boundary.mjs`

当前固定兼容字段：

1. `verify-basic` 返回：
   1. `token`
   2. `csrfToken`
   3. `user`
2. `me` 返回：
   1. `user`
   2. `balance`
   3. `csrfToken`
3. `user` 字段保持：
   1. `id`
   2. `name`
   3. `mobile`
   4. `nick_name`
   5. `avatar_url`
   6. `is_verified_basic`
   7. `verified_at`

### 2.5 前端桥接层

已修改：

1. `src/lib/api.ts`

当前行为：

1. `sendCode / verifyBasic / me` 走 `VITE_USER_SERVICE_BASE`
2. 若未配置 `VITE_USER_SERVICE_BASE`，默认回落到 `VITE_API_BASE`
3. 未改业务页面语义

## 3. 主写边界

当前 B 号认领边界如下：

1. `app_users`（逻辑身份聚合） / runtime equivalent `state.users`
2. `c_customers` / runtime `state.users`
3. `p_sessions` / runtime `state.sessions`
4. 实名状态与用户基础资料同属 user-service 边界

说明：

1. points-service 不应直写上述边界
2. gateway 只做转发与透传，不承载用户写逻辑

### 3.1 user 域白名单

已固化：

1. route 白名单：
   1. `server/microservices/user-service/auth.routes.mjs`
   2. `server/microservices/user-service/me.routes.mjs`
2. usecase 白名单：
   1. `server/skeleton-c-v1/usecases/auth-write.usecase.mjs`
   2. `server/skeleton-c-v1/usecases/customer-assignment-write.usecase.mjs`
   3. `server/skeleton-c-v1/usecases/user-write.usecase.mjs`
3. repository 白名单：
   1. `server/skeleton-c-v1/repositories/auth-write.repository.mjs`
   2. `server/skeleton-c-v1/repositories/user-write.repository.mjs`

## 4. 运行方式

### 4.1 本地 file 存储启动

```bash
cd /Users/wenshuping/Documents/New\ project/insurance_code/insurance_code_full
STORAGE_BACKEND=dbjson API_USER_SERVICE_PORT=4101 node server/microservices/user-service.mjs
```

### 4.2 独立数据库模式

可选环境变量：

1. `API_HOST`
2. `API_USER_SERVICE_PORT`
3. `STORAGE_BACKEND`
4. `DATABASE_URL`
5. `PGSSL`

优先级：

1. 进程启动时显式传入的环境变量
2. 全局 `.env`

## 5. 已完成验证

### 5.1 契约 smoke

已新增并验证通过：

1. `scripts/smoke_user_service_contract.mjs`

覆盖：

1. `GET /health`
2. `GET /ready`
3. 未登录 `GET /api/me -> 401`
4. `POST /api/auth/send-code`
5. `POST /api/auth/verify-basic`
6. 登录后 `GET /api/me`

### 5.2 独立服务启动验证

已验证：

1. `STORAGE_BACKEND=dbjson API_USER_SERVICE_PORT=4101 node server/microservices/user-service.mjs`
2. `GET /health` 正常
3. `GET /ready` 正常
4. 未登录 `GET /api/me` 返回 `401 + UNAUTHORIZED`

### 5.3 与 points-service 鉴权兼容性验证

已验证 `user-service` 登录结果可直接被 `points-service` 复用：

1. `POST /api/auth/send-code -> 200`
2. `POST /api/auth/verify-basic -> 200`
3. `GET /api/points/summary -> 200`
4. `POST /api/sign-in -> 200`

当前固定约定：

1. 登录成功后返回 `token` 与 `csrfToken`
2. points-service 读接口使用 `Authorization: Bearer <token>`
3. points-service 写接口使用：
   1. `Authorization: Bearer <token>`
   2. `x-csrf-token: <csrfToken>`

说明：

1. 本轮无需新增 token 转换层
2. 本轮无需调整 session 头命名
3. C 号应继续沿用现有 Bearer + CSRF 约定

### 5.4 user 边界 guard 与 smoke

已新增并通过：

1. `node scripts/check_user_service_boundary_guard.mjs`
2. `node scripts/smoke_user_service_boundary.mjs`

覆盖：

1. `app_users / c_customers / p_sessions` 主写表声明
2. user 域 route/usecase/repository 白名单检查
3. gateway 与 points-service 不直写 user 主写表
4. `gateway -> user-service -> points-service` 全链路下 user/session 聚合不被 points 链路改写

## 6. 需要 A 号配合的事项

### 6.1 gateway 转发目标

A 号需要把以下路径转发到 `user-service`：

1. `POST /api/auth/send-code`
2. `POST /api/auth/verify-basic`
3. `GET /api/me`

建议 user-service 地址：

1. `http://127.0.0.1:4101`

### 6.2 前端联调环境变量

A 号联调时需要支持：

1. `VITE_USER_SERVICE_BASE`

建议值：

1. 直连 user-service 时：`http://127.0.0.1:4101`
2. 走 gateway 时：与 `VITE_API_BASE` 保持一致，由 gateway 转发

### 6.3 不要覆盖 B 号文件

A 号不应主改：

1. `server/microservices/user-service/`
2. `server/microservices/user-service.mjs`

## 7. 当前限制

1. 当前 user-service 仍复用现有 state/repository/usecase 实现，数据库尚未物理拆库。
2. 本轮已满足“运行时独立进程 + 服务边界收口 + 契约 smoke”目标，但未做 repository 白名单门禁。
3. `/api/bootstrap` 仍不在本次 B 号交付范围内。
4. `POST /api/p/customers/system-assign` 与 `POST /api/p/customers/assign-by-mobile` 对外接口保持不变，但内部写链路已收口到 user 域 usecase / repository。

## 8. 交付文件清单

1. `server/microservices/user-service.mjs`
2. `server/microservices/user-service/app.mjs`
3. `server/microservices/user-service/router.mjs`
4. `server/microservices/user-service/auth.routes.mjs`
5. `server/microservices/user-service/me.routes.mjs`
6. `server/microservices/user-service/contract.md`
7. `scripts/smoke_user_service_contract.mjs`
8. `src/lib/api.ts`
9. `server/microservices/user-service/boundary.mjs`
10. `scripts/check_user_service_boundary_guard.mjs`
11. `scripts/smoke_user_service_boundary.mjs`
12. `server/skeleton-c-v1/usecases/customer-assignment-write.usecase.mjs`
13. `server/skeleton-c-v1/repositories/user-write.repository.mjs`
14. `server/skeleton-c-v1/services/customer-assignment.service.mjs`
15. `server/skeleton-c-v1/routes/p-admin-workforce.routes.mjs`
