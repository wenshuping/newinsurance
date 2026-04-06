# Week5 三名全栈并行拆分计划（2026-03-06）

更新时间：2026-03-06  
状态：`ACTIVE`

## 1. 目标

1. 让 3 名全栈工程师并行推进 `Week5`，避免改同一批文件造成冲突。
2. 本轮只做 `V2 运行时拆分第一阶段`：
   1. `gateway-service`
   2. `user-service`
   3. `points-service`

## 2. 总体分工原则

1. 按“服务边界”拆，不按“前后端”拆。
2. 每个人都负责自己工作流的前后端、脚本、文档、smoke。
3. 公共文件只允许 1 个人主改，其他人通过接口适配。
4. 合并顺序固定，避免互相堵塞。

## 3. 三人分工

### A 号工程师：Gateway + 入口编排

负责范围：
1. `server/microservices/gateway/`
2. 网关入口启动脚本
3. 路由映射、灰度开关、回退开关
4. trace_id 透传
5. 本地一键启动脚本中的网关部分

主要任务：
1. 把 gateway 从“骨架”改成真实 HTTP 转发入口
2. 统一转发到 `user-service` 与 `points-service`
3. 增加：
   1. `/health`
   2. `/ready`
   3. `/internal/gateway/routes`
4. 增加 V1/V2 切流配置
5. 补网关级 smoke

前端相关：
1. 不改业务页面
2. 只允许改 API base URL、gateway 联调配置、dev 代理

禁止碰：
1. 积分交易内部逻辑
2. 用户域内部写逻辑

交付物：
1. 网关启动说明
2. 网关路由映射文档
3. 网关 smoke 脚本

建议分支：
1. `codex/week5-gateway-runtime-split`

### B 号工程师：User Service

负责范围：
1. `server/microservices/user-service/`
2. 认证、实名、`/api/me`
3. `app_users / c_customers / 会话` 相关读写边界
4. 用户域 smoke 和接口兼容

主要任务：
1. 把 `auth/me` 相关逻辑收进 `user-service`
2. 固化 user-service 主写边界
3. 定义 user-service 对外契约
4. 增加：
   1. `/health`
   2. `/ready`
   3. 契约 smoke
5. 保证现有 C 端登录和个人页字段不变

前端相关：
1. 配合 A 号验证 C 端登录/我的页面
2. 若字段需兼容处理，只改桥接层，不改页面语义

禁止碰：
1. 商城、积分、订单、核销逻辑
2. 网关路由规则主文件

交付物：
1. user-service API 契约说明
2. user-service 主写表说明
3. 登录/我的页回归脚本

建议分支：
1. `codex/week5-user-service-split`

### C 号工程师：Points Service

负责范围：
1. `server/microservices/points-service/`
2. `/api/points/*`
3. `/api/mall/*`
4. `/api/orders/*`
5. `/api/redemptions/*`
6. 签到、积分、兑换、核销链路

主要任务：
1. 把积分与商城相关逻辑收进 `points-service`
2. 固化：
   1. 积分账户
   2. 积分流水
   3. 商品
   4. 订单
   5. 核销记录
   6. 签到记录
3. 增加：
   1. `/health`
   2. `/ready`
   3. 交易链路 smoke
4. 保证积分跨页面一致
5. 保证签到/兑换/核销幂等语义不变

前端相关：
1. 配合 A 号验证 C 端：
   1. 活动中心积分
   2. 积分商城
   3. 积分明细
2. 如果 API 返回兼容需要桥接，只改 `src/lib/api.ts` 之类桥接层

禁止碰：
1. 登录、实名、用户主资料写逻辑
2. 网关总路由主文件

交付物：
1. points-service API 契约说明
2. 交易链路主写表说明
3. 签到/兑换/核销回归脚本

建议分支：
1. `codex/week5-points-service-split`

## 4. 公共文件归属

以下文件只允许指定负责人主改：

1. 网关主改：
   1. `server/microservices/gateway/`
   2. `server/microservices/gateway.mjs`
   3. 启动编排脚本中 gateway 部分
2. User 主改：
   1. `server/microservices/user-service/`
   2. `auth-context` 中 user 域相关部分
3. Points 主改：
   1. `server/microservices/points-service/`
   2. points/mall/orders/redemptions 相关 service/repository
4. Tech lead 或最后整合人统一改：
   1. `package.json`
   2. 总 smoke 编排脚本
   3. 总文档索引

## 5. 依赖关系与合并顺序

### 5.1 先后依赖

1. A 号先把 gateway 的转发框架和端口约定定下来。
2. B、C 号并行实现各自服务，只对齐接口地址和契约。
3. 最后由 A 号或整合人完成联调收口。

### 5.2 建议合并顺序

1. 第一批合并：
   1. A 号的 gateway 骨架和环境变量约定
2. 第二批合并：
   1. B 号 user-service
   2. C 号 points-service
3. 第三批合并：
   1. 联调脚本
   2. 总 smoke
   3. 文档更新

## 6. 每个人的 DoD

### A 号 DoD

1. gateway 独立启动
2. 能转发到 user-service / points-service
3. `internal/gateway/routes` 可用
4. 有 smoke

### B 号 DoD

1. user-service 独立启动
2. `auth / me` 走真实服务
3. C 端登录和“我的”页可用
4. 有 smoke

### C 号 DoD

1. points-service 独立启动
2. `points / mall / orders / redemptions` 走真实服务
3. 签到/积分/兑换/核销链路通过
4. 有 smoke

## 7. 统一联调检查项

1. `GET /api/health`
2. 登录
3. `GET /api/me`
4. `GET /api/points/summary`
5. `GET /api/mall/items`
6. `POST /api/sign-in`
7. `POST /api/mall/redeem`
8. `POST /api/redemptions/:id/writeoff`

## 8. 每日同步机制

1. 每天只同步 3 件事：
   1. 今天改了哪些入口
   2. 现在阻塞点是什么
   3. 明天要别人配合什么
2. 不要口头约定，全部写到各自分支说明或文档里。

## 9. 风险控制

1. 如果三个人都去改 `package.json`，一定会冲突。
   - 解决：统一由整合人最后改。
2. 如果三个人都去改 `src/pages` 或页面组件，容易把联调问题伪装成架构问题。
   - 解决：本轮前端只允许改 API 桥接层和环境配置。
3. 如果 B 号和 C 号都去改公共 auth/tenant 中间件，容易串逻辑。
   - 解决：公共中间件改动由 A 号主导，B/C 提 PR 说明需求。

## 10. 推荐你怎么分配

1. 最强后端那个人：A 号，做 gateway
2. 对登录/权限最熟的人：B 号，做 user-service
3. 对积分/订单/事务最熟的人：C 号，做 points-service

## 11. 阅读入口

1. 总状态：`./architecture-status-closeout-2026-03-06.md`
2. 总路线图：`./v2-runtime-split-roadmap-week5-week8-2026-03-06.md`
3. 本文档：`./week5-three-fullstack-parallel-plan-2026-03-06.md`

