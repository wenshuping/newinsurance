# Points Write Boundary

## Main-write tables

- `c_point_accounts`
- `c_point_transactions`
- `p_products`
- `p_orders`
- `c_redeem_records`
- `c_sign_ins`

Week6 single-database mode still allows other domains to read these aggregates, but direct write ownership is controlled as `points-service`.

## Boundary whitelist

Source of truth:

- `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/points-service/write-boundary-whitelist.json`

### Route whitelist

- `server/microservices/points-service/router.mjs`
- `server/microservices/points-service/sign-in.route.mjs`
- `server/skeleton-c-v1/routes/points.routes.mjs`
- `server/skeleton-c-v1/routes/mall.routes.mjs`
- `server/skeleton-c-v1/routes/orders.routes.mjs`
- `server/skeleton-c-v1/routes/redemptions.routes.mjs`
- `server/skeleton-c-v1/routes/p-admin-mall.routes.mjs`
- `server/skeleton-c-v1/routes/b-admin-mall.routes.mjs`
- `server/skeleton-c-v1/routes/b-admin-orders.routes.mjs`

### Usecase whitelist

- `server/skeleton-c-v1/usecases/signin.usecase.mjs`
- `server/skeleton-c-v1/usecases/redeem.usecase.mjs`
- `server/skeleton-c-v1/usecases/redemption-writeoff.usecase.mjs`
- `server/skeleton-c-v1/usecases/order-create.usecase.mjs`
- `server/skeleton-c-v1/usecases/order-pay.usecase.mjs`
- `server/skeleton-c-v1/usecases/order-cancel.usecase.mjs`
- `server/skeleton-c-v1/usecases/order-refund.usecase.mjs`
- `server/skeleton-c-v1/usecases/mall-join-activity.usecase.mjs`
- `server/skeleton-c-v1/usecases/mall-query.usecase.mjs`
- `server/skeleton-c-v1/usecases/p-mall-write.usecase.mjs`
- `server/skeleton-c-v1/usecases/b-mall-config-write.usecase.mjs`
- `server/skeleton-c-v1/usecases/b-order-writeoff.usecase.mjs`

### Repository whitelist

- `server/skeleton-c-v1/repositories/points.repository.mjs`
- `server/skeleton-c-v1/repositories/commerce.repository.mjs`
- `server/skeleton-c-v1/repositories/signin-write.repository.mjs`
- `server/skeleton-c-v1/repositories/redemption-write.repository.mjs`
- `server/skeleton-c-v1/repositories/p-mall-write.repository.mjs`
- `server/skeleton-c-v1/repositories/b-mall-config-write.repository.mjs`
- `server/skeleton-c-v1/repositories/b-order-writeoff.repository.mjs`

Rule:

- route/usecase/service 层不允许直写 6 张主写表
- direct write 只允许出现在上述 whitelist repository 中
- `server/skeleton-c-v1/common/state.mjs` 作为底层存储/同步基础设施，不作为业务边界 owner 判定目标

## Scan result

Direct-write clean scopes:

- `server/microservices/gateway/**`
- `server/microservices/user-service/**`

Result:

- 没有发现 `gateway-service` 对 6 张 points 主写表的直写
- 没有发现 `user-service` 对 6 张 points 主写表的直写

Cross-domain callers found but not classified as direct writes:

- `server/skeleton-c-v1/usecases/auth-write.usecase.mjs`
  - onboarding 时调用 `recordPoints()`
- `server/skeleton-c-v1/usecases/activity-complete.usecase.mjs`
  - 活动完成奖励时调用 `settleActivityReward()`
- `server/skeleton-c-v1/usecases/learning-complete.usecase.mjs`
  - 学习完成奖励时调用 `settleLearningCourseReward()`

These callers still go through `points.service -> points.repository`, so they are boundary dependencies, not direct table writes.

Week13 additional rule:

- learning 奖励不得再直接调用 `appendPoints()`
- learning 奖励只能通过 `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/points-service/learning-reward.contract.mjs`
- 这条规则是 Week13 阻塞解除前提，不是备注项

Week15 additional rule:

- activity 奖励不得再直接调用 `recordPoints()` 或 `appendPoints()`
- activity 奖励只能通过 `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/points-service/activity-reward.contract.mjs`
- `activity-service` 不得直写 `c_point_accounts / c_point_transactions / p_orders / c_redeem_records / c_sign_ins`

Week18 additional rule:

- learning 奖励链路 final review 继续要求：
  - `server/microservices/learning-service/c-learning.routes.mjs` 只能注入 `settleLearningRewardOverHttp`
  - `server/skeleton-c-v1/routes/learning.routes.mjs` 只能通过 `settleLearningCourseRewardViaPointsService`
  - `server/skeleton-c-v1/services/learning-reward.service.mjs` 不得回退到 `recordPoints()` 或 `appendPoints()`
- `learning-service` 及其 legacy 兼容层不得直写 `c_point_accounts / c_point_transactions / p_products / p_orders / c_redeem_records / c_sign_ins`
- Week18 final review 入口：
  - `node scripts/check_learning_points_final_boundary.mjs`
  - `node scripts/review_learning_points_legacy_routes_week18.mjs`
  - `node scripts/gate_learning_points_final_boundary.mjs`

## Smoke

Boundary smoke:

```bash
node scripts/smoke_points_boundary_week5.mjs
```

Frontend bridge guard:

```bash
node scripts/check_points_frontend_bridge_week6.mjs
```

Business smoke:

```bash
node scripts/smoke_points_service_week5.mjs
```

Week13 learning reward smoke:

```bash
node scripts/smoke_points_learning_reward_week13.mjs
```

Week15 activity reward smoke:

```bash
node scripts/smoke_activity_points_reward_phase1.mjs
```

Week15 activity Phase 1 gate:

```bash
node scripts/gate_activity_service_phase1.mjs
```
