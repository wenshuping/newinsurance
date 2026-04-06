# Week18 Learning 正式拆出联调报告

- 时间：2026-03-09T06:05:38.088Z
- 结果：PASS
- gateway：http://127.0.0.1:62716
- learning-service：http://127.0.0.1:62715
- user-service：http://127.0.0.1:62713
- points-service：http://127.0.0.1:62714

## 场景结果

- learning.routes.registered.week18: PASS
- learning.default.courses.v1: PASS | mode=v1 | target=v1-monolith
- learning.default.games.v1: PASS | mode=v1 | target=v1-monolith
- learning.default.tools.v1: PASS | mode=v1 | target=v1-monolith
- learning.cutover.courses.v2: PASS | mode=v2 | target=learning-service
- learning.cutover.games.v2: PASS | mode=v2 | target=learning-service
- learning.cutover.tools.v2: PASS | mode=v2 | target=learning-service
- learning.customer.list.v2: PASS | mode=v2 | target=learning-service
- learning.customer.detail.v2: PASS | mode=v2 | target=learning-service
- learning.complete.v2: PASS | mode=v2 | target=learning-service
- learning.reward.points-summary-updated: PASS | mode=v2 | target=points-service
- learning.reward.points-observability: PASS
- learning.gateway-metrics.v2: PASS
- learning.complete.force-v1.rollback: PASS | mode=v1 | target=v1-monolith
- learning.reward.points-observability.force-v1: PASS
- learning.complete.back-to-v2: PASS | mode=v2 | target=learning-service
- learning.read.games.fallback.v1: PASS | mode=v1 | target=v1-monolith
- learning.complete.no-auto-fallback: PASS | mode=v2 | target=learning-service
- learning.gateway-metrics.rollback: PASS

## 结论

- default learning reads on v1: PASS
- formal split reads on v2: PASS
- learning complete cutover to v2: PASS
- complete reward chain via points: PASS
- force-v1 rollback works: PASS
- back-to-v2 works: PASS
- read fallback works: PASS
- write path requires manual rollback: PASS
- manual rollback for write works: PASS
- gateway metrics cover reads and complete: PASS
- points observability covers reward: PASS
