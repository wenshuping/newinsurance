import { appendAuditLog, getState, nextId, persistState } from '../common/state.mjs';
import { rebuildDailySnapshot, runReconciliation } from './analytics.service.mjs';

const SUPPORTED_JOB_TYPES = new Set(['stats_rebuild', 'reconciliation_run']);
const RETRYABLE_STATUSES = new Set(['retrying', 'failed']);
const RUNNABLE_STATUSES = new Set(['queued', 'retrying']);

function nowIso() {
  return new Date().toISOString();
}

function toInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

function ensureArrays(state) {
  if (!Array.isArray(state.pOpsJobs)) state.pOpsJobs = [];
  if (!Array.isArray(state.pOpsJobLogs)) state.pOpsJobLogs = [];
}

function appendJobLog(state, { jobId, tenantId, level = 'info', message, detail = null }) {
  ensureArrays(state);
  state.pOpsJobLogs.push({
    id: nextId(state.pOpsJobLogs),
    jobId: Number(jobId),
    tenantId: Number(tenantId || 1),
    level: String(level || 'info'),
    message: String(message || ''),
    detail,
    createdAt: nowIso(),
  });
}

function backoffMs(attempt) {
  const n = Math.max(1, toInt(attempt, 1));
  return Math.min(60_000, 1_000 * 2 ** (n - 1));
}

function normalizePayload(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  return input;
}

function executeJobHandler(job) {
  const payload = normalizePayload(job.payload);
  const day = String(payload.day || '').trim();
  if (job.jobType === 'stats_rebuild') {
    const snapshot = rebuildDailySnapshot(day || nowIso().slice(0, 10));
    return {
      snapshotId: Number(snapshot?.id || 0),
      day: String(snapshot?.day || day || ''),
      metrics: snapshot?.metrics || {},
    };
  }
  if (job.jobType === 'reconciliation_run') {
    const failTimes = Math.max(0, toInt(payload.forceFailTimes, 0));
    if (process.env.NODE_ENV !== 'production' && failTimes > 0 && Number(job.attempts || 0) <= failTimes) {
      throw new Error('SIMULATED_RECONCILIATION_FAILURE');
    }
    const report = runReconciliation(day || nowIso().slice(0, 10));
    return {
      reportId: Number(report?.id || 0),
      day: String(report?.day || day || ''),
      status: String(report?.status || ''),
      mismatches: Array.isArray(report?.mismatches) ? report.mismatches.length : 0,
    };
  }
  throw new Error('UNSUPPORTED_JOB_TYPE');
}

function listJobsInternal(state, { tenantId, jobType, status, limit }) {
  ensureArrays(state);
  const max = Math.max(1, Math.min(200, toInt(limit, 50)));
  return [...state.pOpsJobs]
    .filter((row) => Number(row.tenantId || 1) === Number(tenantId || 1))
    .filter((row) => (!jobType ? true : String(row.jobType || '') === String(jobType)))
    .filter((row) => (!status ? true : String(row.status || '') === String(status)))
    .sort((a, b) => Number(b.id || 0) - Number(a.id || 0))
    .slice(0, max);
}

function findJob(state, { tenantId, jobId }) {
  ensureArrays(state);
  return state.pOpsJobs.find(
    (row) => Number(row.id || 0) === Number(jobId || 0) && Number(row.tenantId || 1) === Number(tenantId || 1)
  );
}

function toSafeError(error) {
  const raw = String(error?.message || error || 'JOB_EXECUTION_FAILED').slice(0, 400);
  return raw || 'JOB_EXECUTION_FAILED';
}

