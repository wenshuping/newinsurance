# Week8 Runtime Split 上线判定标准

更新时间：2026-03-07

## 1. 必须全部满足

1. `npm run gate:week8-runtime-split` 通过
2. `week7-gate` 通过
3. `week8-release-drill` 通过
4. V2 默认链路正常
5. 强制回 V1 正常
6. 再切回 V2 正常
7. 上游异常时读路径 fallback 正常
8. fallback 指标可观测
9. `gateway errorRate <= 5%`

## 2. 判定来源

只认以下来源：

1. `docs/reports/week8-release-drill-latest.json`
2. `docs/reports/week8-release-drill-latest.md`
3. `npm run gate:week8-runtime-split` 控制台结果

## 3. 不允许上线的情况

出现任一项即不允许进入下一阶段：

1. `verify-basic` 或 `me` 在 V2 链路失败
2. 强制回 V1 后，`x-gateway-mode` 仍不是 `v1`
3. 回切 V2 后仍停留在 `v1`
4. 上游异常时读路径没有 fallback
5. `fallbackTotal = 0`
6. `gateway errorRate > 5%`
7. Week6/Week7 冻结边界被改动但未同步门禁和文档
