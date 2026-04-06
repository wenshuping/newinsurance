# Week15 Activity Tenant / Owner / Session 口径确认

更新时间：2026-03-09
负责人：B 号（user-service 视角）

## 1. tenant 口径

当前 activity 侧应沿用：

1. `tenantContext(req, res, next)`
2. `req.tenantContext.tenantId / orgId / teamId / ownerUserId`
3. `req.actor.actorType / actorId / tenantId / orgId / teamId`

当前确认：

1. `GET /api/activities` 已挂 `tenantContext`
2. `GET /api/p/activities` 已挂 `tenantContext`
3. `GET /api/b/activity-configs` 已挂 `tenantContext`
4. `POST /api/activities/:id/complete` 已挂 `tenantContext`

## 2. owner 口径

客户活动可见性当前仍通过：

1. `resolveCustomerOwnerActor(...)`
2. `canAccessTemplate(...)`
3. `canDeliverTemplateToActor(...)`

实际含义：

1. 客户必须先有 `ownerUserId`
2. owner 必须在同租户
3. 模板/活动必须满足 owner 可访问条件，才会继续向客户下发

## 3. session 口径

当前 activity 不得自建 session 协议，必须沿用：

1. `Authorization: Bearer <token>`
2. 共享 `resolveSessionFromBearer(...)`
3. 共享 `authRequired / authOptional`

当前确认：

1. activity 没有自己的 session 生成逻辑
2. activity 没有自己的 bearer 解析协议

## 4. csrf 口径

当前 activity 不得新建 csrf 协议，必须沿用：

1. `x-csrf-token`
2. `server/skeleton-c-v1/app.mjs` 中统一挂载的 `csrfProtection`

当前确认：

1. activity 路由没有单独定义 csrf 头名
2. 活动写接口继续受全局 `csrfProtection` 约束

## 5. Week15 结论

1. `tenant` 口径：列表、管理面、complete 已对齐
2. `owner` 口径：列表仍按 owner / tenant 链路下发
3. `session` 口径：未漂移
4. `csrf` 口径：未漂移
