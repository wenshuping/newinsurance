# Activity -> Points Acceptance

更新时间：2026-03-09  
负责人：C 号  
状态：`WEEK16_PHASE2`

## 1. 验收目标

确认 `activity.complete -> points-service` 奖励链路已达到稳定交付口径：

1. 奖励只通过 `points-service` 契约落账
2. `activity-service` 不直写 points 主写表
3. 幂等 key 稳定
4. 错误码稳定
5. observability 稳定

## 2. 最终结论

结论：`PASS`

## 3. 核对结果

### 3.1 奖励是否仍只通过 points-service

是。

依据：

1. `server/microservices/activity-service/c-activity.routes.mjs`
2. `server/skeleton-c-v1/services/activity-reward.service.mjs`
3. `server/microservices/activity-service/points-service.client.mjs`
4. `server/microservices/points-service/activity-reward.route.mjs`
5. `server/microservices/points-service/activity-reward.contract.mjs`

### 3.2 是否仍未直写 points 主写表

是。

受保护表：

1. `c_point_accounts`
2. `c_point_transactions`
3. `p_orders`
4. `c_redeem_records`
5. `c_sign_ins`

### 3.3 幂等 key 是否收平

是。

固定规则：

1. `activity-reward:{tenantId}:{userId}:{activityId}:{completionDate}`
2. `completionDate` 固定 `YYYY-MM-DD`
3. 重复同 key 结算返回 `duplicated=true`

### 3.4 错误码是否收平

是。

固定错误码：

1. `INVALID_ACTIVITY_REWARD_USER`
2. `INVALID_ACTIVITY_REWARD_ACTIVITY_ID`
3. `INVALID_ACTIVITY_REWARD_DATE`
4. `INVALID_ACTIVITY_REWARD_POINTS`
5. `ACTIVITY_REWARD_SETTLEMENT_FAILED`
6. `ACTIVITY_POINTS_UPSTREAM_UNAVAILABLE`
7. `ACTIVITY_POINTS_CONTRACT_REJECTED`

### 3.5 observability 是否收平

是。

最小口径：

1. activity 侧：`activityComplete.successRate`
2. points 侧：`activityReward.successRate`
3. points recentLogs 包含：
   - `INTERNAL activity->points reward settlement`
4. 同一请求建议共享 `trace_id`

## 4. 验证入口

1. `node scripts/smoke_activity_complete_phase2.mjs`
2. `node scripts/smoke_activity_points_reward_phase2.mjs`
3. `node scripts/gate_activity_service_phase2.mjs`
