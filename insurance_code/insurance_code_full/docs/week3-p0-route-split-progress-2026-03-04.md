# Week3 P0 路由拆分进展（2026-03-04）

状态：`DONE`（Week3-Week4 收口范围已完成，后续见 `docs/architecture-status-closeout-2026-03-06.md`）

## 1. 本次目标

1. 继续收敛 `p-admin.routes.mjs`，移除剩余内联路由。
2. 保持行为不变，全部通过现有冒烟回归。

## 2. 本次改动

1. 新增模块：`server/skeleton-c-v1/routes/p-admin-auth.routes.mjs`
   - 承接 `POST /api/p/auth/login`
2. 主入口改造：`server/skeleton-c-v1/routes/p-admin.routes.mjs`
   - 删除内联登录路由实现
   - 改为 `registerPAdminAuthRoutes(app, deps)` 模块注册
3. 共享函数抽离：`server/skeleton-c-v1/routes/p-admin.shared.mjs`
   - 将 `metrics/tags/events/governance` 相关常量与纯函数统一迁出
   - `p-admin.routes.mjs` 仅保留依赖注入与模块装配
   - 主入口文件行数从 `2050` 降到 `170`
4. 新增共享函数回归脚本：`scripts/p_admin_shared_unit_smoke.mjs`
   - 校验 `buildTagJobCustomerMetrics` 的“30天按天去重”口径
   - 校验 `computeMetricCards` 的 `sys_api_uptime` 使用“近24小时”窗口
   - 已并入 `ci:gate:core`
5. 共享模块按域拆分（结构层）
   - 新增：`server/skeleton-c-v1/routes/p-admin-metrics.shared.mjs`
   - 新增：`server/skeleton-c-v1/routes/p-admin-tags.shared.mjs`
   - 新增：`server/skeleton-c-v1/routes/p-admin-events.shared.mjs`
   - `p-admin.routes.mjs` 已改为按域导入，避免主入口继续膨胀
6. 共享模块按域拆分（实现层）
   - `p-admin.shared.mjs` 仅保留治理/权限相关公共函数（70行）
   - 指标实现迁移到 `p-admin-metrics.shared.mjs`（1301行）
   - 标签实现迁移到 `p-admin-tags.shared.mjs`（471行）
   - 事件实现迁移到 `p-admin-events.shared.mjs`（228行）
7. Seed 函数 ID 分配修正
   - `ensureTagSeeds/ensureMetricRuleSeeds/ensureEventDefinitionSeeds` 支持显式传入 `nextIdFn`
   - `p-admin-tags.routes.mjs` 在调用 `ensureTagSeeds` 时已传入 `nextId`
8. 跨域残留清理
   - 删除 `p-admin-metrics.shared.mjs` 中不再使用的 `METRIC_CARD_SEEDS`
   - 删除 `p-admin-metrics.shared.mjs` 中误迁入的事件常量（`EVENT_DEFINITION_SEEDS`、`EVENT_SCHEMA_TEMPLATES`）
   - 保持 tags/events/metrics 三个模块职责单一
9. shared 冒烟覆盖增强
   - `scripts/p_admin_shared_unit_smoke.mjs` 新增：
     - `tag_seed_idempotent`：校验 `ensureTagSeeds` 首次写入、二次幂等、规则目标标签存在
     - `event_seed_schema_backfill`：校验 `ensureEventDefinitionSeeds` 的系统事件补齐、1004 采集方式与 schema 口径回填
     - `metric_seed_idempotent_and_dedupe`：校验 `ensureMetricRuleSeeds` 的历史字段归一、同端同名去重、二次执行不重复写入
10. 依赖注入清理与隐患修复
   - 修复 `p-admin.routes.mjs` 中 `ensureTagSeeds` 的缺失导入（避免进程重启后出现运行时 `ReferenceError`）
   - 删除 `p-admin.shared.mjs` 未被消费的 `ensureCompanyAdminPagePermissions` 死代码
11. GET 配置接口自动补种子（与原行为对齐）
   - `p-admin.routes.mjs` 注入：
     - `ensureMetricRuleSeeds` -> `registerPAdminMetricRoutes`
     - `ensureEventDefinitionSeeds` -> `registerPAdminEventRoutes`
   - `GET /api/p/metrics/config`：
     - 进入读取前执行 `ensureMetricRuleSeeds(state, tenantId, nextId)`
     - 有补种子时执行 `persistState()`
   - `GET /api/p/events/definitions`：
     - 进入读取前执行 `ensureEventDefinitionSeeds(state, tenantId, nextId)`
     - 有补种子时执行 `persistState()`
12. 增加路由级回归：首次访问 GET 自动补种子
   - `scripts/p_admin_module_smoke.mjs` 新增临时租户用例：
     - 创建临时租户（平台管理员）
     - 临时租户管理员首次访问 `GET /api/p/metrics/config`，断言 `seededRules > 0`
     - 临时租户管理员首次访问 `GET /api/p/events/definitions`，断言 `seededEvents > 0` 且包含系统事件 `eventId=1001`
     - 结束后删除临时租户，避免污染测试环境
   - 该用例已进入 `test:smoke:api-core -> p_admin_modules` 链路，作为发布前硬门禁的一部分
13. 主入口 deps 装配按域工厂化
   - 新增：`server/skeleton-c-v1/routes/p-admin.deps.mjs`
   - 提供 `buildPAdminRouteDeps()`，统一装配：
     - `auth/governance/ops/activity/learning/workforce/mall/tags/metrics/events`
   - `server/skeleton-c-v1/routes/p-admin.routes.mjs` 仅保留：
     - 路由模块导入
     - `const deps = buildPAdminRouteDeps()`
     - 各域 `register...Routes(app, deps.xxx)` 调用
   - 收益：主入口冲突面显著降低，跨域依赖改动集中在单一工厂文件
14. deps 工厂继续细分 + 工厂层 smoke
   - `p-admin.deps.mjs` 新增细粒度工厂：
     - `buildAuthDeps/buildGovernanceDeps/buildOpsDeps/buildActivityDeps/buildLearningDeps/buildWorkforceDeps/buildMallDeps/buildTagDeps/buildMetricDeps/buildEventDeps`
   - 保留 `buildPAdminRouteDeps()` 作为聚合入口，向后兼容现有注册逻辑
   - 新增 `scripts/p_admin_deps_factory_smoke.mjs`：
     - 校验每个工厂输出的关键依赖项（函数/常量）完整
     - 校验聚合工厂含全部域
   - `package.json`：
     - 新增 `test:smoke:p-admin-deps`
     - `ci:gate:core` 已接入该 smoke
15. 加入“路由必须走 deps 工厂”的静态守卫
   - 新增文档：`docs/p-admin-deps-wiring-governance-v1.md`
   - 新增脚本：`scripts/check_p_admin_wiring.mjs`
     - 校验 `p-admin.routes.mjs` 导入白名单（仅 route 模块 + `p-admin.deps.mjs`）
     - 校验存在 `buildPAdminRouteDeps()` 调用
     - 校验每个 route 注册均使用 `deps.<domain>`
     - 禁止 inline deps 字面量
   - `package.json`：
     - 新增 `lint:p-admin:wiring`
     - `ci:gate:core` 已接入该校验
   - `docs/INDEX.md` 已加入治理文档索引
16. 同步落地 B-Admin 依赖工厂与守卫
   - 新增：`server/skeleton-c-v1/routes/b-admin.deps.mjs`
   - `registerBAdminRoutes` 改为：
     - `registerBAdminRoutes(app, customDeps = {})`
     - `const deps = { ...buildBAdminRouteDeps(), ...customDeps }`
   - 新增：`scripts/b_admin_deps_factory_smoke.mjs`
   - 新增：`scripts/check_b_admin_wiring.mjs`
   - 新增文档：`docs/b-admin-deps-wiring-governance-v1.md`
   - `ci:gate:core` 已接入：
     - `test:smoke:b-admin-deps`
     - `lint:b-admin:wiring`
17. B-Admin 路由按域拆分（Week3 P1）
   - 新增共享工具：`server/skeleton-c-v1/routes/b-admin.shared.mjs`
   - 新增域模块：
     - `server/skeleton-c-v1/routes/b-admin-auth.routes.mjs`
     - `server/skeleton-c-v1/routes/b-admin-customers.routes.mjs`
     - `server/skeleton-c-v1/routes/b-admin-content.routes.mjs`
     - `server/skeleton-c-v1/routes/b-admin-activity.routes.mjs`
     - `server/skeleton-c-v1/routes/b-admin-mall.routes.mjs`
     - `server/skeleton-c-v1/routes/b-admin-orders.routes.mjs`
   - `server/skeleton-c-v1/routes/b-admin.routes.mjs` 现仅做装配，不再承载业务实现
18. B-Admin 分域冒烟接入
   - 新增：`scripts/b_admin_module_smoke.mjs`
   - 新增 npm 脚本：`test:smoke:b-admin-modules`
   - `scripts/smoke_api_core_suite.mjs` 已接入步骤 `b_admin_modules`
   - 覆盖域：`auth/customers/tags/content/activity/mall/orders`
19. B-Admin 装配守卫增强（升级）
   - `scripts/check_b_admin_wiring.mjs` 新增：
     - 导入白名单
     - 模块注册完整性（6 个 `registerBAdmin*Routes`）
20. 门禁文档快照同步
   - 因新增 B 端模块路由，重生成：
     - `docs/error-code-endpoint-matrix-v1.md`
21. C-App 路由装配治理补齐
   - 新增：`scripts/check_c_app_wiring.mjs`
     - `c-app.routes.mjs` import 白名单校验
     - C 端 10 个模块注册完整性校验
   - 新增：`scripts/c_app_module_smoke.mjs`
     - 覆盖匿名访问、登录链路和 C 端核心读取接口
   - 新增 npm 脚本：
     - `lint:c-app:wiring`
     - `test:smoke:c-app-modules`
22. C-App 门禁接入核心链路
   - `scripts/smoke_api_core_suite.mjs` 新增 `c_app_modules`
   - `ci:gate:core` 新增 `lint:c-app:wiring`
   - 新增文档：`docs/c-app-wiring-governance-v1.md`
   - `docs/INDEX.md` 已补索引
23. 三端前端契约桥接治理（C/B/P）
   - 新增：`scripts/check_frontend_contract_bridge.mjs`
     - 校验 C/B/P 三个工程均通过桥接层接入 `@contracts/template-status` 与 `@contracts/error-ui`
     - 禁止业务页面直接引用 `@contracts/template-status`
     - 限制 `@contracts/error-ui` 仅允许 `src/lib/ui-error.ts` 与 `src/lib/api.ts`
   - 新增 npm 脚本：`lint:frontend:contract-bridge`
   - `ci:gate:core` 已接入该门禁
   - 新增文档：`docs/frontend-contract-bridge-governance-v1.md`
