import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getState, nextId, runInStateTransaction } from '../common/state.mjs';

const DEFAULT_DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
const DEFAULT_DEEPSEEK_MODEL = 'deepseek-chat';
const DEFAULT_FALLBACK_MODEL = 'deepseek-chat';
const DEFAULT_TIMEOUT_MS = 25_000;
const CACHE_TTL_MS = 10 * 60 * 1000;
const REPORT_SCOPE_KEY = 'customer_family';
const REPORT_VERSION = 'family-policy-report-v6';

const piiFieldPattern =
  /(?:^|_)(?:name|full_name|real_name|customer_name|insured_name|applicant_name|holder_name|family_name|id_no|id_number|id_card|identity_no|identity_number|certificate_no|cert_no|phone|mobile|mobile_phone|telephone|tel|contact_phone|contact_mobile|email|mail|wechat|wx)(?:$|_)/i;
const nonPiiNameFields = new Set(['report_name', 'product_name', 'generator_name', 'company_name', 'insurer_name', 'plan_name', 'policy_name']);
const personAliasFields = new Set(['insured', 'applicant', 'policyholder', 'holder', 'customer', 'owner']);
const childRolePattern = /(子女|孩子|女儿|儿子)/;
const elderRolePattern = /(老人|父亲|母亲|爸爸|妈妈|公公|婆婆|岳父|岳母|爷爷|奶奶|外公|外婆)/;
const rulesDocPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../docs/family-policy-report-deepseek-rules-v1.md');

const reportCache = new Map();
let rulesTextPromise = null;

function trimString(value) {
  return String(value || '').trim();
}

function withCode(error, code) {
  error.code = code;
  return error;
}

