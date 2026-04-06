# 错误码触发接口矩阵（v1）

更新时间：2026-03-03

来源：`server/skeleton-c-v1/routes/*.mjs` 自动扫描生成。

维护方式：
- 生成：`npm run docs:generate:error-matrix`
- 校验：`npm run docs:check:error-matrix`

统计：共 61 条映射，覆盖 38 个错误码。

| 错误码 | HTTP | 方法 | 路径 | 来源文件 |
|---|---:|---|---|---|
| `ACTIVITY_NOT_AVAILABLE` | 409 | POST | `/api/activities/:id/complete` | `server/skeleton-c-v1/routes/activities.routes.mjs` |
| `ACTIVITY_NOT_FOUND` | 404 | POST | `/api/activities/:id/complete` | `server/skeleton-c-v1/routes/activities.routes.mjs` |
| `ACTIVITY_NOT_FOUND` | 404 | PUT | `/api/b/activity-configs/:id` | `server/skeleton-c-v1/routes/b-admin-activity.routes.mjs` |
| `ACTOR_ID_REQUIRED` | 400 | GET | `/api/p/metrics/share-daily` | `server/skeleton-c-v1/routes/p-admin-metrics.routes.mjs` |
| `AGENT_NOT_FOUND` | 404 | POST | `/api/p/customers/assign-by-mobile` | `server/skeleton-c-v1/routes/p-admin-workforce.routes.mjs` |
| `AGENT_NOT_FOUND` | 404 | POST | `/api/p/customers/system-assign` | `server/skeleton-c-v1/routes/p-admin-workforce.routes.mjs` |
| `AGENT_REQUIRED` | 400 | POST | `/api/p/customers/assign-by-mobile` | `server/skeleton-c-v1/routes/p-admin-workforce.routes.mjs` |
| `AGENT_REQUIRED` | 400 | POST | `/api/p/customers/system-assign` | `server/skeleton-c-v1/routes/p-admin-workforce.routes.mjs` |
| `ALREADY_COMPLETED` | 409 | POST | `/api/activities/:id/complete` | `server/skeleton-c-v1/routes/activities.routes.mjs` |
| `ALREADY_SIGNED` | 409 | POST | `/api/sign-in` | `server/skeleton-c-v1/routes/activities.routes.mjs` |
| `ALREADY_WRITTEN_OFF` | 409 | POST | `/api/redemptions/:id/writeoff` | `server/skeleton-c-v1/routes/redemptions.routes.mjs` |
| `CODE_EXPIRED` | 400 | POST | `/api/auth/verify-basic` | `server/skeleton-c-v1/routes/auth.routes.mjs` |
| `CODE_NOT_FOUND` | 400 | POST | `/api/auth/verify-basic` | `server/skeleton-c-v1/routes/auth.routes.mjs` |
| `CUSTOMER_IDS_REQUIRED` | 400 | POST | `/api/p/customers/system-assign` | `server/skeleton-c-v1/routes/p-admin-workforce.routes.mjs` |
| `CUSTOMER_MOBILE_INVALID` | 400 | POST | `/api/p/customers/assign-by-mobile` | `server/skeleton-c-v1/routes/p-admin-workforce.routes.mjs` |
| `CUSTOMER_NOT_FOUND` | 404 | GET | `/api/b/customers/:id/profile` | `server/skeleton-c-v1/routes/b-admin-customers.routes.mjs` |
| `CUSTOMER_NOT_FOUND` | 404 | POST | `/api/p/customers/assign-by-mobile` | `server/skeleton-c-v1/routes/p-admin-workforce.routes.mjs` |
| `DAY_INVALID` | 400 | GET | `/api/p/metrics/share-daily` | `server/skeleton-c-v1/routes/p-admin-metrics.routes.mjs` |
| `EVENT_REQUIRED` | 400 | POST | `/api/track/events` | `server/skeleton-c-v1/routes/track.routes.mjs` |
| `FILE_TOO_LARGE` | 413 | POST | `/api/uploads/base64` | `server/skeleton-c-v1/routes/uploads.routes.mjs` |
| `INVALID_ACTIVITY_ID` | 400 | POST | `/api/activities/:id/complete` | `server/skeleton-c-v1/routes/activities.routes.mjs` |
| `INVALID_DATA_URL` | 400 | POST | `/api/uploads/base64` | `server/skeleton-c-v1/routes/uploads.routes.mjs` |
| `INVALID_ORDER_ID` | 400 | POST | `/api/orders/:id/cancel` | `server/skeleton-c-v1/routes/orders.routes.mjs` |
| `INVALID_ORDER_ID` | 400 | POST | `/api/orders/:id/pay` | `server/skeleton-c-v1/routes/orders.routes.mjs` |
| `INVALID_ORDER_ID` | 400 | POST | `/api/orders/:id/refund` | `server/skeleton-c-v1/routes/orders.routes.mjs` |
| `INVALID_PRODUCT_ID` | 400 | POST | `/api/orders` | `server/skeleton-c-v1/routes/orders.routes.mjs` |
| `INVALID_TOKEN` | 400 | POST | `/api/redemptions/:id/writeoff` | `server/skeleton-c-v1/routes/redemptions.routes.mjs` |
| `JOB_NOT_FOUND` | 404 | GET | `/api/p/tag-rule-jobs/:id` | `server/skeleton-c-v1/routes/p-admin-tags.routes.mjs` |
| `MALL_ACTIVITY_NOT_FOUND` | 404 | PUT | `/api/b/mall/activities/:id` | `server/skeleton-c-v1/routes/b-admin-mall.routes.mjs` |
| `MANUAL_FLOW_REQUIRED` | 409 | POST | `/api/activities/:id/complete` | `server/skeleton-c-v1/routes/activities.routes.mjs` |
| `NAME_REQUIRED` | 400 | POST | `/api/b/mall/products` | `server/skeleton-c-v1/routes/b-admin-mall.routes.mjs` |
| `NAME_REQUIRED` | 400 | PUT | `/api/b/mall/products/:id` | `server/skeleton-c-v1/routes/b-admin-mall.routes.mjs` |
| `NEED_BASIC_VERIFY` | 403 | POST | `/api/activities/:id/complete` | `server/skeleton-c-v1/routes/activities.routes.mjs` |
| `NEED_BASIC_VERIFY` | 403 | POST | `/api/mall/activities/:id/join` | `server/skeleton-c-v1/routes/mall.routes.mjs` |
| `NEED_BASIC_VERIFY` | 403 | POST | `/api/mall/redeem` | `server/skeleton-c-v1/routes/mall.routes.mjs` |
| `NEED_BASIC_VERIFY` | 403 | POST | `/api/sign-in` | `server/skeleton-c-v1/routes/activities.routes.mjs` |
| `NO_PERMISSION` | 403 | POST | `/api/activities/:id/complete` | `server/skeleton-c-v1/routes/activities.routes.mjs` |
| `NO_PERMISSION` | 403 | PUT | `/api/b/activity-configs/:id` | `server/skeleton-c-v1/routes/b-admin-activity.routes.mjs` |
| `NO_PERMISSION` | 403 | PUT | `/api/b/mall/activities/:id` | `server/skeleton-c-v1/routes/b-admin-mall.routes.mjs` |
| `NO_PERMISSION` | 403 | PUT | `/api/b/mall/products/:id` | `server/skeleton-c-v1/routes/b-admin-mall.routes.mjs` |
| `NO_PERMISSION` | 403 | GET | `/api/p/permissions/company-admin-pages` | `server/skeleton-c-v1/routes/p-admin-governance.routes.mjs` |
| `OPS_JOB_NOT_FOUND` | 404 | GET | `/api/p/ops/jobs/:id` | `server/skeleton-c-v1/routes/p-admin-ops.routes.mjs` |
| `OPS_JOB_NOT_FOUND` | 404 | GET | `/api/p/ops/jobs/:id/logs` | `server/skeleton-c-v1/routes/p-admin-ops.routes.mjs` |
| `POLICY_NOT_FOUND` | 404 | GET | `/api/insurance/policies/:id` | `server/skeleton-c-v1/routes/insurance.routes.mjs` |
| `PRODUCT_NOT_FOUND` | 404 | PUT | `/api/b/mall/products/:id` | `server/skeleton-c-v1/routes/b-admin-mall.routes.mjs` |
| `REDEMPTION_NOT_FOUND` | 404 | POST | `/api/redemptions/:id/writeoff` | `server/skeleton-c-v1/routes/redemptions.routes.mjs` |
| `SMS_LIMIT_REACHED` | 429 | POST | `/api/auth/send-code` | `server/skeleton-c-v1/routes/auth.routes.mjs` |
| `TENANT_CONTEXT_REQUIRED` | 400 | GET | `/api/b/orders` | `server/skeleton-c-v1/routes/b-admin-orders.routes.mjs` |
| `TENANT_CONTEXT_REQUIRED` | 400 | GET | `/api/p/permissions/company-admin-pages` | `server/skeleton-c-v1/routes/p-admin-governance.routes.mjs` |
| `TENANT_CONTEXT_REQUIRED` | 400 | POST | `/api/track/events` | `server/skeleton-c-v1/routes/track.routes.mjs` |
| `TENANT_CONTEXT_REQUIRED` | 400 | POST | `/api/uploads/base64` | `server/skeleton-c-v1/routes/uploads.routes.mjs` |
| `TITLE_REQUIRED` | 400 | POST | `/api/b/activity-configs` | `server/skeleton-c-v1/routes/b-admin-activity.routes.mjs` |
| `TITLE_REQUIRED` | 400 | PUT | `/api/b/activity-configs/:id` | `server/skeleton-c-v1/routes/b-admin-activity.routes.mjs` |
| `TITLE_REQUIRED` | 400 | POST | `/api/b/mall/activities` | `server/skeleton-c-v1/routes/b-admin-mall.routes.mjs` |
| `TITLE_REQUIRED` | 400 | PUT | `/api/b/mall/activities/:id` | `server/skeleton-c-v1/routes/b-admin-mall.routes.mjs` |
| `TOKEN_EXPIRED` | 410 | POST | `/api/redemptions/:id/writeoff` | `server/skeleton-c-v1/routes/redemptions.routes.mjs` |
| `UNAUTHORIZED` | 401 | POST | `/api/activities/:id/complete` | `server/skeleton-c-v1/routes/activities.routes.mjs` |
| `UNAUTHORIZED` | 401 | POST | `/api/redemptions/:id/writeoff` | `server/skeleton-c-v1/routes/redemptions.routes.mjs` |
| `UNAUTHORIZED` | 401 | POST | `/api/sign-in` | `server/skeleton-c-v1/routes/activities.routes.mjs` |
| `UPLOAD_FAILED` | 500 | POST | `/api/uploads/base64` | `server/skeleton-c-v1/routes/uploads.routes.mjs` |
| `USE_SIGN_IN` | 409 | POST | `/api/activities/:id/complete` | `server/skeleton-c-v1/routes/activities.routes.mjs` |
