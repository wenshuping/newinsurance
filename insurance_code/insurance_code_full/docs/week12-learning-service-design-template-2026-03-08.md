# Learning Service 设计包模板（Week12）

更新时间：2026-03-08  
用途：供 `learning-service` 在 Week13+ 真正进入试点前填写  
状态：模板

## 1. 服务目标

1. 学习域为什么要从当前实现里拆出来
2. 本次只拆哪些学习能力
3. 本次不拆哪些能力

## 2. 服务职责

建议负责：

1. 学习资料管理
2. 学习资料列表/详情
3. 学习完成记录
4. 学习类运营统计

明确不负责：

1. 登录协议
2. `/api/me`
3. 客户主档
4. session/token 存储
5. 积分账本最终落账

## 3. owned routes

### 3.1 C 端

1. `GET /api/learning/courses`
2. `GET /api/learning/courses/:id`
3. `POST /api/learning/courses/:id/complete`
4. `GET /api/learning/games`
5. `GET /api/learning/tools`

### 3.2 P/B 管理面

1. `GET /api/p/learning/courses`
2. `POST /api/p/learning/courses`
3. `PUT /api/p/learning/courses/:id`
4. `DELETE /api/p/learning/courses/:id`

### 3.3 明确不归属

1. `POST /api/auth/send-code`
2. `POST /api/auth/verify-basic`
3. `GET /api/me`

## 4. owned data

### 4.1 建议主写

1. `p_learning_materials`
2. `c_learning_records`

### 4.2 只读引用

1. `c_customers`
2. `app_users`
3. `p_tag_rules`

### 4.3 明确禁止直写

1. `app_users`
2. `c_customers`
3. `p_sessions`
4. `c_point_accounts`
5. `c_point_transactions`

## 5. 与 user-service 的交互

必须明确：

1. 使用共享鉴权上下文
2. 不复制 session/token
3. `user_id / tenant_id / actorType / org_id / team_id` 的来源

## 6. 与 points-service 的交互

如果学习完成会触发积分：

1. 不能直接落账
2. 只能走已定义奖励命令/事件
3. 幂等 key 要先设计

## 7. 灰度与回退

必须填写：

1. 首批学习内容样本
2. 首批租户
3. 首批只放读路径还是读写一起放
4. 完成课程动作失败时如何回退

## 8. smoke 模板

至少覆盖：

1. 课程列表
2. 课程详情
3. 完成课程
4. 重复完成幂等
5. 学习记录查询

## 9. gate 模板

至少检查：

1. 不直写 `user-service` 主写表
2. 不自建 token/session
3. owned routes 不与 `user-service` 重叠
4. 学习完成到积分奖励的跨域契约有文档

## 10. release-check 模板

至少验证：

1. 指定租户走 `learning-service`
2. 非灰度租户走旧路径
3. 学习完成失败可快速回退
4. 观测指标和演练报告可落盘

## 11. 评审结论

这里填写：

1. 是否允许进入 Week13 试点
2. 是否还缺共享鉴权/奖励契约前置项
3. 谁负责 gate / smoke / release-check
