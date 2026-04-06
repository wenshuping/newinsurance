# Week15 Activity Service 最小试点联调报告

- 时间：2026-03-09T01:03:11.850Z
- 结果：PASS
- gateway：http://127.0.0.1:49638
- activity-service：http://127.0.0.1:49637
- user-service：http://127.0.0.1:49635
- points-service：http://127.0.0.1:49636

## 场景结果

- activity.routes.registered.week15: PASS
- activity.default.read.v1: PASS | mode=v1 | target=v1-monolith
- activity.default.complete.v1: PASS | mode=v1 | target=v1-monolith
- activity.cutover.admin.create.v2: PASS | mode=v2 | target=activity-service
- activity.cutover.read.v2: PASS | mode=v2 | target=activity-service
- activity.complete.v2: PASS | mode=v2 | target=activity-service
- activity.reward.points-summary-updated: PASS | mode=v2 | target=points-service
- activity.reward.points-observability: PASS
- activity.complete.gateway-metrics.v2: PASS
- activity.complete.force-v1.rollback: PASS | mode=v1 | target=v1-monolith
- activity.complete.back-to-v2: PASS | mode=v2 | target=activity-service
- activity.read.fallback.v1: PASS | mode=v1 | target=v1-monolith
- activity.complete.no-auto-fallback: PASS | mode=v2 | target=activity-service
- activity.complete.manual-rollback.v1: PASS | mode=v1 | target=v1-monolith
- activity.gateway-metrics.read-fallback: PASS

## 结论

- default activity traffic on v1: PASS
- activity cutover to v2: PASS
- activity reward chain via points: PASS
- force-v1 rollback works: PASS
- back-to-v2 works: PASS
- read fallback works: PASS
- write path requires manual rollback: PASS
- manual write rollback works: PASS
- gateway metrics cover complete: PASS
- points observability covers reward: PASS
