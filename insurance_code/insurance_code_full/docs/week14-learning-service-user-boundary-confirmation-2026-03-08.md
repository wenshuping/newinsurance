# Week14 Learning Service 与 User Service 交叉边界确认结果

更新时间：2026-03-08  
负责人：B 号

## 1. 本周确认范围

只确认 `POST /api/learning/courses/:id/complete` 提升为稳定能力后，`learning-service` 与 `user-service` 的交叉边界是否仍然成立。

## 2. 已确认成立的边界

1. `learning-service` 不暴露 `POST /api/auth/send-code`
2. `learning-service` 不暴露 `POST /api/auth/verify-basic`
3. `learning-service` 不暴露 `GET /api/me`
4. `learning-service` 不主写 `app_users / c_customers / p_sessions`
5. `learning-service` 继续沿用 `Authorization: Bearer <token>`
6. `learning-service` 继续沿用 `x-csrf-token: <csrfToken>`
7. `complete` 稳定化后，learning 仍只消费身份上下文，不维护 user 真相源

## 3. Week14 结论

1. `complete` 已经可以作为 `learning-service` 稳定能力存在
2. 稳定化没有打穿 user-service 边界
3. user 域协议和字段语义不需要改
4. B 号视角下，这条链路可以按稳定能力继续推进

## 4. 验证入口

1. `node scripts/check_learning_service_boundary_guard.mjs`
2. `node scripts/smoke_learning_service_complete_phase2.mjs`
3. `node scripts/gate_learning_service_phase2.mjs`
