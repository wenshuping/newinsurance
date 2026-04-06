import { authRequired, validateBody, validateParams } from '../common/middleware.mjs';
import { getState, nextId, persistPoliciesByIds, persistPolicyAnalysisSnapshot, persistState } from '../common/state.mjs';
import {
  toCreateInsurancePolicyCommand,
  toDeleteInsurancePolicyCommand,
  toScanInsurancePolicyCommand,
  toUpdateInsurancePolicyCommand,
} from '../dto/write-commands.dto.mjs';
import {
  analyzePolicyBodySchema,
  createPolicyBodySchema,
  generateFamilyPolicyReportBodySchema,
  policyIdParamsSchema,
  scanPolicyBodySchema,
  updatePolicyBodySchema,
} from '../schemas/insurance.schemas.mjs';
import { generateFamilyPolicyReport, resolveStoredFamilyPolicyReport } from '../services/family-policy-report.service.mjs';
import {
  analyzeInsurancePolicyResponsibilities,
  mapAnalysisToPolicyResponsibilities,
  sanitizeStoredPolicyAnalysis,
} from '../services/policy-analysis.service.mjs';
import {
  executeCreateInsurancePolicy,
  executeDeleteInsurancePolicy,
  executeScanInsurancePolicy,
  executeUpdateInsurancePolicy,
} from '../usecases/insurance-write.usecase.mjs';
import { scanInsurancePolicy } from '../services/insurance-ocr.service.mjs';
import { respondInsurancePolicyScanError } from './insurance-scan-error.mjs';

