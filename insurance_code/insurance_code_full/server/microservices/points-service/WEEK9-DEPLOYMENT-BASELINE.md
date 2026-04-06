# Week9 Points Service 部署基线

更新时间：2026-03-07  
负责人：C 号（points-service）

## 1. 目标

Week9 只做 `points-service` 的部署基线和上线运行口径收平，不扩积分、订单、核销业务语义。

本文件回答 4 件事：

1. `points-service` 应该怎么启动
2. dev / staging / prod 应该用什么配置
3. 上线后先看哪些健康检查
4. 签到、积分、兑换、订单、核销链路要怎么做最小验证

## 2. 运行边界

`points-service` 当前负责：

- `POST /api/sign-in`
- `GET /api/points/summary`
- `GET /api/points/transactions`
- `GET /api/points/detail`
- `GET /api/mall/items`
- `GET /api/mall/activities`
- `POST /api/mall/redeem`
- `POST /api/mall/activities/:id/join`
- `GET /api/orders`
- `GET /api/orders/:id`
- `POST /api/orders`
- `POST /api/orders/:id/pay`
- `POST /api/orders/:id/cancel`
- `POST /api/orders/:id/refund`
- `GET /api/redemptions`
- `POST /api/redemptions/:id/writeoff`

不负责：

- `user-service` 登录与 `/api/me`
- gateway 灰度、切流、fallback 入口
- 公共 `package.json`、公共 docs 索引

## 3. 启动基线

实际启动入口：

- `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/points-service/index.mjs`

启动命令：

```bash
node server/microservices/points-service/index.mjs
```

默认监听：

- `API_HOST=127.0.0.1`
- `POINTS_SERVICE_PORT=4102`

注意：

1. 当前代码读取的是 `POINTS_SERVICE_PORT`，不是 `API_POINTS_SERVICE_PORT`
2. 如果部署脚本还在传 `API_POINTS_SERVICE_PORT`，需要在部署前收平
3. `STORAGE_BACKEND=postgres` 时必须提供有效 `DATABASE_URL`

## 4. 环境配置基线

### 4.1 dev

推荐口径：

- `API_HOST=127.0.0.1`
- `POINTS_SERVICE_PORT=4102`
- `STORAGE_BACKEND=file` 或 `postgres`
- `CSRF_PROTECTION=true`
- `REQUIRE_SENSITIVE_CONFIRM=true`
- `REQUIRE_TENANT_CONTEXT=false`
- `CORS_ORIGIN=http://127.0.0.1:5173,http://localhost:5173`

说明：

1. 本地 smoke 优先可用 `file` 模式
2. 如果要提前验证 Postgres 兼容，切到 `STORAGE_BACKEND=postgres`
3. 本地不建议为了图快关闭 `CSRF_PROTECTION`

### 4.2 staging

推荐口径：

- `API_HOST=0.0.0.0`
- `POINTS_SERVICE_PORT=4102`
- `STORAGE_BACKEND=postgres`
- `DATABASE_URL=<staging postgres>`
- `PGSSL=require`
- `PG_POOL_MAX=10`
- `CSRF_PROTECTION=true`
- `REQUIRE_SENSITIVE_CONFIRM=true`
- `REQUIRE_TENANT_CONTEXT=true`
- `CORS_ORIGIN=<staging web origins>`

说明：

1. staging 必须和 prod 同类存储，不再跑 file mode
2. staging 应保留真实 `Authorization + x-csrf-token` 校验
3. staging 需要保留 `/internal/points-service/observability` 给联调和预发排障使用

### 4.3 prod

推荐口径：

- `API_HOST=0.0.0.0`
- `POINTS_SERVICE_PORT=4102`
- `STORAGE_BACKEND=postgres`
- `DATABASE_URL=<prod postgres>`
- `PGSSL=require`
- `PG_POOL_MAX` 按实例容量配置，默认从 `10` 起评估
- `CSRF_PROTECTION=true`
- `REQUIRE_SENSITIVE_CONFIRM=true`
- `REQUIRE_TENANT_CONTEXT=true`
- `CORS_ORIGIN=<prod web origins>`

说明：

1. prod 不允许回退到 `file` 存储
2. prod 不应关闭 `CSRF_PROTECTION`
3. prod 仍保留 `/health`、`/ready`、`/metrics`、`/internal/points-service/observability`，但访问控制由外层网络与网关策略保障

