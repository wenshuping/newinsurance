# Week9-Week12 生产化路线图（Runtime Split Aftercare）

更新时间：2026-03-07  
状态：`ACTIVE`
前置完成条件：`Week5 Done`、`Week6 Done`、`Week7 Done`、`Week8 Done`

## 1. 结论

当前 `gateway-service`、`user-service`、`points-service` 已完成：

1. 运行时拆分
2. 主写边界冻结
3. 可观测性基线
4. 发布/回退演练

下一阶段不应该继续横向增加新服务，而应该先把这 3 个服务做成“可部署、可实库运行、可灰度、可上线”的生产基线。

## 2. 诊断（Diagnosis）

### 2.1 当前最大的缺口

当前主要缺口不再是代码结构，而是生产化能力：

1. 仍主要基于本地与演练环境验证，不是完整生产部署基线
2. `file/dbjson` 与实库 Postgres 的长期运行验证还不够
3. 边界治理目前以 `gate + smoke + whitelist + static scan` 为主，尚未进入更硬的 DB/权限级隔离
4. 灰度切流已能演练，但还未形成真正的上线节奏和租户级流量治理策略
5. 下一批服务（`activity-service`、`learning-service`）虽然可以设计，但当前不宜立即开拆

### 2.2 这一阶段真正要解决的问题

1. 把“可联调”升级为“可试运行”
2. 把“可回退”升级为“可上线”
3. 把“单库多服务”从口径治理升级到更硬的运行治理
4. 给下一批服务拆分提供稳定模板，而不是继续复制临时做法

## 3. 指导原则（Guiding Policies）

1. 先生产化，再继续拆服务
2. 先做实库验证，再谈拆库
3. 先把现有 3 个服务做稳，再新增 `activity-service` / `learning-service`
4. 不引入不必要的新技术栈，继续采用现有 `Node + Express + Postgres + Gateway` 标准件
5. 新阶段优先交付：部署、Runbook、DB 约束、灰度能力、上线判定，而不是新页面和新功能

## 4. 执行总览

| 周次 | 主题 | 目标 | 负责人建议 |
|---|---|---|---|
| Week9 | 部署基线 | 从联调态进入准生产可部署态 | A 主，B/C 配合 |
| Week10 | 实库验证 | 在真实 Postgres 下跑通全链路并补硬约束 | C 主，B 配合，A 收口 |
| Week11 | 灰度治理 | 把切流从演练能力升级为上线能力 | A 主，B/C 提供指标支撑 |
| Week12 | 下一批服务设计包 | 为 `activity` / `learning` 拆分输出设计包 | 架构主导，A/B/C 评审 |

## 5. Week9：部署基线

### 5.1 目标

把当前三服务从“本地可跑”推进到“准生产可部署”。

### 5.2 任务

1. 补齐容器化与启动编排
   1. `gateway-service`
   2. `user-service`
   3. `points-service`
2. 固化环境变量模板
   1. `dev`
   2. `staging`
   3. `prod`
3. 补服务级部署 Runbook
4. 明确日志、配置、端口、依赖的部署规范
5. 增加一条“部署后健康检查”脚本

### 5.3 交付物

1. `docker-compose` 或同级本地/预发编排文件
2. 环境变量模板文档
3. 部署 Runbook
4. 部署后健康检查脚本
5. Week9 部署 smoke

### 5.4 完成标准

1. 一条命令能拉起完整三服务栈
2. staging 配置可独立启动
3. 健康检查、`/ready`、`/metrics` 可用
4. 发布后检查可复跑

## 6. Week10：实库验证与数据隔离增强

### 6.1 目标

把 runtime split 从 `file/dbjson` 联调基线推进到真实 Postgres 运行验证。

### 6.2 任务

1. 在真实 Postgres 连接方式下复跑：
   1. 登录
   2. `/api/me`
   3. 签到
   4. 积分汇总/明细
   5. 商城商品/活动
   6. 兑换
   7. 订单列表/详情
   8. 核销
2. 补 DB 级约束方案：
   1. 关键 FK
   2. 幂等键
   3. 唯一索引
   4. 高风险表索引检查
