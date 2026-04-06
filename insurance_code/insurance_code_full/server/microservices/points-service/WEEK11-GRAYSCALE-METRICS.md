# Week11 Points 域灰度指标与阈值

更新时间：2026-03-08  
负责人：C 号（points-service）

## 1. 目标

Week11 只定义 `points-service` 的灰度观测口径、阈值和 fallback 影响判断，不改任何业务接口。

重点关注：

- `sign-in success`
- `redeem success`
- `writeoff success`
- `fallback` 对 C 端交易链路的影响口径

## 2. 灰度前提

进入灰度前先满足：

1. Week9 部署基线完成
2. Week10 实库验证完成
3. `/ready`、`/metrics`、`/internal/points-service/observability` 正常
4. `Authorization + x-csrf-token` 协议保持不变
5. 未启用桥接方法仍冻结：
   - `createOrder()`
   - `payOrder()`
   - `cancelOrder()`
   - `refundOrder()`

## 3. 指标来源

`points-service` 当前可直接提供的指标入口：

- `GET /metrics`
- `GET /internal/points-service/metrics`
- `GET /internal/points-service/observability`

当前重点看：

- `metrics.signIn.successRate`
- `metrics.redeem.successRate`
- `metrics.writeoff.successRate`
- `metrics.orderTransitions`
- `metrics.errorCounts`
- `recentLogs`

## 4. 灰度阶段建议

建议按小流量逐步放量，不直接全量：

1. Phase 1：小流量验证
2. Phase 2：核心租户/指定 tenant 扩量
3. Phase 3：大盘放量
4. Phase 4：全量

C 号关注的是指标判定，不负责灰度开关实现。

## 5. 成功率阈值

### 5.1 `signIn.successRate`

灰度通过阈值：

1. 任一连续 5 分钟窗口不得低于 `98%`
2. 如果低于 `98%` 但高于 `95%`，暂停扩量，先查错误码分布
3. 如果低于 `95%`，建议回退或保持在当前灰度比例，不继续放量

优先排查：

- `UNAUTHORIZED`
- `CSRF_INVALID`
- `NEED_BASIC_VERIFY`
- `ALREADY_SIGNED`

判读要求：

1. `ALREADY_SIGNED` 上升不一定代表故障，先判断是否重复请求
2. `UNAUTHORIZED` / `CSRF_INVALID` 上升优先看 gateway 和前端透传

### 5.2 `redeem.successRate`

灰度通过阈值：

1. 任一连续 5 分钟窗口不得低于 `97%`
2. 如果连续 10 分钟低于 `97%`，停止扩量
3. 如果连续 5 分钟低于 `95%`，建议回退

优先排查：

- `OUT_OF_STOCK`
- `INSUFFICIENT_POINTS`
- `ITEM_NOT_AVAILABLE`
- `CSRF_INVALID`
- `ACTION_CONFIRM_REQUIRED`

判读要求：

1. `OUT_OF_STOCK` 可能是业务真实结果，不一定是服务故障
2. 只有当 `OUT_OF_STOCK`、`INSUFFICIENT_POINTS` 之外的系统错误抬升，才优先怀疑 runtime split 问题

### 5.3 `writeoff.successRate`

灰度通过阈值：

1. 任一连续 5 分钟窗口不得低于 `97%`
2. 如果连续 10 分钟低于 `97%`，停止扩量
3. 如果连续 5 分钟低于 `95%`，建议回退

优先排查：

- `INVALID_TOKEN`
- `TOKEN_EXPIRED`
- `ORDER_NOT_PAID`
- `UNAUTHORIZED`
- `ALREADY_WRITTEN_OFF`

判读要求：

1. `ALREADY_WRITTEN_OFF` 上升要先判断是否重复提交
2. `ORDER_NOT_PAID` 上升通常不是核销入口本身问题，而是前置订单状态异常

## 6. 状态流转观测

除了成功率，灰度期还要盯状态流转数：

1. `none -> created`
2. `created -> paid`
3. `paid -> fulfilled`
4. `created -> cancelled`
5. `paid -> cancelled`

判断规则：

1. `none -> created` 有增长，但 `created -> paid` 不增长：
   - 说明兑换链路停在下单后半段
2. `created -> paid` 有增长，但 `paid -> fulfilled` 不增长：
   - 说明核销链路卡住
3. `paid -> cancelled` 或退款相关动作突然升高：
   - 要同时核对积分返还是否同步增长

## 7. fallback 影响口径

`points-service` 自身只能看到落到 V2 的请求。只看 V2 成功率，不足以判断用户真实体验。

因此 Week11 必须单独看 `fallback` 影响。

### 7.1 口径定义

