# Week5 B号日报（2026-03-07）

负责人：B 号  
服务：`user-service`  
状态：`INTEGRATED_WITH_GATEWAY`

## 1. 今天改了哪些入口

1. 独立启动入口：`server/microservices/user-service.mjs`
2. 服务装配入口：`server/microservices/user-service/app.mjs`
3. 用户域服务路由：`server/microservices/user-service/router.mjs`
4. 登录路由：`server/microservices/user-service/auth.routes.mjs`
5. 我的页路由：`server/microservices/user-service/me.routes.mjs`
6. 前端桥接层：`src/lib/api.ts`
7. 契约 smoke：`scripts/smoke_user_service_contract.mjs`
8. 交付说明：`docs/week5-b-user-service-delivery-note-2026-03-07.md`

## 2. 今天完成了什么

1. `auth / me` 已收口到 `user-service`
2. `user-service` 已可独立启动，并提供 `/health` 与 `/ready`
3. C 端登录与“我的”页字段保持不变
4. gateway 已按 `4101` 接入 user-service
5. 已确认 user-service 登录态与 points-service 当前鉴权兼容

## 3. 当前阻塞点

1. B 号范围内无阻塞
2. 待总联调阶段再并总 smoke 与总文档

## 4. 明天需要谁配合

1. A 号：继续负责 gateway 总 smoke 与环境变量收口
2. C 号：保持 `Authorization` 与 `x-csrf-token` 约定不变，避免桥接层冲突
3. 整合人：最后统一修改 `package.json`、总 smoke 编排、docs 索引

## 5. 当前验证结果

1. `node scripts/smoke_user_service_contract.mjs` 已通过
2. `POST /api/auth/send-code` 已通过
3. `POST /api/auth/verify-basic` 已通过
4. `GET /api/me` 已通过
5. `GET /api/points/summary` 已通过 Bearer token 验证
6. `POST /api/sign-in` 已通过 Bearer token + `x-csrf-token` 验证

## 6. 风险提醒

1. 当前是运行时拆分，不是物理拆库
2. `user-service` 仍复用现有 state/repository/usecase
3. 需要在总联调阶段继续盯前端桥接层环境变量是否被覆盖
