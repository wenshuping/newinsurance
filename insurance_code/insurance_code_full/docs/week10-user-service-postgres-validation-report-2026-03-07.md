# Week10 User Service Postgres 实库验证报告

更新时间：2026-03-07
负责人：B 号
范围：`user-service`

## 1. 验证目标

Week10 只验证 `user-service` 在 Postgres 模式下是否满足以下要求：

1. `auth / me` 可用
2. `c_customers` 可读写
3. `p_sessions` 可读写
4. `app_users` 的逻辑聚合口径明确
5. 现有 observability 不因实库切换失效

## 2. 验证环境

本次实际验证使用：

1. `STORAGE_BACKEND=postgres`
2. `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/insurance_code`

说明：

1. 该连接可实际连通
2. 当前 `.env` 中的 `postgresql://insurance:insurance@127.0.0.1:5432/insurance_dev` 在本机验证失败，属于配置漂移，不计入“验证通过”

## 3. 表级验证结果

### 3.1 物理表存在性

实查结果：

1. `c_customers`：存在
2. `p_sessions`：存在
3. `app_users`：不存在独立物理表

结论：

1. `app_users` 当前仍是逻辑身份聚合，不是独立 Postgres 物理表
2. Week10 对 `app_users` 的验证口径应写成“逻辑聚合已保持由 user-service 主写”，不能误写成“实库独立表已验证”

### 3.2 当前计数

实查结果：

1. `c_customers = 62`
2. `p_sessions = 104`

## 4. 运行验证结果

### 4.1 `initializeState()`

验证结果：

1. 通过

说明：

1. 单独执行 `initializeState()` 成功
2. 说明当前 Postgres schema 在单进程初始化下可正常加载

### 4.2 `user-service` contract smoke

命令：

```bash
DATABASE_URL='postgres://postgres:postgres@127.0.0.1:5432/insurance_code' STORAGE_BACKEND=postgres node scripts/smoke_user_service_contract.mjs
```

结果：

1. 通过

覆盖：

1. `/health`
2. `/ready`
3. 未登录 `/api/me = 401`
4. `send-code`
5. `verify-basic`
6. 登录后 `/api/me = 200`

### 4.3 `user-service` observability smoke

命令：

```bash
DATABASE_URL='postgres://postgres:postgres@127.0.0.1:5432/insurance_code' STORAGE_BACKEND=postgres node scripts/smoke_user_service_week7_observability.mjs
```

结果：

1. 通过

覆盖：

1. 登录成功/失败计数
2. `/api/me` 4xx/5xx
3. `TOKEN_MISSING`
4. `TOKEN_INVALID`
5. `trace_id / request_id / user_id / tenant_id / route / result`

### 4.4 boundary smoke

命令：

```bash
DATABASE_URL='postgres://postgres:postgres@127.0.0.1:5432/insurance_code' STORAGE_BACKEND=postgres node scripts/smoke_user_service_boundary.mjs
```

结果：

1. 单独运行通过

观察：

1. 在和其他 Postgres smoke 并发时，出现过一次 `gateway -> user-service /api/auth/verify-basic = 502 upstream unavailable`
2. 单独运行时通过

结论：

1. 当前更像 shared runtime 在 Postgres 模式下的启动窗口问题
2. 不能直接定性为 `user-service` 业务逻辑缺陷
3. 这条应计入 Week9-Week11 的联调/灰度风险

## 5. 风险与阻塞

### 5.1 已确认风险

1. 本地 `.env` 与实际可连通 Postgres 口径不一致
2. `app_users` 不是独立物理表，实库验收必须写清“逻辑聚合”口径
3. Postgres 模式下整体 runtime 并发 smoke 的启动窗口比 file 模式更窄

### 5.2 当前阻塞

1. 没有统一的 dev/staging/prod `DATABASE_URL` 权威来源
2. 还没有把 Postgres 模式单独纳入 user-service 常规 smoke 编排

## 6. Week10 结论

1. `user-service` 在 Postgres 实库下可完成 `auth / me` 核心链路验证
2. `c_customers`、`p_sessions` 已完成实库存在性和计数验证
3. `app_users` 当前只能按逻辑聚合验收，不能按物理表验收
4. Week10 可判定为“user-service 实库可运行”，但带 2 条前置提醒：
   - 先统一配置口径
   - Postgres 模式下的 shared runtime 启动节奏要单独看

## 7. 验证命令

```bash
DATABASE_URL='postgres://postgres:postgres@127.0.0.1:5432/insurance_code' STORAGE_BACKEND=postgres node --input-type=module -e "import { initializeState, closeState } from './server/skeleton-c-v1/common/state.mjs'; try { await initializeState(); console.log(JSON.stringify({ok:true})); } finally { await closeState().catch(()=>undefined); }"

DATABASE_URL='postgres://postgres:postgres@127.0.0.1:5432/insurance_code' STORAGE_BACKEND=postgres node scripts/smoke_user_service_contract.mjs

DATABASE_URL='postgres://postgres:postgres@127.0.0.1:5432/insurance_code' STORAGE_BACKEND=postgres node scripts/smoke_user_service_week7_observability.mjs

DATABASE_URL='postgres://postgres:postgres@127.0.0.1:5432/insurance_code' STORAGE_BACKEND=postgres node scripts/smoke_user_service_boundary.mjs
```
