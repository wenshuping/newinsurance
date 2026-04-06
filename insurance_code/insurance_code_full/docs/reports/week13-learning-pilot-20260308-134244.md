# Week13 Learning Service 最小试点演练报告

- 时间：2026-03-08T05:42:44.068Z
- 结果：PASS
- gateway：http://127.0.0.1:58784
- learning-service：http://127.0.0.1:58783
- user-service：http://127.0.0.1:58781
- points-service：http://127.0.0.1:58782

## 场景结果

- learning.routes.registered: PASS
- learning.disabled.default-v1: PASS | mode=v1 | target=v1-monolith
- learning.enabled.cutover-v2: PASS | mode=v2 | target=learning-service
- learning.tenant-blocked.v1: PASS | mode=v1 | target=v1-monolith
- learning.force-v1.rollback: PASS | mode=v1 | target=v1-monolith
- learning.back-to-v2: PASS | mode=v2 | target=learning-service
- learning.admin.list.v2: PASS | mode=v2 | target=learning-service
- learning.admin.create.v2: PASS | mode=v2 | target=learning-service
- learning.customer.list.v2: PASS | mode=v2 | target=learning-service
- learning.customer.detail.v2: PASS | mode=v2 | target=learning-service
- learning.complete.stays-on-v1: PASS | mode=v1 | target=v1-monolith
- learning.admin.update.v2: PASS | mode=v2 | target=learning-service
- learning.ops.overview: PASS
- learning.read-fallback.v1: PASS | mode=v1 | target=v1-monolith
- learning.admin.delete.v2: PASS | mode=v2 | target=learning-service

## 结论

- learning pilot enabled by default: false
- pilot cutover works: PASS
- force-v1 rollback works: PASS
- read fallback works: PASS
- complete stays on v1: PASS