24. 状态下拉选项统一（shared-contracts -> P 端）
   - `shared-contracts/template-status.ts` 新增：
     - `TENANT_STATUS_OPTIONS`
     - `ENABLED_STATUS_OPTIONS`
   - `insurance_code_P/src/lib/templateStatus.ts` 已桥接导出上述常量
   - `insurance_code_P/src/App.tsx` 两处状态下拉改为 options 常量渲染
25. 状态下拉防回退门禁
   - 新增：`scripts/check_frontend_status_options_bridge.mjs`
   - 新增 npm 脚本：`lint:frontend:status-options-bridge`
   - `ci:gate:core` 已接入该检查
   - 新增文档：`docs/frontend-status-options-governance-v1.md`
26. B 端状态筛选选项统一（shared-contracts）
   - `shared-contracts/template-status.ts` 新增：
     - `CONTENT_STATUS_FILTER_OPTIONS`
     - `RUNNING_STATUS_FILTER_OPTIONS`
   - `insurance_code_B/src/lib/templateStatus.ts` 已桥接导出
   - `insurance_code_B/src/App.tsx` 不再本地拼接“全部 + 状态选项”
27. B 端状态筛选防回退门禁
   - 新增：`scripts/check_b_status_filter_options_bridge.mjs`
   - 新增 npm 脚本：`lint:b-frontend:status-filter-options-bridge`
   - `ci:gate:core` 已接入该检查
   - 新增文档：`docs/b-frontend-status-filter-options-governance-v1.md`
28. P 端下拉选项统一（事件/角色）
   - 新增：`shared-contracts/select-options.ts`
     - `EVENT_TYPE_OPTIONS`
     - `EVENT_COLLECT_METHOD_OPTIONS`
     - `EMPLOYEE_ROLE_OPTIONS`
   - `shared-contracts/index.ts` 已导出 `select-options`
   - 新增桥接：`insurance_code_P/src/lib/selectOptions.ts`
   - `insurance_code_P/src/App.tsx` 已替换硬编码选项
29. P 端下拉选项防回退门禁
   - 新增：`scripts/check_p_select_options_bridge.mjs`
   - 新增 npm 脚本：`lint:p-frontend:select-options-bridge`
   - `ci:gate:core` 已接入
   - 新增文档：`docs/p-frontend-select-options-governance-v1.md`
30. P 端指标统计周期选项统一（shared-contracts）
   - `shared-contracts/select-options.ts` 新增：`METRIC_PERIOD_OPTIONS`
   - `insurance_code_P/src/lib/selectOptions.ts` 已桥接导出
   - `insurance_code_P/src/App.tsx` 已移除本地 `METRIC_PERIOD_OPTIONS` 硬编码，改为桥接常量
31. P 端指标周期防回退门禁
   - 新增：`scripts/check_p_metric_period_options_bridge.mjs`
   - 新增 npm 脚本：`lint:p-frontend:metric-period-options-bridge`
   - `ci:gate:core` 已接入该检查
32. P 端积分活动类型选项统一（shared-contracts）
   - `shared-contracts/select-options.ts` 新增：`ACTIVITY_TYPE_OPTIONS`
   - `insurance_code_P/src/lib/selectOptions.ts` 已桥接导出
   - `insurance_code_P/src/App.tsx` 积分商城活动编辑页改为 `ACTIVITY_TYPE_OPTIONS.map(...)` 渲染
   - `scripts/check_p_select_options_bridge.mjs` 已升级校验，禁止回退硬编码 `task/competition/invite`
33. P 端指标所属端选项统一（shared-contracts）
   - `shared-contracts/select-options.ts` 新增：`METRIC_END_OPTIONS`
   - `insurance_code_P/src/lib/selectOptions.ts` 已桥接导出
   - `insurance_code_P/src/App.tsx` 指标配置页改为 `METRIC_END_OPTIONS.map(...)` 渲染
   - 新增：`scripts/check_p_metric_end_options_bridge.mjs`
   - 新增 npm 脚本：`lint:p-frontend:metric-end-options-bridge`
   - `ci:gate:core` 已接入该检查
34. P 端员工角色文案映射统一（shared-contracts）
   - `shared-contracts/select-options.ts` 新增：`employeeRoleLabel`
   - `insurance_code_P/src/lib/selectOptions.ts` 已桥接导出
   - `insurance_code_P/src/App.tsx` 员工管理页已移除本地三元映射，改用 `employeeRoleLabel(row.role)`
   - `scripts/check_p_select_options_bridge.mjs` 已升级校验，禁止回退本地角色文案三元表达式
35. P 端事件管理文案/样式映射统一（shared-contracts）
   - `shared-contracts/select-options.ts` 新增：
     - `eventTypeLabel`
     - `eventTypePillClass`
     - `eventCollectMethodLabel`
   - `insurance_code_P/src/lib/selectOptions.ts` 已桥接导出
   - `insurance_code_P/src/App.tsx` 事件定义列表已移除本地 `typeLabel/typePill/methodLabel`，改用共享函数
   - `scripts/check_p_select_options_bridge.mjs` 已升级校验，禁止回退本地事件映射函数
36. P 端状态筛选类型口径统一（shared-contracts）
   - `insurance_code_P/src/lib/templateStatus.ts` 已桥接导出：
     - `OnlineStatusFilter`
     - `EnabledStatusFilter`
     - `TagStatusFilter`
   - `insurance_code_P/src/App.tsx` 已将 3 处本地联合类型替换为上述共享类型
   - `scripts/check_frontend_status_options_bridge.mjs` 已升级校验，要求状态筛选 state 使用共享 filter type
37. B 端状态筛选类型口径统一（shared-contracts）
   - `shared-contracts/template-status.ts` 新增：`ContentRunningStatusFilter`
   - `insurance_code_B/src/lib/templateStatus.ts` 已桥接导出该类型
   - `insurance_code_B/src/App.tsx` 已移除本地 `StatusFilter` 联合类型，改为 `useState<ContentRunningStatusFilter>('all')`
   - `scripts/check_b_status_filter_options_bridge.mjs` 已升级校验，禁止回退本地联合类型
38. B 端分享链路类型口径统一（shared-contracts）
   - `shared-contracts/b-share.ts` 新增：
     - `BToolKind`
     - `BSharePath`
   - `shared-contracts/index.ts` 已导出 `b-share`
   - `insurance_code_B/src/lib/shareTypes.ts` 新增桥接导出
   - `insurance_code_B/src/App.tsx` 已移除本地 `ToolKind/SharePath`，改用共享桥接类型
   - 新增：`scripts/check_b_share_types_bridge.mjs`
   - 新增 npm 脚本：`lint:b-frontend:share-types-bridge`
   - `ci:gate:core` 已接入该检查
39. B 端分享标题文案映射统一（shared-contracts）
   - `shared-contracts/b-share.ts` 新增：`bToolKindShareLabel`
   - `insurance_code_B/src/lib/shareTypes.ts` 已桥接导出该函数
   - `insurance_code_B/src/App.tsx` 分享逻辑已移除本地三元文案，改为 `bToolKindShareLabel(kind)`
   - `scripts/check_b_share_types_bridge.mjs` 已升级校验，禁止回退本地分享文案三元表达式
40. B 端详情弹窗映射统一（shared-contracts）
   - `shared-contracts/b-share.ts` 新增：
     - `bToolKindDetailTitle`
     - `bToolKindShareButtonLabel`
     - `bToolKindDetailSharePath`
   - `insurance_code_B/src/lib/shareTypes.ts` 已桥接导出上述函数
   - `insurance_code_B/src/App.tsx` 详情弹窗中本地三元映射已移除，改为共享函数
   - `scripts/check_b_share_types_bridge.mjs` 已升级校验，禁止回退本地详情/分享映射三元表达式
41. B 端分享埋点事件名统一（shared-contracts）
   - `shared-contracts/b-share.ts` 新增：`B_SHARE_TRACK_EVENTS`
   - `insurance_code_B/src/lib/shareTypes.ts` 已桥接导出该常量
   - `insurance_code_B/src/App.tsx` 分享埋点已移除硬编码事件名，改用 `B_SHARE_TRACK_EVENTS.*`
   - `scripts/check_b_share_types_bridge.mjs` 已升级校验，禁止回退硬编码分享事件名
42. B 端分享契约语义 smoke（非静态校验）
   - 新增：`scripts/smoke_b_share_contracts.ts`
   - 新增 npm 脚本：`test:smoke:b-share-contracts`
   - `ci:gate:core` 已接入该脚本，校验：
     - `bToolKindShareLabel`
     - `bToolKindDetailTitle`
     - `bToolKindShareButtonLabel`
     - `bToolKindDetailSharePath`
     - `B_SHARE_TRACK_EVENTS`
43. 状态契约语义 smoke（template-status）
   - 新增：`scripts/smoke_template_status_contracts.ts`
   - 新增 npm 脚本：`test:smoke:template-status-contracts`
   - `ci:gate:core` 已接入该脚本，校验：
     - `toOnlineStatus/toRunningStatus/toLearningStatus`
     - `normalizeEnabledStatus/normalizeTagStatus/normalizeTenantStatus`
     - `runningListStatusLabel`
     - `ONLINE/RUNNING/CONTENT/ENABLED/TAG/TENANT` 状态选项存在性
44. P 端活动状态映射去本地化（shared-contracts）
   - `shared-contracts/template-status.ts` 新增：`toActivityOnlineStatus(status, canComplete)`
   - `insurance_code_P/src/lib/templateStatus.ts` 已桥接导出
   - `insurance_code_P/src/App.tsx` 已移除本地 `normalizeActivityStatus`，统一改为 `toActivityOnlineStatus(...)`
45. B 端活动配置写路径下沉（router -> usecase -> repository）
   - 新增：`server/skeleton-c-v1/repositories/b-activity-config-write.repository.mjs`
   - 新增：`server/skeleton-c-v1/usecases/b-activity-config-write.usecase.mjs`
   - 新增 DTO：`toCreateBActivityConfigCommand`、`toUpdateBActivityConfigCommand`
   - `server/skeleton-c-v1/routes/b-admin-activity.routes.mjs` 已移除直写 `state.activities/state.pActivities`，改为 usecase 调用与错误码映射
   - 回归通过：`npm run typecheck`、`npm run test:smoke:api-core`
