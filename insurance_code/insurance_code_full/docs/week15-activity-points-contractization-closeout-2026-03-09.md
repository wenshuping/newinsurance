# Week15 activity -> points 契约化改造总说明

更新时间：2026-03-09  
负责人：A 号

## 1. 目标

把活动完成奖励从“活动域本地改积分”收口成“activity-service 调 points-service 契约落账”。

## 2. 当前统一口径

1. `activity-complete.usecase` 不允许直接 `recordPoints()`
2. `activity-service` route 必须通过 `points-service.client.mjs`
3. legacy 兼容入口必须通过 `server/skeleton-c-v1/services/activity-reward.service.mjs` 转发到同一 HTTP 契约
4. points 主写表只允许 `points-service` 持有

## 3. 契约入口

1. endpoint：`POST /internal/points-service/activity-rewards/settle`
2. caller：`activity-service`
3. idempotencyKey：`activity-reward:{tenantId}:{userId}:{activityId}:{completionDate}`

## 4. 验收方式

1. 静态边界检查：`node scripts/check_activity_service_boundary_phase1.mjs`
2. 契约 smoke：`node scripts/smoke_activity_points_reward_phase1.mjs`
3. gateway 联调：`node scripts/smoke_week15_activity_pilot.mjs`

## 5. 结论边界

Week15 只验：

1. 契约调用方式成立
2. 奖励落账成立
3. 幂等成立

Week15 不验：

1. 新积分业务能力
2. points 主写边界扩容
3. gateway 新业务能力