## 5. 健康检查分层

`points-service` 健康检查分 3 层，不要只看一个 `/health` 就判定链路正常。

### 5.1 L0 进程健康

接口：

- `GET /health`
- `GET /api/health`
- `GET /internal/points-service/health`

用途：

1. 进程是否已启动
2. 路由是否已挂载
3. 运行时是否能返回基础 service metadata

### 5.2 L1 就绪健康

接口：

- `GET /ready`
- `GET /internal/points-service/ready`

成功标准：

1. HTTP `200`
2. `ok=true`
3. readiness checks 全部为真：
   - `users`
   - `pointAccounts`
   - `pointTransactions`
   - `products`
   - `orders`
   - `redemptions`
   - `signIns`

### 5.3 L2 交易链路健康

观测入口：

- `GET /metrics`
- `GET /internal/points-service/metrics`
- `GET /internal/points-service/observability`

重点指标：

1. `metrics.signIn.successRate`
2. `metrics.redeem.successRate`
3. `metrics.writeoff.successRate`
4. `metrics.orderTransitions`
5. `metrics.pointsMovements`
6. `metrics.errorCounts`
7. `recentLogs`

说明：

1. L2 反映的是交易链路健康，不等于 readiness
2. 如果 gateway 已 fallback 到 V1，points-service 的 L2 指标可能变好，但业务实际已经绕开 V2；这点要结合 Week11 灰度文档判断

## 6. 链路健康检查建议

### 6.1 签到链路

接口：

- `POST /api/sign-in`

建议做法：

1. staging 使用专用 smoke 用户每日验证
2. prod 只在发版后或故障排查时使用专用 smoke 用户验证
3. 可接受结果：
   - 首次成功：`200`
   - 当日重复请求：`409 ALREADY_SIGNED`

### 6.2 积分链路

接口：

- `GET /api/points/summary`
- `GET /api/points/transactions`

成功标准：

1. 返回 `200`
2. `balance` 可解析为数字
3. 最近积分流水方向和余额变化能自洽

### 6.3 兑换链路

接口：

- `POST /api/mall/redeem`

建议做法：

1. staging 使用专用 smoke 商品
2. prod 不做高频探测，只在发版窗口做一次人工验证
3. 验证时记录：
   - `trace_id`
   - `order_id`
   - `redemption_id`
   - `token`

### 6.4 订单链路

接口：

- `GET /api/orders`
- `GET /api/orders/:id`

成功标准：

1. 兑换成功后能查到真实 `orderNo`
2. 订单状态与支付/履约状态不冲突
3. 详情接口能返回关联兑换信息

### 6.5 核销链路

接口：

- `POST /api/redemptions/:id/writeoff`

建议做法：

1. staging 使用专用 smoke 订单做闭环验证
2. prod 只在发版窗口或事故排查时人工验证一次
3. 可接受结果：
   - 首次成功：`200`
   - 重复核销：`409 ALREADY_WRITTEN_OFF`

## 7. 最小部署后验证

发版后先跑这个顺序：

```bash
curl -s http://127.0.0.1:4102/health
curl -s http://127.0.0.1:4102/ready
curl -s http://127.0.0.1:4102/metrics
curl -s http://127.0.0.1:4102/internal/points-service/observability
```

然后做最小链路验证：

1. 登录拿 `token + csrfToken`（由 `user-service` 提供）
2. `GET /api/points/summary`
3. `POST /api/sign-in`
4. `POST /api/mall/redeem`
5. `GET /api/orders/:id`
6. `POST /api/redemptions/:id/writeoff`

## 8. 发布门槛

`points-service` 可进入下一步联调或灰度的条件：

1. `/health` 正常
2. `/ready` 正常
3. `/metrics` 能返回观测快照
4. 登录头透传正常
5. 最小交易链路至少在 staging 闭环一次
6. 未启用桥接方法仍保持冻结：
   - `createOrder()`
   - `payOrder()`
   - `cancelOrder()`
   - `refundOrder()`

## 9. 不在 Week9 范围内的内容

本周不做：

1. 新增业务接口
2. 改积分/订单/核销语义
3. 改 `user-service` 登录协议
4. 改 gateway 公共入口
5. 打开两步下单/支付前端流程
