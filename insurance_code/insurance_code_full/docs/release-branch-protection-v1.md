# 发布前置检查与分支保护（v1）

更新时间：2026-03-04
状态：`ACTIVE`

## 1. 目标

1. 防止“未过核心质量门禁”代码进入 `main/master`。
2. 发布前固定执行同一套检查，避免人工漏项。

## 2. 本地发布前执行

在仓库根目录执行：

```bash
npm run release:preflight
```

执行内容：

1. 执行 `npm run db:mall:backfill-source-product-id`
2. 若设置 `DATABASE_URL`，执行 `npm run db:fk:precheck`
3. 执行 `npm run risk:check-tenant-fallback`
4. 执行 `npm run docs:check-links:all`
5. 执行 `npm run test:smoke:api-core`
6. 执行 `npm run test:perf:baseline`
7. 执行 `npm run lint:persistence:incremental-writepaths`
8. 执行 `npm run ci:gate:core:report`（内部执行 `ci:gate:core` 并落盘报告）
9. 执行 `npm run slo:guard`

执行产物：

1. 每次执行会在 `docs/reports/` 生成一份时间戳报告：`release-preflight-YYYYMMDD-HHMMSS.json`
2. 同时生成对应 Markdown 报告：`release-preflight-YYYYMMDD-HHMMSS.md`
3. 默认自动保留最近 `30` 份（可通过环境变量 `RELEASE_REPORT_KEEP` 调整）
4. 可手动清理：`npm run release:reports:cleanup`
5. 若本次 preflight 期间发生了 Postgres 持久化，会在报告里附带 `persistSyncStats`（增量同步表的 insert/update/delete 计数）
6. preflight 完成后自动刷新发布看板：
   1. `docs/reports/release-dashboard-latest.json`
   2. `docs/reports/release-dashboard-latest.md`
7. preflight 期间会落 SLO 守卫报告：
   1. `docs/reports/slo-guard-YYYYMMDD-HHMMSS.json`
   2. `docs/reports/slo-guard-latest.json`

## 3. CI 保护门禁

工作流：

1. `.github/workflows/quality-gates.yml`

核心门禁：

1. `typecheck`
2. `docs:check-links`
3. `risk:check-tenant-fallback`
4. `release:preflight`（含 `db:mall:backfill-source-product-id + smoke/perf + ci:gate:core:report + slo:guard`）
5. `ci:gate:core` 内含 `lint:branch-protection:required-checks`，会校验：
   1. `.github/workflows/quality-gates.yml` 的 job 名
   2. 本文档中的 required checks 列表

CI 产物：

1. `insurance-code-gates` 会上传以下 artifact（失败也上传，便于复盘）
   1. `docs/reports/release-preflight-*.json`
   2. `docs/reports/release-preflight-*.md`
   3. `docs/reports/perf-baseline-*.json`
   4. `docs/reports/perf-baseline-*.md`
   5. `docs/reports/release-dashboard-*.json`
   6. `docs/reports/release-dashboard-*.md`
   7. `docs/reports/release-dashboard-latest.json`
   8. `docs/reports/release-dashboard-latest.md`
   9. `docs/reports/slo-guard-*.json`
   10. `docs/reports/slo-guard-*.md`
   11. `docs/reports/slo-guard-latest.json`
   12. `docs/reports/slo-guard-latest.md`

## 4. GitHub Branch Protection（建议配置）

对 `main` 与 `master` 开启：

1. Require a pull request before merging
2. Require approvals: `>= 1`
3. Dismiss stale pull request approvals when new commits are pushed
4. Require status checks to pass before merging

建议设为 required checks：

1. `insurance-code-gates`
2. `insurance-b-typecheck`
3. `insurance-p-typecheck`

可选增强：

1. Require conversation resolution before merging
2. Require branches to be up to date before merging
3. Restrict who can push to matching branches

## 5. GitHub UI 核对步骤（已配置后复核）

仓库：`fenglipop29/insurance_code`

路径：

1. 打开仓库页面
2. 进入 `Settings`
3. 左侧选择 `Branches`
4. 在 `Branch protection rules` 找到 `main`
5. 点击规则右侧 `Edit`

逐项核对：

1. `Require a pull request before merging`：开启
2. `Required approvals`：`1`
3. `Dismiss stale pull request approvals when new commits are pushed`：开启
4. `Require status checks to pass before merging`：开启
5. Required checks 包含：
   1. `insurance-code-gates`
   2. `insurance-b-typecheck`
   3. `insurance-p-typecheck`
6. `Require conversation resolution before merging`：开启
7. `Do not allow bypassing the above settings`（管理员同样受限）：开启
8. `Allow force pushes`：关闭
9. `Allow deletions`：关闭

CLI 复核命令：

```bash
gh api repos/fenglipop29/insurance_code/branches/main/protection
```

## 6. 失败处理约定

1. `db:fk:precheck` 失败：先执行 `npm run db:fk:repair-orphans`（仅测试环境）并复检。
2. `docs` 类失败：先更新文档，再提交代码，不允许跳过。
3. `smoke` 失败：必须定位到接口或数据问题，修复后重跑通过。

## 7. 责任边界

1. 开发提交前：执行 `release:preflight`。
2. 合并前：以 CI `quality-gates` 结果为准。
3. 上线前：再执行一次 `release:preflight` 并留存结果。

## 8. 变更约束（Required Checks）

当你修改 `.github/workflows/quality-gates.yml` 的 job 名时，必须在同一个 PR 同步更新：

1. `docs/release-branch-protection-v1.md` 的 required checks 列表
2. GitHub 仓库 `Branch protection` 的 required checks

本地可先执行：

```bash
npm run lint:branch-protection:required-checks
```

并在 PR 描述按模板勾选：

1. `.github/pull_request_template.md`
