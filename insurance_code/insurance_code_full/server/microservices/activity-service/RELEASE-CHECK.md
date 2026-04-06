# Activity Service Release Check

更新时间：2026-03-09  
负责人：C 号  
状态：`WEEK16_PHASE2`

## 1. 目的

这份 release-check 只覆盖 `activity-service` Phase 2 稳定能力，不覆盖 `user-service`、gateway 总编排，也不覆盖商城/签到链路。

## 2. 发布前必须满足

1. `POST /api/activities/:id/complete` 已进入 `stableContracts`
2. 主写表只包含：
   - `p_activities(source_domain='activity')`
   - `c_activity_completions`
3. 奖励落账只通过：
   - `POST /internal/points-service/activity-rewards/settle`
4. `activity-service` 不直写：
   - `c_point_accounts`
   - `c_point_transactions`
   - `p_orders`
   - `c_redeem_records`
   - `c_sign_ins`
5. 幂等 key、错误码、observability 口径与 points 契约一致

## 3. 最小检查项

1. `node scripts/check_activity_service_boundary_phase2.mjs`
2. `node scripts/smoke_activity_complete_phase2.mjs`
3. `node scripts/smoke_activity_points_reward_phase2.mjs`
4. `node scripts/gate_activity_service_phase2.mjs`

## 4. 通过标准

1. complete 路由未登录返回 `401`
2. complete 路由缺 `x-csrf-token` 返回 `403`
3. 首次完成成功
4. 重复完成返回 `409 ALREADY_COMPLETED`
5. points summary 增加
6. points observability 出现：
   - `INTERNAL activity->points reward settlement`
7. 同一 idempotency key 不新增第二条积分流水

## 5. 明确不做的事

1. 不迁 `sign-in`
2. 不迁 `mall activities / join`
3. 不迁 `redeem / writeoff`
4. 不改 `auth / me`
5. 不改公共 `package.json`
