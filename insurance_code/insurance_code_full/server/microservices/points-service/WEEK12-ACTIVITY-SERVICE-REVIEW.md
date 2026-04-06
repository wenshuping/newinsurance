# Week12 Activity Service 边界设计评审准备

更新时间：2026-03-08  
负责人：C 号（points-service）

## 1. 目标

Week12 C 号只参与 `activity-service` 的边界设计评审，不在本周直接拆服务或改 points 业务语义。

这份文档现在只作为 Week12 总览入口，详细设计已经拆到以下两份文档：

1. `activity-service` 设计包  
   `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/docs/week12-activity-service-design-package-2026-03-08.md`
2. activity 与 points 交叉边界说明  
   `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/microservices/points-service/WEEK12-ACTIVITY-POINTS-BOUNDARY.md`

评审时优先看这两份，不再只看本页摘要。

## 2. 当前结论摘要

Week12 当前建议收成下面 6 条：

1. `activity-service` 首批只接活动定义、活动配置、活动完成判定、完成记录
2. `points-service` 继续独占积分、签到、订单、兑换、核销主写
3. 活动奖励最终必须通过 `points-service` 落账
4. `sign-in` 和商城活动参与本周先不迁
5. 先补 `smoke / gate / route ownership / source-domain ownership` 设计
6. 本周不直接开拆生产代码

## 3. 本周不做的事

Week12 不做：

1. 真正拆 `activity-service`
2. 新增跨服务写接口
3. 改 points-service 已冻结接口
4. 改 user-service 或公共入口文件
