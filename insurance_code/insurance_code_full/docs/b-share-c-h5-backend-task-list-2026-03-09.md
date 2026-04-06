# B 端分享 C 端 H5 落地方案 后端任务单（2026-03-09）

## 1. 文档定位

本文档是 `/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/docs/b-share-c-h5-landing-solution-2026-03-09.md` 的后端拆解版。

目标：

1. 把分享能力拆成可执行的后端任务
2. 固化数据模型、API、校验、埋点、回跳规则
3. 让后端按阶段交付，不和前端口径漂移

## 2. 后端范围

本次后端范围只包含：

1. B 端生成分享链接
2. H5 解析分享内容
3. 分享查看与点击埋点
4. 分享链接状态、过期、兜底规则
5. 目标页与 fallback 路径生成规则

本次不做：

1. 个人中心分享
2. 订单、核销、积分明细分享
3. 直接对外开放动作型接口作为分享落点
4. 二维码海报生成
5. 分享卡片图片生成

## 3. 支持的分享类型

第一阶段必须支持：

1. `activity`
2. `learning_course`
3. `mall_home`
4. `mall_item`

第二阶段再支持：

1. `learning_game`
2. `learning_tool`

## 4. 数据模型任务

## 4.1 主表 `b_share_links`

任务：

1. 建表 `b_share_links`
2. 建唯一索引 `share_code`
3. 建组合索引：
   - `tenant_id + sales_id + share_type`
   - `status + expires_at`
4. 固化字段：
   - `share_code`
   - `tenant_id`
   - `sales_id`
   - `share_type`
   - `target_id`
   - `target_c_path`
   - `fallback_c_path`
   - `login_required`
   - `preview_payload`
   - `channel`
   - `status`
   - `expires_at`
   - `view_count`
   - `click_count`
   - `created_at`
   - `updated_at`

验收：

1. `share_code` 全局唯一
2. `share_type` / `status` 有明确枚举约束
3. `target_c_path` 必填
4. `preview_payload` 可用于直接渲染 H5

## 4.2 事件表 `b_share_events`

任务：

1. 建表 `b_share_events`
2. 记录查看与点击事件
3. 记录 `trace_id`
4. 记录顾问、客户、租户维度

事件名第一版固定：

1. `share_link_created`
2. `share_h5_view`
3. `share_h5_click_cta`
4. `share_jump_c`
5. `share_login_redirect`
6. `share_login_return`
7. `share_target_open_success`
8. `share_target_open_fallback`
9. `share_invalid_code`

验收：

1. 能按 `share_code` 查完整事件轨迹
2. 能按 `sales_id` 聚合分享效果
3. 能区分“打开了 H5”和“跳到了 C 端”

## 5. API 任务

## 5.1 生成分享链接

接口：

- `POST /api/b/shares`

任务：

1. 根据 `shareType + targetId` 生成 `share_code`
2. 根据业务类型生成：
   - `target_c_path`
   - `fallback_c_path`
   - `login_required`
   - `preview_payload`
3. 返回标准分享响应
4. 记录 `share_link_created`

请求字段：

1. `shareType`
2. `targetId`
3. `channel`

返回字段：

1. `shareCode`
2. `shareUrl`
3. `shareType`
4. `targetCPath`
5. `fallbackCPath`
6. `loginRequired`
7. `previewPayload`

验收：

1. 不允许前端自拼 `target_c_path`
2. 非法 `shareType` 返回明确错误码
3. 不存在的 `targetId` 返回明确错误码

## 5.2 查询分享详情

接口：

- `GET /api/share/:shareCode`

任务：

1. 校验 `shareCode` 是否存在
2. 校验是否 `active`
3. 校验是否过期
4. 校验目标资源是否仍有效
5. 返回 H5 渲染所需完整结构

返回至少包含：

1. `valid`
2. `shareType`
3. `targetId`
4. `targetCPath`
5. `fallbackCPath`
6. `loginRequired`
7. `previewPayload`

验收：

1. 无效码返回 `valid=false`
2. 过期码返回 `valid=false`
3. 已下线资源要能走 fallback

## 5.3 查看埋点

接口：

- `POST /api/share/:shareCode/view`

任务：

1. 累加 `view_count`
2. 写入 `share_h5_view`
3. 带上 `trace_id`

验收：

1. 重复打开可累计
2. 埋点和计数口径一致

## 5.4 点击埋点

接口：

- `POST /api/share/:shareCode/click`

任务：

1. 累加 `click_count`
2. 写入 `share_h5_click_cta`
3. 支持附加字段：
   - `isLoggedIn`
   - `jumpTarget`
   - `fallbackUsed`

