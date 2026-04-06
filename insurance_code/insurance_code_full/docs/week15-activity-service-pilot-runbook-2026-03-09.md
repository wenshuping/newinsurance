# Week15 activity-service 最小试点 Runbook

更新时间：2026-03-09  
负责人：A 号

## 1. 范围

Week15 只接入 `activity-service` Phase 1 试点，不扩 `user-service / points-service` 主写边界。

通过范围：

1. `GET /api/activities`
2. `POST /api/activities/:id/complete`
3. `GET /api/p/activities`
4. `POST /api/p/activities`
5. `PUT /api/p/activities/:id`
6. `DELETE /api/p/activities/:id`
7. `GET /api/b/activity-configs`
8. `POST /api/b/activity-configs`
9. `PUT /api/b/activity-configs/:id`
10. `activity-service -> points-service` 奖励结算内部 HTTP 契约

不在本轮范围：

1. `auth / me`
2. `sign-in`
3. `mall activities / join / redeem / writeoff`
4. gateway 写路径自动 fallback

## 2. 端口与开关

1. `gateway`: `4100`
2. `user-service`: `4101`
3. `points-service`: `4102`
4. `learning-service`: `4103`
5. `activity-service`: `4104`
6. `v1-monolith`: `4000`

灰度开关：

1. `GATEWAY_ENABLE_ACTIVITY_SERVICE`
2. `GATEWAY_ACTIVITY_SERVICE_URL`
3. `GATEWAY_FORCE_V1_PATHS`
4. `GATEWAY_V2_TENANTS`
5. `ACTIVITY_POINTS_SERVICE_URL`

推荐口径：

1. 默认 `GATEWAY_ENABLE_ACTIVITY_SERVICE=false`
2. 白名单租户通过 `GATEWAY_V2_TENANTS` 放量
3. 写路径回退使用 `GATEWAY_FORCE_V1_PATHS=/api/activities,/api/p/activities,/api/b/activity-configs`

## 3. 统一入口

1. 服务级 smoke：`npm run test:smoke:activity-service`
2. 奖励契约 smoke：`npm run test:smoke:activity-points-contract:week15`
3. Week15 总 smoke：`npm run test:smoke:week15-activity-pilot`
4. Week15 release-check：`npm run release-check:week15-activity-pilot`
5. Week15 gate：`npm run gate:week15-activity-pilot`

## 4. 验收要求

1. gateway route-map 挂上 activity Phase 1 owned routes
2. activity 默认关闭时，流量仍走 `v1-monolith`
3. 打开开关后，白名单租户的 activity 流量切到 `activity-service`
4. 活动完成奖励通过 `activity-service -> points-service` 内部 HTTP 落账
5. points summary 能看到奖励增量
6. points observability 能看到 `INTERNAL activity->points reward settlement`
7. GET 读路径上游异常时能 fallback 到 `v1-monolith`
8. POST 写路径上游异常时不自动 fallback，只允许手工回退

## 5. 失败时处理

1. 先看 `GET /internal/gateway/routes`
2. 再看 `GET /internal/gateway/metrics`
3. 再看 `GET /internal/activity-service/observability`
4. 再看 `GET /internal/points-service/observability`
5. 如果是写路径故障，优先切 `GATEWAY_FORCE_V1_PATHS`

## 6. 结论口径

Week15 结论只看这 3 件事：

1. activity Phase 1 owned routes 是否切过去
2. complete reward 是否真实走 points-service 契约
3. 读 fallback / 写手工回退是否成立
