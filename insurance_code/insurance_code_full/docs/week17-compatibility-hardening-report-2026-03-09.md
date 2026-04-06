# Week17 兼容层硬化总结报告

更新时间：2026-03-09  
负责人：A 号

## 1. 本轮目标

1. 盘点 `server/skeleton-c-v1` 当前仍承载的路由和写路径
2. 输出 compatibility cleanup 清单：
   - 哪些可以下线
   - 哪些必须保留
   - 哪些只是桥接层
3. 给现有 5 个服务补最终边界快照
4. 增加 Week17 总 gate：
   - compatibility residual scan
   - route ownership drift scan
   - write fallback misuse scan
5. 保证 Week14 learning complete 与 Week16 activity complete 既有链路不回归

## 2. 本轮接入结果

### 2.1 新增 Week17 统一入口

1. `npm run test:smoke:week17-compatibility-hardening`
2. `npm run release-check:week17-compatibility-hardening`
3. `npm run gate:week17-compatibility-hardening`

### 2.2 新增扫描项

1. `check_week17_compatibility_residuals.mjs`
2. `check_week17_route_ownership_drift.mjs`
3. `check_week17_write_fallback_misuse.mjs`

### 2.3 当前兼容层分类

1. compatibility-only route files：`9`
2. must-keep route files：`19`
3. bridge-only files：`43`
4. retire-now files：`0`

## 3. 本轮关键判断

### 3.1 可以下线的范围

本轮没有直接物理删除文件，但已经把 9 个 compatibility-only route files 固定为后续优先清退对象。

### 3.2 必须保留的范围

当前不能删的核心原因有 3 个：

1. skeleton 仍承载未拆功能，如 `bootstrap / insurance / uploads / track / B/P admin 多个模块`
2. `learning.routes.mjs` 仍挂着 `GET /api/learning/games` 与 `GET /api/learning/tools`
3. 4 个拆分服务仍通过 skeleton usecase / repository / deps 装配层复用既有逻辑

### 3.3 写路径 fallback 规则

Week17 冻结结论：

1. 自动 fallback 只允许 `GET / HEAD`
2. 写路径上游失败返回 `502`
3. 写路径回退只允许通过 `GATEWAY_FORCE_V1_PATHS` 手工触发

## 4. 最终边界快照摘要

### 4.1 user-service

1. owned routes：`3`
2. 主写边界：`app_users / c_customers / p_sessions`

### 4.2 points-service

1. owned routes：`15`
2. 主写边界：`c_point_accounts / c_point_transactions / p_products / p_orders / c_redeem_records / c_sign_ins`

### 4.3 learning-service

1. owned routes：`5` 个路径模式
2. 稳定能力：查询 + 管理端 CRUD + `complete`
3. 奖励落账：`learning-service -> points-service` 内部 HTTP
4. 不在稳定范围：`games / tools`

### 4.4 activity-service

1. owned routes：`6` 个路径模式
2. 稳定能力：活动查询 + 管理端 CRUD + `complete`
3. 奖励落账：`activity-service -> points-service` 内部 HTTP
4. 永久留在 points-service：`sign-in / mall activities / orders / redemptions`

## 5. 实际执行命令

1. `node scripts/check_week17_compatibility_residuals.mjs`
2. `node scripts/check_week17_route_ownership_drift.mjs`
3. `node scripts/check_week17_write_fallback_misuse.mjs`
4. `npm run release-check:week17-compatibility-hardening`
5. `npm run gate:week17-compatibility-hardening`
6. `npm run docs:check-links`

## 6. 结果口径

本报告只对下面范围给结论：

1. compatibility 残留是否被清单化并冻结
2. 5 服务 route ownership 是否被固定
3. gateway 写路径 fallback 误用是否被门禁覆盖
4. learning complete / activity complete 是否仍通过既有 release-check / gate

不在本轮结论里的内容：

1. 新服务拆分
2. user-service 新能力
3. points-service 新能力
4. skeleton 物理迁移删除
