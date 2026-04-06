# Points Service 故障排查手册

更新时间：2026-03-07  
负责人：C 号（points-service）  
适用范围：`/api/sign-in`、`/api/points/*`、`/api/mall/*`、`/api/orders/*`、`/api/redemptions/*`

## 1. 目标

这份手册用于上线后排障，不用于指导功能扩展。  
本手册默认 `Week7` 已冻结，接口语义不再变化。

优先排查入口：

1. `GET /health`
2. `GET /ready`
3. `GET /internal/points-service/observability`
4. `npm run gate:week7-runtime-split`

## 2. 通用排查顺序

### 2.1 先判断是不是服务不可用

命令：

```bash
curl -s http://127.0.0.1:4102/health
curl -s http://127.0.0.1:4102/ready
```

判断：

1. `/health` 不通：
   - 先看进程是否启动
   - 再看端口 `4102` 是否被占用
2. `/ready` 返回 `503`：
   - 优先检查 `users / pointAccounts / pointTransactions / products / orders / redemptions / signIns` 这些 readiness checks
   - 再检查底层 `STORAGE_BACKEND` 和数据加载是否完成

### 2.2 再判断是不是链路局部失败

命令：

```bash
curl -s http://127.0.0.1:4102/internal/points-service/observability
```

重点看：

1. `metrics.signIn`
2. `metrics.redeem`
3. `metrics.writeoff`
4. `metrics.orderTransitions`
5. `metrics.pointsMovements`
6. `metrics.errorCounts`
7. `recentLogs`

### 2.3 最后定位到具体请求

优先拿这几个字段串联：

1. `trace_id`
2. `user_id`
3. `order_id`
4. `redemption_id`
5. `route`
6. `result`

如果问题是从 gateway 侧报上来，先拿 gateway 返回头里的 `x-trace-id`，再去 points-service 日志和 `/internal/points-service/observability` 的 `recentLogs` 里查同一个 `trace_id`。

## 3. 场景一：签到失败

接口：

- `POST /api/sign-in`

### 3.1 现象

1. 用户反馈签到按钮报错
2. 当日签到成功率下降
3. gateway 或 C 端看到 `401 / 403 / 409 / 400`

### 3.2 先看什么

1. `metrics.signIn.successRate`
2. `metrics.errorCounts`
3. `recentLogs` 里 `route=POST /api/sign-in`

### 3.3 常见错误码

1. `UNAUTHORIZED`
2. `NEED_BASIC_VERIFY`
3. `ALREADY_SIGNED`
4. `CSRF_INVALID`

### 3.4 排查步骤

1. 先核对登录态
   - 请求是否带 `Authorization: Bearer <token>`
2. 再核对写请求头
   - 是否带 `x-csrf-token`
3. 如果是 `NEED_BASIC_VERIFY`
   - 去 `user-service` 确认登录用户是否完成基础认证
   - 这不是 points 语义问题，不要在 points-service 改规则
4. 如果是 `ALREADY_SIGNED`
   - 这是幂等命中，不是故障
   - 检查是否是重复点击、重试或前端重复提交
5. 如果是大面积 `401 / 403`
   - 先查 gateway 到 user-service 的登录链路
   - 再查请求头是否被代理层丢失

### 3.5 处理建议

1. 单个用户失败：
   - 拿 `trace_id` 定位
   - 校验 token / csrf / basic verify 状态
2. 批量失败：
   - 先视作登录态或代理透传问题
   - 不要先动签到逻辑

## 4. 场景二：兑换失败

接口：

- `POST /api/mall/redeem`

### 4.1 现象

1. 商品列表正常，但点击兑换失败
2. 兑换成功率下降
3. 积分未扣减但页面提示失败，或者直接报错

### 4.2 先看什么

1. `metrics.redeem.successRate`
2. `metrics.errorCounts`
3. `recentLogs` 里 `route=POST /api/mall/redeem`
4. 最近是否有 `orderTransitions.none->created` 但没有 `created->paid`

### 4.3 常见错误码

1. `NEED_BASIC_VERIFY`
2. `ITEM_NOT_FOUND`
3. `ITEM_NOT_AVAILABLE`
4. `OUT_OF_STOCK`
5. `INSUFFICIENT_POINTS`
6. `CSRF_INVALID`
7. `ACTION_CONFIRM_REQUIRED`

### 4.4 排查步骤

1. 先确认是不是请求头问题
   - `Authorization`
   - `x-csrf-token`
   - `x-action-confirm: YES`
2. 如果是 `ITEM_NOT_FOUND / ITEM_NOT_AVAILABLE`
   - 检查商品是否仍在 points 主写域可见范围
   - 检查租户维度商品是否被下线
3. 如果是 `OUT_OF_STOCK`
   - 优先确认真实库存，不要只看前端缓存
4. 如果是 `INSUFFICIENT_POINTS`
   - 取用户当前 `/api/points/summary`
   - 再对比最近一次成功兑换或签到后的余额变化
5. 如果出现“创建了订单但没生成兑换”
   - 去 `/internal/points-service/observability` 看：
     - 是否有 `none->created`
     - 没有 `created->paid`
   - 这通常说明订单创建成功，支付扣点阶段失败

