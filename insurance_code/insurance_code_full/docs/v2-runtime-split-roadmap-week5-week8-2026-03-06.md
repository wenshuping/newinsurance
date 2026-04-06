# V2 运行时拆分路线图（Week5-Week8）

更新时间：2026-03-06  
状态：`ACTIVE`

## 1. 目标

1. 在不破坏当前 `Node 模块化单体` 上线能力的前提下，推进到 `V2 微服务运行时 PoC`。
2. 将当前“只有边界设计和骨架”的状态，推进到“真实多进程可验证、可回滚、可灰度”的状态。
3. 本阶段只做最小闭环，不追求一次拆完所有服务。

## 2. 诊断（Diagnosis）

### 2.1 当前问题

1. 当前架构已经完成“单体内部治理”，但微服务能力仍停留在骨架层。
2. `gateway / user-service / points-service` 已有目录与最小 smoke，但尚未形成真实独立运行边界。
3. 当前业务仍共享同一进程状态层，无法验证真实网络失败、超时、重试、降级、灰度与回滚。

### 2.2 核心矛盾

1. 继续在单体内做治理，边际收益已经明显下降。
2. 直接大拆全部服务，风险过高，容易做成分布式单体。

### 2.3 本阶段判断

1. 正确策略不是“全面微服务化”。
2. 正确策略是“先做 3 服务运行时拆分闭环”，把最关键的工程风险先暴露出来。

## 3. 指导原则（Guiding Policies）

1. 先拆运行时，不先拆数据库。
   - Week5-Week8 保持单库，避免同时引入两类变量。
2. 先拆高价值路径，不追求全量覆盖。
   - 只优先验证 `auth / me / points / mall / orders / redemptions`。
3. 同步接口只走短链路，跨聚合长事务逐步改异步。
4. 禁止共享“写权限无边界”。
   - 即使单库，也要先定义“哪个服务对哪张表拥有主写权限”。
5. 保持回退简单。
   - 所有 V2 流量都必须能切回现有单体入口。

## 4. 范围（In / Out）

### 4.1 In Scope

1. `gateway-service`
2. `user-service`
3. `points-service`
4. 最小服务级运行脚本、健康检查、路由映射、相关 smoke
5. 服务级日志、trace_id、基础错误映射
6. Redis 最小接入（仅用于幂等/短期缓存/异步占位，若已有基础设施可复用）

### 4.2 Out of Scope

1. 不拆 `activity-service / learning-service / policy-service / b-admin-service / p-admin-service`
2. 不做正式数据库拆库
3. 不做 Kafka 级事件总线
4. 不做 Kubernetes / service mesh

## 5. 服务边界（本阶段）

### 5.1 gateway-service

职责：
1. 统一入口
2. 鉴权和 tenant context 注入
3. 路由分发
4. trace_id 透传
5. 灰度开关与回退开关

不负责：
1. 业务写逻辑
2. 聚合计算

### 5.2 user-service

职责：
1. `/api/auth/*`
2. `/api/me`
3. 会话身份、实名状态、基础用户画像

主写表建议：
1. `app_users`
2. `c_customers`
3. `c_sessions` 或等价会话表

### 5.3 points-service

职责：
1. `/api/points/*`
2. `/api/mall/*`
3. `/api/orders/*`
4. `/api/redemptions/*`
5. 签到、兑换、核销相关积分交易链路

主写表建议：
1. `c_point_accounts`
2. `c_point_transactions`
3. `p_products`
4. `p_orders`
5. `c_redeem_records`
6. `c_sign_ins`

## 6. 数据所有权（单库阶段）

### 6.1 原则

1. 单库不代表共享写权限。
2. 每张核心表先定义“主写服务”，其他服务只读或经 API 调用。

### 6.2 初版归属

| 表/聚合 | 主写服务 | 其他服务策略 |
|---|---|---|
| `app_users` / 身份会话 | `user-service` | `gateway/points` 只读 |
| `c_customers` / 客户基础档案 | `user-service` | `points` 只读 |
| `c_point_accounts` / `c_point_transactions` | `points-service` | `user` 只读 |
| `p_products` / `p_orders` / `c_redeem_records` | `points-service` | `user` 不直写 |
| `c_sign_ins` | `points-service` | `user` 只读 |

