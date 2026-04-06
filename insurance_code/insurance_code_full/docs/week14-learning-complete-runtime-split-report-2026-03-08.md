# Week14 Learning Complete + Reward 总结报告

更新时间：2026-03-08  
负责人：A 号（整合）

## 1. 本轮目标

Week14 的目标不是继续扩学习业务，而是把 `learning complete + reward` 正式纳入 runtime split 的统一验收入口。

本轮收口项：

1. gateway 路由正式覆盖 `POST /api/learning/courses/:id/complete`
2. `learning-service -> points-service` 契约调用纳入总 smoke / release-check / gate
3. gateway 对学习完成链路的切流、手工回退、观测口径形成统一结论
4. 保证 `user-service / points-service` 既有 gate 不回归

## 2. 最终口径

### 2.1 已正式纳入 Week14 验收范围

1. `POST /api/learning/courses/:id/complete`
2. `learning-service -> points-service` 奖励结算契约
3. `complete` 路径的 gateway 切流与手工回退
4. `complete` 路径的 gateway / points observability

### 2.2 仍不改变的边界

1. 不改 `user-service` 身份与 session 边界
2. 不改 `points-service` 积分账户 / 流水主写边界
3. 不扩 gateway 自动写路径 fallback 能力
4. 不回写 `Week13 Phase 1 = 查询 + 管理端 CRUD` 的历史结论

## 3. 新增入口

1. 总 smoke：`npm run test:smoke:week14-learning-complete`
2. release-check：`npm run release-check:week14-learning-complete`
3. 总 gate：`npm run gate:week14-learning-complete`

## 4. 通过项

1. learning 默认关闭时，读路径仍走 `v1-monolith`
2. 打开 learning 后，`complete` 经 gateway 路由到 `learning-service`
3. 奖励链路通过 `points-service` 内部 HTTP 契约完成落账
4. points summary 可见奖励增加
5. points observability 可按 `trace_id` 看见奖励结算日志
6. gateway metrics 可按 `trace_id` 看见 `complete` 的路由目标与 fallback 计数
7. `GATEWAY_FORCE_V1_PATHS=/api/learning/courses` 时，`complete` 可手工回退到 `v1-monolith`
8. 清空 `force-v1` 后，`complete` 可重新切回 `learning-service`
9. 读路径上游异常时，自动 fallback 仍成立
10. 写路径上游异常时，返回 `502`，不做自动网络 fallback
11. 写路径通过路径级 `force-v1` 可恢复服务
12. Week14 gate 内的 `week11-gate` 继续通过

## 5. 失败项

本轮最终无失败项。

## 6. 风险项

1. 写路径仍不支持自动网络 fallback，这是刻意设计，不是缺陷
2. Week14 的正式回退方式是手工/路径级强制回 V1，需要运维按 runbook 执行
3. learning-service 当前仍未独立提供像 `points-service` 那样的 observability endpoint，本轮观测以 gateway metrics + points observability 为主

## 7. 结论

1. Week14 已把 `learning complete + reward` 正式纳入总 gate / 总 smoke / release-check
2. gateway 切流、手工回退、观测口径已覆盖学习完成链路
3. 现有 `user-service / points-service` gate 未被打坏
4. Week14 可以按当前口径归档收口
