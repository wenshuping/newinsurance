# B-Admin 依赖装配治理（v1）

更新时间：2026-03-04  
适用范围：`/server/skeleton-c-v1/routes/b-admin*.mjs`

## 1. 目标

避免 `b-admin.routes.mjs` 继续直接耦合底层模块（`access-control/state/service`），统一通过 deps 工厂注入，降低后续拆分风险。

## 2. 当前实现

1. 新增工厂：`server/skeleton-c-v1/routes/b-admin.deps.mjs`
2. `registerBAdminRoutes` 签名调整为：
   - `registerBAdminRoutes(app, customDeps = {})`
3. 路由内依赖来源统一为：
   - `const deps = { ...buildBAdminRouteDeps(), ...customDeps }`

## 3. 强制约束

`b-admin.routes.mjs` 禁止直接导入：

- `../server/skeleton-c-v1/common/access-control.mjs`
- `../server/skeleton-c-v1/common/state.mjs`
- `../server/skeleton-c-v1/services/commerce.service.mjs`

上述依赖必须仅由 `b-admin.deps.mjs` 暴露并注入。

## 4. 自动校验

脚本：`scripts/check_b_admin_wiring.mjs`  
工厂 smoke：`scripts/b_admin_deps_factory_smoke.mjs`

执行命令：

```bash
npm run test:smoke:b-admin-deps
npm run lint:b-admin:wiring
```

两者均已接入 `ci:gate:core`。

## 6. 分域冒烟（新增）

脚本：`scripts/b_admin_module_smoke.mjs`

覆盖域：

- `auth`（登录）
- `customers`（列表/画像/打标签）
- `tags`（标签库/自定义标签）
- `content`（内容列表）
- `activity`（活动配置列表）
- `mall`（商品/活动列表）
- `orders`（订单列表）

已并入 `scripts/smoke_api_core_suite.mjs`，在 `ci:gate:core` 中作为硬门禁执行。

## 5. 路由分层现状（2026-03-04）

已从单文件拆分为：

- `b-admin-auth.routes.mjs`
- `b-admin-customers.routes.mjs`
- `b-admin-content.routes.mjs`
- `b-admin-activity.routes.mjs`
- `b-admin-mall.routes.mjs`
- `b-admin-orders.routes.mjs`
- `b-admin.shared.mjs`（跨模块纯函数）

`b-admin.routes.mjs` 仅做装配，不承载业务路由实现。
