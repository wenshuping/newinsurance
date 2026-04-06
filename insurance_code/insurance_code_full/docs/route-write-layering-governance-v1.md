# 写接口分层治理规范（Route/DTO/Usecase/Repository）

更新时间：2026-03-05  
状态：`ACTIVE`

## 1. 目标

1. 防止路由层回退到“直接拼业务 + 直接改状态”的实现。
2. 保证写接口统一走：`route -> DTO command -> usecase -> repository`。
3. 让新增接口具备可测试、可审计、可迁移到微服务的边界。

## 2. 强制约束

1. 任意写接口（`POST/PUT/DELETE`）必须满足：
   1. 路由文件引入 `../server/skeleton-c-v1/dto/write-commands.dto.mjs`
   2. 路由文件引入至少一个 `../server/skeleton-c-v1/usecases/` 下模块
   3. 路由层不直接操作状态存储（不直接写 `state.*`、不写 SQL）
2. DTO 只做“入参收敛与类型归一化”，不承载业务规则。
3. Usecase 负责业务编排与错误码抛出。
4. Repository 负责数据读写细节（持久化、查询、落盘）。

## 3. 静态门禁

1. 脚本：`scripts/check_route_write_dto_guard.mjs`
2. 命令：`npm run lint:route-write-dto-guard`
3. CI 门禁：已接入 `npm run ci:gate:core`
4. 失败条件：
   1. 存在写路由但未导入 `write-commands.dto`
   2. 存在写路由但未导入 `usecases` 模块

## 3.1 脚手架回归门禁

1. 脚本：`scripts/smoke_scaffold_write_layer.mjs`
2. 命令：`npm run test:smoke:scaffold-write-layer`
3. CI：已接入 `ci:gate:core`
4. 校验点：
   1. repository/usecase/report 文件可生成
   2. `--with-dto` 可追加 DTO 模板
   3. route 片段会写入 scaffold 报告

## 3.2 门禁执行留痕

1. 命令：`npm run ci:gate:core:report`
2. 输出目录：`docs/reports/`
3. 产物：
   1. `ci-gate-core-<timestamp>.json`
   2. `ci-gate-core-<timestamp>.md`
4. 默认保留最近 20 份（可用 `CI_GATE_REPORT_KEEP` 调整）。

## 3.3 Service 写入回退守卫

1. 脚本：`scripts/check_service_write_layer_guard.mjs`
2. 命令：`npm run lint:service-write-layer-guard`
3. CI：已接入 `ci:gate:core`
4. 校验点：
   1. `points/analytics/customer-assignment/commerce` service 必须绑定对应 repository
   2. 禁止 service 出现 `state.xxx =`、`state.xxx.push()` 等直接写入
   3. `commerce.service.mjs` 禁止回退 `persistState` 直调

## 4. 新增写接口标准步骤

0. 可选：先生成模板（减少手工重复）
   1. `npm run scaffold:write-layer -- --name <feature-slug>`
   2. 示例：`npm run scaffold:write-layer -- --name c-policy-upload`
   3. 若希望自动追加 DTO 模板：`npm run scaffold:write-layer -- --name c-policy-upload --with-dto`
   4. 若希望生成路由接入片段：
      - `npm run scaffold:write-layer -- --name c-policy-upload --route server/skeleton-c-v1/routes/uploads.routes.mjs --method post --path /api/uploads/base64`
   3. 输出：
      1. `repositories/<slug>-write.repository.mjs`
      2. `usecases/<slug>-write.usecase.mjs`
      3. `docs/reports/scaffold-<slug>-write-layer.md`（含 DTO/route 接入片段）
      4. 可选追加 `toXxxCommand` 到 `dto/write-commands.dto.mjs`（`--with-dto`）

1. 在 `server/skeleton-c-v1/dto/write-commands.dto.mjs` 新增 `toXxxCommand`
2. 在 `server/skeleton-c-v1/repositories/` 新增 `xxx-write.repository.mjs`
3. 在 `server/skeleton-c-v1/usecases/` 新增 `xxx-write.usecase.mjs`
4. 在对应 `routes/*.routes.mjs` 中仅保留：
   1. command 构造
   2. usecase 调用
   3. 错误码到 HTTP 的映射
5. 补回归：
   1. `npm run typecheck`
   2. 受影响模块 smoke
   3. `npm run test:smoke:api-core`

## 5. PR 自检清单

1. 写路由是否只做装配，不含业务分支？
2. DTO 是否只做字段规范化，不含状态写入？
3. usecase 是否只抛“字典内错误码”？
4. repository 是否封装了存储细节？
5. `lint:route-write-dto-guard` 是否通过？
6. `lint:service-write-layer-guard` 是否通过？
7. `error-code-dictionary-v1.md` 是否已补新增错误码？
8. `docs/week3-p0-route-split-progress-2026-03-04.md` 是否有增量记录？

## 6. 例外处理

1. 纯读接口（`GET`）不要求 DTO 命令，但推荐 query DTO。
2. 非业务写接口（如 health）不在此规范范围。
3. 若存在历史兼容逻辑，需在 route 只保留“兼容映射”，业务落在 usecase。
