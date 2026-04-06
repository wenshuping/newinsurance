# Week2 收口清单与 Week3 进入条件（2026-03-04）

状态：`READY_FOR_HANDOFF`

## 1. Week2 Done

1. C 端核心写路径完成 DTO + UseCase + 事务封装
   1. `/api/sign-in`
   2. `/api/mall/redeem`
   3. `/api/orders`
   4. `/api/orders/:id/pay`
   5. `/api/orders/:id/cancel`
   6. `/api/orders/:id/refund`
2. 新增事务回滚专项冒烟
   1. `scripts/smoke_transaction_writepaths.mjs`
   2. 验证积分不足失败时：订单/余额/库存均不脏写
3. Learning + Mall 路由完成第二批服务层下沉
   1. `learning-query` / `learning-complete`
   2. `mall-query` / `mall-join-activity`
4. DTO 白名单扩展并通过校验
   1. learning games/tools
   2. mall activities
   3. orders list
5. 错误码治理收口
   1. `error-code-dictionary` 补齐新增码
   2. `error-code-endpoint-matrix` 与当前路由同步
6. CI 统一门禁串联
   1. 新增 `ci:gate:core`
   2. `quality-gates.yml` 改为统一执行核心门禁
7. 发布前 preflight 落地
   1. 新增 `release:preflight`
   2. 若有 `DATABASE_URL` 先跑 FK precheck
8. GitHub 分支保护已生效（main）
   1. required checks 已配置
   2. PR/审批/会话收敛规则已开启

## 2. Week2 Pending

1. `p-admin` 大文件剩余拆分仍可继续细化到 service/repository（当前已显著下降但未完全结束）。
2. Learning 完成课程在部分模板权限下为 403，口径已记录为 `completionSkippedByPermission`，后续需要明确产品是否允许客户领取公司外模板积分。
3. B/P/C 三端“状态映射公共模块”尚未统一到单一 package（目前为多处文件复用，未抽成跨端共享包）。

## 3. 当前风险与缓解

1. 风险：权限口径变更容易影响 C 端可见性与领积分行为。
   1. 缓解：保留 `api-core + learning-mall-layer` 冒烟，并把 `NO_PERMISSION` 口径写入测试说明。
2. 风险：错误码新增但文档遗漏会造成前端处理缺失。
   1. 缓解：`docs:check:error-codes` 已纳入 `ci:gate:core`。
3. 风险：发布前未执行统一门禁导致线上回归不足。
   1. 缓解：`release:preflight` 作为发布前强制命令。

## 4. Week3 进入条件（Go/No-Go）

满足以下条件才进入 Week3：

1. `npm run release:preflight` 在目标分支通过。
2. `quality-gates` 在 PR 中绿灯（3 个 required checks 全通过）。
3. 关键文档处于最新：
   1. `docs/week2-write-transaction-progress-2026-03-04.md`
   2. `docs/error-code-dictionary-v1.md`
   3. `docs/error-code-endpoint-matrix-v1.md`

## 5. Week3 建议起步任务（按优先级）

1. P0：继续 `p-admin` 剩余路由拆分（router -> service -> repository），并补模块级 smoke。
2. P1：统一 B/P/C 状态映射函数为公共模块，减少口径分叉。
3. P1：补充发布回归报告模板（自动汇总 `release:preflight` 输出）。

