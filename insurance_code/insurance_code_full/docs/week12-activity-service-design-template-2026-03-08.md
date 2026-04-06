# Activity Service 设计包模板（Week12）

更新时间：2026-03-08  
用途：供 `activity-service` 在 Week13+ 真正进入试点前填写  
状态：模板

## 1. 服务目标

1. 解决什么业务问题
2. 为什么不能继续留在 `points-service`
3. 本次试点范围与非目标

## 2. 服务职责

必须明确：

1. 活动定义
2. 活动规则
3. 活动参与记录
4. 活动完成判定
5. 奖励申请发起

必须明确不负责：

1. 积分账户
2. 积分流水
3. 订单
4. 核销

## 3. owned routes

按三类写：

### 3.1 C 端

1. `GET /api/activities`
2. `GET /api/activities/:id`
3. `POST /api/activities/:id/join`
4. `POST /api/activities/:id/complete`

### 3.2 P/B 管理面

1. `GET /api/p/activities`
2. `POST /api/p/activities`
3. `PUT /api/p/activities/:id`
4. `DELETE /api/p/activities/:id`

### 3.3 明确不归属

1. `POST /api/sign-in`
2. `POST /api/mall/redeem`
3. `POST /api/redemptions/:id/writeoff`

## 4. owned data

按“主写 / 只读引用 / 明确禁止”三栏写：

### 4.1 建议主写

1. `p_activity_templates`
2. `p_activity_rules`
3. `c_activity_participations`
4. `c_activity_completion_records`

### 4.2 只读引用

1. `c_customers`
2. `p_products`
3. `c_point_accounts`

### 4.3 明确禁止直写

1. `c_point_transactions`
2. `p_orders`
3. `c_redeem_records`
4. `c_sign_ins`

## 5. 与 points-service 的交互

至少评审两套方案：

### 5.1 同步命令式

1. 命令名
2. 幂等 key
3. 重试语义
4. 错误码映射

### 5.2 事件驱动式

1. 事件名
2. 事件载荷
3. 投递保证
4. 对账方式

## 6. 灰度与回退

必须填写：

1. 首批租户
2. 首批路径
3. 回退到 `points-service` 旧路径的方式
4. 如果奖励落账失败，如何快速止血

## 7. smoke 模板

至少覆盖：

1. 活动列表
2. 活动详情
3. 参与活动
4. 完成活动
5. 奖励申请发起
6. 奖励重复提交幂等

## 8. gate 模板

至少检查：

1. 不直写 `points-service` 主写表
2. 不改 `Authorization + x-csrf-token`
3. owned routes 不与 `points-service` 重叠
4. 奖励命令/事件契约有文档

## 9. release-check 模板

至少验证：

1. 指定租户走新路径
2. 非灰度租户走旧路径
3. 奖励失败可回退
4. 演练报告落盘

## 10. 评审结论

这里填写：

1. 是否允许进入 Week13 试点
2. 还差哪些前置项
3. 谁负责 gate / smoke / release-check
