# Week8 Runtime Split 发布/回退 Runbook

更新时间：2026-03-07

## 1. 目标

Week8 只做发布、回退、演练、上线判定，不扩业务能力，不改 Week6/Week7 已冻结边界。

本周要求可复跑、可审计，不能只保留口头结论。

## 2. 统一执行入口

本地：

```bash
cd /Users/wenshuping/Documents/New\ project/insurance_code/insurance_code_full
npm run gate:week8-runtime-split
```

发布前单独演练：

```bash
npm run release-check:week8-runtime-split
```

CI：

```bash
npm run ci:gate:week8-runtime-split
```

## 3. Week8 gate 内容

1. `gate_week7_runtime_split.mjs`
   - Week6 边界 gate
   - Week7 trace / metrics / fallback observability gate
2. `smoke_week8_release_drill.mjs`
   - V2 正常
   - 强制回 V1
   - 再切回 V2
   - 上游异常时读路径 fallback
   - gateway 指标和 fallback 计数校验
   - 自动落演练记录到 `docs/reports/`

## 4. 演练场景

### 4.1 V2 正常

目标：

1. `/api/auth/send-code` 走 `user-service`
2. `/api/auth/verify-basic` 走 `user-service`
3. `/api/mall/items` 走 `points-service`

判定：

1. `x-gateway-mode = v2`
2. `x-gateway-target-service = user-service / points-service`

### 4.2 强制回 V1

方式：

1. 设置 `GATEWAY_FORCE_V1=true`

目标：

1. `/api/auth/send-code`
2. `/api/mall/items`

都回到 `v1-monolith`

判定：

1. `x-gateway-mode = v1`
2. `x-gateway-target-service = v1-monolith`

### 4.3 再切回 V2

方式：

1. 设置 `GATEWAY_FORCE_V1=false`

目标：

1. `/api/me` 回到 `user-service`
2. `/api/points/summary` 回到 `points-service`

### 4.4 上游异常时读路径 fallback

方式：

1. 临时把 `GATEWAY_POINTS_SERVICE_URL` 指到无效地址
2. 访问 `GET /api/mall/items`

判定：

1. 读路径仍返回 `200`
2. `x-gateway-mode = v1`
3. `x-gateway-target-service = v1-monolith`
4. `fallbackTotal >= 1`
5. `recentRequests[].fallback_count >= 1`

## 5. 关键环境变量

1. `GATEWAY_V1_BASE_URL`
2. `GATEWAY_USER_SERVICE_URL`
3. `GATEWAY_POINTS_SERVICE_URL`
4. `GATEWAY_ENABLE_V2`
5. `GATEWAY_ENABLE_V1_FALLBACK`
6. `GATEWAY_FORCE_V1`
7. `STORAGE_BACKEND`

## 6. 产物位置

演练脚本每次执行后会生成：

1. `docs/reports/week8-release-drill-<timestamp>.json`
2. `docs/reports/week8-release-drill-<timestamp>.md`
3. `docs/reports/week8-release-drill-latest.json`
4. `docs/reports/week8-release-drill-latest.md`

## 7. 发布前必查

1. `npm run gate:week8-runtime-split` 通过
2. `week8-release-drill` 通过
3. `fallbackTotal` 有效可观测
4. 强制回 V1 与回切 V2 都成功
5. 没有变更 Week6/Week7 冻结边界

## 8. 回退策略

当 `v2` 上游异常，按以下顺序处理：

1. 先看 `GET /internal/gateway/metrics`
2. 确认 fallback 是否已生效
3. 如果需要全量回退，设置 `GATEWAY_FORCE_V1=true`
4. 观察链路：
   1. `/api/auth/send-code`
   2. `/api/mall/items`
5. 待上游恢复后，再切回 `GATEWAY_FORCE_V1=false`
6. 再执行一次 `npm run release-check:week8-runtime-split`
