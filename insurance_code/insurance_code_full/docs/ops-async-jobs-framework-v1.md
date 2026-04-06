# P端异步任务框架（对账/重算）v1

更新时间：2026-03-06  
状态：`ACTIVE`

## 1. 目标

1. 给 P 端运营任务提供最小可用异步执行能力。
2. 至少覆盖 1 条可执行、可重试、可审计链路（本版覆盖 `reconciliation_run` 与 `stats_rebuild`）。
3. 保持现有同步接口兼容，新增异步入口而不破坏旧调用方。

## 2. 任务模型

任务表（运行态）：

1. `pOpsJobs`
   1. `id/tenantId/jobType/payload`
   2. `status`：`queued/running/retrying/success/failed`
   3. `attempts/maxAttempts`
   4. `nextRunAt`
   5. `error/result`
   6. `createdBy/createdAt/updatedAt/startedAt/completedAt`
2. `pOpsJobLogs`
   1. `id/jobId/tenantId/level/message/detail/createdAt`

数据库持久化表：

1. `p_ops_jobs`
2. `p_ops_job_logs`

## 3. 执行与重试策略

1. worker 每 `OPS_ASYNC_JOB_WORKER_INTERVAL_MS`（默认 5000ms）轮询一次。
2. 仅执行 `status in (queued,retrying)` 且 `nextRunAt <= now` 的任务。
3. 失败后指数退避重试：`1s -> 2s -> 4s ...`，封顶 `60s`。
4. `attempts >= maxAttempts` 后进入 `failed`，不再自动重试。
5. 支持手动重试接口，将 `failed/retrying` 任务回置为 `queued`。

## 4. 审计

任务生命周期会写审计日志（`p_audit_logs`）：

1. `p_ops_job_created:<jobType>`
2. `p_ops_job_retry:<jobType>`
3. `p_ops_job_success:<jobType>`
4. `p_ops_job_failed:<jobType>`
5. `p_ops_job_manual_retry:<jobType>`

## 5. API

权限：均要求 `stats:read`。

1. `POST /api/p/ops/jobs`
   1. 入参：`jobType`, `payload`, `maxAttempts`
   2. 返回：`202 { ok, job }`
2. `POST /api/p/ops/jobs/run-pending`
   1. 入参：`limit`
   2. 返回：`200 { ok, summary }`
3. `GET /api/p/ops/jobs`
   1. 查询：`jobType/status/limit`
4. `GET /api/p/ops/jobs/:id`
5. `GET /api/p/ops/jobs/:id/logs`
6. `POST /api/p/ops/jobs/:id/retry`

兼容扩展（不改旧路径）：

1. `POST /api/p/stats/rebuild` 传 `{"async": true}` 可走异步任务。
2. `POST /api/p/reconciliation/run` 传 `{"async": true}` 可走异步任务。

## 6. 回归

1. `npm run test:smoke:p-ops-async-jobs`
   1. 创建对账异步任务
   2. 模拟首次失败后自动进入 `retrying`
   3. 二次执行成功
   4. 校验任务日志完整（运行/重试/成功）
2. `npm run test:smoke:api-core`
   1. 已接入 `p_ops_async_jobs` 必跑步骤