46. B 端积分商城配置写路径下沉（router -> usecase -> repository）
   - 新增：`server/skeleton-c-v1/repositories/b-mall-config-write.repository.mjs`
   - 新增：`server/skeleton-c-v1/usecases/b-mall-config-write.usecase.mjs`
   - 新增 DTO：
     - `toCreateBMallProductCommand`
     - `toUpdateBMallProductCommand`
     - `toCreateBMallActivityCommand`
     - `toUpdateBMallActivityCommand`
   - `server/skeleton-c-v1/routes/b-admin-mall.routes.mjs` 已移除 4 个写接口的直写 state，实现统一 usecase 错误码映射
   - 回归通过：`npm run typecheck`、`npm run test:smoke:api-core`
47. P 端团队管理写路径下沉（router -> usecase -> repository）
   - 新增：`server/skeleton-c-v1/repositories/p-workforce-team-write.repository.mjs`
   - 新增：`server/skeleton-c-v1/usecases/p-workforce-team-write.usecase.mjs`
   - 新增 DTO：
     - `toCreatePTeamCommand`
     - `toUpdatePTeamCommand`
     - `toDeletePTeamCommand`
   - `server/skeleton-c-v1/routes/p-admin-workforce.routes.mjs` 的 `POST/PUT/DELETE /api/p/teams` 已移除直写 `state.teams`
   - 保持原错误口径（`TEAM_*`、`COMPANY_ACCOUNT_REQUIRED`、`TENANT_CONTEXT_REQUIRED`）与 HTTP 状态一致
   - 回归通过：`npm run typecheck`、`npm run test:smoke:api-core`
48. P 端员工管理写路径下沉（router -> usecase -> repository）
   - 新增：`server/skeleton-c-v1/repositories/p-workforce-employee-write.repository.mjs`
   - 新增：`server/skeleton-c-v1/usecases/p-workforce-employee-write.usecase.mjs`
   - 新增 DTO：
     - `toCreatePEmployeeCommand`
     - `toUpdatePEmployeeCommand`
     - `toDeletePEmployeeCommand`
   - `server/skeleton-c-v1/routes/p-admin-workforce.routes.mjs` 的 `POST/PUT/DELETE /api/p/employees` 已移除直写 `state.agents/state.userRoles`
   - 保持原错误口径（`EMPLOYEE_*`、`COMPANY_ACCOUNT_REQUIRED`、`TENANT_CONTEXT_REQUIRED`）与 HTTP 状态一致
   - 回归通过：`npm run typecheck`、`npm run test:smoke:api-core`
49. P 端治理租户写路径下沉（router -> usecase -> repository）
   - 新增：`server/skeleton-c-v1/repositories/p-governance-tenant-write.repository.mjs`
   - 新增：`server/skeleton-c-v1/usecases/p-governance-tenant-write.usecase.mjs`
   - 新增 DTO：
     - `toCreateTenantCommand`
     - `toUpdateTenantCommand`
     - `toDeleteTenantCommand`
   - `server/skeleton-c-v1/routes/p-admin-governance.routes.mjs` 的 `POST/PUT/DELETE /api/p/tenants` 已移除直写 `state.tenants/orgUnits/teams/agents/userRoles`
   - 保持原错误口径（`TENANT_*`、`ADMIN_EMAIL_*`、`NO_PERMISSION`）与 HTTP 状态一致
   - 当前删除行为保持原样：只删除 `tenants` 行，不做级联（行为等价）
   - 回归通过：`npm run typecheck`、`npm run test:smoke:api-core`
50. P 端治理审批写路径下沉（router -> usecase -> repository）
   - 新增：`server/skeleton-c-v1/repositories/p-governance-approval-write.repository.mjs`
   - 新增：`server/skeleton-c-v1/usecases/p-governance-approval-write.usecase.mjs`
   - 新增 DTO：
     - `toCreateApprovalCommand`
     - `toApproveApprovalCommand`
   - `server/skeleton-c-v1/routes/p-admin-governance.routes.mjs` 的
     - `POST /api/p/approvals`
     - `POST /api/p/approvals/:id/approve`
     已移除直写 `state.approvals`
   - 保持原错误口径（`APPROVAL_NOT_FOUND`）与 HTTP 状态一致
   - 回归通过：`npm run typecheck`、`npm run test:smoke:api-core`
51. P 端治理公司页权限写路径下沉（router -> usecase -> repository）
   - 新增：`server/skeleton-c-v1/repositories/p-governance-company-admin-pages-write.repository.mjs`
   - 新增：`server/skeleton-c-v1/usecases/p-governance-company-admin-pages-write.usecase.mjs`
   - 新增 DTO：`toUpdateCompanyAdminPagesCommand`
   - `server/skeleton-c-v1/routes/p-admin-governance.routes.mjs` 的
     - `POST /api/p/permissions/company-admin-pages`
     已移除直写 `state.companyAdminPagePermissions`
   - 保持原错误口径（`TENANT_CONTEXT_REQUIRED`、`NO_PERMISSION`、`PERMISSION_GRANTS_REQUIRED`）与 HTTP 状态一致
   - 回归通过：`npm run typecheck`、`npm run test:smoke:api-core`
52. P 端事件定义写路径下沉（router -> usecase -> repository）
   - 新增：`server/skeleton-c-v1/repositories/p-event-definition-write.repository.mjs`
   - 新增：`server/skeleton-c-v1/usecases/p-event-definition-write.usecase.mjs`
   - 新增 DTO：
     - `toSaveEventDefinitionCommand`
     - `toUpdateEventDefinitionStatusCommand`
     - `toDeleteEventDefinitionCommand`
   - `server/skeleton-c-v1/routes/p-admin-events.routes.mjs` 的
     - `POST /api/p/events/definitions`
     - `POST /api/p/events/definitions/:id/status`
     - `DELETE /api/p/events/definitions/:id`
     已移除直写 `state.eventDefinitions`
   - 保持原错误口径（`EVENT_ID_REQUIRED`、`EVENT_NAME_REQUIRED`、`EVENT_ID_CONFLICT`、`EVENT_NOT_FOUND`、`SYSTEM_EVENT_CANNOT_DELETE`）与 HTTP 状态一致
   - 回归通过：`npm run typecheck`、`npm run test:smoke:api-core`
53. P 端指标规则写路径下沉（router -> usecase -> repository）
   - 新增：`server/skeleton-c-v1/repositories/p-metric-rule-write.repository.mjs`
   - 新增：`server/skeleton-c-v1/usecases/p-metric-rule-write.usecase.mjs`
   - 新增 DTO：
     - `toCreateMetricRuleCommand`
     - `toUpdateMetricRuleCommand`
     - `toDeleteMetricRuleCommand`
   - `server/skeleton-c-v1/routes/p-admin-metrics.routes.mjs` 的
     - `POST /api/p/metrics/rules`
     - `PUT /api/p/metrics/rules/:id`
     - `DELETE /api/p/metrics/rules/:id`
     已移除直写 `state.metricRules`
   - 保持原错误口径（`METRIC_NAME_REQUIRED`、`METRIC_FORMULA_REQUIRED`、`METRIC_PERIOD_REQUIRED`、`METRIC_SOURCE_REQUIRED`、`METRIC_RULE_DUPLICATE`、`METRIC_RULE_NOT_FOUND`）与 HTTP 状态一致
   - 回归通过：`npm run typecheck`、`npm run test:smoke:api-core`
   - `scripts/check_frontend_status_options_bridge.mjs` 已升级校验：
     - 要求使用 `toActivityOnlineStatus`
     - 禁止回退本地 `normalizeActivityStatus`
   - `scripts/smoke_template_status_contracts.ts` 已新增 `toActivityOnlineStatus` 语义校验
45. B 端运行态激活判断去本地化（shared-contracts）
   - `shared-contracts/template-status.ts` 新增：`isRunningStatusActive(value)`
   - `insurance_code_B/src/lib/templateStatus.ts` 已桥接导出
   - `insurance_code_B/src/App.tsx` 已移除本地 `isActiveStatus`，活动货架图标/active 判断统一改为 `isRunningStatusActive(...)`
   - `scripts/check_b_status_filter_options_bridge.mjs` 已升级校验：
     - 要求使用 `isRunningStatusActive`
     - 禁止回退本地 `isActiveStatus`
   - `scripts/smoke_template_status_contracts.ts` 已新增 `isRunningStatusActive` 语义校验
46. C 端状态桥接门禁（ActivityDetail）
   - 新增：`scripts/check_c_frontend_status_bridge.mjs`
   - 新增 npm 脚本：`lint:c-frontend:status-bridge`
   - `ci:gate:core` 已接入该门禁，校验：
     - C 端桥接层重导出 `runningStatusLabel/runningStatusPillClass/normalizeRunningStatus`
     - `ActivityDetail` 必须通过桥接调用 `runningStatusLabel/runningStatusPillClass`
     - 禁止 `ActivityDetail` 本地状态分支（`activity?.status === ...`）
   - 新增文档：`docs/c-frontend-status-bridge-governance-v1.md`
47. C/B/P 状态口径回归用例文档（执行基线）
   - 新增：`docs/status-caliber-regression-cbp-v1.md`
   - 覆盖：
     - C 端活动详情状态文案/样式
     - B 端筛选与活动货架激活判断
     - P 端活动状态映射与状态下拉
     - 跨端同数据状态一致性与异常值兜底
   - 已在 `docs/INDEX.md` 建立索引入口
48. C/B/P 状态口径自动 smoke（可执行）
   - 新增：`scripts/smoke_status_caliber_cbp.ts`
   - 新增 npm 脚本：`test:smoke:status-caliber-cbp`
   - `ci:gate:core` 已接入该 smoke，自动执行：
     - C 端活动状态契约校验（`/api/activities`）
     - B 端内容/活动状态契约校验（`/api/b/content/items`、`/api/b/activity-configs`）
     - P 端活动状态契约校验（`/api/p/activities`）
     - C/B 运行态状态跨端归一一致性校验
49. 状态治理聚合命令（执行提效）
   - `package.json` 新增：`test:smoke:status-governance`
   - 一次执行以下门禁与 smoke：
     - `lint:c-frontend:status-bridge`
     - `lint:b-frontend:status-filter-options-bridge`
     - `lint:frontend:status-options-bridge`
     - `test:smoke:template-status-contracts`
     - `test:smoke:status-caliber-cbp`
