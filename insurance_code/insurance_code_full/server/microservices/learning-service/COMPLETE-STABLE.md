# Learning Complete 稳定能力说明

更新时间：2026-03-08  
负责人：B 号  
状态：`WEEK14_PHASE2`

## 1. 本次收口内容

1. `POST /api/learning/courses/:id/complete` 已从 Week13 试点能力收口为稳定能力
2. 学习完成判定与完成记录继续归 `learning-service`
3. 奖励结算继续走 `learning-service -> points-service` 内部 HTTP 契约
4. `learning-service` 不直写 points 主写表

## 2. 稳定能力定义

1. route：`POST /api/learning/courses/:id/complete`
2. write table：`c_learning_records`
3. reward settlement：`POST /internal/points-service/learning-rewards/settle`
4. auth：`Authorization: Bearer <token>` + `x-csrf-token: <csrfToken>`
5. idempotency：同一用户同一课程重复完成不重复发积分

## 3. 不变项

1. 不改 `auth / me`
2. 不改 `token / csrf` 协议
3. 不扩课程新业务功能
4. 不改 points-service 业务语义

## 4. 验证方式

1. `node scripts/check_learning_service_boundary_guard.mjs`
2. `node scripts/smoke_learning_service_complete_phase2.mjs`
3. `node scripts/gate_learning_service_phase2.mjs`
