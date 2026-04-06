import { runInStateTransaction } from '../common/state.mjs';
import { insertPolicy, removePolicyById, updatePolicyById } from '../repositories/insurance-write.repository.mjs';
import {
  analyzeInsurancePolicyResponsibilities,
  mapAnalysisToPolicyResponsibilities,
  sanitizeStoredPolicyAnalysis,
} from '../services/policy-analysis.service.mjs';

const toTrimmed = (value) => String(value || '').trim();
const policyResponsibilityRefreshJobs = new Map();

function getPolicyPersistOptions(command) {
  const useFastPersist = typeof command.persistPoliciesByIds === 'function';
  return {
    persistMode: useFastPersist ? 'manual' : 'full',
    reloadMode: useFastPersist ? 'none' : 'full',
    snapshotMode: 'policy_write',
  };
}

function buildPolicyAnalysisInput(policyDraft = {}) {
  return {
    company: policyDraft.company,
    name: policyDraft.name,
    date: policyDraft.periodStart,
    amount: policyDraft.amount,
    firstPremium: policyDraft.annualPremium,
  };
}

function buildPolicyRefreshFingerprint(policyDraft = {}) {
  return JSON.stringify({
    company: toTrimmed(policyDraft.company),
    name: toTrimmed(policyDraft.name),
    date: toTrimmed(policyDraft.periodStart),
    amount: Number(policyDraft.amount || 0),
    firstPremium: Number(policyDraft.annualPremium || 0),
  });
}

function shouldApplyAnalyzedResponsibilities(current, analysisInput) {
  return (
    toTrimmed(current?.company) === toTrimmed(analysisInput.company) &&
    toTrimmed(current?.name) === toTrimmed(analysisInput.name) &&
    toTrimmed(current?.periodStart) === toTrimmed(analysisInput.date)
  );
}

function resolveProvidedAnalysis(command, policyDraft = {}, fallbackResponsibilities = []) {
  const analysisSnapshot = sanitizeStoredPolicyAnalysis(command.analysis);
  if (!analysisSnapshot) {
    return {
      analysis: null,
      responsibilities: Array.isArray(fallbackResponsibilities) ? fallbackResponsibilities : [],
      used: false,
    };
  }
  const mappedResponsibilities = mapAnalysisToPolicyResponsibilities(analysisSnapshot, {
    amount: policyDraft.amount,
    firstPremium: policyDraft.annualPremium,
  });
  return {
    analysis: analysisSnapshot,
    responsibilities:
      Array.isArray(mappedResponsibilities) && mappedResponsibilities.length
        ? mappedResponsibilities
        : Array.isArray(fallbackResponsibilities)
          ? fallbackResponsibilities
          : [],
    used: true,
  };
}

function schedulePolicyResponsibilitiesRefresh({ command, policyId, policyDraft }) {
  if (Number(policyId || 0) <= 0) return;
  if (!toTrimmed(policyDraft.company) || !toTrimmed(policyDraft.name)) return;

  const analysisInput = buildPolicyAnalysisInput(policyDraft);
  const fingerprint = buildPolicyRefreshFingerprint(policyDraft);
  policyResponsibilityRefreshJobs.set(Number(policyId), fingerprint);

  Promise.resolve()
    .then(async () => {
      const analysis = await analyzeInsurancePolicyResponsibilities({ policy: analysisInput });
      const analysisSnapshot = sanitizeStoredPolicyAnalysis(analysis);
      const responsibilities = mapAnalysisToPolicyResponsibilities(analysis, {
        amount: policyDraft.amount,
        firstPremium: policyDraft.annualPremium,
      });
      if (policyResponsibilityRefreshJobs.get(Number(policyId)) !== fingerprint) return;

      await runInStateTransaction(async () => {
        const state = command.getState();
        const current = (Array.isArray(state.policies) ? state.policies : []).find((item) => Number(item?.id) === Number(policyId));
        if (!current) return null;
        if (!shouldApplyAnalyzedResponsibilities(current, analysisInput)) return null;

        if (analysisSnapshot) {
          current.analysis = analysisSnapshot;
        }
        if (responsibilities.length) {
          current.responsibilities = responsibilities;
        }
        current.updatedAt = new Date().toISOString();

        if (typeof command.persistPoliciesByIds === 'function') {
          await command.persistPoliciesByIds({ upsertPolicyIds: [Number(policyId)] });
        } else {
          await command.persistState();
        }
        return current;
      }, getPolicyPersistOptions(command));
    })
    .catch(() => undefined)
    .finally(() => {
      if (policyResponsibilityRefreshJobs.get(Number(policyId)) === fingerprint) {
        policyResponsibilityRefreshJobs.delete(Number(policyId));
      }
    });
}

