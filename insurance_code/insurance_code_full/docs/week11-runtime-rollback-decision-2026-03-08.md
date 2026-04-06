# Week11 回退判定（A 号）

更新时间：2026-03-08  
负责人：A 号  
范围：`gateway-service` 灰度治理与统一回退口径

## 1. 目标

Week11 不新增自动化控制面，只先把“什么时候暂停扩量、什么时候回退到 V1”收成统一规则。

## 2. 回退分类

### 2.1 自动回退候选条件

满足任一项，建议立即执行自动或值班人工确认后的快速回退：

1. `gateway /ready != 200`
2. `gateway errorRate > 5%` 且持续 5 分钟
3. `fallback impact >= 5%` 且持续 5 分钟
4. `loginSuccessRate < 0.90`
5. `/api/me 401 rate > 0.20`
6. `userNotFound > 0`
7. `signIn.successRate < 0.95`
8. `redeem.successRate < 0.95`
9. `writeoff.successRate < 0.95`
10. 核心路径出现持续 `5xx`

### 2.2 暂停扩量条件

满足任一项，暂停继续放量，保留当前比例观察：

1. `0.90 <= loginSuccessRate < 0.95`
2. `0.10 < /api/me 401 rate <= 0.20`
3. `1% <= fallback impact < 5%`
4. `signIn.successRate < 0.98`
5. `redeem.successRate < 0.97`
6. `writeoff.successRate < 0.97`
7. `invalidBearer / me.requests > 0.05`
8. 订单状态流转出现明显断层但未造成批量失败

### 2.3 人工回退条件

即使没到自动阈值，只要出现下列业务异常，也允许人工回退：

1. 租户侧明显感知到登录失败、积分异常、兑换异常
2. 客服/运营确认出现批量投诉
3. fallback 虽未超阈值，但集中发生在高价值租户
4. 出现数据一致性怀疑，需要先切回 `V1` 保守止血

## 3. 执行动作

### 3.1 最小回退

优先级最低，影响最小：

1. 仅把高风险路径压回 `V1`
2. 示例：

```bash
GATEWAY_FORCE_V1_PATHS=/api/mall/*,/api/orders/*,/api/redemptions/*
```

### 3.2 租户回退

适用于某个租户异常但大盘正常：

1. 从 `GATEWAY_V2_TENANTS` 中移除异常租户
2. 保持其它租户继续验证

### 3.3 全局回退

出现系统性问题时：

```bash
GATEWAY_FORCE_V1=true
```

恢复条件满足前，不再继续放量。

## 4. 判定顺序

1. 先看 `gateway /ready`
2. 再看 `gateway errorRate`
3. 再看 `fallback impact`
4. 再看 user 域登录与 `/api/me`
5. 再看 points 域 `sign-in / redeem / writeoff`
6. 最后结合业务投诉和租户反馈决定是“暂停”还是“回退”

## 5. fallback impact 统一口径

`fallback impact = 灰度窗口内本应走 V2、但被 gateway 回退到 V1 的受管请求数 / 本应由 V2 承接的受管请求总数`

至少统计：

1. `/api/auth/send-code`
2. `/api/auth/verify-basic`
3. `/api/me`
4. `/api/sign-in`
5. `/api/points/*`
6. `/api/mall/*`
7. `/api/orders/*`
8. `/api/redemptions/*`

## 6. 结论口径

1. `fallback impact` 高，不算灰度成功
2. `V2` 成功率高但 fallback 也高，不继续放量
3. 只有在 fallback 低、关键成功率稳定时，才能继续灰度

## 7. 关联文档

1. `./week11-runtime-grayscale-strategy-2026-03-08.md`
2. `./week11-runtime-observability-dashboard-2026-03-08.md`
3. `./week11-user-service-gray-metrics-thresholds-2026-03-07.md`
4. `../server/microservices/points-service/WEEK11-GRAYSCALE-METRICS.md`
