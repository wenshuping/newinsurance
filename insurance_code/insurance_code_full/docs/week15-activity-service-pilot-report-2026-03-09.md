# Week15 activity-service 最小试点总结报告

更新时间：2026-03-09  
负责人：A 号

## 1. 本轮目标

1. 把 `activity-service` 接入 runtime split 总编排
2. 把 activity Phase 1 owned routes 接进 gateway 路由表和切流开关
3. 把 `activity-service -> points-service` 奖励结算链路接入总 smoke / release-check
4. 保证 `user-service / points-service` 既有 gate 不回归

## 2. 本轮接入结果

### 2.1 gateway

已接入：

1. `GET /api/activities`
2. `POST /api/activities/:id/complete`
3. `GET /api/p/activities`
4. `POST /api/p/activities`
5. `PUT /api/p/activities/:id`
6. `DELETE /api/p/activities/:id`
7. `GET /api/b/activity-configs`
8. `POST /api/b/activity-configs`
9. `PUT /api/b/activity-configs/:id`

开关：

1. `GATEWAY_ENABLE_ACTIVITY_SERVICE`
2. `GATEWAY_ACTIVITY_SERVICE_URL`

### 2.2 runtime split 编排

已纳入：

1. `activity-service` 启动入口：`4104`
2. 本地编排脚本 `dev-start-all / dev-status-all / dev-stop-all`
3. Week15 总 gate / smoke / release-check

### 2.3 activity -> points 契约

固定口径：

1. 调用方式：内部 HTTP
2. 调用方：`activity-service`
3. 提供方：`points-service`
4. 契约入口：`POST /internal/points-service/activity-rewards/settle`
5. 透传头：
   - `x-internal-service`
   - `x-service-name`
   - `x-trace-id`
   - `x-request-id`
   - `x-tenant-id`
   - `x-tenant-code`

## 3. 本轮统一入口

1. `npm run test:smoke:activity-service`
2. `npm run test:smoke:activity-points-contract:week15`
3. `npm run test:smoke:week15-activity-pilot`
4. `npm run release-check:week15-activity-pilot`
5. `npm run gate:week15-activity-pilot`

## 4. 风险与保留项

1. 写路径仍不做自动 network fallback
2. `sign-in / mall activities / join / redeem / writeoff` 继续归 `points-service`
3. `user-service` 身份、客户、session 主写边界未动
4. `points-service` 账务主写边界未动

## 5. 演练结果引用

最新演练结果：

1. `./reports/week15-activity-pilot-latest.md`
2. `./reports/week15-activity-pilot-latest.json`

## 6. 实际执行命令

1. `node scripts/check_week15_activity_service_pilot.mjs`
2. `npm run release-check:week15-activity-pilot`
3. `npm run gate:week15-activity-pilot`
4. `npm run docs:check-links`

## 7. 实际结果

当前结果：

1. activity owned routes 已挂入 gateway，route count = `6`
2. 默认关闭时，`/api/activities` 和 `/api/activities/:id/complete` 都仍走 `v1-monolith`
3. 打开 `GATEWAY_ENABLE_ACTIVITY_SERVICE` 后：
   - `POST /api/p/activities` 走 `activity-service`
   - `GET /api/activities` 走 `activity-service`
   - `POST /api/activities/:id/complete` 走 `activity-service`
4. `activity-service -> points-service` 奖励结算链路成立，`rewardDelta = 9`
5. `points-service` observability 已记录 `INTERNAL activity->points reward settlement`
6. 读路径上游异常时，gateway 自动 fallback 到 `v1-monolith`
7. 写路径上游异常时，不做自动 fallback，返回 `502`
8. 手工把写路径加入 `GATEWAY_FORCE_V1_PATHS` 后，写路径回退到 `v1-monolith` 成功

## 8. A 号结论范围

A 号本轮只对下面范围给结论：

1. activity Phase 1 编排和接线成立
2. gateway 切流 / 读路径 fallback / 写路径手工回退成立
3. activity -> points 契约化奖励结算成立

不在 A 号本轮结论里的内容：

1. `user-service` 主写边界调整
2. `points-service` 主写边界调整
3. 新业务功能扩展