export const executeCreateInsurancePolicy = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const name = String(command.name || '');
    const type = command.type || command.inferPolicyType(name);
    const date = command.date;
    const amount = command.amount;
    const firstPremium = command.firstPremium;
    const customerId =
      Number(command.customerId || 0) > 0
        ? Number(command.customerId || 0)
        : String(command.actorType || 'customer') === 'customer'
          ? Number(command.userId || 0)
          : 0;
    if (customerId <= 0) {
      const err = new Error('POLICY_CUSTOMER_REQUIRED');
      err.code = 'POLICY_CUSTOMER_REQUIRED';
      throw err;
    }
    const fallbackResponsibilities = command.defaultResponsibilities(type, amount);
    const providedAnalysis = resolveProvidedAnalysis(
      command,
      {
        company: command.company,
        name: command.name,
        periodStart: date,
        amount,
        annualPremium: firstPremium,
      },
      fallbackResponsibilities,
    );
    const policy = {
      id: command.nextId(state.policies || []),
      tenantId: Number(command.tenantId || 1),
      customerId,
      company: command.company,
      name: command.name,
      type,
      amount,
      nextPayment: command.nextPaymentDate(date),
      status: '保障中',
      applicant: command.applicant,
      applicantRelation: command.applicantRelation,
      insured: command.insured,
      insuredRelation: command.insuredRelation,
      periodStart: date,
      periodEnd: command.calcPeriodEnd(date, command.coveragePeriod),
      annualPremium: firstPremium,
      paymentPeriod: command.paymentPeriod,
      coveragePeriod: command.coveragePeriod,
      responsibilities: providedAnalysis.responsibilities,
      analysis: providedAnalysis.analysis,
      paymentHistory: [
        {
          date,
          amount: firstPremium,
          note: '首期缴费',
          status: '支付成功',
        },
      ],
      policyNo: `PL${Date.now()}${Math.floor(Math.random() * 1000)}`,
      createdBy: command.userId,
      createdAt: new Date().toISOString(),
    };
    insertPolicy({ state, policy });
    command.refreshInsuranceSummaryFromState(state);
    if (typeof command.persistPoliciesByIds === 'function') {
      await command.persistPoliciesByIds({ upsertPolicyIds: [policy.id] });
    } else {
      await command.persistState();
    }
    return { ok: true, policy };
  }, getPolicyPersistOptions(command)).then((result) => {
    if (sanitizeStoredPolicyAnalysis(result.policy?.analysis)) {
      return result;
    }
    schedulePolicyResponsibilitiesRefresh({
      command,
      policyId: result.policy?.id,
      policyDraft: result.policy,
    });
    return result;
  });

export const executeScanInsurancePolicy = async (command) =>
  command.scanInsurancePolicy({
    uploadItem: command.uploadItem,
    ocrText: command.ocrText,
  });

