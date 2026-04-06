# 报告产物治理（Reports Governance v1）

更新时间：2026-03-05  
状态：`ACTIVE`

## 1. 目标

1. 统一门禁与发布前检查报告落盘位置与格式。
2. 为上线审计与问题复盘保留可追溯证据。

## 2. 报告目录

固定目录：`docs/reports/`

当前五类报告：

1. CI 门禁报告（核心门禁）
   1. `ci-gate-core-<timestamp>.json`
   2. `ci-gate-core-<timestamp>.md`
2. 发布前置检查报告
   1. `release-preflight-<timestamp>.json`
   2. `release-preflight-<timestamp>.md`
3. 性能基线报告
   1. `perf-baseline-<timestamp>.json`
   2. `perf-baseline-<timestamp>.md`
4. 发布看板汇总报告
   1. `release-dashboard-<timestamp>.json`
   2. `release-dashboard-<timestamp>.md`
   3. `release-dashboard-latest.json`
   4. `release-dashboard-latest.md`
5. SLO 守卫报告
   1. `slo-guard-<timestamp>.json`
   2. `slo-guard-<timestamp>.md`
   3. `slo-guard-latest.json`
   4. `slo-guard-latest.md`

## 3. 生成命令

1. 生成 CI 门禁报告：

```bash
npm run ci:gate:core:report
```

可透传自定义命令：

```bash
npm run ci:gate:core:report -- -- npm run typecheck
```

2. 生成发布前置报告：

```bash
npm run release:preflight
```

3. 单独生成性能基线报告：

```bash
npm run test:perf:baseline
```

4. 单独刷新发布看板（汇总最新 preflight/perf/ci-gate/slo）：

```bash
npm run release:dashboard
```

5. 单独执行 SLO 守卫（3个关键 SLI 阈值）：

```bash
npm run slo:guard
```

补充说明：

1. `npm run release:preflight` 内置执行：
   1. `test:perf:baseline`
   2. `ci:gate:core:report`
   3. `slo:guard`
2. `release:preflight` 在完成 preflight 报告写入后会自动刷新一次发布看板。

## 4. 清理策略

统一命令：

```bash
npm run release:reports:cleanup
```

说明：

1. 对 `release-preflight-*`、`ci-gate-core-*`、`perf-baseline-*`、`release-dashboard-*`、`slo-guard-*` 五类时间戳报告分别保留最近 `N` 份。
2. 默认 `N=30`（环境变量：`RELEASE_REPORT_KEEP`）。
3. `release-dashboard-latest.*` 作为固定入口文件，不参与清理。

## 5. 发布前推荐顺序

```bash
npm run release:preflight
npm run release:reports:cleanup
```

说明：

1. `release:preflight` 已内置执行：
   1. `test:perf:baseline`
   2. `ci:gate:core:report`（内部执行 `ci:gate:core`）
   3. `slo:guard`
2. 只有在需要单独排查时才手动运行 `ci:gate:core:report`、`test:perf:baseline` 或 `slo:guard`。

执行后将 `docs/reports/` 最新报告作为发布审计附件：

1. `release-preflight-*.json/.md`
2. `perf-baseline-*.json/.md`
3. `ci-gate-core-*.json/.md`
4. `slo-guard-*.json/.md`
5. `release-dashboard-latest.json/.md`
