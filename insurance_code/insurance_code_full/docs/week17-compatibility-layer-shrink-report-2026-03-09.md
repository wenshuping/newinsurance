# Week17 兼容层收缩报告

更新时间：2026-03-09  
负责人：A 号

## 1. 目标

Week17 只做兼容层收缩、边界冻结和门禁加严，不做大规模迁移。

本轮回答 3 件事：

1. `server/skeleton-c-v1` 现在还承载哪些路由和写路径
2. 哪些残留可以下线，哪些必须保留，哪些只是桥接层
3. 如何把这套口径收进统一 gate，防止后续漂移

## 2. 当前兼容层盘点结果

盘点脚本：`node scripts/check_week17_compatibility_residuals.mjs`

当前结果：

1. compatibility-only route files：`9`
2. must-keep route files：`19`
3. bridge-only files：`43`
4. retire-now files：`0`

## 3. 可以下线的兼容路由层（compatibility-only）

这 9 个文件当前只承载已经由拆分服务 owned 的路由，本身不再承载额外未拆能力；因此它们属于“可收缩目标”，但本轮先不删除，只纳入 gate 冻结：

1. `server/skeleton-c-v1/routes/auth.routes.mjs`
2. `server/skeleton-c-v1/routes/activities.routes.mjs`
3. `server/skeleton-c-v1/routes/mall.routes.mjs`
4. `server/skeleton-c-v1/routes/orders.routes.mjs`
5. `server/skeleton-c-v1/routes/points.routes.mjs`
6. `server/skeleton-c-v1/routes/redemptions.routes.mjs`
7. `server/skeleton-c-v1/routes/b-admin-activity.routes.mjs`
8. `server/skeleton-c-v1/routes/p-admin-activities.routes.mjs`
9. `server/skeleton-c-v1/routes/p-admin-learning.routes.mjs`

判定口径：

1. 文件中所有 `app.get/post/put/patch/delete` 路由都已被 `user-service / points-service / learning-service / activity-service` 的 owned routes 覆盖
2. 文件内没有额外未拆路径
3. 文件仍保留的唯一原因是 legacy 兼容装配，而不是业务 owner 未拆完

## 4. 必须保留的 skeleton 路由层（must-keep）

这 19 个文件当前仍承载未拆或明确不在 Week5-Week16 拆分范围内的能力，不能误删：

1. `server/skeleton-c-v1/routes/health.routes.mjs`
2. `server/skeleton-c-v1/routes/user.routes.mjs`
3. `server/skeleton-c-v1/routes/insurance.routes.mjs`
4. `server/skeleton-c-v1/routes/learning.routes.mjs`
5. `server/skeleton-c-v1/routes/b-admin-auth.routes.mjs`
6. `server/skeleton-c-v1/routes/b-admin-customers.routes.mjs`
7. `server/skeleton-c-v1/routes/b-admin-content.routes.mjs`
8. `server/skeleton-c-v1/routes/b-admin-mall.routes.mjs`
9. `server/skeleton-c-v1/routes/b-admin-orders.routes.mjs`
10. `server/skeleton-c-v1/routes/p-admin-auth.routes.mjs`
11. `server/skeleton-c-v1/routes/p-admin-governance.routes.mjs`
12. `server/skeleton-c-v1/routes/p-admin-ops.routes.mjs`
13. `server/skeleton-c-v1/routes/p-admin-workforce.routes.mjs`
14. `server/skeleton-c-v1/routes/p-admin-mall.routes.mjs`
15. `server/skeleton-c-v1/routes/p-admin-tags.routes.mjs`
16. `server/skeleton-c-v1/routes/p-admin-metrics.routes.mjs`
17. `server/skeleton-c-v1/routes/p-admin-events.routes.mjs`
18. `server/skeleton-c-v1/routes/track.routes.mjs`
19. `server/skeleton-c-v1/routes/uploads.routes.mjs`

其中要特别说明：

1. `server/skeleton-c-v1/routes/learning.routes.mjs` 不能归到 compatibility-only
2. 原因不是 `GET /api/learning/courses*` 或 `POST /api/learning/courses/:id/complete`
3. 真正卡住它的是还挂着：
   - `GET /api/learning/games`
   - `GET /api/learning/tools`
4. 这两条当前仍未纳入 `learning-service` 稳定 owned routes，因此 `learning.routes.mjs` 必须保留

## 5. 只是桥接层的残留（bridge-only）

bridge-only 的意思是：这些文件还存在，但职责已经退化为“兼容装配 / 共享 usecase / 共享 repository / legacy 适配器”，不是未来长期 owner。

当前 bridge-only 文件共 `43` 个，可分 5 类：

### 5.1 user 域桥接

1. `server/skeleton-c-v1/usecases/auth-write.usecase.mjs`
2. `server/skeleton-c-v1/usecases/customer-assignment-write.usecase.mjs`
3. `server/skeleton-c-v1/usecases/user-write.usecase.mjs`
4. `server/skeleton-c-v1/repositories/auth-write.repository.mjs`
5. `server/skeleton-c-v1/repositories/user-write.repository.mjs`

### 5.2 points 域桥接

