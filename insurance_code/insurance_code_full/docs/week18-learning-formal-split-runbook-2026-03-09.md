# Week18 Learning 域正式拆出 Runbook

更新时间：2026-03-09  
负责人：A 号（整合 / gateway / gate / release-check）

## 1. 目标

Week18 只做 `learning` 域正式拆出的总收口，不扩新业务功能，不改 `user-service / points-service` 主写边界。

本轮目标：

1. 把 `learning` 域 C 端读路径和完成链路全部纳入 `learning-service`
2. 把 `learning` 域 P 端课程 CRUD 继续纳入统一 cutover 编排
3. 把 monolith 的 learning 注册点收缩到最小，仅保留 `v1` fallback / `force-v1` 兼容入口
4. 把正式拆出后的总 gate / 总 smoke / release-check 固化为唯一执行入口

## 2. 当前固定口径

### 2.1 learning-service 稳定 owned routes

1. `GET /api/learning/courses`
2. `GET /api/learning/games`
3. `GET /api/learning/tools`
4. `GET /api/learning/courses/:id`
5. `POST /api/learning/courses/:id/complete`
6. `GET /api/p/learning/courses`
7. `POST /api/p/learning/courses`
8. `PUT /api/p/learning/courses/:id`
9. `DELETE /api/p/learning/courses/:id`

### 2.2 monolith learning 注册点

`/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/skeleton-c-v1/routes/learning.routes.mjs`

当前只保留这 1 个目的：

1. `v1-monolith` 读路径 fallback（`courses / games / tools / detail`）
2. `complete` 的 `force-v1` 手工兼容回退
3. 不再承担 learning 域主写边界声明

### 2.3 learning -> points 契约

1. `learning-service -> points-service` 一律走内部 HTTP
2. 入口：`POST /internal/points-service/learning-rewards/settle`
3. 不走 gateway
4. 不允许 `learning-service` 直写 `c_point_accounts / c_point_transactions`
5. 不允许 direct import `points-service` 业务实现

### 2.4 gateway 切流 / fallback 口径

1. `GATEWAY_ENABLE_LEARNING_SERVICE=true` 才启用 learning-service 正式切流
2. 读路径允许自动 fallback 到 `v1-monolith`
3. 写路径不允许自动 fallback
4. 写路径只允许 `GATEWAY_FORCE_V1_PATHS` 手工切回 `v1-monolith`

## 3. 统一入口

### 3.1 总 smoke

```bash
npm run test:smoke:week18-learning-formal-split
```

### 3.2 release-check

```bash
npm run release-check:week18-learning-formal-split
```

### 3.3 总 gate

```bash
npm run gate:week18-learning-formal-split
```

## 4. Week18 release-check 覆盖项

1. learning 默认关闭时：`courses / games / tools` 都走 `v1-monolith`
2. 打开 learning 后：`courses / games / tools` 都经 gateway 走 `learning-service`
3. `complete` 经 gateway 走 `learning-service`
4. `learning-service -> points-service` 奖励落账成立
5. points summary 能反映奖励增量
6. points observability 能按 `trace_id` 看见奖励落账日志
7. gateway metrics 能看到 `games` 读 fallback 和 `complete` 写路径目标服务
8. `force-v1` 时，`complete` 能人工切回 `v1-monolith`
9. 清空 `force-v1` 后，`complete` 能重新切回 `learning-service`
10. learning 读路径上游异常时，自动 fallback 成立
11. learning 写路径上游异常时，仍返回 `502`，不做自动网络 fallback

说明：
1. Week18 的“写手工回退”验收口径是健康上游条件下的 `force-v1` 路径切换
2. 当 `learning-service` 本身不可用时，`complete` 不要求通过 monolith 继续兜底执行

## 5. 验收通过标准

Week18 转绿要求：

1. `npm run test:smoke:week18-learning-formal-split` 通过
2. `npm run release-check:week18-learning-formal-split` 通过
3. `npm run gate:week18-learning-formal-split` 通过
4. `gate:week16-activity-complete` 在 Week18 gate 内继续通过
5. Week17 三个扫描在 Week18 gate 内继续通过
6. `games / tools / complete` 的切流、读 fallback、写手工回退、奖励结算都能复跑验证

## 6. 边界声明

1. 不扩 gateway 新业务能力
2. 不改 `user-service` 主写边界
3. 不改 `points-service` 主写边界
4. Week18 正式纳入的是 `learning` 域正式拆出，不回写历史周的验收口径