50. 分享治理聚合命令 + 前端治理总聚合
   - `package.json` 新增：
     - `test:smoke:share-governance`
     - `test:smoke:frontend-governance`
   - `test:smoke:share-governance` 一次执行：
     - `lint:b-frontend:share-types-bridge`
     - `test:smoke:b-share-contracts`
   - `test:smoke:frontend-governance` 一次执行：
     - `test:smoke:status-governance`
     - `test:smoke:share-governance`
51. 发布前检查接入前端治理聚合
   - `scripts/release_preflight.mjs` 新增阶段：`test:smoke:frontend-governance`
   - 执行顺序更新为：
     - （可选）`db:fk:precheck`
     - `test:smoke:frontend-governance`
     - `ci:gate:core`
   - 文档同步：`docs/release-branch-protection-v1.md`
52. 发布前检查报告落盘与自动留存治理
   - 新增：`scripts/cleanup_release_reports.mjs`
   - `scripts/release_preflight.mjs` 增加：
     - 每次执行写入 `docs/reports/release-preflight-YYYYMMDD-HHMMSS.json`
     - 结束后自动清理旧报告（默认仅保留最近 `30` 份）
     - 输出 JSON 增加 `cleanup` 字段（保留数/删除数/当前数量）
   - `package.json` 新增：`release:reports:cleanup`
   - 文档同步：`docs/release-branch-protection-v1.md`
53. CI 门禁升级为 release preflight + 报告归档
   - `.github/workflows/quality-gates.yml` 更新：
     - `insurance-code-gates` 的主质量门禁从 `ci:gate:core` 升级为 `release:preflight`
     - 新增 `upload-artifact` 步骤（`if: always()`）上传 `docs/reports/release-preflight-*.json`
   - 价值：
     - CI 与本地发布前检查口径统一
     - 门禁失败时可直接下载 preflight JSON 报告进行定位
   - 文档同步：`docs/release-branch-protection-v1.md`
54. 持久化“增量同步”第一刀（替代核心写路径全表删写）
   - 文件：`server/skeleton-c-v1/common/state.mjs`
   - 新增通用方法：`syncTableByPrimaryKeys(...)`
     - 机制：按主键集合做“差异删除 + upsert”
     - 作用：避免 `DELETE FROM table` 后全量重灌
   - 本轮已切换为增量同步的写路径表：
     - `p_sessions`（token 主键）
     - `p_orders`（id 主键）
     - `c_redeem_records`（id 主键）
     - `c_sign_ins`（id 主键）
     - `c_activity_completions`（id 主键）
     - `c_learning_records`（id 主键）
   - 同步调整：从 `clearOrder` 中移除上述 6 张表，避免被预先全表清空
   - 结果：写路径仍保持 FK 安全过滤，且持久化粒度从“全表重写”收敛到“按差异写入”
55. 持久化“增量同步”第二刀 + 防回退门禁
   - 文件：`server/skeleton-c-v1/common/state.mjs`
   - 新增增量同步表：
     - `c_point_transactions`
     - `p_track_events`
     - `p_audit_logs`
   - 同步调整：
     - 从 `clearOrder` 移除 `c_point_transactions` 与 `p_track_events`
   - 新增静态守卫：
     - `scripts/check_persistence_incremental_writepaths.mjs`
     - 校验 9 张受治理表：
       - 不得走 `truncateAndInsert`
       - 不得出现在 `clearOrder`
       - 必须走 `syncTableByPrimaryKeys`
   - `package.json`：
     - 新增 `lint:persistence:incremental-writepaths`
     - `ci:gate:core` 已接入该门禁
   - 新增文档：
     - `docs/persistence-incremental-writepaths-governance-v1.md`
56. 持久化“增量同步”第三刀（主数据域）
   - 文件：`server/skeleton-c-v1/common/state.mjs`
   - 新增增量同步表：
     - `c_customers`
     - `b_agents`
     - `p_products`
     - `p_activities`
     - `p_learning_materials`
   - 同步调整：
     - 从 `clearOrder` 移除上述 5 张表，避免主数据每次被全表清空
   - 防回退门禁升级：
     - `scripts/check_persistence_incremental_writepaths.mjs` 扩展受治理表为 14 张
57. 增量同步可观测性接入 release preflight
   - `server/skeleton-c-v1/common/state.mjs`：
     - `syncTableByPrimaryKeys` 新增返回计数（`inserted/updatedByKey/deleted`）
     - 每次持久化成功后写入 `docs/reports/persist-sync-stats-latest.json`
   - `scripts/release_preflight.mjs`：
     - 读取本次执行窗口内生成的持久化统计快照
     - 写入 `release-preflight-*.json` 的 `persistSyncStats` 字段
58. P0-1 仓储层下沉（第一批：活动完成 + 学习完成）
   - 新增 repository：
     - `server/skeleton-c-v1/repositories/activity-write.repository.mjs`
     - `server/skeleton-c-v1/repositories/learning-write.repository.mjs`
   - 新增 usecase：
     - `server/skeleton-c-v1/usecases/activity-complete.usecase.mjs`
   - 重构：
     - `usecases/learning-complete.usecase.mjs` 改为通过 `learning-write.repository` 完成写入
     - `routes/activities.routes.mjs` 的 `POST /api/activities/:id/complete` 改为 DTO + usecase（移除路由内直写 `activityCompletions/points`）
     - `dto/write-commands.dto.mjs` 新增 `toActivityCompleteCommand`
   - 结果：
     - 保持现有错误码/接口语义不变
     - `npm run typecheck` 与 `npm run test:smoke:api-core` 通过
59. P0-1 仓储层下沉（第六批：P端标签域写接口）
   - 新增 repository：
     - `server/skeleton-c-v1/repositories/p-tag-write.repository.mjs`
     - `server/skeleton-c-v1/repositories/p-tag-rule-write.repository.mjs`
     - `server/skeleton-c-v1/repositories/p-tag-rule-job-write.repository.mjs`
   - 新增 usecase：
     - `server/skeleton-c-v1/usecases/p-tag-write.usecase.mjs`
     - `server/skeleton-c-v1/usecases/p-tag-rule-write.usecase.mjs`
     - `server/skeleton-c-v1/usecases/p-tag-rule-job-write.usecase.mjs`
   - 新增 DTO command：
     - `toSavePTagCommand`
     - `toUpdatePTagStatusCommand`
     - `toDeletePTagCommand`
     - `toSavePTagRuleCommand`
     - `toUpdatePTagRuleStatusCommand`
     - `toDeletePTagRuleCommand`
     - `toCreatePTagRuleJobCommand`
   - 路由改造（`server/skeleton-c-v1/routes/p-admin-tags.routes.mjs`）：
     - `POST /api/p/tags`
     - `POST /api/p/tags/:id/status`
     - `DELETE /api/p/tags/:id`
     - `POST /api/p/tag-rules`
     - `POST /api/p/tag-rules/:id/status`
     - `DELETE /api/p/tag-rules/:id`
     - `POST /api/p/tag-rule-jobs`
     - 全部由 route 直写 state 改为 DTO + usecase + repository
   - 回归结果：
     - `npm run typecheck` 通过
     - `npm run test:smoke:api-core` 通过（`hardFailures=0`）
60. P0-1 仓储层下沉（第七批：B端客户标签写接口）
   - 新增 repository：
     - `server/skeleton-c-v1/repositories/b-customer-tag-write.repository.mjs`
   - 新增 usecase：
     - `server/skeleton-c-v1/usecases/b-customer-tag-write.usecase.mjs`
   - 新增 DTO command：
     - `toAddBCustomerTagCommand`
     - `toCreateBCustomTagCommand`
   - 路由改造（`server/skeleton-c-v1/routes/b-admin-customers.routes.mjs`）：
     - `POST /api/b/customers/:id/tags`
     - `POST /api/b/tags/custom`
     - 从 route 直写 state 改为 DTO + usecase + repository
   - 回归结果：
     - `npm run typecheck` 通过
     - `npm run test:smoke:api-core` 通过（`hardFailures=0`）
61. P0-1 仓储层下沉（第八批：P端学习资料写接口）
   - 新增 repository：
     - `server/skeleton-c-v1/repositories/p-learning-course-write.repository.mjs`
   - 新增 usecase：
     - `server/skeleton-c-v1/usecases/p-learning-course-write.usecase.mjs`
   - 新增 DTO command：
     - `toCreatePLearningCourseCommand`
     - `toUpdatePLearningCourseCommand`
     - `toDeletePLearningCourseCommand`
   - 路由改造（`server/skeleton-c-v1/routes/p-admin-learning.routes.mjs`）：
     - `POST /api/p/learning/courses`
     - `PUT /api/p/learning/courses/:id`
     - `DELETE /api/p/learning/courses/:id`
     - 全部从 route 直写 state 改为 DTO + usecase + repository
   - 兼容保留：
     - 公司管理员删除平台模板源数据时返回专用错误：`PLATFORM_TEMPLATE_SOURCE_IMMUTABLE`
   - 回归结果：
     - `npm run typecheck` 通过
     - `npm run test:smoke:api-core` 通过（`hardFailures=0`）
     - `npm run test:smoke:p-admin-modules` 通过
62. P0-1 仓储层下沉（第九批：P端活动管理写接口）
   - 新增 repository：
     - `server/skeleton-c-v1/repositories/p-activity-write.repository.mjs`
   - 新增 usecase：
     - `server/skeleton-c-v1/usecases/p-activity-write.usecase.mjs`
   - 新增 DTO command：
     - `toCreatePActivityCommand`
     - `toUpdatePActivityCommand`
     - `toDeletePActivityCommand`
   - 路由改造（`server/skeleton-c-v1/routes/p-admin-activities.routes.mjs`）：
     - `POST /api/p/activities`
     - `PUT /api/p/activities/:id`
     - `DELETE /api/p/activities/:id`
     - 全部从 route 直写 state 改为 DTO + usecase + repository
   - 兼容保留：
     - 公司管理员删除平台模板源数据时保留专用错误：`PLATFORM_TEMPLATE_SOURCE_IMMUTABLE`
   - 回归结果：
     - `npm run typecheck` 通过
     - `npm run test:smoke:api-core` 通过（`hardFailures=0`）
     - `npm run test:smoke:p-admin-modules` 通过