export const executeUpdateInsurancePolicy = async (command) =>
  (() => {
    let shouldRefreshAnalysis = false;
    return runInStateTransaction(async () => {
    const state = command.getState();
    const policyId = Number(command.policyId || 0);
    const current = (Array.isArray(state.policies) ? state.policies : []).find((item) => Number(item?.id) === policyId);
    if (!current) {
      const err = new Error('POLICY_NOT_FOUND');
      err.code = 'POLICY_NOT_FOUND';
      throw err;
    }

    const name = String(command.name || current.name || '');
    const type = command.type || command.inferPolicyType(name);
    const date = command.date;
    const amount = command.amount;
    const firstPremium = command.firstPremium;
    const customerId =
      Number(command.customerId || 0) > 0
        ? Number(command.customerId || 0)
        : String(command.actorType || 'customer') === 'customer'
          ? Number(command.userId || 0)
          : Number(current.customerId || 0);

    if (customerId <= 0) {
      const err = new Error('POLICY_CUSTOMER_REQUIRED');
      err.code = 'POLICY_CUSTOMER_REQUIRED';
      throw err;
    }

    const nextPolicy = {
      ...current,
      customerId,
      company: command.company,
      name,
      type,
      amount,
      nextPayment: command.nextPaymentDate(date),
      applicant: command.applicant,
      applicantRelation: command.applicantRelation,
      insured: command.insured,
      insuredRelation: command.insuredRelation,
      periodStart: date,
      periodEnd: command.calcPeriodEnd(date, command.coveragePeriod),
      annualPremium: firstPremium,
      paymentPeriod: command.paymentPeriod,
      coveragePeriod: command.coveragePeriod,
      responsibilities: Array.isArray(current.responsibilities) ? current.responsibilities : [],
      paymentHistory:
        Array.isArray(current.paymentHistory) && current.paymentHistory.length
          ? current.paymentHistory
          : [
              {
                date,
                amount: firstPremium,
                note: '首期缴费',
                status: '支付成功',
              },
            ],
      updatedAt: new Date().toISOString(),
    };

    shouldRefreshAnalysis =
      toTrimmed(current.company) !== toTrimmed(nextPolicy.company) ||
      toTrimmed(current.name) !== toTrimmed(nextPolicy.name) ||
      toTrimmed(current.periodStart) !== toTrimmed(nextPolicy.periodStart);

    const providedAnalysis = resolveProvidedAnalysis(command, nextPolicy, Array.isArray(current.responsibilities) ? current.responsibilities : []);

    nextPolicy.analysis = providedAnalysis.used
      ? providedAnalysis.analysis
      : shouldRefreshAnalysis
        ? null
        : sanitizeStoredPolicyAnalysis(current.analysis);

    if (providedAnalysis.used) {
      nextPolicy.responsibilities = providedAnalysis.responsibilities;
    }

    if (!Array.isArray(nextPolicy.responsibilities) || !nextPolicy.responsibilities.length) {
      nextPolicy.responsibilities = command.defaultResponsibilities(type, amount);
    }

    const updated = updatePolicyById({
      state,
      policyId,
      updater: () => nextPolicy,
    });

    command.refreshInsuranceSummaryFromState(state);
    if (typeof command.persistPoliciesByIds === 'function') {
      await command.persistPoliciesByIds({ upsertPolicyIds: [policyId] });
    } else {
      await command.persistState();
    }
    return { ok: true, policy: updated };
  }, getPolicyPersistOptions(command)).then((result) => {
    const currentPolicy = result?.policy;
    if (!currentPolicy) return result;
    const currentResponsibilities = Array.isArray(currentPolicy.responsibilities) ? currentPolicy.responsibilities : [];
    const currentAnalysis = sanitizeStoredPolicyAnalysis(currentPolicy.analysis);

    if (!currentResponsibilities.length || !currentAnalysis) {
      schedulePolicyResponsibilitiesRefresh({
        command,
        policyId: currentPolicy.id,
        policyDraft: currentPolicy,
      });
    }
    return result;
  });
  })();

export const executeDeleteInsurancePolicy = async (command) =>
  runInStateTransaction(async () => {
    const state = command.getState();
    const policyId = Number(command.policyId || 0);
    const removed = removePolicyById({
      state,
      policyId,
    });
    if (!removed) {
      const err = new Error('POLICY_NOT_FOUND');
      err.code = 'POLICY_NOT_FOUND';
      throw err;
    }
    command.refreshInsuranceSummaryFromState(state);
    if (typeof command.persistPoliciesByIds === 'function') {
      await command.persistPoliciesByIds({ deletePolicyIds: [policyId] });
    } else {
      await command.persistState();
    }
    return { ok: true, policyId };
  }, getPolicyPersistOptions(command));
