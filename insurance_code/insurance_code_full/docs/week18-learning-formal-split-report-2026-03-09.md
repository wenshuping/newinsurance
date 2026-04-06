# Week18 Learning 域正式拆出总结报告

更新时间：2026-03-09  
负责人：A 号（整合）

## 1. 本轮目标

Week18 的目标是把 `learning` 域从 runtime split 试点推进到正式拆出，并把遗留 monolith 注册点收缩到最小兼容面。

本轮收口项：

1. gateway 路由正式覆盖 `courses / games / tools / complete / P 端课程 CRUD`
2. `learning-service -> points-service` 奖励结算链路继续纳入统一验收入口
3. monolith learning 路由文件从 `must-keep` 调整为 `compatibility-only`
4. Week18 总 gate / 总 smoke / release-check 固化

## 2. 最终口径

### 2.1 已正式纳入 Week18 验收范围

1. `GET /api/learning/courses`
2. `GET /api/learning/games`
3. `GET /api/learning/tools`
4. `GET /api/learning/courses/:id`
5. `POST /api/learning/courses/:id/complete`
6. `GET /api/p/learning/courses`
7. `POST /api/p/learning/courses`
8. `PUT /api/p/learning/courses/:id`
9. `DELETE /api/p/learning/courses/:id`

### 2.2 仍不改变的边界

1. 不改 `user-service` 身份与 session 边界
2. 不改 `points-service` 积分账户 / 流水主写边界
3. 不扩 gateway 自动写路径 fallback 能力
4. monolith learning 路由文件仍保留为 `v1` 兼容层，不视为新主边界

## 3. 新增入口

1. 总 smoke：`npm run test:smoke:week18-learning-formal-split`
2. release-check：`npm run release-check:week18-learning-formal-split`
3. 总 gate：`npm run gate:week18-learning-formal-split`

## 4. 通过项

1. learning 默认关闭时，`courses / games / tools` 仍走 `v1-monolith`
2. 打开 learning 后，`courses / games / tools` 经 gateway 路由到 `learning-service`
3. `complete` 经 gateway 路由到 `learning-service`
4. 奖励链路通过 `points-service` 内部 HTTP 契约完成落账
5. points summary 可见奖励增加
6. points observability 可按 `trace_id` 看见奖励结算日志
7. gateway metrics 可按 `trace_id` 看见 `games` 读 fallback 与 `complete` 的路由目标
8. `GATEWAY_FORCE_V1_PATHS=/api/learning/courses` 时，`complete` 可手工回退到 `v1-monolith`
9. 清空 `force-v1` 后，`complete` 可重新切回 `learning-service`
10. 读路径上游异常时，自动 fallback 仍成立
11. 写路径上游异常时，返回 `502`，不做自动网络 fallback
12. Week16 gate 与 Week17 三个扫描在 Week18 gate 内继续通过

补充：
1. Week18 的手工回退结论只覆盖健康上游条件下的 `force-v1` 切换
2. 当 `learning-service` 不可用时，`complete` 不纳入 `v1-monolith` 本地兜底范围

## 5. 风险项

1. monolith 仍保留 learning 兼容路由，直到下一轮 compatibility cleanup 真正下线
2. 写路径回退仍依赖人工/路径级开关，这是刻意设计，不是缺陷
3. 当前 learning-service 观测仍以 gateway metrics + points observability 为主，独立观测面仍弱于 points-service

## 6. 结论

1. Week18 已把 learning 域正式拆出纳入总 gate / 总 smoke / release-check
2. learning 兼容层已收缩到最小：保留 `v1` 读 fallback 和 `complete force-v1` 所需的 monolith 注册点
3. gateway 切流、读 fallback、写手工回退、奖励结算观测口径已覆盖 learning 全域正式拆出链路
