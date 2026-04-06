import { runInStateTransaction } from '../common/state.mjs';
import { appendPTagRuleJobLogs, insertPTagRuleJob } from '../repositories/p-tag-rule-job-write.repository.mjs';

export const executeCreatePTagRuleJob = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const tenantId = Number(command.tenantContext?.tenantId || 0);
    const seeded = command.ensureTagSeeds(state, tenantId, command.nextId);
    if (seeded) command.persistState();

    const now = new Date().toISOString();
    const jobType = String(command.jobType || 'delta')
      .trim()
      .toLowerCase();
    const triggerType = String(command.triggerType || 'manual')
      .trim()
      .toLowerCase();
    const scope = command.scope && typeof command.scope === 'object' ? command.scope : {};
    const tenantRules = (state.pTagRules || []).filter((row) => Number(row.tenantId || 1) === tenantId);
    const targetRuleIdsRaw = Array.isArray(command.targetRuleIds)
      ? command.targetRuleIds.map((x) => Number(x || 0)).filter((x) => x > 0)
      : [];
    const targetRuleIds = targetRuleIdsRaw.length
      ? targetRuleIdsRaw
      : tenantRules.filter((x) => String(x.status || '') === 'active').map((x) => Number(x.id));
    if (!targetRuleIds.length) throw new Error('TARGET_RULE_REQUIRED');

    const customerIds = command.collectCustomerIdsForTagJob(state, tenantId);
    const job = insertPTagRuleJob({
      state,
      row: {
        id: command.nextId(state.pTagRuleJobs || []),
        tenantId,
        jobType: ['full', 'delta', 'replay'].includes(jobType) ? jobType : 'delta',
        triggerType: ['manual', 'schedule', 'publish'].includes(triggerType) ? triggerType : 'manual',
        status: 'running',
        targetRuleIds,
        scope,
        startedAt: now,
        endedAt: null,
        totalCustomers: customerIds.length,
        successCustomers: 0,
        failedCustomers: 0,
        errorSummary: '',
        createdAt: now,
      },
    });

    const selectedRules = tenantRules.filter((row) => targetRuleIds.includes(Number(row.id)));
    const customerMetricMap = command.buildTagJobCustomerMetrics(state, tenantId, customerIds);
    let nextLogId = command.nextId(state.pTagRuleJobLogs || []);
    const logs = [];
    let successCustomers = 0;

    customerIds.forEach((customerId) => {
      selectedRules.forEach((rule) => {
        const customerMetrics = customerMetricMap.get(Number(customerId)) || {};
        const evalResult = command.evaluateTagRuleByCustomer(rule, customerMetrics);
        const hit = Boolean(evalResult.hit);
        logs.push({
          id: nextLogId++,
          jobId: Number(job.id),
          tenantId,
          customerId: Number(customerId),
          ruleId: Number(rule.id),
          result: hit ? 'hit' : 'miss',
          outputValue: hit ? command.resolveTagRuleOutputValue(rule, customerMetrics) : null,
          reason: String(evalResult.reason || (hit ? 'condition matched' : 'condition not matched')),
          createdAt: now,
        });
      });
      successCustomers += 1;
    });

    appendPTagRuleJobLogs({ state, logs });
    job.successCustomers = successCustomers;
    job.failedCustomers = Math.max(0, customerIds.length - successCustomers);
    job.status = job.failedCustomers > 0 ? 'partial_success' : 'success';
    job.endedAt = new Date().toISOString();

    command.persistState();
    return { ok: true, item: job };
  });
