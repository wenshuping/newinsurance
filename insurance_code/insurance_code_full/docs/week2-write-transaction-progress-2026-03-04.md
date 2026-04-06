# Week2 写路径事务化进展（2026-03-04）

状态：`DONE`

## 1. 范围

本次收口的是 C 端商城写路径：

1. `POST /api/mall/redeem`
2. `POST /api/orders`
3. `POST /api/orders/:id/pay`
4. `POST /api/orders/:id/cancel`
5. `POST /api/orders/:id/refund`
6. `POST /api/sign-in`

## 2. 改造点

1. 新增写命令 DTO：`server/skeleton-c-v1/dto/write-commands.dto.mjs`
2. 新增写仓储层：
   - `server/skeleton-c-v1/repositories/signin-write.repository.mjs`
   - `server/skeleton-c-v1/repositories/commerce-write.repository.mjs`
3. 新增用例层：
   - `server/skeleton-c-v1/usecases/signin.usecase.mjs`
   - `server/skeleton-c-v1/usecases/redeem.usecase.mjs`
   - `server/skeleton-c-v1/usecases/order-create.usecase.mjs`
   - `server/skeleton-c-v1/usecases/order-pay.usecase.mjs`
   - `server/skeleton-c-v1/usecases/order-cancel.usecase.mjs`
   - `server/skeleton-c-v1/usecases/order-refund.usecase.mjs`
4. 路由改为 DTO + UseCase 调用：
   - `server/skeleton-c-v1/routes/activities.routes.mjs`
   - `server/skeleton-c-v1/routes/mall.routes.mjs`
   - `server/skeleton-c-v1/routes/orders.routes.mjs`
5. 状态层新增事务封装：`runInStateTransaction(executor)`（`server/skeleton-c-v1/common/state.mjs`）

## 3. 回滚验证

新增 smoke：`scripts/smoke_transaction_writepaths.mjs`

验证场景：

1. 创建高积分商品（99999 分）
2. 新客户调用 `POST /api/mall/redeem`，预期 `INSUFFICIENT_POINTS`
3. 验证失败后无脏写入：
   - 订单数量不变
   - 积分余额不变
   - 商品库存不变

命令：

```bash
npm run test:smoke:transaction-writepaths
```

并已纳入核心回归：

```bash
npm run test:smoke:api-core
```

## 4. 第二批服务层下沉（Learning + Mall）

新增 usecase：

1. `server/skeleton-c-v1/usecases/learning-query.usecase.mjs`
2. `server/skeleton-c-v1/usecases/learning-complete.usecase.mjs`
3. `server/skeleton-c-v1/usecases/mall-query.usecase.mjs`
4. `server/skeleton-c-v1/usecases/mall-join-activity.usecase.mjs`

路由收敛：

1. `server/skeleton-c-v1/routes/learning.routes.mjs`
2. `server/skeleton-c-v1/routes/mall.routes.mjs`

新增 smoke：

1. `scripts/smoke_learning_mall_layer.mjs`
2. `npm run test:smoke:learning-mall-layer`

验证目标：

1. `learning` 列表/详情/完成课程（含重复完成幂等）
2. `mall` 列表接口可用
3. 与积分余额变更一致

## 5. DTO 白名单与错误码矩阵补齐

DTO 白名单新增覆盖：

1. `GET /api/learning/games`
2. `GET /api/learning/tools`
3. `GET /api/mall/activities`
4. `GET /api/orders`

文件：

1. `docs/dto-whitelist-v1.json`

校验结果：

1. `npm run test:smoke:dto-whitelist` 通过（14 个端点）

错误码矩阵已按当前路由重生成：

1. `docs/error-code-endpoint-matrix-v1.md`
2. `npm run docs:check:error-matrix` 通过

## 6. CI 质量门禁收口

新增统一门禁脚本：

1. `npm run ci:gate:core`

执行顺序：

1. `docs:check:error-codes`
2. `docs:check:error-matrix`
3. `test:smoke:dto-whitelist`
4. `test:smoke:api-core`

CI 工作流已改为调用统一脚本：

1. `.github/workflows/quality-gates.yml`

## 7. 发布前 preflight（P1）

新增脚本：

1. `scripts/release_preflight.mjs`
2. `npm run release:preflight`

规则：

1. 若设置 `DATABASE_URL`：先跑 `db:fk:precheck`
2. 然后强制执行 `ci:gate:core`

新增发布与分支保护说明文档：

1. `docs/release-branch-protection-v1.md`

并补充了 GitHub UI 复核步骤（Settings -> Branches -> main）用于交接验收。
