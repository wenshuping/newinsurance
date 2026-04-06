import crypto from 'node:crypto';
import { z } from 'zod';

const DEFAULT_DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
const DEFAULT_DEEPSEEK_MODEL = 'deepseek-chat';
const DEFAULT_FALLBACK_MODEL = 'deepseek-chat';
const DEFAULT_TIMEOUT_MS = 60_000;
const CACHE_TTL_MS = 10 * 60 * 1000;
const DEFAULT_DISCLAIMER = '本分析基于保单摘录和OCR识别结果生成，不替代完整条款、投保须知、健康告知及正式理赔审核结论。';

const analysisResponseSchema = z.object({
  productOverview: z.string().trim().min(1),
  coreFeature: z.string().trim().min(1),
  coverageTable: z
    .array(
      z.object({
        coverageType: z.string().trim().min(1),
        scenario: z.string().trim().min(1),
        payout: z.string().trim().min(1),
        note: z.string().trim().min(1),
      }),
    )
    .default([]),
  exclusions: z.array(z.string().trim().min(1)).default([]),
  purchaseAdvice: z.string().trim().min(1),
  disclaimer: z.string().trim().min(1).default(DEFAULT_DISCLAIMER),
});

const analysisCache = new Map();

function isoNow() {
  return new Date().toISOString();
}

function nowMs() {
  return Date.now();
}

function trimString(value) {
  return String(value || '').trim();
}

function toNumberString(value) {
  const raw = trimString(value);
  if (!raw) return '';
  const normalized = raw.replace(/[,\s]/g, '').replace(/[^\d.]/g, '');
  return normalized;
}

function normalizePolicyForPrompt(policy = {}) {
  return {
    company: trimString(policy.company),
    name: trimString(policy.name),
    date: trimString(policy.date || policy.periodStart),
    type: trimString(policy.type),
    amount: toNumberString(policy.amount),
    firstPremium: toNumberString(policy.firstPremium || policy.annualPremium),
    responsibilities: Array.isArray(policy.responsibilities)
      ? policy.responsibilities
          .map((item) => ({
            name: trimString(item?.name),
            desc: trimString(item?.desc),
            limit: toNumberString(item?.limit),
          }))
          .filter((item) => item.name)
      : [],
  };
}

function getConfig() {
  const timeoutCandidate = Number(process.env.DEEPSEEK_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const model = trimString(process.env.DEEPSEEK_MODEL) || DEFAULT_DEEPSEEK_MODEL;
  const fallbackModel =
    trimString(process.env.DEEPSEEK_FALLBACK_MODEL) || (model === 'deepseek-reasoner' ? DEFAULT_FALLBACK_MODEL : '');
  return {
    apiKey: trimString(process.env.DEEPSEEK_API_KEY),
    baseUrl: trimString(process.env.DEEPSEEK_BASE_URL) || DEFAULT_DEEPSEEK_BASE_URL,
    model,
    fallbackModel,
    timeoutMs: Number.isFinite(timeoutCandidate) ? Math.max(5_000, timeoutCandidate) : DEFAULT_TIMEOUT_MS,
  };
}

function buildCacheKey({ policy, analysisInput, model }) {
  const hash = crypto
    .createHash('sha1')
    .update(
      JSON.stringify({
        model,
        policy,
        analysisInput,
      }),
    )
    .digest('hex');
  return `policy-analysis:${model}:${hash}`;
}

function getCachedAnalysis(cacheKey) {
  const cached = analysisCache.get(cacheKey);
  if (!cached) return null;
  if (cached.expiresAt <= nowMs()) {
    analysisCache.delete(cacheKey);
    return null;
  }
  return {
    ...cached.value,
    cached: true,
  };
}

function setCachedAnalysis(cacheKey, value) {
  analysisCache.set(cacheKey, {
    value,
    expiresAt: nowMs() + CACHE_TTL_MS,
  });
}

function extractJson(content) {
  const raw = trimString(content);
  if (!raw) throw withCode(new Error('POLICY_ANALYSIS_EMPTY'), 'POLICY_ANALYSIS_EMPTY');
  try {
    return JSON.parse(raw);
  } catch {}

  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const candidate = raw.slice(start, end + 1);
    return JSON.parse(candidate);
  }
  throw withCode(new Error('POLICY_ANALYSIS_INVALID_JSON'), 'POLICY_ANALYSIS_INVALID_JSON');
}