63. P0-1 仓储层下沉（第十批：P端商城管理写接口）
   - 新增 repository：
     - `server/skeleton-c-v1/repositories/p-mall-write.repository.mjs`
   - 新增 usecase：
     - `server/skeleton-c-v1/usecases/p-mall-write.usecase.mjs`
   - 新增 DTO command：
     - `toCreatePMallProductCommand`
     - `toUpdatePMallProductCommand`
     - `toDeletePMallProductCommand`
     - `toCreatePMallActivityCommand`
     - `toUpdatePMallActivityCommand`
     - `toDeletePMallActivityCommand`
   - 路由改造（`server/skeleton-c-v1/routes/p-admin-mall.routes.mjs`）：
     - `POST /api/p/mall/products`
     - `PUT /api/p/mall/products/:id`
     - `DELETE /api/p/mall/products/:id`
     - `POST /api/p/mall/activities`
     - `PUT /api/p/mall/activities/:id`
     - `DELETE /api/p/mall/activities/:id`
     - 全部从 route 直写 state 改为 DTO + usecase + repository
   - 兼容保留：
     - 公司管理员删除平台模板源数据时保留原错误文案/语义
   - 回归结果：
     - `npm run typecheck` 通过
     - `npm run test:smoke:api-core` 通过（`hardFailures=0`）
     - `npm run test:smoke:p-admin-modules` 通过
64. P0-1 仓储层下沉（第十一批：B端内容管理写接口）
   - 新增 repository：
     - `server/skeleton-c-v1/repositories/b-content-write.repository.mjs`
   - 新增 usecase：
     - `server/skeleton-c-v1/usecases/b-content-write.usecase.mjs`
   - 新增 DTO command：
     - `toCreateBContentItemCommand`
     - `toUpdateBContentItemCommand`
   - 路由改造（`server/skeleton-c-v1/routes/b-admin-content.routes.mjs`）：
     - `POST /api/b/content/items`
     - `PUT /api/b/content/items/:id`
     - 全部从 route 直写 state 改为 DTO + usecase + repository
   - 回归结果：
     - `npm run typecheck` 通过
     - `npm run test:smoke:api-core` 通过（`hardFailures=0`）
     - `npm run test:smoke:b-admin-modules` 通过
65. P0-1 仓储层下沉（第十二批：C端认证写接口）
   - 新增 repository：
     - `server/skeleton-c-v1/repositories/auth-write.repository.mjs`
   - 新增 usecase：
     - `server/skeleton-c-v1/usecases/auth-write.usecase.mjs`
   - 新增 DTO command：
     - `toSendAuthCodeCommand`
     - `toVerifyBasicCommand`
   - 路由改造（`server/skeleton-c-v1/routes/auth.routes.mjs`）：
     - `POST /api/auth/send-code`
     - `POST /api/auth/verify-basic`
     - 全部从 route 直写 state 改为 DTO + usecase + repository
   - 兼容保留：
     - 开发环境验证码透传 `dev_code`
     - 生产环境短信日限流（>=5 返回 `SMS_LIMIT_REACHED`）
     - 验证码错误/过期/租户缺失错误码与文案保持
     - 新用户首登发放 200 积分逻辑保持
   - 回归结果：
     - `npm run typecheck` 通过
     - `npm run test:smoke:api-core` 通过（`hardFailures=0`）
     - `npm run test:smoke:c-app-modules` 通过
66. P0-1 仓储层下沉（第十三批：C端保险/埋点/用户触达写接口）
   - 新增 repository：
     - `server/skeleton-c-v1/repositories/insurance-write.repository.mjs`
     - `server/skeleton-c-v1/repositories/track-write.repository.mjs`
     - `server/skeleton-c-v1/repositories/user-write.repository.mjs`
   - 新增 usecase：
     - `server/skeleton-c-v1/usecases/insurance-write.usecase.mjs`
     - `server/skeleton-c-v1/usecases/track-write.usecase.mjs`
     - `server/skeleton-c-v1/usecases/user-write.usecase.mjs`
   - 新增 DTO command：
     - `toCreateInsurancePolicyCommand`
     - `toTrackEventCommand`
     - `toTouchMeCommand`
   - 路由改造：
     - `server/skeleton-c-v1/routes/insurance.routes.mjs`
       - `POST /api/insurance/policies`
     - `server/skeleton-c-v1/routes/track.routes.mjs`
       - `POST /api/track/events`
     - `server/skeleton-c-v1/routes/user.routes.mjs`
       - `GET /api/me` 的活跃触达写回
     - 均由 route 直写 state 改为 DTO + usecase + repository
   - 兼容保留：
     - 保单创建成功响应结构、icon 字段逻辑不变
     - 埋点缺参数错误码 `EVENT_REQUIRED` 与 `TENANT_CONTEXT_REQUIRED` 不变
     - `/api/me` 返回结构不变
   - 回归结果：
     - `npm run typecheck` 通过
     - `npm run test:smoke:api-core` 通过（`hardFailures=0`）
     - `npm run test:smoke:c-app-modules` 通过
67. P0-1 仓储层下沉（第十四批：B端订单核销写接口）
   - 新增 repository：
     - `server/skeleton-c-v1/repositories/b-order-writeoff.repository.mjs`
   - 新增 usecase：
     - `server/skeleton-c-v1/usecases/b-order-writeoff.usecase.mjs`
   - 新增 DTO command：
     - `toBOrderWriteoffCommand`
   - 路由改造（`server/skeleton-c-v1/routes/b-admin-orders.routes.mjs`）：
     - `POST /api/b/orders/:id/writeoff`
     - 从 route 内直接调用 service 改为 DTO + usecase + repository 包装调用
   - 兼容保留：
     - 原错误码映射保持不变（`ORDER_NOT_FOUND/ORDER_NOT_PAID/REDEMPTION_NOT_FOUND/INVALID_TOKEN/TOKEN_EXPIRED`）
   - 回归结果：
     - `npm run typecheck` 通过
     - `npm run test:smoke:b-admin-modules` 通过
     - `npm run test:smoke:api-core` 通过（`hardFailures=0`）
68. P0-1 仓储层下沉（第十五批：B/P 端登录写接口）
   - 新增 repository：
     - `server/skeleton-c-v1/repositories/admin-auth-write.repository.mjs`
   - 新增 usecase：
     - `server/skeleton-c-v1/usecases/admin-auth-write.usecase.mjs`
   - 新增 DTO command：
     - `toBAdminLoginCommand`
     - `toPAdminLoginCommand`
   - 路由改造：
     - `server/skeleton-c-v1/routes/b-admin-auth.routes.mjs`
       - `POST /api/b/auth/login`
     - `server/skeleton-c-v1/routes/p-admin-auth.routes.mjs`
       - `POST /api/p/auth/login`
     - 均从 route 直写 state/session 改为 DTO + usecase + repository
   - 兼容保留：
     - 登录参数校验与错误码保持（`LOGIN_PARAMS_REQUIRED/LOGIN_FAILED`）
     - B 端与 P 端既有角色映射与 session 返回结构保持
     - demo 登录通道与 csrf 回填逻辑保持
   - 回归结果：
     - `npm run typecheck` 通过
     - `npm run test:smoke:b-admin-modules` 通过
     - `npm run test:smoke:p-admin-modules` 通过
     - `npm run test:smoke:api-core` 通过（`hardFailures=0`）
69. P0-1 仓储层下沉（第十六批：P端运营写接口）
   - 新增 repository：
     - `server/skeleton-c-v1/repositories/p-ops-write.repository.mjs`
   - 新增 usecase：
     - `server/skeleton-c-v1/usecases/p-ops-write.usecase.mjs`
   - 新增 DTO command：
     - `toPRefundOrderCommand`
     - `toPRebuildStatsCommand`
     - `toPRunReconciliationCommand`
   - 路由改造（`server/skeleton-c-v1/routes/p-admin-ops.routes.mjs`）：
     - `POST /api/p/orders/:id/refund`
     - `POST /api/p/stats/rebuild`
     - `POST /api/p/reconciliation/run`
     - 从 route 内直接调用服务改为 DTO + usecase + repository
   - 兼容保留：
     - 退款错误码映射保持（`ORDER_NOT_FOUND/ORDER_NOT_PAID/ORDER_ALREADY_FULFILLED`）
     - 统计重建与对账成功返回结构保持
   - 回归结果：
     - `npm run typecheck` 通过
     - `npm run test:smoke:p-admin-modules` 通过
     - `npm run test:smoke:api-core` 通过（`hardFailures=0`）
70. P0-1 入参收敛（第十七批：C端学习完成接口接入 DTO）
   - 新增 DTO command：
     - `toLearningCompleteCommand`
   - 路由改造（`server/skeleton-c-v1/routes/learning.routes.mjs`）：
     - `POST /api/learning/courses/:id/complete`
     - 从 route 内联构造 command 改为统一 DTO 入参
   - 兼容保留：
     - 既有错误码与文案保持（`COURSE_NOT_FOUND/COURSE_NOT_AVAILABLE/NO_PERMISSION/INVALID_COURSE_ID`）
     - 完成课程奖励与幂等行为保持
   - 回归结果：
     - `npm run typecheck` 通过
     - `npm run test:smoke:c-app-modules` 通过
     - `npm run test:smoke:api-core` 通过（`hardFailures=0`）
71. P0-1 仓储层下沉（第十八批：上传写接口）
   - 新增 repository：
     - `server/skeleton-c-v1/repositories/upload-write.repository.mjs`
   - 新增 usecase：
     - `server/skeleton-c-v1/usecases/upload-write.usecase.mjs`
   - 新增 DTO command：
     - `toUploadBase64Command`
   - 路由改造（`server/skeleton-c-v1/routes/uploads.routes.mjs`）：
     - `POST /api/uploads/base64`
     - 从 route 内直接解析/落盘改为 DTO + usecase + repository
   - 兼容保留：
     - 错误码与文案保持（`TENANT_CONTEXT_REQUIRED/INVALID_DATA_URL/FILE_TOO_LARGE`）
     - 上传成功返回结构保持（`ok + file{name,type,size,path,url}`）
     - 12MB 限制保持
   - 回归结果：
     - `npm run typecheck` 通过
     - `npm run test:smoke:api-core` 通过（`hardFailures=0`）
72. P0-1 静态守卫（新增写路由必须接入 DTO）
   - 新增脚本：
     - `scripts/check_route_write_dto_guard.mjs`
   - 新增 npm script：
     - `lint:route-write-dto-guard`
   - 接入 CI：
     - `ci:gate:core` 增加 `npm run lint:route-write-dto-guard`
   - 校验策略：
     - 发现任一 `*.routes.mjs` 含 `app.post/put/delete` 且未引入 `server/skeleton-c-v1/dto/write-commands.dto.mjs` 时直接失败
   - 回归结果：
     - `npm run lint:route-write-dto-guard` 通过
     - `npm run typecheck` 通过
     - `npm run test:smoke:api-core` 通过（`hardFailures=0`）
