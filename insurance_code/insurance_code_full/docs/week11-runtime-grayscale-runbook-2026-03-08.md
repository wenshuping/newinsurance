# Week11 灰度 Runbook（A 号）

更新时间：2026-03-08

## 1. 目标

把 Week11 灰度期的配置、验证、暂停、回退动作固定成可复跑步骤。

## 2. 前置条件

1. Week10 已转绿
2. `npm run gate:week8-runtime-split` 通过
3. `gateway /ready`、`user-service /ready`、`points-service /ready` 正常
4. B/C 的 Week11 指标文档已确认

## 3. 配置入口

只使用现有环境变量：

1. `GATEWAY_ENABLE_V2`
2. `GATEWAY_FORCE_V1`
3. `GATEWAY_ENABLE_V1_FALLBACK`
4. `GATEWAY_V2_TENANTS`
5. `GATEWAY_FORCE_V1_PATHS`
6. `GATEWAY_FORCE_V2_PATHS`

## 4. 推荐操作步骤

### Step 1：基线确认

```bash
npm run gate:week8-runtime-split
```

### Step 2：Week11 灰度演练

```bash
npm run release-check:week11-runtime-split
```

### Step 3：Week11 总 gate

```bash
npm run gate:week11-runtime-split
```

## 5. 人工灰度顺序

1. 先按租户放量
2. 再按路径解除 `FORCE_V1`
3. 高风险交易链路最后放

## 6. 紧急回退动作

### 6.1 某些路径回退

```bash
GATEWAY_FORCE_V1_PATHS=/api/mall/*,/api/orders/*,/api/redemptions/*
```

### 6.2 某个租户回退

从 `GATEWAY_V2_TENANTS` 移除目标租户。

### 6.3 全局回退

```bash
GATEWAY_FORCE_V1=true
```

## 7. 灰度观察顺序

1. `GET /ready`
2. `GET /internal/gateway/metrics`
3. `GET /internal/ops/overview`
4. `GET /internal/user-service/observability`
5. `GET /internal/points-service/observability`

## 8. 结果记录

演练结果统一落到：

1. `docs/reports/week11-grayscale-drill-latest.json`
2. `docs/reports/week11-grayscale-drill-latest.md`

## 9. 关联文档

1. `./week11-runtime-grayscale-strategy-2026-03-08.md`
2. `./week11-runtime-rollback-decision-2026-03-08.md`
3. `./week11-runtime-observability-dashboard-2026-03-08.md`