function normalizeInsightList(items = []) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      if (typeof item === 'string') return trimString(item);
      if (!item || typeof item !== 'object') return '';
      return trimString(item.text || item.detail || item.title || item.label || item.content || item.message || item.reason);
    })
    .filter(Boolean);
}

function normalizeParagraph(value) {
  if (typeof value === 'string') return trimString(value);
  if (Array.isArray(value)) return normalizeInsightList(value).join('\n');
  if (!value || typeof value !== 'object') return '';
  return trimString(value.text || value.detail || value.description || value.content || value.message || value.reason);
}

function extractDetailPart(detail, label) {
  const raw = trimString(detail);
  if (!raw) return '';
  const match = raw.match(new RegExp(`${label}[：:]\\s*([^；;]+)`));
  return trimString(match?.[1] || '');
}

function normalizeCoverageTable(items = []) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      if (!item) return null;
      if (typeof item === 'string') {
        const coverageType = trimString(item);
        if (!coverageType) return null;
        return {
          coverageType,
          scenario: '需以正式条款核对',
          payout: '需以正式条款核对',
          note: '当前只有责任名称，具体责任需以正式条款核对。',
        };
      }
      if (typeof item !== 'object') return null;
      const coverageType = trimString(item.coverageType || item.title || item.name || item.label || item.heading);
      const detail = trimString(item.detail || item.desc || item.description || item.text || item.content);
      const scenario = trimString(item.scenario || extractDetailPart(detail, '保障情形'));
      const payout = trimString(item.payout || item.amount || item.limit || extractDetailPart(detail, '赔付金额'));
      const note = trimString(item.note || item.explanation || extractDetailPart(detail, '说明'));
      if (!coverageType && !detail) return null;
      return {
        coverageType: coverageType || '责任项',
        scenario: scenario || '需以正式条款核对',
        payout: payout || '需以正式条款核对',
        note: note || detail || '需以正式条款核对。',
      };
    })
    .filter(Boolean);
}

function normalizeAnalysis(payload, model) {
  const normalizedPayload = {
    productOverview: trimString(payload?.productOverview || payload?.summary || payload?.overview || payload?.conclusion),
    coreFeature: normalizeParagraph(payload?.coreFeature || payload?.coreSellingPoint || payload?.positioning || payload?.responsibilityHighlights),
    coverageTable: normalizeCoverageTable(
      payload?.coverageTable || payload?.mainCoverageBreakdown || payload?.primaryCoverageBreakdown || payload?.mainCoverage,
    ),
    exclusions: normalizeInsightList(payload?.exclusions || payload?.riskAlerts || payload?.risks || payload?.riskWarnings),
    purchaseAdvice: normalizeParagraph(payload?.purchaseAdvice || payload?.advisorSuggestions || payload?.serviceSuggestions || payload?.nextActions),
    disclaimer: trimString(payload?.disclaimer || payload?.notice || DEFAULT_DISCLAIMER),
  };
  const parsed = analysisResponseSchema.parse(normalizedPayload);
  return {
    productOverview: parsed.productOverview,
    coreFeature: parsed.coreFeature,
    coverageTable: parsed.coverageTable.slice(0, 12),
    exclusions: parsed.exclusions.slice(0, 6),
    purchaseAdvice: parsed.purchaseAdvice,
    disclaimer: parsed.disclaimer || DEFAULT_DISCLAIMER,
    model: trimString(model) || DEFAULT_DEEPSEEK_MODEL,
    generatedAt: isoNow(),
    cached: false,
  };
}

