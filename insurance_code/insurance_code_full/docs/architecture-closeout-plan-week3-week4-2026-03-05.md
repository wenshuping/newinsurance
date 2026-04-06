# 架构收口计划（Week3-Week4）

更新时间：2026-03-06  
状态：`COMPLETE`

## 1. 范围与目标

1. 范围：`architecture-executable-v2` 的近期目标（模块化单体）收口。
2. 目标：两周内将当前架构完成度从约 `70%-80%` 提升到 `85%+`，满足稳定上线前的工程化要求。

## 2. 当前完成度评估

1. Week3-Week4 计划范围：已完成。
2. 已完成（实际交付）
   1. 多租户与权限安全主线
   2. P/B/C 路由模块化、deps 工厂与静态守卫
   3. 写接口分层（DTO / Usecase / Repository）与 DTO 白名单门禁
   4. 核心高频表增量持久化与防回退门禁
   5. 事件/指标口径版本化（字段 + API + 文档 + smoke）
   6. release preflight、报告治理、CI 一致化
   7. 性能基线、异步任务框架、SLO/告警基线
3. 当前剩余（不在本计划范围内）
   1. 真实跨进程微服务拆分与流量切换
   2. 按域数据库边界与数据迁移/双写策略
   3. Redis / MQ / OpenTelemetry / Prometheus-Grafana 生产化接入
   4. API Gateway 生产入口替换与发布拓扑切换
4. 后续入口
   1. 当前状态与下一阶段缺口：`./architecture-status-closeout-2026-03-06.md`
   2. 微服务边界设计输入：`./week1-microservices-boundary-design-2026-03-04.md`

## 3. P0（必须完成）

1. 仓储层下沉（router -> service -> repository）
   1. 状态：`DONE`
   1. 任务：为 CRM/Commerce/Tracking 建立 repository 接口与实现，路由不再直接操纵 state SQL。
   2. 工时：`16h`
   3. DoD：
      1. 新增 repository 模块并被 service 调用
      2. `state.mjs` 写路径直接 SQL 调用数下降（可量化）
      3. `npm run test:smoke:api-core` 通过
2. 增量持久化全覆盖（剩余表）
   1. 状态：`DONE`
   1. 任务：将当前仍采用 truncate-and-insert 的高频写表切增量同步或仓储化写入。
   2. 工时：`8h`
   3. DoD：
      1. `scripts/check_persistence_incremental_writepaths.mjs` 扩展覆盖并通过
      2. `ci:gate:core` 全绿
3. 事件/指标口径版本化快照
   1. 状态：`DONE`
   1. 任务：指标计算口径与事件字典增加版本字段与变更记录。
   2. 工时：`8h`
   3. DoD：
      1. 文档与代码中的版本号一致
      2. `test:smoke:status-caliber-cbp` 与指标 smoke 通过
4. 发布前性能基线
   1. 状态：`DONE`
   1. 任务：建立最小压测脚本与阈值检查（登录/列表/签到兑换）
   2. 工时：`6h`
   3. DoD：
      1. 新增性能基线脚本
      2. 输出可追溯报告到 `docs/reports/`

P0 合计：`38h`

## 4. P1（建议完成）

1. 异步任务框架（重算/补偿/对账）
   1. 状态：`DONE`
   1. 工时：`10h`
   2. DoD：至少 1 条任务链路可执行、可重试、可审计。
2. preflight 报告扩展
   1. 状态：`DONE`
   1. 工时：`4h`
   2. DoD：统一汇总 `risk/docs/smoke/perf/persist` 五类结果。
3. SLO 与告警基线
   1. 状态：`DONE`
   1. 工时：`6h`
   2. DoD：定义 3 个关键 SLI + 触发阈值，文档落地。

P1 合计：`20h`

## 5. 实际收口结果

1. 已完成的核心交付可从以下文档追溯：
   1. `./week3-p0-route-split-progress-2026-03-04.md`
   2. `./route-write-layering-governance-v1.md`
   3. `./persistence-incremental-writepaths-governance-v1.md`
   4. `./metric-event-versioning-v1.md`
   5. `./ops-async-jobs-framework-v1.md`
   6. `./reports-governance-v1.md`
   7. `./slo-alert-baseline-v1.md`
2. 本计划已转为“历史完成记录”，不再继续追加任务。

## 6. 验收命令（收口门禁）

```bash
npm run release:preflight
npm run ci:gate:core
npm run test:smoke:api-core
npm run lint:persistence:incremental-writepaths
npm run test:smoke:metric-event-versioning
```

## 7. 交接说明

1. 当前文件只保留为“Week3-Week4 收口完成记录”。
2. 新人从 `./architecture-status-closeout-2026-03-06.md` 进入，先看当前状态，再看下一阶段任务。
3. 任何破坏 `release:preflight` 或 `ci:gate:core` 的变更不得合并。
