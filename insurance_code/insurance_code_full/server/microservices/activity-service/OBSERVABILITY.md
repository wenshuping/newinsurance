# Activity Service Observability

更新时间：2026-03-09  
负责人：C 号  
状态：`WEEK16_PHASE2`

## 1. 最小观测指标

| Metric | Meaning | Success path | Failure path |
| --- | --- | --- | --- |
| `activityComplete.successRate` | 活动完成成功率 | `POST /api/activities/:id/complete` 返回 `200` | 任意失败，包括 `401`、`403`、`409`、`400`、`502` |
| `errorCounts` | activity 域错误码频次 | 从路由 catch 和 middleware JSON 响应归档 | 包含鉴权、CSRF、可见性、重复完成、points 上游错误 |

内部观测入口：

1. `GET /internal/activity-service/observability`
2. `GET /metrics`
3. `GET /internal/activity-service/metrics`

## 2. 日志字段规范

| Field | Required | Meaning |
| --- | --- | --- |
| `trace_id` | Yes | 优先复用 `x-trace-id`，否则由 activity-service 生成 |
| `user_id` | No | Bearer session 对应的客户 id |
| `activity_id` | No | 当前请求关联的活动 id |
| `route` | Yes | `METHOD /path` |
| `result` | Yes | `success` 或 `fail` |

支持字段：

1. `request_id`
2. `status_code`
3. `duration_ms`
4. `error_code`
5. `error_category`
6. `ts`

## 3. 错误分类

1. `INVALID_ACTIVITY_ID`
2. `ACTIVITY_NOT_FOUND`
3. `ACTIVITY_NOT_AVAILABLE`
4. `ALREADY_COMPLETED`
5. `NEED_BASIC_VERIFY`
6. `ACTIVITY_POINTS_UPSTREAM_UNAVAILABLE`
7. `ACTIVITY_POINTS_CONTRACT_REJECTED`
8. `INVALID_ACTIVITY_REWARD_USER`
9. `INVALID_ACTIVITY_REWARD_ACTIVITY_ID`
10. `INVALID_ACTIVITY_REWARD_DATE`
11. `INVALID_ACTIVITY_REWARD_POINTS`
12. `ACTIVITY_REWARD_SETTLEMENT_FAILED`
13. `UNAUTHORIZED`
14. `CSRF_INVALID`

## 4. 与 points 的联动观测

1. `activity-service` 侧记录 `POST /api/activities/:id/complete`
2. `points-service` 侧记录 `INTERNAL activity->points reward settlement`
3. 同一请求建议用同一个 `trace_id` 串联
4. Week16 验收口径中，`activityComplete.successRate` 与 `activityReward.successRate` 需同时解释
