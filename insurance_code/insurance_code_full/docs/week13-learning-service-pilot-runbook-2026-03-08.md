# Week13 Learning Service 最小试点 Runbook

更新时间：2026-03-08  
负责人：A 号（gateway / gate / release-check / 归档）

## 1. 目标

Week13 只做 `learning-service` 最小试点接线与验收，不扩业务功能，不改 `user-service` / `points-service` 业务边界。

本周目标：

1. 把 `learning-service` 接入 runtime split 总编排
2. 给 `learning-service` 建立独立的 gate / smoke / release-check 入口
3. 验证租户级切流、路径级回退、读路径 fallback
4. 保证 `user-service` / `points-service` 既有 gate 不被打坏

## 2. Week13 试点边界

本轮只允许以下路由进入 `learning-service` 试点：

1. `GET /api/learning/courses`
2. `GET /api/learning/courses/:id`
3. `GET /api/p/learning/courses`
4. `POST /api/p/learning/courses`
5. `PUT /api/p/learning/courses/:id`
6. `DELETE /api/p/learning/courses/:id`

本轮明确不进入 `learning-service` 的路径：

1. `POST /api/learning/courses/:id/complete`
2. `GET /api/learning/games`
3. `GET /api/learning/tools`

结论口径：

1. `complete` 继续留在 `v1-monolith`
2. 学习奖励积分链路本周不拆，不改成 `learning-service` 主写
3. `Phase 1` 验收通过范围只包含“内容查询 + 管理端 CRUD”
4. `complete` 只作为边界观察项存在，不计入 `Phase 1` 验收通过范围
5. 这轮不是“完整学习闭环”试点

## 3. 统一入口

### 3.1 直连 learning-service smoke

```bash
npm run test:smoke:learning-service
```

覆盖：

1. `learning-service /health`
2. `learning-service /ready`
3. 不暴露 `/api/auth/*`
4. 不暴露 `/api/me`
5. C 端课程列表 / 详情
6. P 端课程 CRUD
7. `complete` 不在 learning-service 暴露

### 3.2 Week13 release-check

```bash
npm run release-check:week13-learning-pilot
```

覆盖：

1. 默认 learning pilot 关闭，流量走 `v1-monolith`
2. 打开 learning pilot 后，learning 查询与管理流量走 `learning-service`
3. 非 allowlist 租户继续走 `v1-monolith`
4. 强制 `force-v1` 时回退到 `v1-monolith`
5. 清空 `force-v1` 后恢复到 `learning-service`
6. 读路径上游异常时 fallback 到 `v1-monolith`
7. `complete` 仍走 `v1-monolith`，该检查只用于确认边界未越界，不作为 learning-service 通过项

### 3.3 Week13 总 gate

```bash
npm run gate:week13-learning-pilot
```

执行顺序：

1. `gate:week11-runtime-split`
2. `check_learning_service_boundary_guard.mjs`
3. `check_week13_learning_service_pilot.mjs`
4. `smoke_learning_service_phase1.mjs`
5. `smoke_week13_learning_pilot.mjs`

## 4. 关键环境变量

gateway 侧新增：

1. `GATEWAY_LEARNING_SERVICE_URL`
2. `GATEWAY_ENABLE_LEARNING_SERVICE`

仍沿用的切流变量：

1. `GATEWAY_V2_TENANTS`
2. `GATEWAY_FORCE_V1_PATHS`
3. `GATEWAY_FORCE_V2_PATHS`
4. `GATEWAY_ENABLE_V1_FALLBACK`

当前 Week13 口径：

1. `learning-service` 默认 `disabled`
2. 只有显式打开后，allowlist 租户才进 `learning-service`
3. 读路径可 fallback，写路径不自动 fallback

## 5. 发布/回退动作

### 5.1 打开试点

条件：

1. `npm run gate:week13-learning-pilot` 通过
2. B 号 user 边界确认已收口
3. C 号 points 奖励链路风险已确认并接受“本周不解”的范围约束

动作：

1. 设置 `GATEWAY_ENABLE_LEARNING_SERVICE=true`
2. 设置 `GATEWAY_V2_TENANTS=<试点租户>`
3. 不把 `complete`、`games`、`tools` 加入 learning-service owned routes

补充说明：

1. 当前 gateway route-map 未将 `POST /api/learning/courses/:id/complete` 归为 `learning-service` owned route
2. 本周只接受它继续由 `v1-monolith` 承接
3. 即使后续某个试点分支临时接入，也不自动构成 `Phase 1` 验收通过项

### 5.2 强制回退到 V1

动作：

1. 设置 `GATEWAY_FORCE_V1_PATHS=/api/learning/*,/api/p/learning/*`
2. 验证 `GET /api/learning/courses` 返回头：
   - `x-gateway-mode: v1`
   - `x-gateway-target-service: v1-monolith`

### 5.3 恢复到 V2

动作：

1. 清空 `GATEWAY_FORCE_V1_PATHS`
2. 保持 `GATEWAY_ENABLE_LEARNING_SERVICE=true`
3. 验证 `GET /api/learning/courses` 返回头：
   - `x-gateway-mode: v2`
   - `x-gateway-target-service: learning-service`

## 6. fallback 口径

Week13 只接受读路径 fallback：

1. `GET /api/learning/courses`
2. `GET /api/learning/courses/:id`

不接受自动 fallback 的写路径：

1. `POST /api/p/learning/courses`
2. `PUT /api/p/learning/courses/:id`
3. `DELETE /api/p/learning/courses/:id`

原因：

1. 避免双写
2. 避免管理端误把 V2 写请求落回 V1，造成数据语义漂移

## 7. 与 B/C 的边界结论

### 7.1 B 号结论

见：

1. `./week13-learning-service-user-boundary-confirmation-2026-03-08.md`

已确认：

1. `learning-service` 不暴露 `auth / me`
2. 不主写 `app_users / c_customers / p_sessions`
3. 继续沿用现有 `Bearer + x-csrf-token` 口径

### 7.2 C 号结论

见：

1. `../server/microservices/points-service/WEEK13-LEARNING-POINTS-REVIEW.md`

已确认：

1. 学习完成奖励链路当前仍不是 `points-service` 契约化落账
2. `appendPoints()` 旧路径仍是遗留风险
3. 因此 Week13 不把 `complete` 纳入 learning-service 试点

## 8. Week13 通过标准

本周转绿标准：

1. `gate:week13-learning-pilot` 全部通过
2. `Phase 1` 通过范围明确限定为：`查询 + 管理端 CRUD`
3. `learning-service` 只接 Week13 白名单路由
4. `complete` 继续走 `v1-monolith`，且只作为边界观察项
5. `user-service` / `points-service` 既有 gate 不回归
6. `release-check` 产物落盘

## 9. 产物

1. 演练最新结果：`./reports/week13-learning-pilot-latest.md`
2. 演练最新 JSON：`./reports/week13-learning-pilot-latest.json`
3. Week13 总报告：`./week13-learning-service-pilot-report-2026-03-08.md`
