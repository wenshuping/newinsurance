# Week9 User Service 部署基线

更新时间：2026-03-07
负责人：B 号
范围：`user-service`

## 1. 目标

Week9 的目标不是扩 `auth / me` 功能，而是把 `user-service` 从“可联调”推进到“可部署、可检查、可回退”。

本基线只覆盖：

1. `POST /api/auth/send-code`
2. `POST /api/auth/verify-basic`
3. `GET /api/me`
4. `GET /health`
5. `GET /ready`
6. `GET /metrics`
7. `GET /internal/user-service/observability`

## 2. 启动基线

### 2.1 独立启动

```bash
cd /Users/wenshuping/Documents/New\ project/insurance_code/insurance_code_full
API_USER_SERVICE_PORT=4101 API_HOST=127.0.0.1 STORAGE_BACKEND=postgres DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/insurance_code node server/microservices/user-service.mjs
```

### 2.2 依赖

`user-service` 自身依赖：

1. `Node + Express`
2. `Postgres`

`user-service` 不依赖：

1. `points-service` 业务启动
2. `gateway` 才能完成自身健康检查

说明：

1. `gateway` 联调是整体链路问题，不是 `user-service` 启动前置
2. Week9 部署基线要求 `user-service` 自己就能完成健康检查和 `/api/me` 自检

## 3. 环境变量基线

### 3.1 dev

推荐 2 种 dev 口径，只能二选一，不要混用：

1. 直连本机 Postgres
   - `STORAGE_BACKEND=postgres`
   - `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/insurance_code`
2. file/debug 模式
   - `STORAGE_BACKEND=file`

说明：

1. Week9 以 Postgres dev 为推荐基线，file 模式只保留给本地快速 smoke
2. `DEV_SMS_CODE` 只允许 dev 使用

### 3.2 staging

1. `STORAGE_BACKEND=postgres`
2. `DATABASE_URL=<staging postgres>`
3. `API_HOST=0.0.0.0`
4. `API_USER_SERVICE_PORT=4101`
5. `PGSSL=require` 或按托管库要求配置
6. `DEV_SMS_CODE` 不应开启

### 3.3 prod

1. `STORAGE_BACKEND=postgres`
2. `DATABASE_URL=<prod postgres>`
3. `API_HOST=0.0.0.0`
4. `API_USER_SERVICE_PORT=4101`
5. `PGSSL=require` 或按托管库要求配置
6. `DEV_SMS_CODE` 必须关闭
7. 仅保留生产需要的 `CORS_ORIGIN`

## 4. 当前发现的配置漂移

当前仓库内同时存在 3 套不同口径：

1. `.env`
   - `postgresql://insurance:insurance@127.0.0.1:5432/insurance_dev`
2. `.env.example` / `README.md`
   - `postgres://postgres:postgres@127.0.0.1:5432/insurance_code`
3. `docker-compose.dev.yml`
   - `postgresql://insurance:insurance@postgres:5432/insurance_dev`

当前本机实际可连通的是：

1. `postgres://postgres:postgres@127.0.0.1:5432/insurance_code`

结论：

1. Week9 必须先收口 dev/staging/prod 配置说明
2. 不能再让 `.env`、README、compose 各写一套不同答案

## 5. 健康检查基线

### 5.1 `GET /health`

用途：

1. 进程是否存活
2. HTTP 服务是否可响应

判定：

1. 返回 `200`
2. 响应体包含 `ok=true`
3. 响应体包含 `service=user-service`

### 5.2 `GET /ready`

用途：

1. Postgres 初始化是否完成
2. `user-service` owned routes 是否已挂载
3. 基础观测指标是否可读

判定：

1. 返回 `200`
2. `storage=postgres` 或当前期望存储后端
3. `ownedRoutes` 包含：
   - `POST /api/auth/send-code`
   - `POST /api/auth/verify-basic`
   - `GET /api/me`
4. `ownership.customerProfiles`、`ownership.sessions` 为可读数字

### 5.3 登录、`/api/me`、session 健康检查

最小健康链路：

1. `POST /api/auth/send-code`
2. `POST /api/auth/verify-basic`
3. 拿返回的 `token`
4. `GET /api/me`

通过条件：

1. `send-code=200`
2. `verify-basic=200`
3. 返回 `token`、`csrfToken`、`user`
4. `GET /api/me=200`
5. 返回 `user`、`balance`、`csrfToken`

## 6. 部署后检查项

部署后至少复跑：

```bash
node scripts/smoke_user_service_contract.mjs
node scripts/smoke_user_service_week7_observability.mjs
```

如果是整体链路发布，再跑：

```bash
npm run gate:week8-runtime-split
```

## 7. 当前 Week9 结论

1. `user-service` 已具备独立启动入口
2. 已具备 `/health`、`/ready`、`/metrics`、`/internal/user-service/observability`
3. 已具备登录、`/api/me`、session 级别健康检查链路
4. 当前最大的 Week9 风险不是代码，而是环境变量口径漂移

## 8. 关联文档

1. `./week10-user-service-postgres-validation-report-2026-03-07.md`
2. `./week11-user-service-gray-metrics-thresholds-2026-03-07.md`
3. `../server/microservices/user-service/contract.md`
4. `../server/microservices/user-service/OBSERVABILITY.md`
