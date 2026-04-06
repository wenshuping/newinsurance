# Week11 灰度策略（A 号）

更新时间：2026-03-08  
负责人：A 号  
范围：`gateway-service`、`user-service`、`points-service`

## 1. 目标

Week11 不扩业务功能，只把现有 `V1/V2` 切流能力收成可上线灰度策略。

本文件回答 4 件事：

1. 租户级灰度怎么开
2. 路径级灰度怎么开
3. 规则优先级是什么
4. 灰度如何分阶段推进

## 2. 现有可用开关

当前统一只使用已有网关环境变量：

1. `GATEWAY_ENABLE_V2`
2. `GATEWAY_FORCE_V1`
3. `GATEWAY_ENABLE_V1_FALLBACK`
4. `GATEWAY_V2_TENANTS`
5. `GATEWAY_FORCE_V1_PATHS`
6. `GATEWAY_FORCE_V2_PATHS`

不新增新的 gateway 业务能力，不引入新控制面。

## 3. 灰度规则优先级

当前生效顺序按 `server/microservices/gateway/route-map.mjs` 口径收口：

1. `GATEWAY_FORCE_V1=true`
   - 全局强制走 `V1`
2. `GATEWAY_FORCE_V1_PATHS`
   - 命中的路径强制走 `V1`
3. `GATEWAY_FORCE_V2_PATHS`
   - 命中的路径即使租户不在放量名单里，也可强制走 `V2`
4. `GATEWAY_V2_TENANTS`
   - 未命中强制路径时，按租户名单决定是否走 `V2`
5. 其余请求
   - 若不满足 `V2` 条件，则回到 `V1`

## 4. 租户级灰度策略

### 4.1 目标

租户级灰度只决定“某个租户默认是否走 `V2`”。

### 4.2 配置方式

`GATEWAY_V2_TENANTS` 支持：

1. `all`
2. 租户 ID 列表
3. 租户 code/key 列表

示例：

```bash
GATEWAY_V2_TENANTS=tenant-alpha,tenant-beta
```

### 4.3 建议分阶段

1. Phase 0：`V1` 基线
   - `GATEWAY_ENABLE_V2=true`
   - `GATEWAY_V2_TENANTS=` 空或仅小样本租户
2. Phase 1：单租户验证
   - 只放 1 个低风险租户
3. Phase 2：多租户扩量
   - 放 3~5 个代表性租户
4. Phase 3：大盘放量
   - 放核心租户群
5. Phase 4：全量
   - `GATEWAY_V2_TENANTS=all`

### 4.4 租户选择原则

优先放量：

1. 行为路径清晰、交易量可控的租户
2. 有运维响应窗口的租户
3. 可快速回查问题的内部或友好租户

暂不优先放量：

1. 高峰交易租户
2. 历史异常多的租户
3. 对兑换/核销强依赖的敏感租户

## 5. 路径级灰度策略

### 5.1 `GATEWAY_FORCE_V1_PATHS`

用于在全局 `V2` 开启时，仍把高风险路径压回 `V1`。

建议初始保守路径：

```bash
GATEWAY_FORCE_V1_PATHS=/api/mall/*,/api/orders/*,/api/redemptions/*
```

适用场景：

1. 交易链路需要单独观察
2. 先放 `auth / me / sign-in / points summary`
3. 订单、退款、核销后放

### 5.2 `GATEWAY_FORCE_V2_PATHS`

用于在租户默认不进 `V2` 时，仍让低风险路径先进入 `V2`。

建议优先路径：

```bash
GATEWAY_FORCE_V2_PATHS=/api/me,/api/points/summary,/api/mall/items
```

适用场景：

1. 先验证读路径
2. 先验证身份和积分只读体验
3. 在租户级放量前做小范围路径验证

## 6. 推荐灰度顺序

建议按风险从低到高推进：

1. `auth / me`
2. `sign-in / points summary / mall items`
3. `mall redeem`
4. `orders`
5. `redemptions writeoff`

## 7. 推荐配置模板

### 7.1 只放 user 域和低风险读路径

```bash
GATEWAY_ENABLE_V2=true
GATEWAY_FORCE_V1=false
GATEWAY_ENABLE_V1_FALLBACK=true
GATEWAY_V2_TENANTS=tenant-alpha
GATEWAY_FORCE_V2_PATHS=/api/me,/api/points/summary,/api/mall/items
GATEWAY_FORCE_V1_PATHS=/api/mall/redeem,/api/orders/*,/api/redemptions/*
```

### 7.2 多租户扩量但保留交易回压

```bash
GATEWAY_ENABLE_V2=true
GATEWAY_FORCE_V1=false
GATEWAY_ENABLE_V1_FALLBACK=true
GATEWAY_V2_TENANTS=tenant-alpha,tenant-beta,tenant-gamma
GATEWAY_FORCE_V1_PATHS=/api/orders/*,/api/redemptions/*
GATEWAY_FORCE_V2_PATHS=
```

### 7.3 全量前 final check

```bash
GATEWAY_ENABLE_V2=true
GATEWAY_FORCE_V1=false
GATEWAY_ENABLE_V1_FALLBACK=true
GATEWAY_V2_TENANTS=all
GATEWAY_FORCE_V1_PATHS=
GATEWAY_FORCE_V2_PATHS=
```

## 8. 本轮不做

1. 不新增 DB 控制表
2. 不新增租户灰度后台页面
3. 不改 `user-service` / `points-service` 业务逻辑
4. 不改 Week6/Week7/Week8 已冻结边界

## 9. 关联文档

1. `./week11-runtime-rollback-decision-2026-03-08.md`
2. `./week11-runtime-observability-dashboard-2026-03-08.md`
3. `./week11-runtime-grayscale-runbook-2026-03-08.md`
4. `./week11-user-service-gray-metrics-thresholds-2026-03-07.md`
5. `../server/microservices/points-service/WEEK11-GRAYSCALE-METRICS.md`
