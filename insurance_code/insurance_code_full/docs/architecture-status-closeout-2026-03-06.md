# 当前架构状态与下一阶段缺口（2026-03-06）

更新时间：2026-03-06  
状态：`ACTIVE`

## 1. 结论

1. 当前唯一执行线仍是 `Node + Express 模块化单体`，见 `./adr-0001-architecture-decision.md`。
2. `Week3-Week4` 架构收口计划已完成，当前执行线已具备上线前工程化基线。
3. 距离 `V2 微服务最终态` 仍有明显差距，但差距已从“治理缺失”收敛为“运行时拆分与基础设施建设”。

## 2. 当前已完成到什么程度

### 2.1 模块化单体执行线

1. 完成度判断：`已收口完成`
2. 依据：
   1. P/B/C 路由已按域拆分，并有 deps 工厂与静态守卫。
   2. 写接口已形成 `Route -> DTO -> Usecase -> Repository` 主路径治理。
   3. 核心高频持久化表已切到增量同步治理，避免全表删写回退。
   4. 事件/指标已带版本号，API 可返回 `rulebookVersion` / `dictionaryVersion`。
   5. release preflight、核心 smoke、性能基线、SLO 基线、报告归档均已落地。

### 2.2 向 V2 微服务演进的准备度

1. 工程判断：`前置条件已完成，生产级拆分尚未开始`
2. 已有输入：
   1. 服务边界设计：`./week1-microservices-boundary-design-2026-03-04.md`
   2. Gateway / User Service / Points Service 骨架：`server/microservices/`
   3. 统一鉴权上下文与路由映射 smoke
3. 尚未完成：
   1. 真正的跨进程服务拆分
   2. 独立部署、独立扩缩容、独立故障隔离
   3. 按域 DB 边界与数据迁移
   4. API Gateway 真实流量切换

## 3. 本轮已交付能力清单

1. 安全与租户隔离
   1. 禁止默认身份兜底
   2. tenant context 强约束
   3. P/B/C 权限与可见范围回归基线
2. 路由与依赖治理
   1. `p-admin.routes.mjs`、`b-admin.routes.mjs`、`c-app.routes.mjs` 已模块化
   2. deps 工厂 + wiring lint 已接入 `ci:gate:core`
3. 写链路治理
   1. DTO 白名单
   2. Usecase 写入口
   3. Repository 分层
   4. FK 预检与孤儿数据修复脚本
4. 数据与持久化治理
   1. 真实 Postgres 表作为业务真源
   2. 核心高频表增量持久化
   3. 防回退静态门禁
5. 埋点、指标、标签治理
   1. 指标口径文档
   2. 事件字典文档
   3. 版本字段与版本返回
   4. 口径 smoke 回归
6. 发布工程化
   1. `release:preflight`
   2. `ci:gate:core`
   3. 性能基线 smoke
   4. SLO/告警基线文档
   5. 报告归档治理
7. 异步能力
   1. 对账/重算/补偿任务框架
   2. 任务可审计、可重试、可纳入门禁

## 4. 当前还差什么

### 4.1 如果目标是“当前执行线可上线”

1. 已不再缺少结构性 P0。
2. 剩余工作主要是常规业务开发、Bug 回归、发布演练，不是架构骨架问题。

### 4.2 如果目标是“V2 微服务最终态”

仍缺以下 6 类能力：

1. 运行时拆分
   1. 将 `gateway`、`user-service`、`points-service` 从骨架变成真实独立进程/容器。
2. 数据边界
   1. 明确每个服务的主表、共享表、只读表
   2. 补双写/迁移/回填/回滚方案
3. 异步总线
   1. Redis / MQ / Job Broker 落地
   2. 跨服务补偿不再依赖单进程内调度
4. 生产观测
   1. OpenTelemetry
   2. Prometheus / Grafana / Loki
   3. 按服务级别的告警
5. 发布拓扑
   1. API Gateway 作为统一入口
   2. 服务级灰度、回滚、容量规划
6. 契约冻结与切流
   1. V1/V2 契约并行
   2. 双栈验证
   3. 分批切流与回退策略

## 5. 下一阶段建议顺序

1. Week5：运行时拆分 PoC
   1. 先把 `gateway + user-service + points-service` 跑成 3 个独立进程
   2. 保持单库，不先拆库
2. Week6：服务边界固化
   1. 明确“谁可写哪张表”
   2. 给跨域调用补契约 smoke
3. Week7：基础设施接入
   1. Redis / MQ / OTEL / Prometheus-Grafana 最小集成
4. Week8：灰度与发布演练
   1. 网关切真实入口
   2. 做一轮服务级故障注入与回滚演练

## 6. 建议作为下一位工程师的阅读顺序

1. `./adr-0001-architecture-decision.md`
2. `./architecture-executable-v2.md`
3. `./architecture-closeout-plan-week3-week4-2026-03-05.md`
4. `./week3-p0-route-split-progress-2026-03-04.md`
5. `./route-write-layering-governance-v1.md`
6. `./persistence-incremental-writepaths-governance-v1.md`
7. `./metric-event-versioning-v1.md`
8. `./week1-microservices-boundary-design-2026-03-04.md`
9. `./v2-runtime-split-roadmap-week5-week8-2026-03-06.md`

## 7. 截止当前的硬门禁

```bash
npm run release:preflight
npm run ci:gate:core
npm run test:smoke:api-core
npm run test:smoke:metric-event-versioning
```

## 8. 备注

1. 本文档回答的是“当前架构状态”和“下一阶段差距”，不是重新定义执行线。
2. 执行线未变：先把 Node 模块化单体做稳，再推进微服务运行时拆分。
3. Week5-Week8 的具体执行计划见：`./v2-runtime-split-roadmap-week5-week8-2026-03-06.md`