function resolveGeneratedAt(value) {
  const text = trimString(value);
  if (!text) return isoNow();
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? isoNow() : parsed.toISOString();
}

export function sanitizeStoredPolicyAnalysis(analysis) {
  if (!analysis || typeof analysis !== 'object') return null;
  try {
    const normalized = normalizeAnalysis(analysis, trimString(analysis.model) || DEFAULT_DEEPSEEK_MODEL);
    return {
      ...normalized,
      generatedAt: resolveGeneratedAt(analysis.generatedAt),
      cached: false,
    };
  } catch {
    return null;
  }
}

function buildModelChain(config) {
  const seen = new Set();
  return [config.model, config.fallbackModel].filter((model) => {
    const value = trimString(model);
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function buildAnalysisInput({ policy }) {
  return {
    company: policy.company,
    name: policy.name,
    date: policy.date,
    amount: policy.amount,
    firstPremium: policy.firstPremium,
  };
}

function buildMessages({ policy, analysisInput }) {
  const factLines = [
    `保险公司：${policy.company || '未识别'}`,
    `保险产品：${policy.name || '未识别'}`,
    `投保时间：${policy.date || '未识别'}`,
    `保额：${policy.amount || '未识别'}`,
    `年交保费：${policy.firstPremium || '未识别'}`,
  ];
  return [
    {
      role: 'system',
      content:
        '你是保险产品责任分析助手。你只能基于已提供的最小脱敏事实进行分析：保险公司、保险产品名称、投保时间、保额、年交保费。严禁臆造客户身份、年龄、职业、家庭、手机号、证件号、投保人与被保人关系等任何未提供信息。允许你依据保险公司公开产品资料、公开条款名称、保险行业通用责任结构和产品命名来识别该产品的常见保障责任，并可将保额、年交保费作为责任强度和返还表达的参考，但凡版本、年龄段、保障期间或责任细节无法完全确认，必须在对应文案里明确写“需以正式条款核对”，不能写成绝对事实。请只输出 JSON，不要输出 markdown 或解释性前后缀。JSON 只能包含 productOverview、coreFeature、coverageTable、exclusions、purchaseAdvice、disclaimer 这 6 个字段。coverageTable 输出 6 到 12 行，每行只允许 coverageType、scenario、payout、note 四列，用来表达保险责任。若能识别具体产品，请优先拆解满期金/生存金、疾病身故或全残、一般意外、特定交通意外、自然灾害或公共场所事故等关键责任；若无法确认，则按最常见责任结构给出，并在 note 中说明需以正式条款核对。exclusions 中优先写免责条款、赔付唯一性、投保规则或版本差异提醒。purchaseAdvice 写适用人群、关注点和投保前核对项，不要写客户经营话术。',
    },
    {
      role: 'user',
      content: `请基于下面这五项已确认事实，输出这张保单的责任讲解 JSON：保险公司、保险产品名称、投保时间、保额、年交保费。不要带入客户信息，不要臆造投保人/被保人资料，不要编造销售场景。请优先结合该产品公开产品资料和业内常见条款结构，按产品责任尽量拆解到具体保障场景，而不是只写一句泛泛概述。coverageTable 请尽量覆盖：满期金/生存金、疾病身故或全残、一般意外、特定交通意外、自然灾害/公共场所事故等关键责任；如果产品名不足以支撑强判断，就在对应字段明确写“需以正式条款核对”。保额和年交保费可用于帮助判断倍数责任、满期返还和条款表达，但仍不得臆造未提供的客户信息。\n\n已识别关键信息：\n${factLines.join('\n')}\n\n原始结构化输入：\n${JSON.stringify(analysisInput, null, 2)}`,
    },
  ];
}

function parseLimitAmountFromPayout(payout, policy = {}) {
  const text = trimString(payout);
  if (!text) return 0;
  const wanMatch = text.match(/(\d+(?:\.\d+)?)\s*万/);
  if (wanMatch) return Math.round(Number(wanMatch[1]) * 10000);
  const yuanMatch = text.match(/(\d+(?:\.\d+)?)\s*元/);
  if (yuanMatch) return Math.round(Number(yuanMatch[1]));
  const baseAmount = Number(toNumberString(policy.amount));
  const multiMatch = text.match(/基本保额(?:的)?\s*(\d+(?:\.\d+)?)\s*倍/);
  if (multiMatch && Number.isFinite(baseAmount) && baseAmount > 0) {
    return Math.round(baseAmount * Number(multiMatch[1]));
  }
  if (/返还.*保费/.test(text)) {
    const premium = Number(toNumberString(policy.firstPremium || policy.annualPremium));
    if (Number.isFinite(premium) && premium > 0) return premium;
  }
  return 0;
}

export function mapAnalysisToPolicyResponsibilities(analysis, policy = {}) {
  const rows = Array.isArray(analysis?.coverageTable) ? analysis.coverageTable : [];
  return rows
    .map((item) => {
      const name = trimString(item?.coverageType);
      if (!name) return null;
      const scenario = trimString(item?.scenario);
      const note = trimString(item?.note);
      return {
        name,
        desc: [scenario, note].filter(Boolean).join('；'),
        limit: parseLimitAmountFromPayout(item?.payout, policy),
      };
    })
    .filter(Boolean);
}

function withCode(error, code) {
  error.code = code;
  return error;
}

export async function analyzeInsurancePolicyResponsibilities({ policy, ocrText = '', fetchImpl = fetch }) {
  const normalizedPolicy = normalizePolicyForPrompt(policy);
  const config = getConfig();
  if (!config.apiKey) {
    throw withCode(new Error('POLICY_ANALYSIS_PROVIDER_NOT_READY'), 'POLICY_ANALYSIS_PROVIDER_NOT_READY');
  }

  const analysisInput = buildAnalysisInput({
    policy: normalizedPolicy,
  });
  const modelChain = buildModelChain(config);
  const cacheKey = buildCacheKey({
    model: modelChain.join('->'),
    policy: normalizedPolicy,
    analysisInput,
  });
  const cached = getCachedAnalysis(cacheKey);
  if (cached) return cached;

  let lastError = null;
  for (const model of modelChain) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const url = new URL('/chat/completions', config.baseUrl);
      const response = await fetchImpl(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.15,
          max_tokens: 3200,
          response_format: {
            type: 'json_object',
          },
          messages: buildMessages({
            policy: normalizedPolicy,
            analysisInput,
          }),
        }),
      });

      if (!response.ok) {
        const bodyText = trimString(await response.text());
        const error = new Error(`POLICY_ANALYSIS_UPSTREAM_${response.status}:${bodyText || 'upstream_error'}`);
        error.code = 'POLICY_ANALYSIS_UPSTREAM_FAILED';
        throw error;
      }

      const payload = await response.json();
      const content = trimString(payload?.choices?.[0]?.message?.content);
      const normalized = normalizeAnalysis(extractJson(content), String(payload?.model || model));
      setCachedAnalysis(cacheKey, normalized);
      return normalized;
    } catch (error) {
      if (error?.name === 'AbortError') {
        lastError = withCode(new Error('POLICY_ANALYSIS_TIMEOUT'), 'POLICY_ANALYSIS_TIMEOUT');
      } else if (error?.code) {
        lastError = error;
      } else {
        lastError = withCode(error instanceof Error ? error : new Error('POLICY_ANALYSIS_FAILED'), 'POLICY_ANALYSIS_FAILED');
      }
      if (model === modelChain[modelChain.length - 1]) {
        throw lastError;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError || withCode(new Error('POLICY_ANALYSIS_FAILED'), 'POLICY_ANALYSIS_FAILED');
}
