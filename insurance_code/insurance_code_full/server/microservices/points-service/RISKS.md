# Points Service 风险清单

更新时间：2026-03-07  
负责人：C 号（points-service）

## 1. 使用说明

这份清单只关注上线运行风险，不讨论新功能扩展。  
风险分级按上线影响面看，不按开发复杂度看。

## 2. 风险项

| 风险ID | 风险描述 | 影响 | 当前信号 | 建议动作 |
| --- | --- | --- | --- | --- |
| `PTS-R01` | 登录态头透传异常，导致签到/兑换/核销批量 `401/403` | 高 | `UNAUTHORIZED`、`CSRF_INVALID` 短时上升 | 先查 gateway 与前端请求头透传，不改 points 语义 |
| `PTS-R02` | 商品库存和兑换请求并发导致 `OUT_OF_STOCK` 激增 | 中 | 兑换失败率上升，`OUT_OF_STOCK` 集中出现 | 先看库存，再判断是否需要限流或临时下线商品 |
| `PTS-R03` | 订单流转停在 `created`，未进入 `paid` | 高 | `none->created` 增长但 `created->paid` 不增长 | 重点检查积分扣减、余额和支付阶段错误码 |
| `PTS-R04` | 核销链路停在 `paid`，未进入 `fulfilled` | 高 | `created->paid` 有增长，`paid->fulfilled` 无增长 | 优先检查核销 token、订单状态和兑换记录 |
| `PTS-R05` | 积分流水与订单状态不一致 | 高 | 用户投诉余额异常；订单/流水/兑换记录对不上 | 禁止直接改展示，先查真实流水并走人工修复审批 |
| `PTS-R06` | observability 只有局部窗口，没有长期留存 | 中 | `recentLogs` 只保留近期窗口 | 线上需要配合日志平台和指标平台承接，不依赖内存窗口 |
| `PTS-R07` | 未启用的订单桥接被误打开，造成前端流程与冻结基线不一致 | 中 | 前端开始调用 `createOrder/payOrder/cancelOrder/refundOrder` | 本轮禁止启用；先开新任务再接页面 |
| `PTS-R08` | 批量幂等命中被误判为故障 | 中 | `ALREADY_SIGNED`、`ALREADY_WRITTEN_OFF` 上升 | 先区分用户重复提交和系统失败，不要误拉 P0 |
| `PTS-R09` | `points-service` 准备就绪但上游切流/fallback 配置异常 | 高 | 本服务正常，但 gateway 全链路失败 | 交给 A 号/整合人处理网关层，不在 C 号侧改协议 |

## 3. 重点关注风险

本周上线最需要盯的 3 个风险：

1. `PTS-R03`
   - 订单卡在 `created`
2. `PTS-R04`
   - 核销链路打不通
3. `PTS-R05`
   - 积分扣减不一致

原因：

1. 这 3 个问题会直接影响用户兑换结果
2. 都属于“用户可感知 + 数据一致性”问题
3. 一旦发生，不能只看前端表现，必须回到订单/兑换/积分三条数据链路

## 4. 风险处置原则

1. 先判定是链路问题、配置问题还是数据一致性问题
2. 先保留证据：
   - `trace_id`
   - `user_id`
   - `order_id`
   - `redemption_id`
3. 先止损，再修复
4. 不在上线窗口临时改冻结语义

## 5. 不在本轮处理的事项

以下不是本轮上线风险修复范围：

1. 拆 `PointsMall` 两步下单/支付
2. 启用 `createOrder / payOrder / cancelOrder / refundOrder` 前端桥接
3. 改写 token/csrf 协议
4. 改积分/订单/核销接口语义