### 4.5 处理建议

1. 商品问题：
   - 先恢复商品可售状态或库存
2. 积分不足：
   - 先按业务结果解释，不视作系统故障
3. 链路半成功：
   - 先锁定具体 `order_id`
   - 再核对订单状态、积分流水、兑换记录三者是否一致

## 5. 场景三：核销失败

接口：

- `POST /api/redemptions/:id/writeoff`

### 5.1 现象

1. 用户有兑换记录，但核销失败
2. 核销成功率下降
3. 重复核销、过期核销或核销码错误

### 5.2 先看什么

1. `metrics.writeoff.successRate`
2. `metrics.errorCounts`
3. `recentLogs` 里 `route=POST /api/redemptions/:id/writeoff`
4. `orderTransitions` 是否存在 `paid->fulfilled`

### 5.3 常见错误码

1. `REDEMPTION_NOT_FOUND`
2. `ALREADY_WRITTEN_OFF`
3. `INVALID_TOKEN`
4. `TOKEN_EXPIRED`
5. `ORDER_NOT_PAID`
6. `UNAUTHORIZED`
7. `CSRF_INVALID`

### 5.4 排查步骤

1. 先确认兑换记录是否存在
   - `GET /api/redemptions`
2. 再确认订单状态
   - `GET /api/orders/:id`
3. 如果是 `ALREADY_WRITTEN_OFF`
   - 这是幂等命中，不是故障
4. 如果是 `INVALID_TOKEN`
   - 优先核对本次提交 token 是否和兑换记录一致
5. 如果是 `TOKEN_EXPIRED`
   - 检查 `expiresAt`
6. 如果是 `ORDER_NOT_PAID`
   - 说明订单状态不满足核销前置
   - 不要直接改核销逻辑，要回查兑换/支付链路

### 5.5 处理建议

1. 单条核销失败：
   - 用 `redemption_id` 和 `order_id` 反查
2. 批量失败：
   - 先查 token 透传、csrf 透传、订单状态流转
3. 已核销重复提交：
   - 视作重复请求，不升级为 P0

## 6. 场景四：订单状态异常

典型异常：

1. 有订单但状态停在 `created`
2. 已兑换但未进入 `fulfilled`
3. 订单列表和兑换记录状态对不上

### 6.1 应该有的主流状态流转

1. `none -> created`
2. `created -> paid`
3. `paid -> fulfilled`
4. `created -> cancelled`
5. `paid -> cancelled`

### 6.2 排查步骤

1. 查 `metrics.orderTransitions`
2. 查订单详情：
   - `GET /api/orders/:id`
3. 查兑换记录：
   - `GET /api/redemptions`
4. 查日志：
   - 用 `order_id` 过滤 `recentLogs`

### 6.3 判断规则

1. 有 `none->created`，没有 `created->paid`
   - 重点查积分扣减、库存、余额、支付阶段错误码
2. 有 `created->paid`，没有 `paid->fulfilled`
   - 重点查核销链路和兑换记录
3. 订单是 `fulfilled`，兑换还是 `pending`
   - 这是数据一致性异常，需要人工核对并升级

### 6.4 处理建议

1. 先冻结异常订单继续操作
2. 保留 `trace_id / order_id / redemption_id`
3. 交给 C 号和整合人联合判断是否需要人工数据修复

## 7. 场景五：积分扣减不一致

典型现象：

1. 用户反馈兑换后余额不对
2. 订单成功，但余额未扣或重复扣
3. 退款后余额未回补

### 7.1 先看什么

1. `/api/points/summary`
2. `/api/points/transactions`
3. `metrics.pointsMovements.creditCount`
4. `metrics.pointsMovements.debitCount`
5. `recentLogs` 中对应 `order_id`

### 7.2 排查步骤

1. 先确认用户当前余额
2. 再查对应订单
3. 再查对应积分流水
4. 最后核对：
   - 订单状态
   - 积分流水
   - 兑换记录

### 7.3 判断规则

1. 有订单支付成功，但没有消费流水
   - 重点查 `recordPoints()` 是否执行
2. 有消费流水，但订单未支付成功
   - 视为一致性异常
3. 取消/退款成功，但没有返还流水
   - 重点查退款链路和幂等命中
4. 重复点击导致重复扣点
   - 先查幂等键是否生效

### 7.4 处理建议

1. 不要先改余额展示
2. 先核对真实流水
3. 确认是展示问题还是数据问题
4. 确认需要修复时，走人工数据修复审批，不直接在线改逻辑

## 8. 升级条件

满足任一条件，直接升级：

1. `/health` 正常但 `/ready` 长时间 `503`
2. `signIn / redeem / writeoff` 成功率连续下降
3. `orderTransitions` 长时间只有 `none->created`，没有后续流转
4. 出现“订单状态、兑换状态、积分流水”三者不一致
5. 出现批量 `401 / 403 / CSRF_INVALID`

## 9. 禁止动作

上线排障期间，不要做这些事：

1. 不要改已冻结接口字段
2. 不要改幂等语义
3. 不要临时启用未启用桥接方法
4. 不要绕过 points 主写边界直接写表
