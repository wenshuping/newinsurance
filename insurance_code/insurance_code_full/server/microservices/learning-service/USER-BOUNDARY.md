# Learning 与 User 交叉边界说明

更新时间：2026-03-18  
负责人：B 号（user-service）  
状态：`WEEK18_FINAL_CLOSEOUT`

## 1. 结论先行

Week18 收口后，learning 与 user 的最终判断是：

1. `learning-service` 没有接管 `auth / me`
2. `learning-service` 没有主写 `app_users / c_customers / p_sessions`
3. `Bearer + x-csrf-token` 口径保持不变
4. learning 域现在可以按“正式拆出”处理
5. monolith 剩余的 learning 入口只剩最小兼容层：本地读 fallback、`complete` bridge、`b-content` bridge

## 2. 继续留在 user-service 的能力

1. `POST /api/auth/send-code`
2. `POST /api/auth/verify-basic`
3. `GET /api/me`
4. 登录态签发与 session 生命周期
5. 客户主档与身份聚合

## 3. learning-service 使用 user 域能力的方式

允许：

1. 通过 `Authorization: Bearer <token>` 获取登录身份
2. 通过 `x-csrf-token` 完成写请求保护
3. 通过共享鉴权上下文消费 `user_id / tenant_id / actor_type / org_id / team_id`
4. 通过 `customer_id` 外键引用学习完成者

不允许：

1. 直接写 `c_customers`
2. 直接写 `p_sessions`
3. 新建 `learning_sessions` 之类的镜像表
4. 为 learning 单独设计一套 `/api/learning/auth/*`
5. 复制 `/api/me` 语义到 learning-service

## 4. complete 稳定能力下的 user 边界

`POST /api/learning/courses/:id/complete` 现在是正式稳定能力，但它仍然只能：

1. 读取当前 user 身份
2. 写 learning 域自己的完成记录
3. 通过 points-service 契约触发奖励结算

它仍然不能：

1. 修改 user 主档
2. 修改 session
3. 调整 `/api/me` 返回结构
4. 自己发 token 或 csrf

## 5. Week18 兼容层最终归类

### 5.1 迁到 learning-service 的稳定能力

1. `GET /api/learning/courses`
2. `GET /api/learning/games`
3. `GET /api/learning/tools`
4. `GET /api/learning/courses/:id`
5. `POST /api/learning/courses/:id/complete`
6. `GET /api/p/learning/courses`
7. `POST /api/p/learning/courses`
8. `POST /api/p/learning/courses/batch`
9. `PUT /api/p/learning/courses/:id`
10. `DELETE /api/p/learning/courses/:id`

### 5.2 保留桥接的兼容路径

1. `GET /api/b/content/items`
2. `POST /api/b/content/items`
3. `PUT /api/b/content/items/:id`

说明：
这些路径仍可从 monolith URL 访问，但已经不再在 monolith 本地执行业务写入，统一桥接到 `learning-service`。

### 5.3 保留的最小 monolith 兼容层

1. `GET /api/learning/courses`
2. `GET /api/learning/games`
3. `GET /api/learning/tools`
4. `GET /api/learning/courses/:id`
5. `POST /api/learning/courses/:id/complete`

说明：
这些路径在 monolith 里不再代表 learning 主归属，其中：

1. `courses / games / tools / detail` 只保留 v1 读 fallback
2. `complete` 只保留 bridge 到 `learning-service`

## 6. Week18 最终判断

从 user 边界看，现在答案是 `可以`：

1. learning 域已经正式拆出
2. user 主边界没有被打穿
3. monolith 不再保留会影响 user 判断的 learning 主写逻辑
4. `formalSplitReady = true` 与 user 边界判断一致

## 7. B 号验收口径

B 号只认下面 5 条：

1. `auth / me` 路径仍归 `user-service`
2. `Bearer + x-csrf-token` 口径不变
3. `app_users / c_customers / p_sessions` 没有 learning 写路径
4. learning 兼容层只剩最小读 fallback 和 bridge，不再有额外 user 越权写逻辑
5. `formalSplitReady = true` 时，不能再把 monolith learning 最小兼容层算作 user 边界阻塞项