73. P1-1 开发规范与守卫加强（写接口分层治理）
   - 新增治理文档：
     - `docs/route-write-layering-governance-v1.md`
   - 文档索引更新：
     - `docs/INDEX.md` 增加写接口分层治理入口
   - 守卫增强：
     - `scripts/check_route_write_dto_guard.mjs`
       - 从“仅检查 DTO import”升级为“检查 DTO + usecase 双 import”
       - 失败码从 `ROUTE_WRITE_DTO_GUARD_FAILED` 升级为 `ROUTE_WRITE_LAYER_GUARD_FAILED`
   - 兼容保留：
     - npm 命令仍为 `lint:route-write-dto-guard`
     - `ci:gate:core` 门禁链路不变（仅增强检查强度）
   - 回归结果：
     - `npm run lint:route-write-dto-guard` 通过
     - `npm run typecheck` 通过
     - `npm run test:smoke:api-core` 通过（`hardFailures=0`）
74. P1-2 脚手架能力（写接口分层模板生成）
   - 新增脚本：
     - `scripts/scaffold_write_layer.mjs`
   - 新增 npm 命令：
     - `scaffold:write-layer`
   - 功能：
     - 按 `--name <feature-slug>` 自动生成：
       - `repositories/<slug>-write.repository.mjs`
       - `usecases/<slug>-write.usecase.mjs`
       - `docs/reports/scaffold-<slug>-write-layer.md`（含 DTO/route 接入片段）
     - 支持 `--dry-run`、`--force`
   - 文档更新：
     - `docs/route-write-layering-governance-v1.md` 增加脚手架使用步骤
   - 回归结果：
     - `npm run scaffold:write-layer -- --name demo-write-flow --dry-run` 通过
     - `npm run lint:route-write-dto-guard` 通过
     - `npm run typecheck` 通过
75. P1-3 脚手架增强（可选自动追加 DTO 模板）
   - 脚本增强：
     - `scripts/scaffold_write_layer.mjs` 新增参数 `--with-dto`
   - 功能：
     - 在生成 repository/usecase 模板基础上，可选把 `toXxxCommand` 模板追加到
       `server/skeleton-c-v1/dto/write-commands.dto.mjs`
     - 若 DTO 已存在则跳过，不重复写入
   - 文档更新：
     - `docs/route-write-layering-governance-v1.md` 增加 `--with-dto` 使用说明
   - 回归结果：
     - `npm run scaffold:write-layer -- --name demo-write-flow --with-dto --dry-run` 通过
     - `npm run lint:route-write-dto-guard` 通过
     - `npm run typecheck` 通过
76. P1-4 脚手架增强（路由接入片段自动生成）
   - 脚本增强：
     - `scripts/scaffold_write_layer.mjs` 新增参数：
       - `--route <route-file>`
       - `--method <post|put|delete>`
       - `--path <api-path>`
   - 功能：
     - 在 `docs/reports/scaffold-<slug>-write-layer.md` 自动追加可粘贴的 route 接入代码片段
   - 文档更新：
     - `docs/route-write-layering-governance-v1.md` 增加 route 片段参数说明
   - 回归结果：
     - `npm run scaffold:write-layer -- --name demo-write-flow --with-dto --route server/skeleton-c-v1/routes/uploads.routes.mjs --method post --path /api/uploads/base64 --dry-run` 通过
     - `npm run lint:route-write-dto-guard` 通过
     - `npm run typecheck` 通过
77. P1-5 脚手架回归门禁（CI）
   - 新增 smoke 脚本：
     - `scripts/smoke_scaffold_write_layer.mjs`
   - 新增 npm 命令：
     - `test:smoke:scaffold-write-layer`
   - CI 接入：
     - `ci:gate:core` 新增 `npm run test:smoke:scaffold-write-layer`
   - 文档更新：
     - `docs/route-write-layering-governance-v1.md` 新增脚手架回归门禁章节
   - 回归结果：
     - `npm run test:smoke:scaffold-write-layer` 通过
     - `npm run lint:route-write-dto-guard` 通过
     - `npm run typecheck` 通过
78. P1-6 发布审计留痕（CI Gate 报告自动落盘）
   - 新增脚本：
     - `scripts/run_ci_gate_with_report.mjs`
   - 新增 npm 命令：
     - `ci:gate:core:report`
   - 能力：
     - 运行 gate 命令并写入 `docs/reports/ci-gate-core-<timestamp>.json/.md`
     - 自动清理历史报告（默认保留 20 份）
     - 支持透传自定义命令（`-- <command> <args...>`）
   - 文档更新：
     - `docs/route-write-layering-governance-v1.md` 增加“门禁执行留痕”
   - 回归结果：
     - `npm run ci:gate:core:report -- -- npm run typecheck` 通过
     - `npm run lint:route-write-dto-guard` 通过
79. P1-7 发布前置报告统一（Release Preflight 双格式 + 统一清理）
   - 脚本增强：
     - `scripts/release_preflight.mjs`
       - 新增 `release-preflight-<timestamp>.md` 报告输出
       - 清理逻辑升级为按时间戳成对清理 `json + md`
   - 清理脚本增强：
     - `scripts/cleanup_release_reports.mjs`
       - 统一清理两类报告：`release-preflight-*`、`ci-gate-core-*`
       - 按前缀分别保留最近 `KEEP_COUNT`
   - 回归结果：
     - `node --check scripts/release_preflight.mjs` 通过
     - `node --check scripts/cleanup_release_reports.mjs` 通过
     - `npm run release:reports:cleanup` 通过
80. P1-8 报告索引收口（可执行入口与运行手册对齐）
   - 新增文档：
     - `docs/reports-governance-v1.md`
   - 文档索引更新：
     - `docs/INDEX.md` 增加“报告产物治理（门禁/发布审计）”
   - 联调手册更新：
     - `docs/local-stack-runbook-v1.md` 增加“审计留痕”命令段
       - `npm run ci:gate:core:report`
       - `npm run release:preflight`
   - 回归结果：
     - `npm run docs:check-links` 通过
81. P1-9 文档链路全量校验收口（all mode）
   - 问题修复：
     - 清理 4 份文档中的旧绝对路径前缀
     - 修正治理文档中的错误相对路径（`b-admin`/`p-admin`/`route-write`）
     - 移除通配符与跨仓相对路径写法，改为可执行或可读的仓内引用/环境变量占位
     - 修正 Week3 进展文档中的 DTO 错误路径示例
   - 回归结果：
     - `npm run docs:check-links:all` 通过（57/57）
82. P1-10 发布前置报告扩展（risk/docs/smoke/perf/persist 分类）
   - 新增脚本：
     - `scripts/perf_baseline_smoke.mjs`
   - 新增命令：
     - `test:perf:baseline`
   - `release:preflight` 增强：
     - 增加分类步骤：`risk/docs/smoke/perf/persist`
     - 报告新增 `categories` 汇总区块
     - 支持 `PREFLIGHT_SKIP_PERF=1` 跳过性能步骤
   - 清理脚本增强：
     - `scripts/cleanup_release_reports.mjs` 新增 `perf-baseline-*` 清理
   - 文档同步：
     - `docs/reports-governance-v1.md`
     - `docs/local-stack-runbook-v1.md`
   - 回归结果：
     - `node --check scripts/perf_baseline_smoke.mjs` 通过
     - `node --check scripts/release_preflight.mjs` 通过
     - `npm run test:perf:baseline` 通过（`PERF_BASELINE_ITERATIONS=3`）
     - `npm run release:reports:cleanup` 通过
83. P1-11 preflight 全链路回归修复（错误码字典/矩阵同步）
   - 问题修复：
     - `docs/error-code-dictionary-v1.md` 补齐 7 个缺失错误码
     - 重新生成 `docs/error-code-endpoint-matrix-v1.md`
   - 回归结果：
     - `npm run docs:check:error-codes` 通过
     - `npm run docs:check:error-matrix` 通过
     - `PREFLIGHT_SKIP_PERF=1 npm run release:preflight` 通过（分类汇总与 `ci:gate:core` 同时通过）
84. P0-1 第一批仓储层下沉（Points/Analytics）
   - 新增 repository：
     - `server/skeleton-c-v1/repositories/points.repository.mjs`
     - `server/skeleton-c-v1/repositories/analytics.repository.mjs`
   - service 改造：
     - `services/points.service.mjs` 不再直接 `state.pointAccounts/pointTransactions.push`
     - `services/analytics.service.mjs` 的快照与对账报告写入改为 repository 负责
   - 回归结果：
     - `npm run test:smoke:mall-commerce` 通过
     - `npm run test:smoke:learning-mall-layer` 通过
     - `npm run test:smoke:transaction-writepaths` 通过
     - `npm run test:smoke:api-core` 通过
85. P0-1 第二批仓储层下沉（Customer Assignment）
   - 新增 repository：
     - `server/skeleton-c-v1/repositories/customer-assignment.repository.mjs`
   - service 改造：
     - `services/customer-assignment.service.mjs` 的归属写入改由 repository 执行
     - service 仅保留审计与返回组装
   - 回归结果：
     - `npm run test:smoke:api-core` 通过
86. P0-1 第三批仓储层下沉（Commerce 持久化入口收口）
   - repository 增强：
     - `server/skeleton-c-v1/repositories/commerce.repository.mjs`
       - 新增 `commitCommerceWrite()`
       - 新增 `markOrderRefundStatus()`
   - service 改造：
     - `server/skeleton-c-v1/services/commerce.service.mjs`
       - 移除 `persistState` 直接依赖
       - 所有持久化改为调用 `commitCommerceWrite()`
       - 取消订单中的 `order.refundStatus` 直接赋值改为 repository 函数
   - 回归结果：
     - `npm run test:smoke:mall-commerce` 通过
     - `npm run test:smoke:transaction-writepaths` 通过
     - `npm run test:smoke:api-core` 通过
87. P0-1 第四批分层收口（移除 repository 反向依赖 service）
   - 问题：
     - `repositories/commerce-write.repository.mjs` 反向依赖 `services/commerce.service.mjs`
   - 修复：
     - `order-create/redeem/order-pay/order-cancel/order-refund` 五个 usecase 改为直接调用 `commerce.service`
     - 删除 `server/skeleton-c-v1/repositories/commerce-write.repository.mjs`
   - 结果：
     - 消除“repository 依赖 service”的分层逆向关系
     - 交易链路回归保持通过
   - 回归结果：
     - `npm run test:smoke:transaction-writepaths` 通过
     - `npm run test:smoke:mall-commerce` 通过
     - `npm run test:smoke:api-core` 通过
