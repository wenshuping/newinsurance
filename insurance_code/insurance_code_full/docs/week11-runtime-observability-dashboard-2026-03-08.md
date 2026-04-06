# Week11 上线观测看板总口径（A 号）

更新时间：2026-03-08  
负责人：A 号

## 1. 目标

把 Week11 灰度期的“继续放量 / 暂停 / 回退”判断，统一收敛到一个看板口径。

## 2. 数据来源

### 2.1 gateway

1. `GET /internal/gateway/metrics`
2. `GET /internal/ops/overview`
3. gateway 结构化日志

### 2.2 user-service

1. `GET /internal/user-service/observability`
2. `GET /ready`
3. user-service 结构化日志

### 2.3 points-service

1. `GET /internal/points-service/observability`
2. `GET /metrics`
3. `GET /ready`
4. points-service 结构化日志

## 3. 必须展示的总览指标

### 3.1 gateway 层

1. `requestTotal`
2. `errorTotal`
3. `errorRate`
4. `avgLatencyMs`
5. `maxLatencyMs`
6. `fallbackTotal`
7. `statusBuckets`

### 3.2 user 域

1. `login.attempts`
2. `login.success`
3. `login.failure`
4. `loginSuccessRate`
5. `me.requests`
6. `UNAUTHORIZED.count`
7. `/api/me 401 rate`
8. `missingBearer`
9. `invalidBearer`
10. `userNotFound`

### 3.3 points 域

1. `signIn.successRate`
2. `redeem.successRate`
3. `writeoff.successRate`
4. `orderTransitions`
5. `errorCounts`

### 3.4 灰度治理指标

1. `tenant coverage`
2. `path override coverage`
3. `fallback impact`
4. `forced-v1 request count`
5. `forced-v2 request count`

## 4. 公式口径

### 4.1 `loginSuccessRate`

`login.success / login.attempts`

### 4.2 `/api/me 401 rate`

`UNAUTHORIZED.count / me.requests`

### 4.3 `fallback impact`

`fallbacked managed requests / requests expected on V2`

### 4.4 `gateway errorRate`

`errorTotal / requestTotal`

## 5. 看板布局建议

### 5.1 第一屏：是否继续放量

1. 当前灰度阶段
2. 当前租户名单
3. 当前强制路径规则
4. `gateway errorRate`
5. `fallback impact`
6. 是否满足继续放量条件

### 5.2 第二屏：user 域

1. login 成功率
2. `/api/me 401 rate`
3. token/session 异常分布

### 5.3 第三屏：points 域

1. `sign-in`
2. `redeem`
3. `writeoff`
4. 订单状态流转

### 5.4 第四屏：回退决策

1. 是否命中自动回退条件
2. 是否命中暂停条件
3. 最近 15 分钟 fallback 走势
4. 最近 15 分钟 5xx 走势

## 6. 判定阈值汇总

### 6.1 继续放量

1. `gateway errorRate <= 5%`
2. `fallback impact < 1%`
3. `loginSuccessRate >= 95%`
4. `/api/me 401 rate <= 10%`
5. `signIn.successRate >= 98%`
6. `redeem.successRate >= 97%`
7. `writeoff.successRate >= 97%`

### 6.2 暂停扩量

1. `fallback impact >= 1%`
2. `loginSuccessRate < 95%`
3. `/api/me 401 rate > 10%`
4. `signIn.successRate < 98%`
5. `redeem.successRate < 97%`
6. `writeoff.successRate < 97%`

### 6.3 直接回退

1. `gateway /ready != 200`
2. `gateway errorRate > 5%`
3. `fallback impact >= 5%`
4. `loginSuccessRate < 90%`
5. `/api/me 401 rate > 20%`
6. `signIn.successRate < 95%`
7. `redeem.successRate < 95%`
8. `writeoff.successRate < 95%`

## 7. 关联文档

1. `./week11-runtime-grayscale-strategy-2026-03-08.md`
2. `./week11-runtime-rollback-decision-2026-03-08.md`
3. `./week11-user-service-gray-metrics-thresholds-2026-03-07.md`
4. `../server/microservices/points-service/WEEK11-GRAYSCALE-METRICS.md`