function nowMs() {
  return Date.now();
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

function buildModelChain(config) {
  const seen = new Set();
  return [config.model, config.fallbackModel].filter((model) => {
    const value = trimString(model);
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function getCachedReport(cacheKey) {
  const cached = reportCache.get(cacheKey);
  if (!cached) return null;
  if (cached.expiresAt <= nowMs()) {
    reportCache.delete(cacheKey);
    return null;
  }
  return {
    ...cached.value,
    cached: true,
  };
}

function setCachedReport(cacheKey, value) {
  reportCache.set(cacheKey, {
    value,
    expiresAt: nowMs() + CACHE_TTL_MS,
  });
}

function hasMeaningfulValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function canonicalizeFamilyPolicyInput(rawInput = {}) {
  const raw = rawInput && typeof rawInput === 'object' ? rawInput : {};
  const pick = (...keys) => {
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(raw, key) && raw[key] !== undefined) return raw[key];
    }
    return undefined;
  };

  const knownKeys = new Set([
    'reportName',
    'report_name',
    'reportDate',
    'report_date',
    'generatorName',
    'generator_name',
    'familyProfile',
    'family_profile',
    'scoreSummary',
    'score_summary',
    'policyFacts',
    'policy_facts',
    'policies',
    'policy',
    'analysisFacts',
    'analysis_facts',
    'memberDiagnosis',
    'member_diagnosis',
    'members',
    'recommendationCandidates',
    'recommendation_candidates',
    'boundaryNotes',
    'boundary_notes',
    'ocrText',
    'ocr_text',
    'policyText',
    'policy_text',
    'detailMode',
    'detail_mode',
  ]);

  const policyFacts = pick('policy_facts', 'policyFacts') || pick('policies') || (pick('policy') ? [pick('policy')] : undefined);
  const memberDiagnosis = pick('member_diagnosis', 'memberDiagnosis') || pick('members');

  const canonical = {
    report_name: pick('report_name', 'reportName') || '家庭保障体检报告',
    report_date: pick('report_date', 'reportDate') || '',
    generator_name: pick('generator_name', 'generatorName') || '',
    family_profile: pick('family_profile', 'familyProfile') || {},
    score_summary: pick('score_summary', 'scoreSummary') || {},
    policy_facts: Array.isArray(policyFacts) ? policyFacts : [],
    analysis_facts: pick('analysis_facts', 'analysisFacts') || {},
    member_diagnosis: Array.isArray(memberDiagnosis) ? memberDiagnosis : [],
    recommendation_candidates: Array.isArray(pick('recommendation_candidates', 'recommendationCandidates'))
      ? pick('recommendation_candidates', 'recommendationCandidates')
      : [],
    boundary_notes: Array.isArray(pick('boundary_notes', 'boundaryNotes')) ? pick('boundary_notes', 'boundaryNotes') : [],
    ocr_text: trimString(pick('ocr_text', 'ocrText')),
    policy_text: trimString(pick('policy_text', 'policyText')),
    detail_mode: trimString(pick('detail_mode', 'detailMode')),
  };

  for (const [key, value] of Object.entries(raw)) {
    if (knownKeys.has(key)) continue;
    canonical[key] = value;
  }

  return canonical;
}

function nextAliasForRole(role = '', state) {
  if (/配偶/.test(role)) return '配偶';
  if (/本人/.test(role)) return '本人';
  if (childRolePattern.test(role)) {
    state.child += 1;
    return `子女${state.child}`;
  }
  if (elderRolePattern.test(role)) {
    state.elder += 1;
    return `老人${state.elder}`;
  }
  state.member += 1;
  return `家庭成员${state.member}`;
}

function collectNameAliases(source, aliasMap = new Map(), state = { child: 0, elder: 0, member: 0 }) {
  if (Array.isArray(source)) {
    for (const item of source) collectNameAliases(item, aliasMap, state);
    return aliasMap;
  }
  if (!source || typeof source !== 'object') return aliasMap;

  const role = String(source.role || source.relation || source.memberRole || '');
  const candidates = [source.name, source.customer_name, source.applicant, source.insured, source.policyholder, source.holder];
  for (const value of candidates) {
    if (typeof value !== 'string' || !value.trim()) continue;
    const original = value.trim();
    if (aliasMap.has(original)) continue;
    aliasMap.set(original, nextAliasForRole(role, state));
  }

  for (const value of Object.values(source)) collectNameAliases(value, aliasMap, state);
  return aliasMap;
}

function maskString(value, aliasMap) {
  let result = String(value);
  for (const [original, alias] of aliasMap.entries()) {
    if (!original) continue;
    result = result.split(original).join(alias);
  }
  return result
    .replace(/\b1[3-9]\d{9}\b/g, '[已脱敏手机号]')
    .replace(/\b\d{17}[\dXx]\b/g, '[已脱敏身份证号]')
    .replace(/\b\d{15}\b/g, '[已脱敏证件号]');
}

function sanitizeForLLM(source, aliasMap) {
  if (Array.isArray(source)) {
    return source.map((item) => sanitizeForLLM(item, aliasMap));
  }
  if (typeof source === 'string') {
    return maskString(source, aliasMap);
  }
  if (source === null || typeof source !== 'object') {
    return source;
  }

  const result = {};
  for (const [key, value] of Object.entries(source)) {
    if (piiFieldPattern.test(key) && !nonPiiNameFields.has(key)) {
      if (/(family_name)/i.test(key)) {
        result[key] = '受测家庭';
      } else if (/(?:name)/i.test(key)) {
        const original = typeof value === 'string' ? value.trim() : '';
        result[key] = aliasMap.get(original) || '[已脱敏姓名]';
      } else if (/(phone|mobile|tel|telephone|email|mail|wechat|wx)/i.test(key)) {
        result[key] = '[已脱敏联系方式]';
      } else {
        result[key] = '[已脱敏证件信息]';
      }
      continue;
    }

    if (personAliasFields.has(key) && typeof value === 'string') {
      result[key] = aliasMap.get(value.trim()) || '家庭成员';
      continue;
    }

    result[key] = sanitizeForLLM(value, aliasMap);
  }
  return result;
}

function detectPolicyDetailLevel(input) {
  const manualMode = trimString(input.detail_mode);
  if (manualMode === 'detailed' || manualMode === 'partial' || manualMode === 'basic') {
    return {
      level: manualMode,
      reason: `由调用方显式指定为 ${manualMode} 模式`,
    };
  }

  const policies = Array.isArray(input.policy_facts) ? input.policy_facts : [];
  const detailedKeys = [
    'coverage_details',
    'responsibility_details',
    'benefit_summary',
    'clause_text',
    'ocr_text',
    'ocr_excerpt',
    'policy_text',
    'liability_text',
    'coverage_text',
    'official_public_reference',
  ];
  const partialKeys = ['mapping_summary', 'known_from_user', 'coverage_hints', 'benefit_hints', 'product_type_hint', 'user_summary'];

  let detailedScore = 0;
  let partialScore = 0;

  if (trimString(input.ocr_text) || trimString(input.policy_text)) detailedScore += 1;

  for (const policy of policies) {
    for (const key of detailedKeys) {
      if (hasMeaningfulValue(policy?.[key])) detailedScore += 1;
    }
    for (const key of partialKeys) {
      if (hasMeaningfulValue(policy?.[key])) partialScore += 1;
    }
  }

  if (detailedScore > 0) {
    return {
      level: 'detailed',
      reason: '检测到责任摘要、OCR/条款摘录或官方责任信息，按详细信息模式处理',
    };
  }
  if (partialScore > 0 || policies.length > 0 || hasMeaningfulValue(input.analysis_facts) || hasMeaningfulValue(input.member_diagnosis)) {
    return {
      level: 'partial',
      reason: '检测到部分保单事实或保障提示，按部分信息模式处理',
    };
  }
  return {
    level: 'basic',
    reason: '仅检测到基础家庭或产品信息，按基础信息模式处理',
  };
}

async function loadRulesText() {
  if (!rulesTextPromise) {
    rulesTextPromise = readFile(rulesDocPath, 'utf8').catch((error) => {
      rulesTextPromise = null;
      throw error;
    });
  }
  return rulesTextPromise;
}

function buildMessages({ input, rulesText }) {
  const systemPrompt = [
    '你是一名非常克制、专业、有人情味的家庭保障顾问。',
    '你不会恐吓客户，也不会把报告写成销售文案。',
    '你会先看到这个家已经做对了什么，再指出最值得先补的一层保护。',
    '你必须严格基于输入事实写作，不允许臆测、不允许补编。',
    '你写出来的报告要让客户感到：你看到的是这个家，而不是一堆保单。',
    '你的每个重点结论都必须有依据，必须把事实、险种功能和判断逻辑连起来。',
    '输入数据已经做过隐私脱敏，不包含姓名、身份证号、手机号等个人基础信息。',
    '你不得补写任何真实姓名、手机号、身份证号，也不要假设客户身份信息。',
    '如果输入中存在详细责任信息、OCR摘要或条款摘录，必须优先采用这些详细信息。',
    '如果输入只有部分信息，也必须生成报告，但要把“已确认”“初步判断”“待确认”区分清楚。',
    '最终报告中，不要出现“AI”“DeepSeek”“模型”“大模型”“智能生成”等字眼。',
    '',
    '下面是完整的业务规则、语气规则和输出结构，你必须遵守：',
    '',
    rulesText,
  ].join('\n');

  const userPrompt = [
    '请基于下面的结构化家庭保障数据，生成一份《家庭保障体检报告》。',
    '',
    '要求：',
    '1. 使用简体中文',
    '2. 输出 Markdown',
    '3. 语气要有温度，但不能煽情和推销',
    '4. 只根据提供的数据写，不要臆测',
    '5. 先肯定，再提醒，再建议',
    '6. 建议只给轻重缓急，不要列大而全清单',
    '7. 不要使用“必须马上买”“严重错误配置”等压迫式措辞',
    '8. 允许引用总分，但不能把分数放在开头第一句',
    '9. 缺少信息时，要明确写“暂无法确认”',
    '10. 不要输出任何执行说明、过程说明或自我介绍',
    '11. 不要出现“好的”“下面是”“我将”“我会”“为您生成”等开场白',
    '12. 直接从报告标题或报告正文开始输出',
    '13. 不要使用空泛表达，例如“风险管理意识”“安全网”“筑牢防线”“更稳一些”',
    '14. 每个主要判断都要说明“为什么这么判断”',
    '15. 尽量用“因为……所以……”或“已知……因此……”把事实和判断连起来',
    '16. 如果是基于产品名称做推断，必须明确说明这是初步判断',
    '17. 当你判断保障缺口时，要讲清楚险种功能差异，例如重疾给付不等于医疗报销',
    '18. 建议先说保障层或风险层，不要一上来直接推荐具体产品名',
    '19. 如需举例产品类型，放在括号中轻描淡写带过，不要写成销售口径',
    '20. 如果 `_input_meta.policy_detail_level` 是 `detailed`，优先使用详细责任信息，不要退回到产品名推断',
    '21. 如果 `_input_meta.policy_detail_level` 是 `partial` 或 `basic`，报告必须显式区分已确认和待确认，不要把弱信息写成强结论',
    '22. 报告正文里不要出现“AI”“DeepSeek”“模型”“系统生成”“智能分析”等字眼',
    '23. 请结合输入中的家庭结构、投保人维度、图表事实和保单明细表来写，不要只复述一段总括',
    '24. 正文中允许引用“家庭结构”“投保人维度”“保单明细”这些章节名称，但不要输出程序字段名',
    '',
    '结构化数据如下：',
    '```json',
    JSON.stringify(input, null, 2),
    '```',
  ].join('\n');

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
}

function buildCacheKey({ input, modelChain }) {
  const hash = crypto
    .createHash('sha1')
    .update(
      JSON.stringify({
        reportVersion: REPORT_VERSION,
        modelChain,
        input,
      }),
    )
    .digest('hex');
  return `family-policy-report:${modelChain.join('->')}:${hash}`;
}

function buildStoredReportFingerprint({ input, modelChain }) {
  return crypto
    .createHash('sha1')
    .update(
      JSON.stringify({
        reportVersion: REPORT_VERSION,
        modelChain,
        input,
      }),
    )
    .digest('hex');
}

function normalizeStoredResult(record) {
  return {
    reportId: Number(record.id || 0) || undefined,
    reportMarkdown: String(record.reportMarkdown || ''),
    sanitizedInput: record.sanitizedInput && typeof record.sanitizedInput === 'object' ? record.sanitizedInput : {},
    meta: {
      privacyMode: record.meta?.privacyMode || 'desensitized',
      policyDetailLevel: record.meta?.policyDetailLevel || 'partial',
      policyDetailReason: record.meta?.policyDetailReason || '',
      model: String(record.meta?.model || ''),
      generatedAt: record.generatedAt || record.meta?.generatedAt || record.updatedAt || new Date().toISOString(),
    },
    cached: false,
    stored: true,
    reused: true,
  };
}

function findStoredReport({ tenantId, customerId, scopeKey, fingerprint }) {
  const state = getState();
  const reports = Array.isArray(state.familyPolicyReports) ? state.familyPolicyReports : [];
  return reports.find(
    (row) =>
      Number(row?.tenantId || 1) === Number(tenantId || 1) &&
      Number(row?.customerId || 0) === Number(customerId || 0) &&
      String(row?.scopeKey || REPORT_SCOPE_KEY) === String(scopeKey || REPORT_SCOPE_KEY) &&
      String(row?.fingerprint || '') === String(fingerprint || ''),
    ) || null;
}

async function storeGeneratedReport({
  tenantId,
  customerId,
  scopeKey = REPORT_SCOPE_KEY,
  fingerprint,
  llmInput,
  reportMarkdown,
  meta,
}) {
  if (!Number.isFinite(Number(customerId)) || Number(customerId) <= 0) {
    return null;
  }

  return runInStateTransaction(() => {
    const state = getState();
    if (!Array.isArray(state.familyPolicyReports)) state.familyPolicyReports = [];

    const generatedAt = meta?.generatedAt || new Date().toISOString();
    const policyCount = Array.isArray(llmInput?.policy_facts) ? llmInput.policy_facts.length : 0;
    const memberCount =
      Array.isArray(llmInput?.member_diagnosis) && llmInput.member_diagnosis.length
        ? llmInput.member_diagnosis.length
        : Number(llmInput?.family_profile?.member_count || 0) || 0;
    const record = {
      id: 0,
      tenantId: Number(tenantId || 1),
      customerId: Number(customerId || 0),
      scopeKey: String(scopeKey || REPORT_SCOPE_KEY),
      reportVersion: REPORT_VERSION,
      fingerprint: String(fingerprint || ''),
      policyCount,
      memberCount,
      reportMarkdown,
      sanitizedInput: llmInput,
      meta,
      generatedAt,
      createdAt: generatedAt,
      updatedAt: generatedAt,
    };

    const existingIndex = state.familyPolicyReports.findIndex(
      (row) =>
        Number(row?.tenantId || 1) === record.tenantId &&
        Number(row?.customerId || 0) === record.customerId &&
        String(row?.scopeKey || REPORT_SCOPE_KEY) === record.scopeKey,
    );

    if (existingIndex >= 0) {
      const current = state.familyPolicyReports[existingIndex] || {};
      const nextRecord = {
        ...current,
        ...record,
        id: Number(current.id || 0) || nextId(state.familyPolicyReports),
        createdAt: current.createdAt || generatedAt,
        updatedAt: generatedAt,
      };
      state.familyPolicyReports[existingIndex] = nextRecord;
      return nextRecord;
    }

    const nextRecord = {
      ...record,
      id: nextId(state.familyPolicyReports),
    };
    state.familyPolicyReports.push(nextRecord);
    return nextRecord;
  });
}

function normalizeMarkdown(content) {
  const normalized = trimString(content);
  if (!normalized) {
    throw withCode(new Error('FAMILY_POLICY_REPORT_EMPTY'), 'FAMILY_POLICY_REPORT_EMPTY');
  }
  return normalized;
}

function toNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function formatMoney(value) {
  return `¥${toNumber(value).toLocaleString('zh-CN')}`;
}

function formatCoverage(value) {
  const amount = toNumber(value);
  if (amount <= 0) return '暂无明确保额';
  if (amount >= 10000) return `${(amount / 10000).toFixed(2)} 万`;
  return `${amount.toLocaleString('zh-CN')} 元`;
}

function fallbackAdviceForNeed(label) {
  if (label === '健康') return '优先确认重疾给付和医疗报销是否都已经覆盖，不要把两类功能混成一层。';
  if (label === '人寿') return '优先确认家庭收入责任主要由谁承担，再看身故/全残责任是否足够承接。';
  if (label === '养老') return '优先确认退休后的长期现金流目标，再决定是否补长期储备或年金安排。';
  if (label === '财富') return '优先确认教育金、传承或长期储蓄目标，避免把所有保单都当成同一种资产工具。';
  if (label === '意外') return '优先确认高频出行、家庭主要收入者和老人孩子的意外责任是否有基础覆盖。';
  return '优先结合家庭目标确认这一层需求是否需要补位。';
}

function buildLocalFamilyPolicyReportMarkdown(input) {
  const policies = Array.isArray(input?.policy_facts) ? input.policy_facts : [];
  const familyName = trimString(input?.family_profile?.family_name) || '这个家庭';
  const scopeLabel = trimString(input?.family_profile?.scope_label) || '当前已录入保单';
  const derivedMemberCount = new Set(
    policies
      .map((item) => trimString(item?.insured || item?.insured_name || item?.member_name))
      .filter(Boolean),
  ).size;
  const derivedApplicantCount = new Set(
    policies
      .map((item) => trimString(item?.applicant || item?.applicant_name))
      .filter(Boolean),
  ).size;
  const memberCount = toNumber(input?.family_profile?.member_count) || derivedMemberCount;
  const policyCount = toNumber(input?.family_profile?.total_policy_count || input?.score_summary?.active_policy_count) || policies.length;
  const applicantCount = toNumber(input?.family_profile?.applicant_count) || derivedApplicantCount;
  const totalPremium =
    toNumber(input?.score_summary?.annual_premium_total) ||
    policies.reduce((sum, item) => sum + toNumber(item?.annual_premium), 0);
  const totalCoverage =
    toNumber(input?.score_summary?.coverage_total) ||
    policies.reduce((sum, item) => sum + toNumber(item?.coverage_amount || item?.sum_assured), 0);
  const protectionDistribution = Array.isArray(input?.chart_facts?.protection_distribution) ? input.chart_facts.protection_distribution : [];
  const insuranceNeedAxes = Array.isArray(input?.chart_facts?.insurance_need_axes) ? input.chart_facts.insurance_need_axes : [];
  const memberDiagnosis = Array.isArray(input?.member_diagnosis) ? input.member_diagnosis : [];
  const applicantSummary = Array.isArray(input?.applicant_summary) ? input.applicant_summary : [];
  const boundaryNotes = Array.isArray(input?.boundary_notes) ? input.boundary_notes : [];

  const topProtection = [...protectionDistribution]
    .sort((a, b) => toNumber(b.coverage_amount) - toNumber(a.coverage_amount) || toNumber(b.policy_count) - toNumber(a.policy_count))
    .slice(0, 2);
  const sortedNeedAxes = [...insuranceNeedAxes].sort((a, b) => toNumber(b.score) - toNumber(a.score));
  const strongestNeed = sortedNeedAxes[0];
  const weakestNeeds = [...insuranceNeedAxes]
    .sort((a, b) => toNumber(a.score) - toNumber(b.score))
    .slice(0, 2)
    .filter((item) => trimString(item?.dimension));
  const keyMember = [...memberDiagnosis]
    .sort((a, b) => toNumber(b.coverage_amount) - toNumber(a.coverage_amount) || toNumber(b.policy_count) - toNumber(a.policy_count))[0];
  const keyApplicant = [...applicantSummary]
    .sort((a, b) => toNumber(b.policy_count) - toNumber(a.policy_count) || toNumber(b.annual_premium) - toNumber(a.annual_premium))[0];

  const confirmed = [
    `当前按「${scopeLabel}」口径，已录入 ${policyCount} 张保单，覆盖 ${memberCount} 位家庭成员、${applicantCount} 位投保人。`,
    `已录入保单对应的年度保费合计约 ${formatMoney(totalPremium)}，当前可识别保额合计约 ${formatCoverage(totalCoverage)}。`,
  ];
  if (topProtection.length) {
    confirmed.push(
      `从现有保单看，保障配置主要集中在${topProtection
        .map((item) => `${trimString(item.type) || '未标注类型'}（${toNumber(item.policy_count)} 张）`)
        .join('、')}。`
    );
  }
  if (strongestNeed?.dimension) {
    confirmed.push(
      `按当前录入信息做结构评分，${strongestNeed.dimension}这一层相对更完整，当前得分 ${toNumber(strongestNeed.score)} 分。`
    );
  }
  if (keyMember?.member_name) {
    confirmed.push(
      `${trimString(keyMember.member_name)}当前名下已录入 ${toNumber(keyMember.policy_count)} 张保单，可识别保额约 ${formatCoverage(keyMember.coverage_amount)}。`
    );
  }

  const reminders = [];
  if (weakestNeeds.length) {
    reminders.push(
      `当前更值得优先确认的是${weakestNeeds.map((item) => `${trimString(item.dimension)}（${toNumber(item.score)} 分）`).join('、')}这几层需求是否已经被真正覆盖。`
    );
  }
  if (protectionDistribution.length <= 1) {
    reminders.push('现有保障类型比较集中，说明这个家已经开始配置，但还不能直接等同于保障结构完整。');
  }
  if (keyApplicant?.applicant_name) {
    reminders.push(
      `从投保人维度看，${trimString(keyApplicant.applicant_name)}名下保单相对更集中，建议后续确认家庭责任是否也主要由这一位承担。`
    );
  }
  if (!reminders.length) {
    reminders.push('当前已录入信息足够支持初步判断，但仍建议结合家庭责任和预算目标确认优先级。');
  }

  const actions = [];
  if (weakestNeeds.length) {
    weaksetLoop: for (const item of weakestNeeds) {
      const label = trimString(item.dimension);
      if (!label) continue weaksetLoop;
      actions.push(`先看${label}：${fallbackAdviceForNeed(label)}`);
    }
  }
  actions.push('再回到家庭成员维度确认：老人、孩子和主要收入者是否都已经有对应安排。');
  actions.push('最后再讨论具体产品，不要直接把“已有保单”理解成“这个家已经配齐”。');

  const notes = [
    `这份书面整理基于当前已录入的家庭结构、投保人关系、保障分布和保单清单生成。`,
    '它更适合拿来做家庭保障盘点和业务沟通，不直接替代正式核保、条款审核或理赔结论。',
    ...boundaryNotes.map((item) => trimString(item)).filter(Boolean),
  ];

  return normalizeMarkdown(
    [
      '# 家庭保障体检报告',
      '',
      `> 对象：${familyName}`,
      '',
      '### 已确认的情况',
      ...confirmed.map((item) => `- ${item}`),
      '',
      '### 当前更值得确认的地方',
      ...reminders.map((item) => `- ${item}`),
      '',
      '### 建议先做的动作',
      ...actions.slice(0, 3).map((item, index) => `${index + 1}. ${item}`),
      '',
      '### 口径说明',
      ...notes.map((item) => `- ${item}`),
    ].join('\n'),
  );
}

async function finalizeGeneratedReport({ cacheKey, storageFingerprint, storageScope, llmInput, reportMarkdown, meta }) {
  const result = {
    reportId: undefined,
    reportMarkdown,
    sanitizedInput: llmInput,
    meta,
    cached: false,
    stored: false,
    reused: false,
  };
  const stored = await storeGeneratedReport({
    ...storageScope,
    fingerprint: storageFingerprint,
    llmInput,
    reportMarkdown,
    meta,
  });
  const normalized = stored
    ? {
        ...result,
        reportId: Number(stored.id || 0) || undefined,
        stored: true,
      }
    : result;
  setCachedReport(cacheKey, normalized);
  return normalized;
}

async function buildLocalFallbackResult({ cacheKey, storageFingerprint, storageScope, llmInput, detail }) {
  const generatedAt = new Date().toISOString();
  return finalizeGeneratedReport({
    cacheKey,
    storageFingerprint,
    storageScope,
    llmInput,
    reportMarkdown: buildLocalFamilyPolicyReportMarkdown(llmInput),
    meta: {
      privacyMode: 'desensitized',
      policyDetailLevel: detail.level,
      policyDetailReason: detail.reason,
      model: 'local-rule-report',
      generatedAt,
    },
  });
}

function prepareFamilyPolicyReportContext({ input = {}, reportOwner = null }) {
  const canonicalInput = canonicalizeFamilyPolicyInput(input);
  const aliasMap = collectNameAliases(canonicalInput);
  const sanitizedInput = sanitizeForLLM(canonicalInput, aliasMap);
  const detail = detectPolicyDetailLevel(sanitizedInput);
  const llmInput = {
    ...sanitizedInput,
    _input_meta: {
      privacy_mode: 'desensitized',
      policy_detail_level: detail.level,
      policy_detail_reason: detail.reason,
    },
  };

  const config = getConfig();
  const modelChain = buildModelChain(config);
  const cacheKey = buildCacheKey({ input: llmInput, modelChain });
  const storageFingerprint = buildStoredReportFingerprint({ input: llmInput, modelChain });
  const storageScope = {
    tenantId: Number(reportOwner?.tenantId || 1),
    customerId: Number(reportOwner?.customerId || 0),
    scopeKey: String(reportOwner?.scopeKey || REPORT_SCOPE_KEY),
  };
  return {
    canonicalInput,
    sanitizedInput,
    detail,
    llmInput,
    config,
    modelChain,
    cacheKey,
    storageFingerprint,
    storageScope,
  };
}

function resolveExistingFamilyPolicyReport({ cacheKey, storageScope, storageFingerprint }) {
  const storedReport = findStoredReport({
    ...storageScope,
    fingerprint: storageFingerprint,
  });
  if (storedReport) {
    const normalized = normalizeStoredResult(storedReport);
    setCachedReport(cacheKey, normalized);
    return normalized;
  }

  const cached = getCachedReport(cacheKey);
  if (cached) return cached;
  return null;
}

export async function resolveStoredFamilyPolicyReport({ input = {}, reportOwner = null }) {
  const prepared = prepareFamilyPolicyReportContext({ input, reportOwner });
  return resolveExistingFamilyPolicyReport(prepared);
}

export async function generateFamilyPolicyReport({ input = {}, reportOwner = null, fetchImpl = fetch }) {
  const prepared = prepareFamilyPolicyReportContext({ input, reportOwner });
  const { detail, llmInput, config, modelChain, cacheKey, storageFingerprint, storageScope } = prepared;
  const existingReport = resolveExistingFamilyPolicyReport(prepared);
  if (existingReport) return existingReport;

  if (!config.apiKey) {
    return buildLocalFallbackResult({
      cacheKey,
      storageFingerprint,
      storageScope,
      llmInput,
      detail,
    });
  }

  let rulesText = '';
  try {
    rulesText = await loadRulesText();
  } catch {
    return buildLocalFallbackResult({
      cacheKey,
      storageFingerprint,
      storageScope,
      llmInput,
      detail,
    });
  }

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
          temperature: 0.3,
          max_tokens: 3600,
          messages: buildMessages({
            input: llmInput,
            rulesText,
          }),
        }),
      });

      if (!response.ok) {
        const bodyText = trimString(await response.text());
        const error = new Error(`FAMILY_POLICY_REPORT_UPSTREAM_${response.status}:${bodyText || 'upstream_error'}`);
        error.code = 'FAMILY_POLICY_REPORT_UPSTREAM_FAILED';
        throw error;
      }

      const payload = await response.json();
      const reportMarkdown = normalizeMarkdown(payload?.choices?.[0]?.message?.content);
      const result = {
        cacheKey,
        storageFingerprint,
        storageScope,
        llmInput,
        reportMarkdown,
        meta: {
          privacyMode: 'desensitized',
          policyDetailLevel: detail.level,
          policyDetailReason: detail.reason,
          model: String(payload?.model || model),
          generatedAt: new Date().toISOString(),
        },
      };
      return finalizeGeneratedReport(result);
    } catch (error) {
      if (error?.name === 'AbortError') {
        lastError = withCode(new Error('FAMILY_POLICY_REPORT_TIMEOUT'), 'FAMILY_POLICY_REPORT_TIMEOUT');
      } else if (error?.code) {
        lastError = error;
      } else {
        lastError = withCode(error instanceof Error ? error : new Error('FAMILY_POLICY_REPORT_FAILED'), 'FAMILY_POLICY_REPORT_FAILED');
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return buildLocalFallbackResult({
    cacheKey,
    storageFingerprint,
    storageScope,
    llmInput,
    detail,
    error: lastError || withCode(new Error('FAMILY_POLICY_REPORT_FAILED'), 'FAMILY_POLICY_REPORT_FAILED'),
  });
}
