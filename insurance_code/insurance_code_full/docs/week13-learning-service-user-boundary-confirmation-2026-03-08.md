# Week13 Learning Service 与 User Service 交叉边界确认结果

更新时间：2026-03-08  
负责人：B 号

## 1. 本周确认范围

只确认 `learning-service Phase 1` 与 `user-service` 的交叉边界，不讨论 points 域最终解耦。

## 2. 已确认成立的边界

1. `learning-service` 不暴露 `POST /api/auth/send-code`
2. `learning-service` 不暴露 `POST /api/auth/verify-basic`
3. `learning-service` 不暴露 `GET /api/me`
4. `learning-service` 不主写 `app_users / c_customers / p_sessions`
5. `learning-service` 沿用 `Authorization: Bearer <token>`
6. `learning-service` 沿用 `x-csrf-token: <csrfToken>`
7. `learning-service` 通过共享鉴权上下文消费 `user_id / tenant_id / actor_type / org_id / team_id`

## 3. Phase 1 试点实现口径

1. C 端登录仍通过 `user-service`
2. 登录成功后的 token / csrfToken 可直接调用 `learning-service` 的完成课程接口
3. 完成课程不会新增 user 主档写路径
4. 管理面课程接口继续复用共享 admin session，不新增 learning 自己的登录口
5. `complete` 只说明“试点实现存在”，不说明“Phase 1 已完成能力”

## 4. 本周未解决、但已记录的遗留

1. `complete` 仍复用共享 runtime 的积分落账逻辑
2. 这不影响 `user-service` 边界确认结果
3. 但它仍是 learning 与 points 之间的下一阶段遗留项
4. 因此不能把 `complete + reward` 作为本轮已完成项对外同步

## 5. 验证方式

1. `node scripts/smoke_learning_service_phase1.mjs`
2. `node scripts/check_learning_service_boundary_guard.mjs`
3. `node scripts/gate_learning_service_phase1.mjs`

## 6. B 号结论

Week13 这轮从 `user-service` 视角看，`learning-service` Phase 1 试点没有打穿 user 边界，可以继续保留在试点范围内推进。