88. P0-1 第五批防回退门禁（Service 写入守卫）
   - 新增脚本：
     - `scripts/check_service_write_layer_guard.mjs`
   - 新增命令：
     - `npm run lint:service-write-layer-guard`
   - CI 接入：
     - `ci:gate:core` 新增 `lint:service-write-layer-guard`
   - 校验范围：
     - `points/analytics/customer-assignment/commerce` 四个 service
     - 必须绑定对应 repository
     - 禁止 `state.xxx =` 与 `state.xxx.push()` 等直接写入
     - `commerce.service` 禁止回退 `persistState` 直调
   - 文档更新：
     - `docs/route-write-layering-governance-v1.md` 增加 3.3 小节
   - 回归结果：
     - `npm run lint:service-write-layer-guard` 通过
     - `npm run ci:gate:core` 通过
89. P0-1 第六批链路回归补齐（客户归属 + B→C 可见性）
   - 新增脚本：
     - `scripts/smoke_assignment_visibility_chain.mjs`
   - 覆盖链路：
     - P 端创建员工（含团队兜底）并登录 B 端
     - B 端创建 `内容/活动/商城商品` 模板
     - C 端注册客户并执行 `assign-by-mobile` 归属绑定
     - 校验 `P 端客户 ownerUserId`、`B 端客户列表可见`、`C 端三域模板可见`
   - 套件接入：
     - `scripts/smoke_api_core_suite.mjs` 新增 `assignment_visibility_chain` 必跑步骤
     - `package.json` 新增 `test:smoke:assignment-visibility`
   - 回归结果：
     - `npm run test:smoke:assignment-visibility` 通过
     - `npm run test:smoke:api-core` 通过
90. P0-1 第七批链路回归补齐（订单生命周期）
   - 新增脚本：
     - `scripts/smoke_orders_lifecycle_api.mjs`
   - 覆盖链路：
     - C 端客户创建订单 -> 支付 -> 取消（积分返还）
     - C 端客户创建订单 -> 支付 -> 退款（积分返还）
     - 核对余额变化与订单状态（`paymentStatus/refundStatus/status`）
   - 套件接入：
     - `scripts/smoke_api_core_suite.mjs` 新增 `orders_lifecycle` 必跑步骤
     - `package.json` 新增 `test:smoke:orders-lifecycle`
   - 回归结果：
     - `npm run test:smoke:orders-lifecycle` 通过
     - `npm run test:smoke:api-core` 通过
91. P0-1 第八批一致性修复（商城库存读写同源）
   - 问题：
     - 订单扣减库存走 `state.mallItems`
     - C 端商品列表读库存走 `state.pProducts`
     - 导致“支付成功但列表库存不变”
   - 修复：
     - `repositories/commerce.repository.mjs`
       - `findActiveProduct()` 改为优先查 `pProducts`，回退 `mallItems`
       - `adjustProductStock()` 改为双向同步 `pProducts/mallItems`
     - `services/commerce.service.mjs`
       - 统一使用 productRef + 归一化字段（`name/title`, `pointsCost/points`）
       - 库存变更调用升级为 `adjustProductStock(state, productRef, delta)`
     - `usecases/p-mall-write.usecase.mjs`
       - 新增 `mallItems.sourceProductId`，确保镜像可追溯
   - 回归增强：
     - `scripts/smoke_orders_lifecycle_api.mjs` 恢复并强制校验库存变更
       - 支付后库存 -1
       - 取消/退款后库存恢复
   - 回归结果：
     - `npm run test:smoke:orders-lifecycle` 通过
     - `npm run test:smoke:api-core` 通过
     - `npm run ci:gate:core` 通过
92. 过程修复（P 管理端活动列表500）
   - 问题：
     - `/api/p/activities` 缺少 `canAccessTemplate` 依赖注入，触发 `ReferenceError`
   - 修复：
     - `routes/p-admin-activities.routes.mjs` 增补 `canAccessTemplate` 解构注入
   - 回归结果：
     - `npm run test:smoke:api-core` 通过
     - `npm run ci:gate:core` 通过
93. P0-1 第九批一致性收口（P 端商品 Update/Delete 镜像同步）
   - 修复文件：
     - `repositories/p-mall-write.repository.mjs`
       - 新增 `syncMallItemMirrorByProduct()`
       - 新增 `removeMallItemMirrorsByProductId()`
     - `usecases/p-mall-write.usecase.mjs`
       - 商品更新后同步 `mallItems` 镜像
       - 商品删除后删除 `mallItems` 镜像
   - 目标：
     - 避免 `pProducts` 与 `mallItems` 长期漂移，减少订单/兑换展示口径不一致

94. P0-1 第十批历史兼容修复（sourceProductId 回填 + 读取口径）
   - 新增脚本：
     - `scripts/backfill_mall_item_source_product_id.mjs`
     - `npm run db:mall:backfill-source-product-id`
   - 回填策略：
     - 优先按同租户 `id` 直连
     - 其次按同租户 `name/title + points` 唯一匹配
   - 读取侧修复：
     - `routes/redemptions.routes.mjs` 兑换记录商品名查找改为 `sourceProductId || id`
     - `routes/b-admin-customers.routes.mjs` 客户画像商品映射改为 `sourceProductId || id`
     - `routes/b-admin.shared.mjs` 行为轨迹商品映射改为 `sourceProductId || id`
   - 目标：
     - 兼容“新镜像 id != productId”与“历史镜像缺 sourceProductId”两种数据形态

95. P0-1 第十一批稳定性修复（商城镜像租户归属与回填脚本幂等）
   - 问题：
     - 历史 `mallItems` 可能缺 `tenantId/sourceProductId`，导致“修一次、运行中又漂移”。
     - `scripts/backfill_mall_item_source_product_id.mjs` 未先初始化状态，且幂等性不足。
   - 修复：
     - `common/state.mjs` `syncOperationCatalog()` 增加统一归一：
       - 规范 `pProducts`（`id/tenantId/name/pointsCost/shelfStatus/status`）
       - 为每个 `mallItems` 自动补齐 `tenantId + sourceProductId`
       - 缺失源商品时自动补建 `pProducts`（保持最小兼容字段）
     - `scripts/backfill_mall_item_source_product_id.mjs` 改为：
       - 通过 `runInStateTransaction()` 执行（自动初始化 + 持久化）
       - 增强租户推断/跨租户兜底/缺失源商品补建
       - 输出 `fixedTenant/fixedSource/createdProducts` 统计
       - 连续执行保持幂等（第二次 `touched=0`）
   - 回归结果：
     - `STORAGE_BACKEND=dbjson node scripts/backfill_mall_item_source_product_id.mjs` 两次执行均 `unresolved=0`，第二次 `touched=0`
     - `npm run dev:stack:restart` 后 `npm run test:smoke:api-core` 通过

96. P0-1 第十二批启动门禁收口（回填前置到 prestart / preflight）
   - 目标：
     - 启动 API 前自动执行商城镜像回填，避免历史数据在运行中反复漂移。
   - 修改：
     - `package.json`
       - `predev:api:skeleton` 改为：
         - `npm run db:mall:backfill-source-product-id && npm run db:fk:precheck`
       - `test:smoke:api-core:ci` 改为：
         - `npm run db:mall:backfill-source-product-id && npm run db:fk:precheck && npm run test:smoke:api-core`
     - `scripts/release_preflight.mjs`
       - 在 `db:fk:precheck` 前新增 `db:mall:backfill-source-product-id` 步骤。
     - `docs/local-stack-runbook-v1.md`
       - 补充“API 启动前自动执行回填+FK 预检”说明。

97. P0-1 第十三批稳定性修复（preflight 环境兜底 + 报告落地）
   - 问题：
     - `release:preflight` 在本地无显式 `DATABASE_URL` 时，`db:mall:backfill-source-product-id` 仍可能被 `.env` 拉到 Postgres，导致认证失败。
   - 修复：
     - `scripts/backfill_mall_item_source_product_id.mjs`
       - 增加环境兜底：当 `STORAGE_BACKEND/DATABASE_URL` 都未显式设置时，默认 `STORAGE_BACKEND=dbjson`
       - 将 `state.mjs` 改为动态导入，确保兜底环境先于 `dotenv` 生效
   - 验证：
     - `npm run release:preflight` 通过
     - 产物：
       - `docs/reports/release-preflight-20260306-130253.json`
       - `docs/reports/release-preflight-20260306-130253.md`

98. P0-1 第十四批 CI 门禁增强（release preflight 强制环境 + 完整报告上传）
   - 目标：
     - 将 `release:preflight` 作为 PR/主干可复现硬门禁，避免 CI 误用外部数据库环境。
   - 修改：
     - `.github/workflows/quality-gates.yml`
       - `Release preflight gate` 增加：
         - `STORAGE_BACKEND: dbjson`
         - `DATABASE_URL: ""`
       - `Upload release preflight reports` 扩展 artifact：
         - `release-preflight-*.json`
         - `release-preflight-*.md`
         - `perf-baseline-*.json`
         - `perf-baseline-*.md`
     - `docs/release-branch-protection-v1.md`
       - 更新 preflight 执行步骤口径（含 `db:mall:backfill-source-product-id`）
       - 更新 CI 产物说明与 required checks 描述
   - 验证：
     - `npm run release:preflight` 通过（全分类 PASS）
     - `npm run dev:stack:status` 通过

99. P0-1 第十五批漂移防护（required checks 文档/工作流同步校验）
   - 目标：
     - 防止 `quality-gates` job 改名后，GitHub branch protection 的 required checks 与文档失配。
   - 修改：
     - 新增 `scripts/check_required_checks_sync.mjs`
       - 解析 `.github/workflows/quality-gates.yml` 的 job 列表
       - 解析 `docs/release-branch-protection-v1.md` 的 required checks 列表
       - 双向对比（缺失/未登记）并以非 0 退出阻断门禁
     - `package.json`
       - 新增 `lint:branch-protection:required-checks`
       - `ci:gate:core` 前置该检查
     - `docs/release-branch-protection-v1.md`
       - 增加“变更约束（Required Checks）”章节
       - 明确 workflow 改名必须同步更新文档 + GitHub branch protection
   - 验证：
     - `npm run lint:branch-protection:required-checks` 通过
     - `npm run ci:gate:core` 通过

