# Week16 Activity Service Tenant / Owner / Session / CSRF 稳定口径确认

更新时间：2026-03-09  
负责人：B 号（user-service 视角）

## 1. tenant 口径

activity-service 必须沿用：

1. `unifiedAuthAndTenantContext`
2. `tenantContext(req, res, next)`
3. `req.tenantContext.tenantId / orgId / teamId / ownerUserId`
4. `req.actor.actorType / actorId / tenantId / orgId / teamId`

当前确认：

1. `GET /api/activities` 已挂 `tenantContext`
2. `POST /api/activities/:id/complete` 已挂 `tenantContext`
3. `GET /api/p/activities` 继续复用 `tenantContext`
4. `GET /api/b/activity-configs` 继续复用 `tenantContext`

## 2. owner 口径

客户活动可见性继续通过：

1. `resolveCustomerOwnerActor(...)`
2. `canAccessTemplate(...)`
3. `canDeliverTemplateToActor(...)`

稳定含义：

1. 客户无 `ownerUserId` 时，不应看到同租户活动
2. 客户有 owner 后，只能看到 owner 可访问且同租户可下发的活动
3. 跨租户活动不得外泄

## 3. session 口径

activity-service 不得自建 session 协议，必须沿用：

1. `Authorization: Bearer <token>`
2. 共享 `authRequired / authOptional`
3. 共享 `unifiedAuthAndTenantContext`

当前确认：

1. activity-service 没有自己的 session 生成逻辑
2. activity-service 没有自己的 bearer 解析协议
3. `POST /api/activities/:id/complete` 仍要求 Bearer token

## 4. csrf 口径

activity-service 不得新建 csrf 协议，必须沿用：

1. `x-csrf-token`
2. `server/microservices/activity-service/app.mjs` 中统一挂载的 `csrfProtection`

当前确认：

1. activity-service 没有单独定义新的 csrf 头名
2. `POST /api/activities/:id/complete` 继续受共享 csrf 保护

## 5. Week16 稳定结论

1. `tenant` 口径：列表、完成、P/B 管理面已对齐
2. `owner` 口径：继续按 owner / tenant 链路下发
3. `session` 口径：未漂移
4. `csrf` 口径：未漂移
5. `complete` 已可按稳定 user 侧边界处理
