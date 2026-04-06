# P-Admin 依赖装配治理（v1）

更新时间：2026-03-04
适用范围：`/server/skeleton-c-v1/routes/p-admin*.mjs`

## 1. 目标

防止 `p-admin.routes.mjs` 回退为“主入口堆叠业务依赖”的耦合形态，降低多人并行开发冲突。

## 2. 约束规则（必须遵守）

1. `p-admin.routes.mjs` 只允许导入：
   - 各域路由模块 `p-admin-<domain>.routes.mjs`
   - 依赖聚合工厂 `../server/skeleton-c-v1/routes/p-admin.deps.mjs`
2. `p-admin.routes.mjs` 必须通过 `buildPAdminRouteDeps()` 构建依赖对象。
3. 每个域路由注册必须使用 `deps.<domain>`，禁止内联对象字面量。
4. 共享能力新增时，先在 `p-admin.deps.mjs` 对应 `buildXxxDeps` 暴露，再在域路由消费。

## 3. 当前域映射

- `registerPAdminAuthRoutes(app, deps.auth)`
- `registerPAdminGovernanceRoutes(app, deps.governance)`
- `registerPAdminOpsRoutes(app, deps.ops)`
- `registerPAdminActivityRoutes(app, deps.activity)`
- `registerPAdminLearningRoutes(app, deps.learning)`
- `registerPAdminWorkforceRoutes(app, deps.workforce)`
- `registerPAdminMallRoutes(app, deps.mall)`
- `registerPAdminTagRoutes(app, deps.tags)`
- `registerPAdminMetricRoutes(app, deps.metrics)`
- `registerPAdminEventRoutes(app, deps.events)`

## 4. 自动校验

已接入脚本：`scripts/check_p_admin_wiring.mjs`

校验点：

1. 导入白名单
2. 必须存在 `buildPAdminRouteDeps()` 调用
3. 路由注册必须使用 `deps.<domain>`
4. 禁止内联依赖对象字面量

执行命令：

```bash
npm run lint:p-admin:wiring
```

在 `ci:gate:core` 中已作为硬门禁执行。
