# Week13+ 执行建议（Week12 收口输出）

更新时间：2026-03-08  
负责人：A 号

## 1. 结论

Week13+ 不建议同时开拆 `activity-service` 和 `learning-service`。

推荐顺序：

1. 先试点 `learning-service`
2. 再试点 `activity-service`
3. 两者都只做“最小迁移面”，不做大批量接口挪动

## 2. 为什么先 learning-service

1. `learning-service` 与 `user-service` 的边界更清晰
2. 学习域主要是内容和完成记录，交易风险低于活动奖励
3. 即使失败，回退成本低于账务类链路

## 3. 为什么 activity-service 放后

1. `activity-service` 与 `points-service` 的奖励落账耦合更深
2. 一旦奖励、签到、兑换边界处理不稳，最容易打到账务一致性
3. 需要先把同步命令/事件驱动方案选型收敛

## 4. Week13 建议动作

### 4.1 learning-service 试点

先做：

1. owned routes 最小集试点
2. `p_learning_materials` / `c_learning_records` ownership 落表
3. learning-service gate / smoke / release-check 样板脚本
4. 只放一个租户和一组学习资料样本

不要做：

1. 新登录协议
2. 新 session/token
3. 直接打通积分落账

## 5. Week14 建议动作

### 5.1 activity-service 试点前置

先做：

1. 评审“同步命令”与“事件驱动”二选一
2. 明确奖励幂等 key
3. 明确失败补偿策略
4. 明确签到是否长期留在 `points-service`

### 5.2 activity-service 最小试点

只试点：

1. 活动配置
2. 活动参与
3. 活动完成判定

不试点：

1. 账务最终写入
2. 订单/核销迁移

## 6. 总体执行纪律

1. 任何新服务试点，先文档、再 gate、再代码
2. 任何新服务试点，先小租户、再小路径、再扩量
3. 任何跨服务写路径，先定契约和幂等，再准许开发
4. 继续保持 Week5-Week11 既有边界不被打穿

## 7. Week12 最终建议

1. Week12 到此收口
2. Week13 进入 `learning-service` 最小试点准备
3. `activity-service` 保持设计评审状态，待奖励链路方案定稿后再进入试点
