# Week11 灰度演练总报告（A 号）

更新时间：2026-03-08  
负责人：A 号  
范围：`gateway-service`、`user-service`、`points-service`

## 1. 结论

本轮 `Week11` 灰度演练已通过。

当前结论：

1. 租户级灰度开关生效
2. 路径级 `force-v1 / force-v2` 规则生效
3. 读路径上游异常时 `fallback` 生效，且指标可见
4. `gateway -> user-service -> points-service` 灰度治理链路可复跑
5. 当前可进入 `Week11` 灰度上线准备阶段

## 2. 执行命令

本次演练基于 Postgres 模式复跑，使用统一入口：

```bash
DATABASE_URL='postgresql://insurance:insurance@127.0.0.1:5432/insurance_runtime_dev_verify_1772881526' \
PGSSL=disable \
STORAGE_BACKEND=postgres \
STATE_SEED_PATH='/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/data/db.json' \
STATE_RUNTIME_SNAPSHOT_PATH='/Users/wenshuping/Documents/New project/insurance_code/insurance_code_full/server/data/runtime-snapshot.json' \
npm run gate:week11-runtime-split
```

单独演练入口：

```bash
npm run release-check:week11-runtime-split
```

## 3. 验收结果

### 3.1 gate 结果

1. `week8-gate`: `PASS`
2. `week11-grayscale-drill`: `PASS`
3. 总结果：`ok: true`

### 3.2 灰度演练检查项

1. `tenant.allowlist.send-code.v2`: `PASS`
2. `tenant.blocked.send-code.v1`: `PASS`
3. `tenant.blocked.verify-basic.v1`: `PASS`
4. `path.force-v2.me`: `PASS`
5. `path.force-v2.points-summary`: `PASS`
6. `path.force-v1.mall-items`: `PASS`
7. `fallback.read.mall-items`: `PASS`
8. `fallback.metrics.visible`: `PASS`
9. `ops.overview.available`: `PASS`

### 3.3 上线判定项

1. `tenant-level-gray-switch-works`: `PASS`
2. `path-level-force-v2-works`: `PASS`
3. `path-level-force-v1-works`: `PASS`
4. `fallback-visible-for-read-paths`: `PASS`
5. `gateway-dashboard-signals-available`: `PASS`

## 4. 关键指标快照

本次演练快照来自 `docs/reports/week11-grayscale-drill-latest.json`：

1. `requestTotal`: `8`
2. `errorTotal`: `0`
3. `errorRate`: `0`
4. `avgLatencyMs`: `189.13`
5. `maxLatencyMs`: `1180`
6. `fallbackTotal`: `1`
7. `statusBuckets.2xx`: `8`

判读：

1. 本轮未出现 `4xx/5xx` 异常抬升
2. `fallbackTotal=1` 来自演练中故意制造的读路径上游异常
3. `fallback` 被正确记录，因此观测口径有效

## 5. 演练产物

本轮统一报告产物：

1. `./reports/week11-grayscale-drill-latest.json`
2. `./reports/week11-grayscale-drill-latest.md`

本次具体落盘文件：

1. `./reports/week11-grayscale-drill-20260308-115431.json`
2. `./reports/week11-grayscale-drill-20260308-115431.md`

## 6. 风险说明

当前没有新的功能性阻塞，但仍保留以下已知边界：

1. Week11 只做灰度、回退、观测、演练，不扩业务功能
2. 写路径 `fallback` 仍不自动放开，保持保守口径
3. 租户级和路径级灰度目前仍通过环境变量控制，不是控制台动态下发

## 7. 关联文档

1. `./week11-runtime-grayscale-strategy-2026-03-08.md`
2. `./week11-runtime-rollback-decision-2026-03-08.md`
3. `./week11-runtime-observability-dashboard-2026-03-08.md`
4. `./week11-runtime-grayscale-runbook-2026-03-08.md`
5. `./week11-user-service-gray-metrics-thresholds-2026-03-07.md`
6. `../server/microservices/points-service/WEEK11-GRAYSCALE-METRICS.md`
