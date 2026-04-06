# Learning Service Contract

更新时间：2026-03-18  
负责人：A 号 / B 号  
状态：`WEEK18_FORMAL_SPLIT`

## 1. 稳定能力

### 1.1 C 端稳定能力

1. `GET /api/learning/courses`
2. `GET /api/learning/games`
3. `GET /api/learning/tools`
4. `GET /api/learning/courses/:id`
5. `POST /api/learning/courses/:id/complete`

### 1.2 P 端稳定能力

1. `GET /api/p/learning/courses`
2. `POST /api/p/learning/courses`
3. `POST /api/p/learning/courses/batch`
4. `PUT /api/p/learning/courses/:id`
5. `DELETE /api/p/learning/courses/:id`

## 2. 兼容桥接与正式弃用

### 2.1 保留桥接的兼容入口

1. `GET /api/b/content/items`
2. `POST /api/b/content/items`
3. `PUT /api/b/content/items/:id`

说明：
这些路径仍可从 monolith 入口访问，但实际处理已经统一落到 `learning-service`，monolith 只保留显式 bridge 适配层。

### 2.2 明确不接管的 user 能力

1. `POST /api/auth/send-code`
2. `POST /api/auth/verify-basic`
3. `GET /api/me`

## 3. 鉴权口径

### 3.1 C 端

1. 读课程列表/详情：`authOptional`
2. 完成课程：需要 `Authorization: Bearer <token>`
3. 完成课程：继续使用 `x-csrf-token: <csrfToken>`

### 3.2 管理端

1. 继续复用共享 admin session
2. 继续复用 `tenantContext + permissionRequired`
3. `POST /api/p/learning/courses`
4. `POST /api/p/learning/courses/batch`

说明：

1. 管理后台页面仍可继续使用共享 admin session + `x-csrf-token`
2. 运营系统直连时，`POST /api/p/learning/courses` 与 `POST /api/p/learning/courses/batch` 允许使用 `x-ops-api-key`
3. `x-ops-api-key` 模式下不需要 `Authorization` 与 `x-csrf-token`
4. 不新增 learning 自己的登录协议

## 4. 关键返回语义

### 4.1 `GET /api/learning/courses`

1. 返回 `{ categories, courses }`
2. 不改现有课程字段语义

### 4.2 `GET /api/learning/courses/:id`

1. 成功返回 `{ course }`
2. 不存在返回 `404 { code: 'COURSE_NOT_FOUND' }`

### 4.3 `GET /api/learning/games`

1. 成功返回 `{ games }`
2. 当前属于 learning-service 稳定读能力

### 4.4 `GET /api/learning/tools`

1. 成功返回 `{ tools }`
2. 当前属于 learning-service 稳定读能力

### 4.5 `POST /api/learning/courses/:id/complete`

1. 成功返回 `{ ok: true, duplicated, reward, balance }`
2. 首次完成返回 `duplicated=false`
3. 重复完成返回 `duplicated=true`
4. 奖励结算通过 `learning-service -> points-service` 内部 HTTP 契约完成
5. `learning-service` 本身不直写 `c_point_accounts / c_point_transactions`

### 4.6 `GET /api/p/learning/courses`

1. 返回 `{ list, courses }`
2. 保持当前管理面字段语义

### 4.7 `POST /api/p/learning/courses`

1. 成功返回 `{ ok: true, course, idempotent }`
2. 支持 `media` 与 `uploadItems`
3. `uploadItems[].dataUrl` 允许直接内联传文件内容
4. `idempotencyKey` 可选；重复提交同一个 key 时返回第一次创建结果且 `idempotent=true`
5. 无权限返回 `403`
6. 标题为空返回 `400 COURSE_TITLE_REQUIRED`
7. 非法 `dataUrl` 返回 `400 INVALID_DATA_URL`
8. 单文件超过 12MB 返回 `413 FILE_TOO_LARGE`

### 4.8 `POST /api/p/learning/courses/batch`

1. 成功返回 `{ ok: true, total, createdCount, items, courses, idempotent }`
2. `items[]` 内每条返回 `{ index, ok, course, idempotent }`
3. 顶层 `idempotencyKey` 可选；重复提交同一批次 key 时返回第一次整包结果且 `idempotent=true`
4. 单批最多 20 条，超出返回 `400 COURSE_BATCH_ITEMS_LIMIT_EXCEEDED`
5. `items` 为空返回 `400 COURSE_BATCH_ITEMS_REQUIRED`
6. 任一条数据不合法时整批失败并回滚，返回里带 `itemIndex`
7. 批量导入沿用单条导入的上传限制：非法 `dataUrl` 返回 `400 INVALID_DATA_URL`，单文件超过 12MB 返回 `413 FILE_TOO_LARGE`

### 4.9 `PUT /api/p/learning/courses/:id`

1. 成功返回 `{ ok: true, course }`
2. 不存在返回 `404 COURSE_NOT_FOUND`
3. 无权限返回 `403 NO_PERMISSION`

### 4.10 `DELETE /api/p/learning/courses/:id`

1. 成功返回 `{ ok: true }`
2. 不存在返回 `404 COURSE_NOT_FOUND`
3. 平台模板源数据不可删时返回 `403 PLATFORM_TEMPLATE_SOURCE_IMMUTABLE`

### 4.11 兼容桥接 `b-content`

1. `GET /api/b/content/items` 返回 `{ list }`
2. `POST /api/b/content/items` 返回 `{ ok: true, item }`
3. `PUT /api/b/content/items/:id` 返回 `{ ok: true, item }`
4. 这组路径属于 compatibility contract，不属于新的 stable owned route 集合

## 5. 健康检查与 ready

1. `GET /health`
2. `GET /ready`
3. `GET /internal/learning-service/health`
4. `GET /internal/learning-service/ready`

ready 输出要求：

1. `stableContracts` 只包含稳定 owned routes
2. `bridgeCompatibilityContracts` 必须包含 `/api/b/content/items*`
3. `deprecatedContracts` 当前应为空
4. `mainWriteTables` 必须只包含 `p_learning_materials / c_learning_records`
5. `formalSplitReady` 必须为 `true`
6. `splitConclusion.status` 必须为 `formally_split`

## 6. 跨服务奖励契约

1. caller：`learning-service`
2. provider：`points-service`
3. endpoint：`POST /internal/points-service/learning-rewards/settle`
4. sourceType：`course_complete`
5. idempotencyKey：`learning-reward:{tenantId}:{userId}:{courseId}`

## 7. 边界红线

1. 不改 `auth / me`
2. 不改 `token / csrf` 协议
3. 不主写 `app_users / c_customers / p_sessions`
4. 不主写 `c_point_accounts / c_point_transactions`
5. monolith 只允许保留显式 v1 读 fallback 兼容和 complete bridge，不允许恢复 learning 域主写逻辑

## 8. 验证入口

1. `node scripts/check_learning_service_boundary_guard.mjs`
2. `node scripts/review_learning_user_legacy_routes.mjs`
3. `node scripts/check_week18_learning_formal_split.mjs`
4. `node scripts/smoke_week18_learning_formal_split.mjs`
5. `node scripts/gate_week18_learning_formal_split.mjs`

## 9. 运营导入对接产物

1. 手册：`server/microservices/learning-service/OPS-IMPORT-API.md`
2. OpenAPI：`server/microservices/learning-service/OPS-IMPORT-OPENAPI.yaml`
3. Postman Collection：`server/microservices/learning-service/OPS-IMPORT.postman_collection.json`
