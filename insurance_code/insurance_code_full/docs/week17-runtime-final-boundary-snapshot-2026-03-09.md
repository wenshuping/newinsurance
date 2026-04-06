# Week17 最终边界快照

更新时间：2026-03-09  
负责人：A 号

## 1. 目的

这份文档只回答 Week17 当前生效的最终边界快照：

1. 5 个服务各自 owned routes 是什么
2. 5 个服务主写表边界是什么
3. skeleton-c-v1 还剩什么角色
4. gateway 的 fallback 和切流红线是什么

## 2. gateway-service

### 2.1 服务注册

1. `v1-monolith` -> `4000`
2. `user-service` -> `4101`
3. `points-service` -> `4102`
4. `learning-service` -> `4103`
5. `activity-service` -> `4104`

### 2.2 默认开关

1. `user-service`：默认开
2. `points-service`：默认开
3. `learning-service`：默认关
4. `activity-service`：默认关

### 2.3 路由所有权

1. `user-service`：`3` 条
2. `points-service`：`15` 条
3. `learning-service`：`5` 条
4. `activity-service`：`6` 条

### 2.4 fallback 红线

1. 自动 fallback 仅允许 `GET / HEAD`
2. 写路径上游失败返回 `502`
3. 写路径回退只允许通过 `GATEWAY_FORCE_V1_PATHS` 手工触发

## 3. user-service 最终边界

### 3.1 owned routes

1. `POST /api/auth/send-code`
2. `POST /api/auth/verify-basic`
3. `GET /api/me`

### 3.2 主写边界

1. `app_users`（逻辑身份聚合）
2. `c_customers`（客户主资料）
3. `p_sessions`（session）

### 3.3 兼容层说明

1. `user-service` 仍通过 skeleton 的 `auth-write / user-write / customer-assignment-write` usecase 和 repository 完成运行时复用
2. 这些文件属于 bridge-only，不等于 user 边界未拆清

## 4. points-service 最终边界

### 4.1 owned routes

1. `POST /api/sign-in`
2. `GET /api/points/summary`
3. `GET /api/points/transactions`
4. `GET /api/points/detail`
5. `GET /api/mall/items`
6. `GET /api/mall/activities`
7. `POST /api/mall/redeem`
8. `POST /api/mall/activities/:id/join`
9. `GET /api/redemptions`
10. `POST /api/redemptions/:id/writeoff`
11. `GET /api/orders`
12. `GET /api/orders/:id`
13. `POST /api/orders/:id/pay`
14. `POST /api/orders/:id/cancel`
15. `POST /api/orders/:id/refund`

### 4.2 主写边界

1. `c_point_accounts`
2. `c_point_transactions`
3. `p_products`
4. `p_orders`
5. `c_redeem_records`
6. `c_sign_ins`

### 4.3 跨服务契约提供方

1. `POST /internal/points-service/learning-rewards/settle`
2. `POST /internal/points-service/activity-rewards/settle`

## 5. learning-service 最终边界

### 5.1 owned routes

1. `GET /api/learning/courses`
2. `GET /api/learning/courses/:id`
3. `POST /api/learning/courses/:id/complete`
4. `GET /api/p/learning/courses`
5. `POST /api/p/learning/courses`
6. `PUT /api/p/learning/courses/:id`
7. `DELETE /api/p/learning/courses/:id`

说明：gateway route ownership 当前按路径模式记录为 `5` 条；管理端 `GET/POST/PUT/DELETE` 共用两条路径模式。

### 5.2 主写边界

1. `p_learning_materials`
2. `c_learning_records`

### 5.3 奖励结算口径

1. `learning-service` 不直写 points 主写表
2. 学习奖励必须经 `points-service` 内部 HTTP 契约落账

### 5.4 仍不在稳定边界内

1. `GET /api/learning/games`
2. `GET /api/learning/tools`

## 6. activity-service 最终边界

### 6.1 owned routes

1. `GET /api/activities`
2. `POST /api/activities/:id/complete`
3. `GET /api/p/activities`
4. `POST /api/p/activities`
5. `PUT /api/p/activities/:id`
6. `DELETE /api/p/activities/:id`
7. `GET /api/b/activity-configs`
8. `POST /api/b/activity-configs`
9. `PUT /api/b/activity-configs/:id`

说明：gateway route ownership 当前按路径模式记录为 `6` 条；管理端 CRUD 共用路径模式。

### 6.2 主写边界

1. `p_activities`（仅 `source_domain='activity'` 的稳定域数据）
2. `c_activity_completions`

### 6.3 奖励结算口径

1. `activity-service` 不直写 points 主写表
2. 活动奖励必须经 `points-service` 内部 HTTP 契约落账

### 6.4 永久不迁出的邻接路由

1. `POST /api/sign-in`
2. `GET /api/mall/activities`
3. `POST /api/mall/activities/:id/join`
4. `POST /api/mall/redeem`
5. `GET /api/orders`
6. `GET /api/orders/:id`
7. `POST /api/orders/:id/pay`
8. `POST /api/orders/:id/cancel`
9. `POST /api/orders/:id/refund`
10. `POST /api/redemptions/:id/writeoff`

## 7. skeleton-c-v1 最终角色

Week17 之后，`server/skeleton-c-v1` 的角色被固定成 3 类：

1. 必须保留的未拆功能承载层
2. compatibility-only route adapter
3. bridge-only shared usecase / repository / reward adapter

它不再被允许新增“新的跨域 owner”，也不允许新增新的写路径 fallback 语义。

## 8. 当前冻结结论

1. 5 个服务的 route ownership 已固定
2. 5 个服务的主写边界已固定
3. gateway 的 fallback 规则已固定为“读自动、写手工”
4. skeleton-c-v1 的剩余职责已被显式列单，后续任何新增残留都必须先过 Week17 gate