function processOne(state, job) {
  const now = nowIso();
  job.status = 'running';
  job.attempts = Number(job.attempts || 0) + 1;
  job.startedAt = now;
  job.updatedAt = now;
  appendJobLog(state, {
    jobId: job.id,
    tenantId: job.tenantId,
    level: 'info',
    message: `job running attempt=${job.attempts}`,
  });

  try {
    const result = executeJobHandler(job);
    const doneAt = nowIso();
    job.status = 'success';
    job.result = result;
    job.error = '';
    job.completedAt = doneAt;
    job.updatedAt = doneAt;
    appendJobLog(state, {
      jobId: job.id,
      tenantId: job.tenantId,
      level: 'info',
      message: 'job completed',
      detail: { result },
    });
    appendAuditLog({
      tenantId: job.tenantId,
      actorType: 'system',
      actorId: 0,
      action: `p_ops_job_success:${job.jobType}`,
      result: 'success',
      resourceType: 'p_ops_job',
      resourceId: String(job.id),
      meta: { attempts: job.attempts, maxAttempts: job.maxAttempts },
    });
    return { status: 'success' };
  } catch (error) {
    const errorMessage = toSafeError(error);
    const failedAt = nowIso();
    const maxAttempts = Math.max(1, Number(job.maxAttempts || 3));
    if (Number(job.attempts || 0) < maxAttempts) {
      const waitMs = backoffMs(job.attempts);
      job.status = 'retrying';
      job.error = errorMessage;
      job.nextRunAt = new Date(Date.now() + waitMs).toISOString();
      job.updatedAt = failedAt;
      appendJobLog(state, {
        jobId: job.id,
        tenantId: job.tenantId,
        level: 'warn',
        message: `job failed, retry scheduled in ${waitMs}ms`,
        detail: { error: errorMessage, attempts: job.attempts, maxAttempts },
      });
      appendAuditLog({
        tenantId: job.tenantId,
        actorType: 'system',
        actorId: 0,
        action: `p_ops_job_retry:${job.jobType}`,
        result: 'warn',
        resourceType: 'p_ops_job',
        resourceId: String(job.id),
        meta: { attempts: job.attempts, maxAttempts, error: errorMessage, waitMs },
      });
      return { status: 'retrying' };
    }

    job.status = 'failed';
    job.error = errorMessage;
    job.completedAt = failedAt;
    job.updatedAt = failedAt;
    appendJobLog(state, {
      jobId: job.id,
      tenantId: job.tenantId,
      level: 'error',
      message: 'job failed permanently',
      detail: { error: errorMessage, attempts: job.attempts, maxAttempts },
    });
    appendAuditLog({
      tenantId: job.tenantId,
      actorType: 'system',
      actorId: 0,
      action: `p_ops_job_failed:${job.jobType}`,
      result: 'error',
      resourceType: 'p_ops_job',
      resourceId: String(job.id),
      meta: { attempts: job.attempts, maxAttempts, error: errorMessage },
    });
    return { status: 'failed' };
  }
}

export function enqueueOpsAsyncJob({ tenantId = 1, jobType, payload = {}, actorId = 0, maxAttempts = 3 }) {
  const type = String(jobType || '').trim();
  if (!SUPPORTED_JOB_TYPES.has(type)) throw new Error('OPS_JOB_TYPE_INVALID');
  const t = Number(tenantId || 1) || 1;
  const state = getState();
  ensureArrays(state);
  const now = nowIso();
  const job = {
    id: nextId(state.pOpsJobs),
    tenantId: t,
    jobType: type,
    payload: normalizePayload(payload),
    status: 'queued',
    attempts: 0,
    maxAttempts: Math.max(1, Math.min(10, toInt(maxAttempts, 3))),
    nextRunAt: now,
    error: '',
    result: null,
    createdBy: Number(actorId || 0) || 0,
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    completedAt: null,
  };
  state.pOpsJobs.push(job);
  appendJobLog(state, {
    jobId: job.id,
    tenantId: t,
    level: 'info',
    message: 'job created',
    detail: { jobType: type, createdBy: job.createdBy },
  });
  appendAuditLog({
    tenantId: t,
    actorType: 'employee',
    actorId: Number(actorId || 0) || null,
    action: `p_ops_job_created:${type}`,
    result: 'success',
    resourceType: 'p_ops_job',
    resourceId: String(job.id),
    meta: { maxAttempts: job.maxAttempts },
  });
  persistState();
  return job;
}