## 7. Week5-Week8 拆解

### 7.1 Week5：真实三进程跑通

目标：
1. `gateway-service`、`user-service`、`points-service` 真实分进程启动。
2. 本地与测试环境均可独立健康检查。

任务：
1. 抽出三服务独立启动入口
2. 固化端口、环境变量、health/readiness 接口
3. 网关转发改为真实 HTTP 调用，不再仅进程内拼装
4. 增加本地一键启动与一键回退脚本

DoD：
1. 三个进程都能单独启动
2. `GET /internal/gateway/routes` 能看到真实后端地址
3. `auth/me/points/mall/orders` 基础 smoke 通过

预计工时：`12h-16h`

### 7.2 Week6：边界固化与写权限收口

目标：
1. 禁止服务跨域直接写核心表。
2. 把单库阶段的数据边界写成代码门禁。

任务：
1. 补“表 -> 主写服务”治理文档
2. 为 `user-service` 和 `points-service` 建立 repository 白名单
3. 对跨域写入增加静态守卫或 smoke 校验
4. 为签到/兑换/核销链路明确事务边界

DoD：
1. 关键核心表都有主写服务归属
2. 新增跨域直写会被 lint/smoke 阻断
3. `signin -> points -> redeem -> order -> writeoff` 口径不变

预计工时：`10h-14h`

### 7.3 Week7：最小基础设施接入

目标：
1. 把服务间必需的非功能能力补上，但保持“标准套件”最小化。

任务：
1. Redis 接入
   - 幂等键
   - 短期缓存
   - 异步任务占位
2. trace_id / correlation_id 全链路透传
3. OpenTelemetry 最小埋点
4. Prometheus 指标暴露

DoD：
1. 服务日志可按 trace_id 串起来
2. 至少 3 个服务级指标可抓取
3. Redis 故障时关键链路有明确降级策略

预计工时：`12h-16h`

### 7.4 Week8：灰度、回退、故障演练

目标：
1. 做“可发布”的最小验证，不只是本地能跑。

任务：
1. 增加网关切流开关
2. 支持按路径或按租户灰度到 V2
3. 做单服务故障注入
4. 做一轮回滚演练
5. 输出发布 Runbook

DoD：
1. `auth/points/mall` 可通过开关切到 V2，再切回 V1
2. `points-service` 单独重启后链路可恢复
3. 有发布/回滚文档与演练记录

预计工时：`12h-18h`

## 8. 关键测试面

1. 契约一致性
   1. C 端 `me / points / mall` 与现有字段保持兼容
2. 交易正确性
   1. 签到加分
   2. 兑换扣分
   3. 核销幂等
3. 一致性
   1. 我的积分、活动中心、积分商城余额一致
4. 可靠性
   1. 网关转发超时
   2. points-service 重启恢复
   3. Redis 短暂不可用降级

配套测试文档沿用并扩展：
1. `./microservices-v2-test-cases.md`

## 9. 主要风险与控制

1. 风险：做成“分布式单体”
   - 控制：先定义主写边界，不允许任意服务直写任意表
2. 风险：一次拆太多导致联调失控
   - 控制：只拆 3 服务，不碰 B/P Admin 和学习/活动/保单
3. 风险：基础设施过度设计
   - 控制：只引入 Redis + OTEL + Prometheus 最小集，不引入 Kafka / K8s
4. 风险：回滚路径不清晰
   - 控制：所有 V2 入口由 gateway 开关控制，保留 V1 路由

## 10. 里程碑完成判定

### 10.1 Week5-Week8 完成后，表示什么

1. 已完成“微服务运行时第一阶段”。
2. 这时可以说：
   1. 架构整体完成度从当前约 `45%` 提升到约 `70%`
   2. 已进入“可灰度验证的微服务阶段”

### 10.2 仍未完成什么

1. 全域服务拆分
2. 数据库按服务拆分
3. 真正的消息总线与最终一致性体系
4. 生产级容器编排与 service mesh

## 11. 执行入口

1. 当前状态：`./architecture-status-closeout-2026-03-06.md`
2. 服务边界：`./week1-microservices-boundary-design-2026-03-04.md`
3. 微服务测试：`./microservices-v2-test-cases.md`

