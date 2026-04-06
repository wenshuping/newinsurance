# Week8 发布/回退演练结果记录

更新时间：2026-03-07

## 1. 统一复跑入口

```bash
cd /Users/wenshuping/Documents/New\ project/insurance_code/insurance_code_full
npm run release-check:week8-runtime-split
```

## 2. 结果文件

脚本会自动生成：

1. `docs/reports/week8-release-drill-latest.json`
2. `docs/reports/week8-release-drill-latest.md`

最近一次结果以 `latest` 为准。

## 3. 本次演练覆盖

1. V2 正常
2. 强制回 V1
3. 再切回 V2
4. 上游异常时读路径 fallback
5. fallback 指标可观测

## 4. 判定字段

重点看：

1. `checks[]`
2. `gatewayMetrics`
3. `goLiveCriteria[]`

## 5. 当前记录口径

只认脚本产物，不认口头结论。

发布前或回退后，都必须重新生成一次记录。