验收：

1. 点击统计和事件明细能对上
2. 可区分 CTA 点击和实际打开成功

## 5.5 分享历史查询

接口：

- `GET /api/b/shares`

任务：

1. 支持按 `shareType` 查询
2. 支持按 `status` 查询
3. 支持查看：
   - `shareCode`
   - `shareUrl`
   - `targetId`
   - `viewCount`
   - `clickCount`
   - `status`
   - `createdAt`

验收：

1. B 端可直接看到分享历史
2. 不需要手工查库看效果

## 6. 路径生成规则任务

后端必须统一生成以下映射：

1. `activity`
   - `target_c_path=/activities?activityId=:id`
   - `fallback_c_path=/activities`
2. `learning_course`
   - `target_c_path=/learning?courseId=:id`
   - `fallback_c_path=/learning`
3. `learning_game`
   - `target_c_path=/learning?tab=games&gameId=:id`
   - `fallback_c_path=/learning?tab=games`
4. `learning_tool`
   - `target_c_path=/learning?tab=tools&toolId=:id`
   - `fallback_c_path=/learning?tab=tools`
5. `mall_home`
   - `target_c_path=/mall`
   - `fallback_c_path=/`
6. `mall_item`
   - `target_c_path=/mall?itemId=:id`
   - `fallback_c_path=/mall`

验收：

1. 规则不在多个前端重复实现
2. B 端、H5、C 端看到的是同一套路径口径

## 7. 状态与错误码任务

建议新增或固化错误码：

1. `INVALID_SHARE_TYPE`
2. `SHARE_TARGET_NOT_FOUND`
3. `SHARE_CODE_NOT_FOUND`
4. `SHARE_CODE_DISABLED`
5. `SHARE_CODE_EXPIRED`
6. `SHARE_TARGET_UNAVAILABLE`
7. `SHARE_CHANNEL_NOT_SUPPORTED`

验收：

1. 所有失败场景都能返回确定错误码
2. H5 能根据错误码渲染失效态

## 8. 登录回跳后端约定

后端需要保证：

1. 分享详情响应里明确给出 `loginRequired`
2. 需要登录的分享项不直接在分享服务端执行动作
3. 后端只负责给出目标路径，不负责客户端自动执行业务动作

说明：

1. 活动完成、学习完成、商品兑换都属于登录后行为
2. 分享页只做预览与导流，不直接触发后端业务写入

## 9. 后端埋点与观测

任务：

1. 给每次分享链路写 `trace_id`
2. 支持按 `share_code` 回查：
   - 创建
   - 查看
   - 点击
   - 登录跳转
   - 目标页打开
3. 为异常场景补日志：
   - 分享码不存在
   - 分享码过期
   - 目标资源失效

建议指标：

1. 分享链接生成成功率
2. 分享页打开成功率
3. CTA 点击率
4. 目标页打开成功率
5. fallback 使用率

## 10. 后端测试任务

## 10.1 单元测试

至少覆盖：

1. `shareType -> target_c_path` 生成规则
2. `shareType -> fallback_c_path` 生成规则
3. 分享码状态校验
4. 过期校验
5. 预览结构生成

## 10.2 接口测试

至少覆盖：

1. `POST /api/b/shares`
2. `GET /api/share/:shareCode`
3. `POST /api/share/:shareCode/view`
4. `POST /api/share/:shareCode/click`
5. `GET /api/b/shares`

## 10.3 异常测试

至少覆盖：

1. 非法 `shareType`
2. 非法 `targetId`
3. 不存在 `shareCode`
4. 已过期 `shareCode`
5. 已下线资源

## 11. 后端分阶段交付

### 第一阶段

1. 表结构
2. `POST /api/b/shares`
3. `GET /api/share/:shareCode`
4. `activity / learning_course / mall_home / mall_item`

### 第二阶段

1. `POST /api/share/:shareCode/view`
2. `POST /api/share/:shareCode/click`
3. `GET /api/b/shares`
4. 统计字段回填

### 第三阶段

1. `learning_game / learning_tool`
2. 更多渠道字段
3. 海报、二维码、更多分享形态

## 12. 后端验收标准

后端完成的最低标准：

1. B 端能生成标准分享链接
2. H5 能拿到标准分享详情
3. 目标路径和兜底路径由后端统一生成
4. 查看和点击有埋点
5. 失效、过期、下线都能稳定返回
6. 第一阶段 4 类分享类型可用

## 13. 建议执行顺序

1. 先建表
2. 再做分享生成接口
3. 再做分享详情接口
4. 再做埋点接口
5. 最后做历史查询和统计优化
