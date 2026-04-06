# C-App 路由装配治理（v1）

更新时间：2026-03-04  
适用范围：`/server/skeleton-c-v1/routes/c-app.routes.mjs`

## 1. 目标

统一 C 端路由注册入口，明确模块边界，并通过静态守卫 + 模块冒烟保证装配不回退。

## 2. 当前实现

1. C 端路由装配入口：`server/skeleton-c-v1/routes/c-app.routes.mjs`
2. 装配范围（固定 10 个模块）：
   - `health/auth/user/activities/points/mall/redemptions/orders/learning/insurance`
3. `server/skeleton-c-v1/app.mjs` 只通过：
   - `registerCAppRoutes(app)` 挂载 C 端接口

## 3. 自动校验

脚本：`scripts/check_c_app_wiring.mjs`

检查项：

- import 白名单（仅允许 10 个 C 端 route 模块）
- 注册完整性（10 个 `register*Routes(app)`）
- 导出签名（`registerCAppRoutes(app)`）

执行命令：

```bash
npm run lint:c-app:wiring
```

## 4. 模块冒烟

脚本：`scripts/c_app_module_smoke.mjs`

覆盖：

- 匿名接口：`/api/health`、`/api/bootstrap`
- 登录链路：`/api/auth/send-code` + `/api/auth/verify-basic`
- 登录后核心读取：`/api/me`、`/api/activities`、`/api/points/*`、`/api/mall/*`、`/api/orders`、`/api/redemptions`、`/api/learning/*`、`/api/insurance/overview`

执行命令：

```bash
npm run test:smoke:c-app-modules
```

该冒烟已并入：`scripts/smoke_api_core_suite.mjs`（步骤 `c_app_modules`）。

## 5. CI 门禁

`ci:gate:core` 已接入：

- `npm run lint:c-app:wiring`
- `npm run test:smoke:api-core`（含 `c_app_modules`）
