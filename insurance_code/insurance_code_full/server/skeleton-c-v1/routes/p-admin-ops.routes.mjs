import {
  toCreatePOpsAsyncJobCommand,
  toPRebuildStatsCommand,
  toPRefundOrderCommand,
  toPRunReconciliationCommand,
  toRetryPOpsAsyncJobCommand,
  toRunPOpsAsyncJobWorkerCommand,
} from '../dto/write-commands.dto.mjs';
import {
  executePRebuildStats,
  executePRefundOrder,
  executePRunReconciliation,
} from '../usecases/p-ops-write.usecase.mjs';
import {
  executeCreatePOpsAsyncJob,
  executeRetryPOpsAsyncJob,
  executeRunPOpsAsyncJobWorker,
} from '../usecases/p-ops-async-job.usecase.mjs';

export function registerPAdminOpsRoutes(app, deps) {
  const { tenantContext, permissionRequired, latestSnapshot, listSnapshots, listOpsAsyncJobs, getOpsAsyncJob, listOpsAsyncJobLogs } = deps;

  app.post('/api/p/orders/:id/refund', tenantContext, permissionRequired('order:refund'), (req, res) => {
    const command = toPRefundOrderCommand({
      params: req.params,
      body: req.body,
      actor: req.actor,
      tenantContext: req.tenantContext,
      deps,
    });
    executePRefundOrder(command)
      .then((result) => res.json({ ok: true, ...result }))
      .catch((err) => {
        const code = err?.message || 'REFUND_FAILED';
        const mapping = {
          ORDER_NOT_FOUND: [404, '订单不存在'],
          ORDER_NOT_PAID: [409, '订单未支付'],
          ORDER_ALREADY_FULFILLED: [409, '订单已履约，不能退款'],
        };
        const [status, message] = mapping[code] || [400, '退款失败'];
        return res.status(status).json({ code, message });
      });
  });

  app.post('/api/p/stats/rebuild', tenantContext, permissionRequired('stats:read'), (req, res) => {
    if (req.body?.async === true) {
      const command = toCreatePOpsAsyncJobCommand({
        body: {
          jobType: 'stats_rebuild',
          payload: { day: req.body?.day },
          maxAttempts: req.body?.maxAttempts,
        },
        actor: req.actor,
        tenantContext: req.tenantContext,
        deps,
      });
      executeCreatePOpsAsyncJob(command)
        .then((job) => res.status(202).json({ ok: true, async: true, job }))
        .catch((err) => res.status(400).json({ code: String(err?.message || 'OPS_JOB_CREATE_FAILED'), message: '异步任务创建失败' }));
      return;
    }

    const command = toPRebuildStatsCommand({ body: req.body, deps });
    executePRebuildStats(command)
      .then((snapshot) => res.json({ ok: true, snapshot }))
      .catch((err) => res.status(500).json({ code: String(err?.message || 'REBUILD_FAILED'), message: '重建失败' }));
  });

  app.get('/api/p/stats/overview', tenantContext, permissionRequired('stats:read'), (req, res) => {
    const limit = Number(req.query?.limit || 14);
    res.json({
      latest: latestSnapshot(),
      history: listSnapshots(limit),
    });
  });

  app.post('/api/p/reconciliation/run', tenantContext, permissionRequired('stats:read'), (req, res) => {
    if (req.body?.async === true) {
      const command = toCreatePOpsAsyncJobCommand({
        body: {
          jobType: 'reconciliation_run',
          payload: {
            day: req.body?.day,
            forceFailTimes: req.body?.forceFailTimes,
          },
          maxAttempts: req.body?.maxAttempts,
        },
        actor: req.actor,
        tenantContext: req.tenantContext,
        deps,
      });
      executeCreatePOpsAsyncJob(command)
        .then((job) => res.status(202).json({ ok: true, async: true, job }))
        .catch((err) => res.status(400).json({ code: String(err?.message || 'OPS_JOB_CREATE_FAILED'), message: '异步任务创建失败' }));
      return;
    }

    const command = toPRunReconciliationCommand({ body: req.body, deps });
    executePRunReconciliation(command)
      .then((report) => res.json({ ok: true, report }))
      .catch((err) => res.status(500).json({ code: String(err?.message || 'RECONCILIATION_FAILED'), message: '对账执行失败' }));
  });

  app.post('/api/p/ops/jobs', tenantContext, permissionRequired('stats:read'), (req, res) => {
    const command = toCreatePOpsAsyncJobCommand({
      body: req.body,
      actor: req.actor,
      tenantContext: req.tenantContext,
      deps,
    });
    executeCreatePOpsAsyncJob(command)
      .then((job) => res.status(202).json({ ok: true, job }))
      .catch((err) => {
        const code = String(err?.message || 'OPS_JOB_CREATE_FAILED');
        const [status, message] = code === 'OPS_JOB_TYPE_INVALID' ? [400, '任务类型不支持'] : [400, '异步任务创建失败'];
        return res.status(status).json({ code, message });
      });
  });

  app.post('/api/p/ops/jobs/run-pending', tenantContext, permissionRequired('stats:read'), (req, res) => {
    const command = toRunPOpsAsyncJobWorkerCommand({
      body: req.body,
      deps,
    });
    executeRunPOpsAsyncJobWorker(command)
      .then((summary) => res.json({ ok: true, summary }))
      .catch((err) => res.status(500).json({ code: String(err?.message || 'OPS_JOB_RUN_FAILED'), message: '任务执行失败' }));
  });

  app.get('/api/p/ops/jobs', tenantContext, permissionRequired('stats:read'), (req, res) => {
    const tenantId = Number(req.tenantContext?.tenantId || 1);
    const items = listOpsAsyncJobs({
      tenantId,
      jobType: String(req.query?.jobType || ''),
      status: String(req.query?.status || ''),
      limit: Number(req.query?.limit || 50),
    });
    res.json({ items });
  });

  app.get('/api/p/ops/jobs/:id', tenantContext, permissionRequired('stats:read'), (req, res) => {
    const tenantId = Number(req.tenantContext?.tenantId || 1);
    const id = Number(req.params?.id || 0);
    const item = getOpsAsyncJob({ tenantId, jobId: id });
    if (!item) {
      return res.status(404).json({ code: 'OPS_JOB_NOT_FOUND', message: '任务不存在' });
    }
    return res.json({ item });
  });

  app.get('/api/p/ops/jobs/:id/logs', tenantContext, permissionRequired('stats:read'), (req, res) => {
    const tenantId = Number(req.tenantContext?.tenantId || 1);
    const id = Number(req.params?.id || 0);
    const item = getOpsAsyncJob({ tenantId, jobId: id });
    if (!item) {
      return res.status(404).json({ code: 'OPS_JOB_NOT_FOUND', message: '任务不存在' });
    }
    const logs = listOpsAsyncJobLogs({
      tenantId,
      jobId: id,
      limit: Number(req.query?.limit || 200),
    });
    return res.json({ logs });
  });

  app.post('/api/p/ops/jobs/:id/retry', tenantContext, permissionRequired('stats:read'), (req, res) => {
    const command = toRetryPOpsAsyncJobCommand({
      params: req.params,
      actor: req.actor,
      tenantContext: req.tenantContext,
      deps,
    });
    executeRetryPOpsAsyncJob(command)
      .then((job) => res.json({ ok: true, job }))
      .catch((err) => {
        const code = String(err?.message || 'OPS_JOB_RETRY_FAILED');
        const mapping = {
          OPS_JOB_NOT_FOUND: [404, '任务不存在'],
          OPS_JOB_NOT_RETRYABLE: [409, '任务状态不支持重试'],
        };
        const [status, message] = mapping[code] || [400, '重试失败'];
        return res.status(status).json({ code, message });
      });
  });
}