1. `server/skeleton-c-v1/usecases/signin.usecase.mjs`
2. `server/skeleton-c-v1/usecases/redeem.usecase.mjs`
3. `server/skeleton-c-v1/usecases/redemption-writeoff.usecase.mjs`
4. `server/skeleton-c-v1/usecases/order-create.usecase.mjs`
5. `server/skeleton-c-v1/usecases/order-pay.usecase.mjs`
6. `server/skeleton-c-v1/usecases/order-cancel.usecase.mjs`
7. `server/skeleton-c-v1/usecases/order-refund.usecase.mjs`
8. `server/skeleton-c-v1/usecases/mall-join-activity.usecase.mjs`
9. `server/skeleton-c-v1/usecases/mall-query.usecase.mjs`
10. `server/skeleton-c-v1/usecases/p-mall-write.usecase.mjs`
11. `server/skeleton-c-v1/usecases/b-mall-config-write.usecase.mjs`
12. `server/skeleton-c-v1/usecases/b-order-writeoff.usecase.mjs`
13. `server/skeleton-c-v1/repositories/points.repository.mjs`
14. `server/skeleton-c-v1/repositories/commerce.repository.mjs`
15. `server/skeleton-c-v1/repositories/signin-write.repository.mjs`
16. `server/skeleton-c-v1/repositories/redemption-write.repository.mjs`
17. `server/skeleton-c-v1/repositories/p-mall-write.repository.mjs`
18. `server/skeleton-c-v1/repositories/b-mall-config-write.repository.mjs`
19. `server/skeleton-c-v1/repositories/b-order-writeoff.repository.mjs`
20. `server/skeleton-c-v1/services/points.service.mjs`
21. `server/microservices/points-service/learning-reward.contract.mjs`
22. `server/microservices/points-service/activity-reward.contract.mjs`

### 5.3 learning 域桥接

1. `server/skeleton-c-v1/usecases/learning-query.usecase.mjs`
2. `server/skeleton-c-v1/usecases/learning-complete.usecase.mjs`
3. `server/skeleton-c-v1/usecases/p-learning-course-write.usecase.mjs`
4. `server/skeleton-c-v1/repositories/learning-write.repository.mjs`
5. `server/skeleton-c-v1/repositories/p-learning-course-write.repository.mjs`
6. `server/skeleton-c-v1/services/learning-reward.service.mjs`

### 5.4 activity 域桥接

1. `server/skeleton-c-v1/usecases/activity-complete.usecase.mjs`
2. `server/skeleton-c-v1/usecases/p-activity-write.usecase.mjs`
3. `server/skeleton-c-v1/usecases/b-activity-config-write.usecase.mjs`
4. `server/skeleton-c-v1/repositories/activity-write.repository.mjs`
5. `server/skeleton-c-v1/repositories/p-activity-write.repository.mjs`
6. `server/skeleton-c-v1/repositories/b-activity-config-write.repository.mjs`
7. `server/skeleton-c-v1/services/activity-reward.service.mjs`

### 5.5 公共装配桥接

1. `server/skeleton-c-v1/routes/p-admin.deps.mjs`
2. `server/skeleton-c-v1/routes/b-admin.deps.mjs`

## 6. 当前不能直接下线的原因

### 6.1 skeleton 仍承载未拆 C/B/P 路由

包括但不限于：

1. `GET /api/bootstrap`
2. `GET /api/health`
3. `GET|POST /api/insurance/*`
4. `POST /api/uploads/base64`
5. `POST /api/track/events`
6. `POST /api/b/auth/login`
7. `GET|POST /api/b/customers* / tags* / content* / mall* / orders*`
8. `POST /api/p/auth/login`
9. `GET|POST /api/p/tenants* / permissions* / approvals*`
10. `GET|POST /api/p/events* / tags* / tag-rules* / tag-rule-jobs*`
11. `GET|POST /api/p/teams* / customers* / employees*`
12. `GET|POST /api/p/metrics* / stats* / reconciliation* / ops/jobs*`
13. `GET /api/learning/games`
14. `GET /api/learning/tools`

### 6.2 现有 4 个拆分服务仍复用 skeleton 共享层

1. `user-service` 仍复用 skeleton usecase / repository 处理 auth / me 相关写路径
2. `points-service` 仍复用 skeleton usecase / repository / public route 处理账务和商城
3. `learning-service` 仍通过注入式 usecase 与 skeleton 共享逻辑完成课程完成与管理端 CRUD
4. `activity-service` 仍通过注入式 usecase 与 skeleton 共享逻辑完成活动完成与管理端 CRUD

## 7. 当前明确可以冻结的结论

1. `compatibility-only route files` 已经稳定识别，可作为未来清退清单
2. `must-keep route files` 当前是 skeleton 存续的真实原因，不能和兼容残留混淆
3. `bridge-only files` 已经被列表化，后续任何新增 bridge 文件都应视为边界回退，需要先过 gate
4. `retire-now files` 当前为 `0`，说明这轮不做物理删除，只做口径冻结与门禁

## 8. 本轮命令

1. `node scripts/check_week17_compatibility_residuals.mjs`
2. `node scripts/check_week17_route_ownership_drift.mjs`
3. `node scripts/check_week17_write_fallback_misuse.mjs`
