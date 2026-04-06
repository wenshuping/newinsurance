# Week11 灰度演练报告

- 时间：2026-03-09T01:01:08.735Z
- 结果：PASS
- gateway：http://127.0.0.1:49301
- user-service：http://127.0.0.1:49299
- points-service：http://127.0.0.1:49300

## 场景结果

- tenant.allowlist.send-code.v2: PASS | mode=v2 | target=user-service
- tenant.blocked.send-code.v1: PASS | mode=v1 | target=v1-monolith
- tenant.blocked.verify-basic.v1: PASS | mode=v1 | target=v1-monolith
- path.force-v2.me: PASS | mode=v2 | target=user-service
- path.force-v2.points-summary: PASS | mode=v2 | target=points-service
- path.force-v1.mall-items: PASS | mode=v1 | target=v1-monolith
- fallback.read.mall-items: PASS | mode=v1 | target=v1-monolith
- fallback.metrics.visible: PASS
- ops.overview.available: PASS

## 灰度判定

- tenant-level-gray-switch-works: PASS
- path-level-force-v2-works: PASS
- path-level-force-v1-works: PASS
- fallback-visible-for-read-paths: PASS
- gateway-dashboard-signals-available: PASS

## gateway 指标快照

- requestTotal: 8
- errorTotal: 0
- errorRate: 0
- fallbackTotal: 1