export function listOpsAsyncJobs({ tenantId = 1, jobType = '', status = '', limit = 50 }) {
  const state = getState();
  return listJobsInternal(state, { tenantId, jobType, status, limit });
}

export function getOpsAsyncJob({ tenantId = 1, jobId }) {
  const state = getState();
  return findJob(state, { tenantId, jobId });
}

export function listOpsAsyncJobLogs({ tenantId = 1, jobId, limit = 200 }) {
  const state = getState();
  ensureArrays(state);
  const max = Math.max(1, Math.min(1000, toInt(limit, 200)));
  return [...state.pOpsJobLogs]
    .filter((row) => Number(row.tenantId || 1) === Number(tenantId || 1))
    .filter((row) => Number(row.jobId || 0) === Number(jobId || 0))
    .sort((a, b) => Number(a.id || 0) - Number(b.id || 0))
    .slice(-max);
}

export function retryOpsAsyncJob({ tenantId = 1, jobId, actorId = 0 }) {
  const state = getState();
  const job = findJob(state, { tenantId, jobId });
  if (!job) throw new Error('OPS_JOB_NOT_FOUND');
  if (!RETRYABLE_STATUSES.has(String(job.status || ''))) throw new Error('OPS_JOB_NOT_RETRYABLE');
  const now = nowIso();
  job.status = 'queued';
  job.nextRunAt = now;
  job.error = '';
  job.updatedAt = now;
  appendJobLog(state, {
    jobId: job.id,
    tenantId: job.tenantId,
    level: 'info',
    message: 'job retried manually',
    detail: { actorId: Number(actorId || 0) || 0 },
  });
  appendAuditLog({
    tenantId: job.tenantId,
    actorType: 'employee',
    actorId: Number(actorId || 0) || null,
    action: `p_ops_job_manual_retry:${job.jobType}`,
    result: 'success',
    resourceType: 'p_ops_job',
    resourceId: String(job.id),
    meta: { attempts: job.attempts, maxAttempts: job.maxAttempts },
  });
  persistState();
  return job;
}

export function runOpsAsyncJobWorkerOnce({ limit = 5 } = {}) {
  const state = getState();
  ensureArrays(state);
  const max = Math.max(1, Math.min(50, toInt(limit, 5)));
  const nowTs = Date.now();
  const runnable = state.pOpsJobs
    .filter((row) => RUNNABLE_STATUSES.has(String(row.status || '')))
    .filter((row) => new Date(String(row.nextRunAt || row.createdAt || 0)).getTime() <= nowTs)
    .sort((a, b) => Number(a.id || 0) - Number(b.id || 0))
    .slice(0, max);

  const summary = {
    processed: 0,
    success: 0,
    retrying: 0,
    failed: 0,
  };
  for (const job of runnable) {
    const result = processOne(state, job);
    summary.processed += 1;
    if (result.status === 'success') summary.success += 1;
    if (result.status === 'retrying') summary.retrying += 1;
    if (result.status === 'failed') summary.failed += 1;
  }
  if (summary.processed > 0) persistState();
  return summary;
}

let workerTimer = null;
let workerRunning = false;

export function startOpsAsyncJobWorker({ intervalMs = 5000 } = {}) {
  if (workerTimer) return () => {};
  const interval = Math.max(1000, toInt(intervalMs, 5000));
  workerTimer = setInterval(() => {
    if (workerRunning) return;
    workerRunning = true;
    try {
      runOpsAsyncJobWorkerOnce({ limit: 5 });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('[ops-async-job] worker tick failed:', error?.message || error);
    } finally {
      workerRunning = false;
    }
  }, interval);
  if (typeof workerTimer.unref === 'function') workerTimer.unref();
  return () => {
    if (!workerTimer) return;
    clearInterval(workerTimer);
    workerTimer = null;
    workerRunning = false;
  };
}
