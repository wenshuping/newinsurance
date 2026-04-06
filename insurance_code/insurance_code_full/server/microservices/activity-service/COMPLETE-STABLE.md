# Activity Complete Stable Capability

更新时间：2026-03-09  
负责人：C 号  
状态：`WEEK16_PHASE2`

## 1. 结论

`POST /api/activities/:id/complete` 从 Week15 试点能力提升为 Week16 稳定能力。

稳定含义：

1. 已纳入 `activity-service` 正式 `stableContracts`
2. 已有独立 boundary guard
3. 已有独立 complete smoke
4. 已有 `activity -> points` 奖励链路 smoke
5. 已有 release-check 说明
6. 奖励结算只通过 `points-service` 内部契约

## 2. 稳定能力范围

1. 活动可见性判断
2. 活动可完成性判断
3. 当日重复完成拦截
4. `c_activity_completions` 写入
5. `activity-service -> points-service` 奖励结算
6. 统一 `trace_id` / 错误码 / 指标口径

## 3. 当前固定语义

1. 首次完成成功返回 `200`
2. 返回体包含：
   - `ok`
   - `reward`
   - `duplicated`
   - `balance`
3. 同用户同活动同日重复完成返回：
   - `409 ALREADY_COMPLETED`
4. 奖励落账失败时，不回退到本地点数写入
5. `sign-in / mall activities / join / redeem / writeoff` 不在当前稳定范围

## 4. 稳定性前提

1. `activity-complete.usecase` 不再直接 `recordPoints()`
2. legacy 兼容入口通过 `activity-reward.service.mjs` 转发到 `points-service`
3. points 侧契约固定为：
   - `POST /internal/points-service/activity-rewards/settle`
4. idempotency key 固定为：
   - `activity-reward:{tenantId}:{userId}:{activityId}:{completionDate}`

## 5. 验证入口

1. `node scripts/check_activity_service_boundary_phase2.mjs`
2. `node scripts/smoke_activity_complete_phase2.mjs`
3. `node scripts/smoke_activity_points_reward_phase2.mjs`
4. `node scripts/gate_activity_service_phase2.mjs`
