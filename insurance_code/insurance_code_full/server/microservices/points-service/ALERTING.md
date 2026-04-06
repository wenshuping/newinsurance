# Points Service 告警建议

更新时间：2026-03-08  
负责人：C 号（points-service）

## 1. 目标

告警要服务上线排障，不要只做开发期提示。  
原则是：

1. 先抓用户可感知故障
2. 再抓链路卡顿和一致性风险
3. 最后抓容量和噪声问题

## 2. 推荐告警项

| 告警ID | 指标/信号 | 触发建议 | 等级 | 处置重点 |
| --- | --- | --- | --- | --- |
| `PTS-A01` | `/ready` 非 `200` | 连续 3 个周期失败 | Critical | 先查服务 readiness 和底层存储 |
| `PTS-A02` | `signIn.successRate` | 5 分钟低于 `95%` | High | 先查登录态、csrf、基础认证前置 |
| `PTS-A03` | `redeem.successRate` | 5 分钟低于 `95%` | High | 先查库存、商品状态、积分余额错误码 |
| `PTS-A04` | `writeoff.successRate` | 5 分钟低于 `95%` | High | 先查 token、订单支付状态、兑换记录 |
| `PTS-A05` | `UNAUTHORIZED` / `CSRF_INVALID` 激增 | 5 分钟内明显高于日常基线 | High | 优先判断 header 透传或登录态故障 |
| `PTS-A06` | `OUT_OF_STOCK` 激增 | 单商品或全局短时升高 | Medium | 判断是真缺货还是异常并发 |
| `PTS-A07` | `INSUFFICIENT_POINTS` 激增 | 超过日常基线 | Medium | 判断活动流量变化还是余额异常 |
| `PTS-A08` | `orderTransitions.none->created` 增长但 `created->paid` 不增长 | 连续 10 分钟 | Critical | 订单创建成功但支付扣点链路卡住 |
| `PTS-A09` | `created->paid` 增长但 `paid->fulfilled` 不增长 | 连续 10 分钟 | Critical | 核销链路卡住或兑换状态异常 |
| `PTS-A10` | `pointsMovements.debitCount` 与成功兑换量明显偏离 | 连续 10 分钟 | High | 重点查扣点和订单支付一致性 |
| `PTS-A11` | `learningReward.successRate` | 5 分钟低于 `95%` | High | 先查 learning -> points 内部契约、租户头、奖励配置和 points error code |

## 3. 告警分组建议

### 3.1 P0/P1 立即响应

1. `PTS-A01`
2. `PTS-A08`
3. `PTS-A09`

这些问题直接影响交易链路可用性或一致性。

### 3.2 业务强感知

1. `PTS-A02`
2. `PTS-A03`
3. `PTS-A04`
4. `PTS-A11`

这些问题会直接影响 C 端用户完成签到、兑换、核销。

### 3.3 观察型告警

1. `PTS-A06`
2. `PTS-A07`
3. `PTS-A10`

这些先用于判断趋势，不一定一触发就升级事故。

## 4. 推荐告警文案结构

建议统一包含：

1. 时间窗口
2. 失败指标
3. 主要错误码
4. Top `trace_id`
5. 关联 `order_id` / `redemption_id`
6. 推荐第一步动作

示例：

```text
[High] points-service redeem success rate dropped below 95% in 5m.
Top errors: OUT_OF_STOCK, INSUFFICIENT_POINTS.
Check /internal/points-service/observability and recentLogs first.
```

learning reward 示例：

```text
[High] points-service learningReward success rate dropped below 95% in 5m.
Top errors: INVALID_LEARNING_REWARD_*, LEARNING_REWARD_SETTLEMENT_FAILED.
Check /internal/points-service/observability, recentLogs, and learning-service internal caller headers first.
```

## 5. 告警后的第一步动作

### 5.1 `/ready` 告警

1. 先打 `/health`
2. 再打 `/ready`
3. 看 readiness checks 缺哪一块

### 5.2 成功率告警

1. 打 `/internal/points-service/observability`
2. 看对应 `metrics`
3. 看 `errorCounts`
4. 再看 `recentLogs`

### 5.3 状态流转告警

1. 先确认停在哪个 transition
2. 取具体 `order_id`
3. 回查订单、兑换记录、积分流水

### 5.4 learning reward 告警

1. 先看 `/internal/points-service/observability`
2. 看 `metrics.learningReward`
3. 看 `recentLogs` 中 `INTERNAL learning->points reward settlement`
4. 重点核对：
   - `x-internal-service`
   - `x-tenant-id`
   - `x-trace-id`
   - `INVALID_LEARNING_REWARD_*`
   - `LEARNING_REWARD_SETTLEMENT_FAILED`

## 6. 当前限制

1. `points-service` 当前提供的是内部 runtime snapshot
2. 这适合本地和预发排查
3. 真正线上告警，仍建议把这些信号接到统一日志/指标平台
4. 不要把内存窗口当作长期审计存储

## 7. Week11 灰度告警判定补充

Week11 灰度期，告警不是单独决策依据，必须和 `fallback impact` 一起判断。

执行口径：

1. 只有告警，但 `fallback impact < 1%` 且成功率仍在继续阈值内：
   - 先保持当前比例
   - 不立即回退
2. 告警出现且 `fallback impact >= 1%`：
   - 先暂停扩量
   - 由 A 号核对 gateway 回退样本，C 号核对 points 指标
3. 告警出现且命中以下任一条：
   - `signIn.successRate < 95%`
   - `redeem.successRate < 95%`
   - `writeoff.successRate < 95%`
   - `fallback impact >= 5%`
   - `created -> paid` 或 `paid -> fulfilled` 断层
   - 则按回退处理

Week11 source of truth：

- `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/points-service/WEEK11-GRAYSCALE-METRICS.md`
