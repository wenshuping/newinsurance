# Week1 微服务边界设计与落地说明（2026-03-04）

## 1. 目标与范围

本设计文档对应 V2 计划 Week1，目标是先完成“可执行骨架”，不打断现网单体能力：

1. 划清服务边界（User / Points）
2. 给出 API Gateway 路由映射（可查询）
3. 落统一鉴权上下文（JWT + tenant context）
4. 提供最小可运行验证（smoke）

> 非目标（Week1 不做）：数据库拆库、分布式事务、事件总线、生产流量切换。

## 2. 当前实现形态（As-Is）

- 现状是模块化单体：`server/skeleton-c-v1/*`
- 所有路由在一个 Express 进程挂载
- 状态/数据读写由 `common/state.mjs` 统一承载

## 3. 目标形态（Week1 To-Be）

### 3.1 上下文图（文本）

- `API Gateway`（统一入口，鉴权、租户上下文、路由编排）
- `User Service`（认证、会话、用户画像）
- `Points Service`（积分、商城、兑换、订单）
- `Shared State`（当前阶段沿用现有状态层，Week2 再演进仓储与事务）

### 3.2 服务边界

1. **user-service（身份域）**
- 负责：`/api/auth/*`、`/api/me`
- 主体能力：验证码登录、实名注册/登录、会话身份读取

2. **points-service（积分交易域）**
- 负责：`/api/points/*`、`/api/mall/*`、`/api/redemptions/*`、`/api/orders/*`
- 主体能力：积分查询、商城浏览/兑换、兑换记录与核销、订单查询

3. **gateway（流量入口）**
- 负责：跨域、统一认证上下文、租户上下文注入、服务路由可观测

## 4. 路由归属与契约

路由映射已固化为代码清单：
- `server/microservices/gateway/route-map.mjs`

核心归属：
- user-service: `/api/auth/send-code`, `/api/auth/verify-basic`, `/api/me`
- points-service: `/api/points/*`, `/api/mall/*`, `/api/redemptions/*`, `/api/orders/*`

网关暴露内部可见路由：
- `GET /internal/gateway/routes`（用于核对服务边界）

## 5. 鉴权与租户上下文设计

统一中间件：
- `server/microservices/shared/auth-context.mjs`

策略：
1. 解析 `Authorization` -> `req.user` / `req.session`
2. 解析 `x-tenant-id|x-tenant-code|x-tenant-key` -> `req.tenantContext`
3. `/api/p/*` `/api/b/*` 强制登录
4. 开启 `REQUIRE_TENANT_CONTEXT=true` 时，对 `p/b/track` 路径强制 tenant 上下文

## 6. 已落地代码（Week1）

1. Gateway
- `server/microservices/gateway/app.mjs`
- `server/microservices/gateway.mjs`
- `server/microservices/gateway/route-map.mjs`

2. Services
- `server/microservices/user-service/router.mjs`
- `server/microservices/points-service/router.mjs`

3. Shared
- `server/microservices/shared/auth-context.mjs`

4. Smoke
- `scripts/smoke_gateway_week1.mjs`
- `npm run test:smoke:gateway-week1`

## 7. 运行与验证

### 7.1 启动网关（Week1 骨架）

```bash
cd "$(git rev-parse --show-toplevel)"
npm run dev:api:gateway
```

### 7.2 运行 Week1 smoke

```bash
npm run test:smoke:gateway-week1
```

预期：
- `gateway.health` = 200
- `gateway.routes` = 200 且存在 2+ 服务映射
- `api.health` = 200

## 8. 风险与权衡

1. 目前仍是“进程内聚合”而非真实跨进程 RPC
- 好处：低风险、快速验证边界
- 风险：尚未验证网络级失败模式

2. 仍复用现有状态层
- 好处：不破坏当前业务
- 风险：Week2 前仍存在状态层耦合

3. JWT/tenant 校验策略已统一，但授权矩阵尚未服务化
- 计划在 Week3/Week4 进入策略中心

## 9. 下一步（Week2 接口）

1. 从路由函数抽仓储层与用例层（DTO + Repository）
2. 为 signin/redeem/order 增加事务边界
3. 将 FK 预检接入 API prestart（阻断上线）
4. 移除 runtime_state 业务写路径

## 10. 状态标记

- Week1.1 服务边界定义：`DONE`
- Week1.2 网关路由映射：`DONE`
- Week1.3 统一鉴权上下文：`DONE`
- Week1.4 最小 smoke：`DONE`
- Week1.5 生产流量切换：`TODO`（不在 Week1 范围）

## 11. 变更记录

- 2026-03-04: 初版创建并与代码骨架同步。