export function registerInsuranceRoutes(app) {
  app.get('/api/insurance/overview', (_req, res) => {
    const state = getState();
    return res.json({
      summary: state.insuranceSummary,
      familyMembers: state.familyMembers,
      reminders: state.insuranceReminders,
    });
  });

  app.get('/api/insurance/policies', authRequired, (req, res) => {
    const state = getState();
    const policies = state.policies
      .filter((policy) => policyBelongsToCustomer(policy, Number(req.user?.id || 0)))
      .map((p) => ({ ...p, icon: iconByType(p.type) }))
      .sort((a, b) => b.id - a.id);
    return res.json({ policies });
  });

  app.get('/api/insurance/policies/:id', authRequired, validateParams(policyIdParamsSchema), (req, res) => {
    const state = getState();
    const { id } = req.params;
    const policy = state.policies.find((p) => Number(p.id) === Number(id) && policyBelongsToCustomer(p, Number(req.user?.id || 0)));
    if (!policy) {
      return res.status(404).json({ code: 'POLICY_NOT_FOUND', message: '保单不存在' });
    }
    return res.json({ policy: { ...policy, icon: iconByType(policy.type) } });
  });

  app.post('/api/insurance/policies/analyze', authRequired, validateBody(analyzePolicyBodySchema), async (req, res) => {
    try {
      const state = getState();
      let targetPolicy = req.body.policy || null;
      let storedPolicy = null;
      if (Number(req.body.policyId || 0) > 0) {
        const policy = state.policies.find(
          (item) => Number(item.id) === Number(req.body.policyId) && policyBelongsToCustomer(item, Number(req.user?.id || 0)),
        );
        if (!policy) {
          return res.status(404).json({ code: 'POLICY_NOT_FOUND', message: '保单不存在' });
        }
        targetPolicy = policy;
        storedPolicy = policy;
      }
      const storedAnalysis = sanitizeStoredPolicyAnalysis(storedPolicy?.analysis);
      if (storedAnalysis) {
        storedPolicy.analysis = storedAnalysis;
        return res.json({
          ok: true,
          analysis: storedAnalysis,
          policy: {
            ...storedPolicy,
            icon: iconByType(storedPolicy.type),
          },
        });
      }
      const analysis = await analyzeInsurancePolicyResponsibilities({
        policy: targetPolicy || {},
      });
      if (storedPolicy) {
        const nextResponsibilities = mapAnalysisToPolicyResponsibilities(analysis, {
          amount: storedPolicy.amount,
          firstPremium: storedPolicy.annualPremium,
        });
        const analysisSnapshot = sanitizeStoredPolicyAnalysis(analysis);
        if (analysisSnapshot) {
          storedPolicy.analysis = analysisSnapshot;
        }
        if (nextResponsibilities.length) {
          storedPolicy.responsibilities = nextResponsibilities;
        }
        storedPolicy.updatedAt = new Date().toISOString();
        await persistPolicyAnalysisSnapshot({
          policyId: storedPolicy.id,
          analysis: analysisSnapshot,
          responsibilities: storedPolicy.responsibilities,
          updatedAt: storedPolicy.updatedAt,
        });
      }
      return res.json({
        ok: true,
        analysis,
        ...(storedPolicy
          ? {
              policy: {
                ...storedPolicy,
                icon: iconByType(storedPolicy.type),
              },
            }
          : {}),
      });
    } catch (err) {
      const code = String(err?.code || err?.message || 'POLICY_ANALYSIS_FAILED');
      if (code === 'POLICY_ANALYSIS_PROVIDER_NOT_READY') {
        return res.status(503).json({ code, message: '保单责任分析服务未配置，请先设置 DeepSeek Key' });
      }
      if (code === 'POLICY_ANALYSIS_TIMEOUT') {
        return res.status(504).json({ code, message: '保单责任分析超时，请稍后重试' });
      }
      if (code === 'POLICY_ANALYSIS_EMPTY' || code === 'POLICY_ANALYSIS_INVALID_JSON') {
        return res.status(502).json({ code, message: '保单责任分析结果异常，请稍后重试' });
      }
      if (code === 'POLICY_ANALYSIS_UPSTREAM_FAILED') {
        return res.status(502).json({ code, message: '保单责任分析服务暂不可用，请稍后重试' });
      }
      return res.status(500).json({ code: 'POLICY_ANALYSIS_FAILED', message: '保单责任分析失败，请稍后重试' });
    }
  });

  app.post('/api/insurance/family-reports/generate', authRequired, validateBody(generateFamilyPolicyReportBodySchema), async (req, res) => {
    try {
      const result = await generateFamilyPolicyReport({
        input: req.body,
        reportOwner: {
          tenantId: Number(req.user?.tenantId || 1),
          customerId: Number(req.user?.id || 0),
        },
      });
      return res.json({
        ok: true,
        reportId: result.reportId,
        reportMarkdown: result.reportMarkdown,
        sanitizedInput: result.sanitizedInput,
        meta: result.meta,
        cached: Boolean(result.cached),
        stored: Boolean(result.stored),
        reused: Boolean(result.reused),
      });
    } catch (err) {
      const code = String(err?.code || err?.message || 'FAMILY_POLICY_REPORT_FAILED');
      if (code === 'FAMILY_POLICY_REPORT_PROVIDER_NOT_READY') {
        return res.status(503).json({ code, message: '家庭报告服务未配置，请联系管理员' });
      }
      if (code === 'FAMILY_POLICY_REPORT_TIMEOUT') {
        return res.status(504).json({ code, message: '家庭报告生成超时，请稍后重试' });
      }
      if (code === 'FAMILY_POLICY_REPORT_EMPTY') {
        return res.status(502).json({ code, message: '家庭报告结果为空，请稍后重试' });
      }
      if (code === 'FAMILY_POLICY_REPORT_UPSTREAM_FAILED') {
        return res.status(502).json({ code, message: '家庭报告服务暂不可用，请稍后重试' });
      }
      return res.status(500).json({ code: 'FAMILY_POLICY_REPORT_FAILED', message: '家庭报告生成失败，请稍后重试' });
    }
  });

  app.post('/api/insurance/family-reports/resolve', authRequired, validateBody(generateFamilyPolicyReportBodySchema), async (req, res) => {
    try {
      const result = await resolveStoredFamilyPolicyReport({
        input: req.body,
        reportOwner: {
          tenantId: Number(req.user?.tenantId || 1),
          customerId: Number(req.user?.id || 0),
        },
      });
      if (!result) {
        return res.status(404).json({ code: 'FAMILY_POLICY_REPORT_NOT_FOUND', message: '当前还没有已归档报告' });
      }
      return res.json({
        ok: true,
        reportId: result.reportId,
        reportMarkdown: result.reportMarkdown,
        sanitizedInput: result.sanitizedInput,
        meta: result.meta,
        cached: Boolean(result.cached),
        stored: Boolean(result.stored),
        reused: Boolean(result.reused),
      });
    } catch (_err) {
      return res.status(500).json({ code: 'FAMILY_POLICY_REPORT_FAILED', message: '家庭报告读取失败，请稍后重试' });
    }
  });

  app.post('/api/insurance/policies/scan', validateBody(scanPolicyBodySchema), (req, res) => {
    const command = toScanInsurancePolicyCommand({
      body: req.body,
      deps: {
        scanInsurancePolicy,
      },
    });
    executeScanInsurancePolicy(command)
      .then((payload) => res.json(payload))
      .catch((err) => respondInsurancePolicyScanError(res, err));
  });

  app.post('/api/insurance/policies', authRequired, validateBody(createPolicyBodySchema), (req, res) => {
    const command = toCreateInsurancePolicyCommand({
      body: req.body,
      user: req.user,
      deps: {
        getState,
        nextId,
        persistPoliciesByIds,
        persistState,
        inferPolicyType,
        nextPaymentDate,
        calcPeriodEnd,
        defaultResponsibilities,
        refreshInsuranceSummaryFromState,
      },
    });
    executeCreateInsurancePolicy(command)
      .then(({ policy }) =>
        res.status(201).json({
          ok: true,
          policy: {
            ...policy,
            icon: iconByType(policy.type),
          },
        })
      )
      .catch((err) => {
        const code = String(err?.code || err?.message || 'POLICY_CREATE_FAILED');
        if (code === 'POLICY_CUSTOMER_REQUIRED') {
          return res.status(400).json({ code, message: '请选择归属客户后再提交保单' });
        }
        return res.status(400).json({ code, message: '保单创建失败' });
      });
  });

  app.put('/api/insurance/policies/:id', authRequired, validateParams(policyIdParamsSchema), validateBody(updatePolicyBodySchema), (req, res) => {
    const command = toUpdateInsurancePolicyCommand({
      params: req.params,
      body: req.body,
      user: req.user,
      deps: {
        getState,
        persistPoliciesByIds,
        persistState,
        inferPolicyType,
        nextPaymentDate,
        calcPeriodEnd,
        defaultResponsibilities,
        refreshInsuranceSummaryFromState,
      },
    });
    executeUpdateInsurancePolicy(command)
      .then(({ policy }) =>
        res.json({
          ok: true,
          policy: {
            ...policy,
            icon: iconByType(policy.type),
          },
        })
      )
      .catch((err) => {
        const code = String(err?.code || err?.message || 'POLICY_UPDATE_FAILED');
        if (code === 'POLICY_NOT_FOUND') {
          return res.status(404).json({ code, message: '保单不存在' });
        }
        if (code === 'POLICY_CUSTOMER_REQUIRED') {
          return res.status(400).json({ code, message: '请选择归属客户后再提交保单' });
        }
        return res.status(400).json({ code, message: '保单修改失败' });
      });
  });

  app.delete('/api/insurance/policies/:id', authRequired, validateParams(policyIdParamsSchema), (req, res) => {
    const command = toDeleteInsurancePolicyCommand({
      params: req.params,
      deps: {
        getState,
        persistPoliciesByIds,
        persistState,
        refreshInsuranceSummaryFromState,
      },
    });
    executeDeleteInsurancePolicy(command)
      .then(() => res.json({ ok: true }))
      .catch((err) => {
        const code = String(err?.code || err?.message || 'POLICY_DELETE_FAILED');
        if (code === 'POLICY_NOT_FOUND') {
          return res.status(404).json({ code, message: '保单不存在' });
        }
        return res.status(400).json({ code, message: '保单删除失败' });
      });
  });
}