3. 输出单库多服务下的 DB 权限/隔离方案草案
4. 识别长期仍需运行在共享库上的风险点

### 6.3 交付物

1. Week10 Postgres 验证报告
2. DB 约束补强清单
3. 单库多服务权限方案草案
4. Week10 实库 smoke

### 6.4 完成标准

1. 三服务在 Postgres 下跑通 Week8 gate 主链路
2. 核心交易链路无明显一致性问题
3. 关键高风险表有约束补强方案

## 7. Week11：灰度与流量治理

### 7.1 目标

让 `V1/V2` 切流从“测试开关”升级为“上线策略”。

### 7.2 任务

1. 增加租户级灰度开关
2. 增加路径级灰度规则
3. 明确自动/人工回退判定条件
4. 补上线看板口径：
   1. login success rate
   2. `/api/me` 401 rate
   3. sign-in success rate
   4. redeem success rate
   5. writeoff success rate
   6. fallback total
5. 做一次完整灰度演练

### 7.3 交付物

1. 灰度策略文档
2. 回退判定文档
3. 上线观测看板口径文档
4. Week11 灰度演练报告

### 7.4 完成标准

1. 可按租户切 V2
2. 可按路径灰度
3. 出问题可快速回 V1
4. 灰度期间关键指标可观测

## 8. Week12：下一批服务拆分设计包

### 8.1 目标

不直接开拆新服务，而是把下一批拆分工作准备成可执行包。

### 8.2 候选服务

1. `activity-service`
2. `learning-service`

### 8.3 任务

1. 定 owned routes
2. 定主写表归属
3. 定共享只读边界
4. 定迁移顺序
5. 定 smoke / gate / release-check 模板
6. 定灰度进入顺序

### 8.4 交付物

1. `activity-service` 设计包
2. `learning-service` 设计包
3. 扩展版 ownership matrix
4. Week13+ 执行建议

### 8.5 完成标准

1. 下一批服务边界可评审
2. 有迁移顺序和风险清单
3. 但本周不直接开拆生产代码

## 9. A/B/C 分工建议

### 9.1 A 号

1. Week9：部署与健康检查编排
2. Week11：灰度切流、回退、发布判定
3. Week12：新服务拆分模板与总 gate 模板

### 9.2 B 号

1. Week9：user-service 部署与配置基线
2. Week10：user 域 Postgres 实库验证
3. Week11：user 域灰度指标支撑
4. Week12：`learning-service` 边界评审

### 9.3 C 号

1. Week9：points-service 部署与配置基线
2. Week10：points 域 Postgres 实库验证
3. Week11：交易链路灰度指标支撑
4. Week12：`activity-service` 边界评审

## 10. 本阶段不做的事

1. 不立即拆 `activity-service` / `learning-service` 代码
2. 不立即做物理拆库
3. 不引入 MQ / Redis / service mesh 作为前置条件
4. 不扩 C 端/B 端/P 端新业务功能
5. 不打破 Week6/Week7/Week8 已冻结边界

## 11. 风险与取舍

### 11.1 风险

1. 如果跳过 Week9/Week10，直接继续拆服务，会把联调复杂度放大到生产环境
2. 如果没有实库验证，当前 gate 通过并不代表生产数据链路一定稳定
3. 如果没有灰度策略，V1/V2 切换只能算测试能力，不能算上线能力

### 11.2 取舍

1. 当前最优策略是“少拆服务，先稳运行”
2. 先把三服务做成标准模板，再复制到后续服务域
3. 这条路线更慢，但风险显著更低

## 12. 推荐阅读顺序

1. `./week5-runtime-split-integration-report-2026-03-07.md`
2. `./week6-runtime-split-runbook-2026-03-07.md`
3. `./week6-write-ownership-matrix-2026-03-07.md`
4. `./week7-runtime-split-runbook-2026-03-07.md`
5. `./week8-runtime-release-rollback-runbook-2026-03-07.md`
6. `./week8-runtime-go-live-criteria-2026-03-07.md`

## 13. 一句话结论

`Week9-Week12` 的重点不是继续“多拆几个微服务”，而是把当前三服务做成真正可部署、可实库运行、可灰度、可上线的生产基线；新服务拆分应在这条基线稳定后再继续推进。
