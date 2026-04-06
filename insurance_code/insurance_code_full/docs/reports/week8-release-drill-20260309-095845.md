# Week8 发布/回退演练记录

- 时间：2026-03-09T01:58:44.989Z
- 结果：PASS
- gateway：http://127.0.0.1:56419
- user-service：http://127.0.0.1:56417
- points-service：http://127.0.0.1:56418

## 场景结果

- release.v2.send-code: PASS | mode=v2 | target=user-service
- release.v2.verify-basic: PASS | mode=v2 | target=user-service
- release.v2.mall-items: PASS | mode=v2 | target=points-service
- rollback.force-v1.send-code: PASS | mode=v1 | target=v1-monolith
- rollback.force-v1.mall-items: PASS | mode=v1 | target=v1-monolith
- release.back-to-v2.me: PASS | mode=v2 | target=user-service
- release.back-to-v2.points-summary: PASS | mode=v2 | target=points-service
- fallback.read.mall-items: PASS | mode=v1 | target=v1-monolith
- fallback.metrics.visible: PASS

## 指标快照

- requestTotal: 9
- errorTotal: 0
- errorRate: 0
- avgLatencyMs: 27.22
- maxLatencyMs: 57
- fallbackTotal: 1

## 上线判定

- v2-default-paths-healthy: PASS
- force-v1-rollback-works: PASS
- back-to-v2-recovers: PASS
- read-fallback-works-on-upstream-failure: PASS
- gateway-error-rate-acceptable: PASS
