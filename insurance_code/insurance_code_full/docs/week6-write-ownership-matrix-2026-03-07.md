# 全仓统一主写表归属总表（Week6 当前生效范围）

更新时间：2026-03-07  
状态：`ACTIVE`
验收状态：`WEEK6_DONE`

## 1. 文档目的

1. 把当前 `Week6 runtime split` 已冻结的主写边界收成一张统一总表。
2. 让后续工程师不需要分别翻 `user-service`、`points-service` 文档再拼接口径。
3. 明确：
   1. 哪张表由哪个服务主写
   2. 哪些服务只允许只读
   3. 哪些写法会被当前门禁拦截
   4. 哪些还只是“暂未纳入本轮治理范围”

## 2. 当前适用范围

这是一份“统一总表”，但当前只对 `Week6` 已冻结的运行时拆分范围生效：

1. `gateway-service`
2. `user-service`
3. `points-service`

不在本表主写治理范围内的模块，不表示“可以随便写”，只表示：

1. 当前尚未纳入 `Week6` 服务边界冻结范围
2. 需要在后续阶段继续补齐 ownership matrix

## 3. 统一原则

1. 单库不等于共享写权限。
2. 每张核心表必须先定义主写服务，再允许其他服务只读或经 API 调用。
3. `gateway-service` 不承载业务主写。
4. `user-service` 只负责身份、客户基础资料、会话边界。
5. `points-service` 只负责积分、商城、订单、核销、签到链路。

## 4. Week6 已冻结 Ownership Matrix

| 表 / 聚合 | 主写服务 | 允许只读服务 | 禁止直写服务 | 当前门禁 / smoke | 当前状态 | 备注 |
|---|---|---|---|---|---|---|
| `app_users` | `user-service` | `gateway-service`, `points-service`, `v1-monolith` | `points-service` | `check_user_service_boundary_guard.mjs`, `smoke_user_service_boundary.mjs` | `frozen` | 身份与基础用户主档 |
| `c_customers` | `user-service` | `gateway-service`, `points-service`, `v1-monolith` | `points-service` | `check_user_service_boundary_guard.mjs`, `smoke_user_service_boundary.mjs` | `frozen` | 客户基础档案与实名侧边界 |
| `p_sessions` | `user-service` | `gateway-service`, `points-service`, `v1-monolith` | `points-service` | `check_user_service_boundary_guard.mjs`, `smoke_user_service_boundary.mjs` | `frozen` | 登录态 / session 聚合 |
| `c_point_accounts` | `points-service` | `gateway-service`, `user-service`, `v1-monolith` | `user-service` | `write-boundary-whitelist.json`, `smoke_points_boundary_week5.mjs` | `frozen` | 积分账户 |
| `c_point_transactions` | `points-service` | `gateway-service`, `user-service`, `v1-monolith` | `user-service` | `write-boundary-whitelist.json`, `smoke_points_boundary_week5.mjs` | `frozen` | 积分流水 |
| `p_products` | `points-service` | `gateway-service`, `user-service`, `v1-monolith` | `user-service` | `write-boundary-whitelist.json`, `smoke_points_boundary_week5.mjs` | `frozen` | 商城商品聚合 |
| `p_orders` | `points-service` | `gateway-service`, `user-service`, `v1-monolith` | `user-service` | `write-boundary-whitelist.json`, `smoke_points_boundary_week5.mjs` | `frozen` | 订单主表 |
| `c_redeem_records` | `points-service` | `gateway-service`, `user-service`, `v1-monolith` | `user-service` | `write-boundary-whitelist.json`, `smoke_points_boundary_week5.mjs` | `frozen` | 兑换/核销记录 |
| `c_sign_ins` | `points-service` | `gateway-service`, `user-service`, `v1-monolith` | `user-service` | `write-boundary-whitelist.json`, `smoke_points_boundary_week5.mjs` | `frozen` | 签到记录 |

## 5. 未纳入 Week6 冻结的服务域

下表不是“未定义”，而是“尚未纳入本轮运行时拆分主写冻结”，后续需要继续补齐：

| 服务域 | Week6 状态 | 说明 |
|---|---|---|
| `activity-service` | `out_of_scope` | 尚未完成独立运行时拆分，暂不纳入本轮主写冻结 |
| `learning-service` | `out_of_scope` | 尚未完成独立运行时拆分，暂不纳入本轮主写冻结 |
| `policy-service` | `out_of_scope` | 尚未完成独立运行时拆分，暂不纳入本轮主写冻结 |
| `b-admin-service` | `out_of_scope` | 当前仍属于管理面能力，不在 Week6 服务边界冻结范围 |
| `p-admin-service` | `out_of_scope` | 当前仍属于管理面能力，不在 Week6 服务边界冻结范围 |

