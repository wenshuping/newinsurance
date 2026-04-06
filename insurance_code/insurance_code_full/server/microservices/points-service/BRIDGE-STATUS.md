# Points Service 未启用桥接说明

更新时间：2026-03-07  
负责人：C 号（points-service）

## 1. 当前未启用桥接

以下桥接方法已经定义在：

- `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/src/lib/api.ts`

但当前没有启用到 C 端页面主流程：

1. `createOrder()`
2. `payOrder()`
3. `cancelOrder()`
4. `refundOrder()`

## 2. 为什么本轮不启用

### 2.1 `createOrder()` / `payOrder()`

原因：

1. 当前 `PointsMall` 已冻结为单步 `redeem()` 交互
2. 如果启用这两个桥接，等于把当前前端流程改成“两步下单/支付”
3. 这会改变上线交互路径，不属于 Week8 上线保障范围

结论：

1. 本轮不启用
2. 只有产品明确确认“两步下单/支付”方案后，才单独开任务

### 2.2 `cancelOrder()`

原因：

1. 当前 C 端没有稳定的用户自助取消入口
2. 如果直接启用，会引入新的前端操作路径
3. 上线窗口不应该新增交易路径

结论：

1. 本轮不启用
2. 后续如果产品需要“我的订单 -> 取消订单”，再单独评估

### 2.3 `refundOrder()`

原因：

1. 当前 C 端没有稳定的用户自助退款入口
2. 退款属于高风险交易动作
3. 上线窗口不应该新增这类高影响写操作

结论：

1. 本轮不启用
2. 后续如果要开放，必须先补明确的业务规则、权限和风控要求

## 3. 上线口径

Week8 上线保障阶段，C 号只承诺以下前端桥接保持稳定：

1. `signIn()`
2. `pointsSummary()`
3. `pointsTransactions()`
4. `mallItems()`
5. `redeem()`
6. `orders()`
7. `orderDetail()`
8. `redemptions()`
9. `writeoff()`

不承诺新增：

1. 两步下单/支付
2. 用户自助取消
3. 用户自助退款

## 4. 排障时的注意事项

如果线上有人提出“为什么不用 `createOrder/payOrder` 来修问题”，统一答复口径是：

1. 这不是故障修复动作
2. 这是新流程启用
3. 新流程启用必须单独立项，不能在上线排障窗口临时打开