function iconByType(type) {
  if (type === '医疗') return 'stethoscope';
  if (type === '重疾') return 'heart-pulse';
  if (type === '意外') return 'shield';
  return 'shield';
}

function policyBelongsToCustomer(policy, customerId) {
  const currentCustomerId = Number(customerId || 0);
  if (currentCustomerId <= 0) return false;
  const explicitCustomerId = Number(policy?.customerId || 0);
  if (explicitCustomerId > 0) return explicitCustomerId === currentCustomerId;
  const legacyCreatedBy = Number(policy?.createdBy || 0);
  if (legacyCreatedBy > 0) return legacyCreatedBy === currentCustomerId;
  return false;
}

function inferPolicyType(name) {
  if (name.includes('医疗')) return '医疗';
  if (name.includes('重疾')) return '重疾';
  if (name.includes('意外')) return '意外';
  return '保障';
}

function calcPeriodEnd(startDate, coveragePeriod) {
  const d = new Date(startDate);
  if (Number.isNaN(d.getTime())) return startDate;
  if (coveragePeriod === '终身') return '终身';

  const years = Number(String(coveragePeriod).replace('年', ''));
  if (!Number.isFinite(years) || years <= 0) return startDate;

  d.setFullYear(d.getFullYear() + years);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function nextPaymentDate(startDate) {
  const d = new Date(startDate);
  if (Number.isNaN(d.getTime())) return startDate;
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

function defaultResponsibilities(type, amount) {
  if (type === '重疾') {
    return [
      { name: '重大疾病保险金', desc: '覆盖常见重大疾病', limit: amount },
      { name: '轻症疾病保险金', desc: '轻症多次赔付', limit: Math.floor(amount * 0.3) },
    ];
  }

  if (type === '意外') {
    return [
      { name: '意外身故/伤残', desc: '按合同约定比例给付', limit: amount },
      { name: '意外医疗', desc: '医疗费用报销', limit: Math.floor(amount * 0.1) },
    ];
  }

  return [
    { name: '一般医疗保险金', desc: '住院及门急诊保障', limit: amount },
    { name: '重疾医疗保险金', desc: '重大疾病医疗额外保障', limit: amount * 2 },
  ];
}

function refreshInsuranceSummaryFromState(targetState) {
  const activePolicies = targetState.policies.filter((p) => p.status === '保障中').length;
  const totalCoverage = targetState.policies.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const annualPremium = targetState.policies.reduce((sum, p) => sum + Number(p.annualPremium || 0), 0);

  targetState.insuranceSummary = {
    ...(targetState.insuranceSummary || {}),
    totalCoverage,
    activePolicies,
    annualPremium,
    healthScore: targetState.insuranceSummary?.healthScore || 85,
  };
}