## 6. 服务职责边界

### 6.1 gateway-service

只负责：

1. 路由映射
2. V1/V2 切流
3. 回退策略
4. `trace_id` / header 透传

不负责：

1. 写 `app_users`
2. 写 `c_customers`
3. 写 `p_sessions`
4. 写 `c_point_accounts`
5. 写 `c_point_transactions`
6. 写 `p_products`
7. 写 `p_orders`
8. 写 `c_redeem_records`
9. 写 `c_sign_ins`

### 6.2 user-service

主写：

1. `app_users`
2. `c_customers`
3. `p_sessions`

不主写：

1. `c_point_accounts`
2. `c_point_transactions`
3. `p_products`
4. `p_orders`
5. `c_redeem_records`
6. `c_sign_ins`

### 6.3 points-service

主写：

1. `c_point_accounts`
2. `c_point_transactions`
3. `p_products`
4. `p_orders`
5. `c_redeem_records`
6. `c_sign_ins`

不主写：

1. `app_users`
2. `c_customers`
3. `p_sessions`

## 7. 当前门禁覆盖

### 7.1 总门禁入口

1. `scripts/gate_week6_runtime_split.mjs`
2. `npm run gate:week6-runtime-split`
3. `npm run ci:gate:week6-runtime-split`

### 7.2 静态边界门禁

1. `scripts/check_week6_runtime_split_boundaries.mjs`
   1. 校验 `gateway -> user-service` owned routes 一致
   2. 校验 `gateway -> points-service` owned routes 一致
   3. 校验 `user-service` / `points-service` route 不重叠
2. `scripts/check_user_service_boundary_guard.mjs`
   1. 扫描 `app_users / c_customers / p_sessions`
3. `scripts/check_points_frontend_bridge_week6.mjs`
   1. 校验 points 前端桥接仍统一走 `src/lib/api.ts`
4. `scripts/check_service_write_layer_guard.mjs`
   1. 校验服务写层边界
5. `scripts/check_route_write_dto_guard.mjs`
   1. 校验 route / dto / usecase / repository 分层约束

### 7.3 服务级 smoke

1. `scripts/smoke_user_service_contract.mjs`
2. `scripts/smoke_user_service_boundary.mjs`
3. `scripts/smoke_points_service_week5.mjs`
4. `scripts/smoke_points_boundary_week5.mjs`
5. `scripts/smoke_week6_runtime_split_suite.mjs`

## 8. 当前结论

1. `Week6` 范围内，`user-service` 与 `points-service` 的主写边界已明确。
2. 当前门禁可以有效拦住已定义范围内的跨域直写和服务边界漂移。
3. 当前门禁主要是：
   1. `route ownership`
   2. `service import`
   3. `regex + whitelist` 级别写路径扫描
4. 当前门禁不是：
   1. AST 级全语义分析
   2. 数据库 trigger 级防护
   3. 全仓所有未来写法的绝对证明

## 9. 例外与未覆盖范围

以下内容不应被误判为“已完全治理”：

1. `v1-monolith`
   1. 仍是当前兼容与回退承载体
   2. 不是本轮新 ownership 设计的主语
2. `activity-service / learning-service / policy-service / b-admin-service / p-admin-service`
   1. 尚未进入本轮运行时拆分
   2. 尚未纳入统一 ownership matrix 的主写边界冻结
3. PostgreSQL 实库级强约束
   1. 当前未通过 DB trigger / grant 限制实现物理隔离

## 10. 执行入口

统一执行入口：

```bash
npm run gate:week6-runtime-split
```

配套命令：

```bash
npm run lint:boundary:week6-runtime-split
npm run test:smoke:week6-runtime-split
npm run test:smoke:week5-runtime-split
```

## 11. 后续建议

### 11.1 Week7 必做

1. 在这份总表上继续追加后续服务 ownership
2. 把 `activity / learning / policy` 相关表逐步补进矩阵

### 11.2 Week7-Week8 可增强

1. 把 `regex + whitelist` 检查升级为 AST 级扫描
2. 对主写表增加更强的 repository 白名单门禁
3. 在实库阶段增加 DB 权限或 trigger 级兜底

## 12. 关联文档

1. `./week6-runtime-split-runbook-2026-03-07.md`
2. `./week6-runtime-split-report-template-2026-03-07.md`
3. `./week5-b-user-service-delivery-note-2026-03-07.md`
4. `../server/microservices/points-service/CONTRACT.md`
5. `../server/microservices/points-service/BOUNDARY.md`
6. `./v2-runtime-split-roadmap-week5-week8-2026-03-06.md`