`fallback impact` = 在观察窗口内，本应由 V2 `points-service` 处理、但被 gateway 回退到 V1 的 points 域请求占比。

至少要覆盖：

- `/api/sign-in`
- `/api/points/*`
- `/api/mall/*`
- `/api/orders/*`
- `/api/redemptions/*`

### 7.2 为什么要单独算

如果 gateway 已经把大部分流量 fallback 到 V1：

1. V2 `points-service` 的失败率可能看起来很好
2. 但用户实际上没在走 V2
3. 这不算灰度成功，只能算“靠 fallback 保住服务”

### 7.3 建议阈值

1. 灰度放量阶段：`fallback impact` 建议低于 `1%`
2. 如果高于 `1%` 且持续 10 分钟，不继续扩量
3. 如果高于 `5%`，建议停止灰度并回查 gateway / upstream 健康

### 7.4 口径解释

1. `fallback impact` 高，但 V2 成功率也高：
   - 不能判定灰度成功
   - 先说明 V2 实际承载不足
2. `fallback impact` 低，且 `sign-in / redeem / writeoff` 成功率稳定：
   - 才能继续扩量

## 8. 灰度期间的暂停/回退条件

满足任一条就暂停扩量：

1. `/ready` 非 `200`
2. `signIn.successRate < 98%`
3. `redeem.successRate < 97%`
4. `writeoff.successRate < 97%`
5. `fallback impact >= 1%` 且持续 10 分钟
6. 订单状态流转出现明显断层

满足任一条建议回退：

1. `signIn.successRate < 95%`
2. `redeem.successRate < 95%`
3. `writeoff.successRate < 95%`
4. `fallback impact >= 5%`
5. 出现积分扣减不一致、订单状态异常、核销批量失败

## 9. 告警判断口径

Week11 灰度期不要只看“有没有告警”，要看告警落在哪个动作档位。

| 档位 | 触发条件 | C 号判断 | 处理动作 |
| --- | --- | --- | --- |
| `continue` | 成功率稳定、`fallback impact < 1%`、状态流转完整 | 指标正常 | 可以继续当前灰度比例或进入下一档 |
| `pause` | 成功率进入观察区间、`fallback impact >= 1%`、错误码开始集中 | 轻度退化 | 暂停扩量，先核对 points 指标与 gateway 回退计数 |
| `rollback` | 成功率跌破回退阈值、`fallback impact >= 5%`、状态流转断层、出现一致性异常 | 明显退化 | 建议 A 号立即回退到 V1，并保留样本 `trace_id / order_id / redemption_id` |

### 9.1 `continue` 判定

满足以下条件才算可继续灰度：

1. `signIn.successRate >= 98%`
2. `redeem.successRate >= 97%`
3. `writeoff.successRate >= 97%`
4. `fallback impact < 1%`
5. `none -> created -> paid -> fulfilled` 主链路没有明显断层

### 9.2 `pause` 判定

命中任一条就先暂停扩量：

1. `signIn.successRate` 在 `95%-98%`
2. `redeem.successRate` 在 `95%-97%`
3. `writeoff.successRate` 在 `95%-97%`
4. `fallback impact` 在 `1%-5%`
5. `UNAUTHORIZED`、`CSRF_INVALID`、`ORDER_NOT_PAID` 等系统性错误开始集中抬升

### 9.3 `rollback` 判定

命中任一条就建议回退：

1. `signIn.successRate < 95%`
2. `redeem.successRate < 95%`
3. `writeoff.successRate < 95%`
4. `fallback impact >= 5%`
5. `created -> paid` 或 `paid -> fulfilled` 明显断层
6. 出现积分扣减不一致、订单状态异常、核销批量失败

## 10. 与 A 号联动核对项

灰度演练期间，C 号只认 `points-service` 口径，但必须和 A 号交换这 4 组信息：

1. 本轮灰度租户范围
2. 本轮灰度路径范围
3. gateway 侧 `fallback total` 与路径级 fallback 计数
4. 演练窗口内的样本 `trace_id`

C 号返回给 A 号的核对项：

1. `signIn.successRate`
2. `redeem.successRate`
3. `writeoff.successRate`
4. `orderTransitions`
5. `errorCounts`
6. 是否建议 `continue / pause / rollback`

## 11. 灰度期间的查看顺序

1. `/ready`
2. `/metrics`
3. `/internal/points-service/observability`
4. `metrics.errorCounts`
5. `metrics.orderTransitions`
6. `recentLogs` 中按 `trace_id / order_id / redemption_id` 抽样
7. 再结合 gateway 的 fallback 计数判断是否继续扩量

## 12. 本轮不做的事

Week11 不做：

1. 新增灰度开关代码
2. 调整 gateway fallback 实现
3. 改 points 域接口语义
4. 打开冻结桥接方法