100. P1-1 第一步流程约束（PR 模板发布门禁清单）
   - 目标：
     - 将“发布前必做动作”前置到 PR 描述，减少评审阶段遗漏。
   - 修改：
     - 新增 `.github/pull_request_template.md`
       - 要求勾选 `release:preflight`、`lint:branch-protection:required-checks`
       - 要求提供 preflight/perf 报告路径
       - 要求声明 workflow job 改名时同步更新文档与 branch protection
     - `docs/release-branch-protection-v1.md`
       - 增加 PR 模板引用说明

101. P1-2 第二步报告扩展（发布看板自动汇总）
   - 目标：
     - 将 `preflight + perf + ci-gate` 三类结果聚合为一个固定入口看板，降低发布评审查阅成本。
   - 修改：
     - 新增 `scripts/release_dashboard.mjs`
       - 自动读取 `docs/reports/` 最新：
         - `release-preflight-*.json`
         - `perf-baseline-*.json`
         - `ci-gate-core-*.json`
       - 生成：
         - `release-dashboard-<timestamp>.json/.md`
         - `release-dashboard-latest.json/.md`
       - 汇总维度：
         - 缺失/失败/过期（默认 72h）判定
         - preflight 分类结果表
         - perf 端点基线快照
         - ci-gate 执行命令与耗时
     - `scripts/release_preflight.mjs`
       - preflight 报告写入后自动触发 dashboard 刷新（失败仅告警，不阻断 preflight 主流程）
     - `scripts/cleanup_release_reports.mjs`
       - 新增 `release-dashboard-*` 时间戳报告清理
     - `package.json`
       - 新增 `npm run release:dashboard`
     - `.github/workflows/quality-gates.yml`
       - artifact 上传新增 `release-dashboard-*` 与 `release-dashboard-latest.*`
     - 文档同步：
       - `docs/reports-governance-v1.md`
       - `docs/release-branch-protection-v1.md`
   - 验证：
     - `npm run release:dashboard` 通过
     - `npm run release:preflight` 通过（含 dashboard 自动刷新）

102. P1-3 SLO 与告警基线（3个关键 SLI 可执行门禁）
   - 目标：
     - 将 SLO 从文档约定升级为发布前自动校验，失败即阻断发布。
   - 修改：
     - 新增 `scripts/slo_guard.mjs`
       - SLI-1：`api_uptime_24h >= 99%`
       - SLI-2：`api_error_rate_1h <= 1%`
       - SLI-3：`api_perf_p95_ms <= 1200ms`
       - 数据源：
         - `metricHourlyCounters(api_total/api_success/api_fail)`，空聚合回退 `auditLogs`
         - `perf-baseline-*.json` 的 `endpointMetrics[].p95Ms`
       - 报告产物：
         - `slo-guard-<timestamp>.json/.md`
         - `slo-guard-latest.json/.md`
       - 告警分级：
         - `warning` / `critical`
     - `package.json`
       - 新增 `npm run slo:guard`
     - `scripts/release_preflight.mjs`
       - 新增 preflight 步骤：`slo:guard`（category=`slo`）
     - `scripts/release_dashboard.mjs`
       - 汇总新增 `slo-guard` 状态与告警数
     - `scripts/cleanup_release_reports.mjs`
       - 新增 `slo-guard-*` 清理
     - CI 与文档同步：
       - `.github/workflows/quality-gates.yml` artifact 增加 `slo-guard-*`
       - `docs/slo-alert-baseline-v1.md`（新）
       - `docs/reports-governance-v1.md`
       - `docs/release-branch-protection-v1.md`
       - `docs/INDEX.md`
   - 验证：
     - `npm run slo:guard` 通过
     - `npm run release:preflight` 通过（含 `slo` 分类）

103. P1-4 异步任务框架落地（对账/重算链路）
   - 目标：
     - 落地“可执行、可重试、可审计”的 P 端异步任务最小能力，覆盖 `reconciliation_run` 与 `stats_rebuild`。
   - 新增能力：
     - 新增服务：`server/skeleton-c-v1/services/ops-async-job.service.mjs`
       - 任务状态机：`queued/running/retrying/success/failed`
       - 自动重试（指数退避，最大 60s）
       - 审计写入（`p_ops_job_*` action）
       - worker 周期执行（`OPS_ASYNC_JOB_WORKER_INTERVAL_MS`）
     - 新增 usecase：`server/skeleton-c-v1/usecases/p-ops-async-job.usecase.mjs`
     - `server/skeleton-c-v1/routes/p-admin-ops.routes.mjs` 新增接口：
       - `POST /api/p/ops/jobs`
       - `POST /api/p/ops/jobs/run-pending`
       - `GET /api/p/ops/jobs`
       - `GET /api/p/ops/jobs/:id`
       - `GET /api/p/ops/jobs/:id/logs`
       - `POST /api/p/ops/jobs/:id/retry`
     - 兼容扩展：
       - `POST /api/p/stats/rebuild` 支持 `async=true`
       - `POST /api/p/reconciliation/run` 支持 `async=true`
   - 存储与持久化：
     - `common/state.mjs` 新增运行态数组：`pOpsJobs/pOpsJobLogs`
     - Postgres 模式新增表：
       - `p_ops_jobs`
       - `p_ops_job_logs`
     - 已接入 `loadStateFromPostgresTables` 与 `writeStateToPostgresTables` 增量同步
   - 回归：
     - 新增 `scripts/smoke_p_ops_async_jobs.mjs`
     - 新增命令 `npm run test:smoke:p-ops-async-jobs`
     - `test:smoke:api-core` 已接入 `p_ops_async_jobs` 必跑步骤
   - 文档：
     - 新增 `docs/ops-async-jobs-framework-v1.md`
     - `docs/INDEX.md` 已补索引

104. P0-2 增量持久化全覆盖（事件/指标5表）
   - 目标：
     - 将指标与事件配置相关写入从“全表删写”切换到“主键增量同步”，减少写放大与并发覆盖风险。
   - 修改：
     - `server/skeleton-c-v1/common/state.mjs`
       - 移除 `clearOrder` 中：
         - `p_event_definitions`
         - `p_metric_rules`
       - 下列表改为 `syncTableByPrimaryKeys`：
         - `p_metric_uv_daily`
         - `p_metric_counter_daily`
         - `p_metric_counter_hourly`
         - `p_event_definitions`
         - `p_metric_rules`
       - `persist-sync-stats` 新增上述5表增量统计输出。
     - `scripts/check_persistence_incremental_writepaths.mjs`
       - 门禁治理表新增上述5表，防回退到 `truncateAndInsert`。
     - `docs/persistence-incremental-writepaths-governance-v1.md`
       - 受治理表清单扩展至 19 张表。
   - 验证：
     - `npm run lint:persistence:incremental-writepaths` 通过
     - `npm run ci:gate:core` 通过

105. P0-3 事件/指标口径版本化快照（字段 + 读写 + 门禁）
   - 目标：
     - 为 `p_metric_rules` 与 `p_event_definitions` 建立可追踪版本号，并在接口侧显式返回版本信息。
   - 修改：
     - `server/skeleton-c-v1/common/state.mjs`
       - 新增列：
         - `p_metric_rules.rule_version`
         - `p_event_definitions.definition_version`
       - `loadStateFromPostgresTables` / `writeStateToPostgresTables` 已完成版本字段映射。
     - `server/skeleton-c-v1/routes/p-admin-metrics.shared.mjs`
       - 新增常量：`METRIC_RULEBOOK_VERSION=2026-03-06.v1`
       - 新增 `normalizeRuleVersion`，并在种子修复改写口径时自动升版。
     - `server/skeleton-c-v1/routes/p-admin-events.shared.mjs`
       - 新增常量：`EVENT_DICTIONARY_VERSION=2026-03-06.v1`
       - 新增 `normalizeDefinitionVersion`，系统事件模板修复时自动升版。
     - `server/skeleton-c-v1/usecases/p-metric-rule-write.usecase.mjs`
       - 创建规则默认 `ruleVersion=1`
       - 更新口径字段（`end/name/formula/period/source`）时 `ruleVersion +1`
     - `server/skeleton-c-v1/usecases/p-event-definition-write.usecase.mjs`
       - 创建定义默认 `definitionVersion=1`
       - 更新字典字段（`eventId/eventName/eventType/description/collectMethod/schema`）时 `definitionVersion +1`
     - `server/skeleton-c-v1/routes/p-admin-metrics.routes.mjs`
       - `GET /api/p/metrics/config` 返回 `rulebookVersion` 与每条 `ruleVersion`
     - `server/skeleton-c-v1/routes/p-admin-events.routes.mjs`
       - `GET /api/p/events/definitions` 返回 `dictionaryVersion` 与每条 `definitionVersion`
     - 新增 smoke：`scripts/smoke_metric_event_versioning.mjs`
       - 校验“新建=1、更新=+1、接口版本字段存在”
     - `package.json`
       - 新增 `test:smoke:metric-event-versioning`
       - 已接入 `ci:gate:core`
   - 文档：
     - 新增：`docs/metric-event-versioning-v1.md`
     - 更新：`docs/metric-definition-v1.md`
   - 更新：`docs/tracking-events-v2.md`
   - 更新：`docs/INDEX.md`
106. Week3-Week4 架构收口完成
   - 范围：
     - `P0-1` 仓储层下沉
     - `P0-2` 增量持久化全覆盖
     - `P0-3` 事件/指标口径版本化
     - `P0-4` 发布前性能基线
     - `P1-1` 异步任务框架
     - `P1-2` preflight 报告扩展
     - `P1-3` SLO 与告警基线
   - 交接：
     - 总计划收口文档：`docs/architecture-closeout-plan-week3-week4-2026-03-05.md`
     - 当前状态与下一阶段：`docs/architecture-status-closeout-2026-03-06.md`
   - 验证：
     - `npm run release:preflight`
     - `npm run ci:gate:core`
     - `npm run test:smoke:metric-event-versioning`

结果：

1. `p-admin.routes.mjs` 已不再直接声明任何 `app.get/post/...` 路由，仅做模块编排。
2. 共享逻辑集中在 `p-admin.shared.mjs`，便于后续继续按领域拆分单测。
3. `p_metric_* / p_event_definitions / p_metric_rules` 已进入增量同步治理，发布门禁可阻断回退。

## 3. 验证

执行：

```bash
npm run test:smoke:p-admin-modules
npm run test:smoke:api-core
npm run test:smoke:p-admin-shared
npm run ci:gate:core
```

结果：通过。

## 4. 后续入口

1. 当前文件转为“Week3-Week4 历史进展记录”。
2. 后续推进请从 `docs/architecture-status-closeout-2026-03-06.md` 进入。
3. 若继续向 V2 微服务演进，优先做运行时拆分，而不是重复做单体治理。
