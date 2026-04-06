export const executeCreatePOpsAsyncJob = async (command) =>
  command.enqueueOpsAsyncJob({
    tenantId: command.tenantId,
    jobType: command.jobType,
    payload: command.payload,
    actorId: command.actorId,
    maxAttempts: command.maxAttempts,
  });

export const executeRetryPOpsAsyncJob = async (command) =>
  command.retryOpsAsyncJob({
    tenantId: command.tenantId,
    jobId: command.jobId,
    actorId: command.actorId,
  });

export const executeRunPOpsAsyncJobWorker = async (command) =>
  command.runOpsAsyncJobWorkerOnce({
    limit: command.limit,
  });

