import type { InsurancePolicy } from './api';

type BuildFamilyPolicyReportOptions = {
  customerName?: string;
  reportName?: string;
  scopeLabel?: string;
};

export type FamilyMemberSummary = {
  name: string;
  role: string;
  policyCount: number;
  annualPremium: number;
  coverage: number;
  protectionTypes: string[];
};

export type ApplicantSummary = {
  name: string;
  role: string;
  policyCount: number;
  annualPremium: number;
  coverage: number;
  insuredMembers: string[];
  protectionTypes: string[];
};

export type ProtectionDistributionItem = {
  type: string;
  coverage: number;
  annualPremium: number;
  policyCount: number;
};

export type PremiumTimelinePoint = {
  key: string;
  label: string;
  annualPremium: number;
  policyCount: number;
};

export type InsuranceNeedAxis = {
  key: 'health' | 'life' | 'retirement' | 'wealth' | 'accident';
  label: string;
  score: number;
  policyCount: number;
  annualPremium: number;
  coverage: number;
  guidance: string;
};

export type FamilyStructureNode = {
  id: string;
  name: string;
  role: string;
  generation: number;
  isApplicant: boolean;
  isInsured: boolean;
};

export type FamilyStructureLink = {
  source: string;
  target: string;
  count: number;
};

export type PolicyContentRow = {
  id: number;
  company: string;
  name: string;
  type: string;
  policyNo: string;
  applicant: string;
  applicantRelation: string;
  insured: string;
  insuredRelation: string;
  status: string;
  period: string;
  annualPremium: number;
  amount: number;
  responsibilities: string;
};

const INSURANCE_NEED_BUCKETS: Array<{
  key: InsuranceNeedAxis['key'];
  label: string;
  matcher: RegExp;
  coverageTarget: number;
  annualPremiumTarget: number;
  guidance: string;
}> = [
  {
    key: 'retirement',
    label: '养老',
    matcher: /养老|年金|退休|养老金|退休金/,
    coverageTarget: 800000,
    annualPremiumTarget: 12000,
    guidance: '看长期现金流和退休储备是否成型',
  },
  {
    key: 'wealth',
    label: '财富',
    matcher: /增额|财富|理财|传承|分红|万能|教育金|婚嫁金|储蓄/,
    coverageTarget: 800000,
    annualPremiumTarget: 12000,
    guidance: '看财富保全、教育金或传承安排是否成型',
  },
  {
    key: 'accident',
    label: '意外',
    matcher: /意外|伤残|交通意外|航空意外/,
    coverageTarget: 800000,
    annualPremiumTarget: 3000,
    guidance: '看突发事故的短期冲击是否被覆盖',
  },
  {
    key: 'health',
    label: '健康',
    matcher: /医疗|住院|门急诊|百万|防癌|重疾|疾病|津贴/,
    coverageTarget: 3000000,
    annualPremiumTarget: 6000,
    guidance: '看重疾与医疗的组合是不是足够完整',
  },
  {
    key: 'life',
    label: '人寿',
    matcher: /寿险|身故|全残|定寿|终身寿|长期责任/,
    coverageTarget: 1000000,
    annualPremiumTarget: 8000,
    guidance: '看家庭收入责任和长期责任承接是否充分',
  },
];

function safeText(value: unknown, fallback = '-') {
  const text = String(value || '').trim();
  return text || fallback;
}

function normalizeRoleLabel(value: string) {
  if (/本人/.test(value)) return '本人';
  if (/配偶|老公|老婆|丈夫|妻子/.test(value)) return '配偶';
  if (/子女|儿子|女儿|孩子/.test(value)) return '子女';
  if (/父母|母亲|父亲|爸爸|妈妈|老人|爷爷|奶奶|外公|外婆/.test(value)) return '老人';
  return '家庭成员';
}

function fallbackMemberName(policy: InsurancePolicy) {
  const role = inferMemberRole(policy);
  if (role === '本人') return '本人';
  if (role === '配偶') return '配偶';
  if (role === '子女') return '子女';
  if (role === '老人') return '老人';
  return '未标注家庭成员';
}

function resolveMemberName(policy: InsurancePolicy) {
  const insured = safeText(policy.insured, '');
  if (insured) return insured;
  const applicant = safeText(policy.applicant, '');
  if (applicant) return applicant;
  return fallbackMemberName(policy);
}

export function inferMemberRole(policy: InsurancePolicy) {
  const relation = `${policy.insuredRelation || ''} ${policy.applicantRelation || ''}`.trim();
  const insuredName = safeText(policy.insured, '');
  const applicantName = safeText(policy.applicant, '');
  if (/本人/.test(relation) || (!relation && insuredName && insuredName === applicantName)) return '本人';
  if (/配偶|老公|老婆|丈夫|妻子/.test(relation)) return '配偶';
  if (/子女|儿子|女儿|孩子/.test(relation)) return '子女';
  if (/父母|母亲|父亲|爸爸|妈妈|老人|爷爷|奶奶|外公|外婆/.test(relation)) return '老人';
  return '家庭成员';
}

function inferApplicantRole(policy: InsurancePolicy) {
  const applicantRelation = safeText(policy.applicantRelation, '');
  if (applicantRelation !== '-') return normalizeRoleLabel(applicantRelation);
  const applicantName = safeText(policy.applicant, '');
  const insuredName = safeText(policy.insured, '');
  if (applicantName && insuredName && applicantName === insuredName) return '本人';
  return inferMemberRole(policy);
}

export function inferProtectionType(policy: InsurancePolicy) {
  const text = `${policy.type} ${policy.name} ${(policy.responsibilities || []).map((item) => item.name).join(' ')}`;
  if (/医疗|住院|门急诊|百万/.test(text)) return '医疗保障';
  if (/重疾|癌症|疾病|防癌/.test(text)) return '重疾保障';
  if (/意外/.test(text)) return '意外保障';
  if (/寿险|身故|全残|终身|定期|年金/.test(text)) return '身故/长期责任';
  return '综合保障';
}

function inferInsuranceNeedBucket(policy: InsurancePolicy): InsuranceNeedAxis['key'] {
  const text = `${policy.type} ${policy.name} ${(policy.responsibilities || []).map((item) => item.name).join(' ')}`;
  const matched = INSURANCE_NEED_BUCKETS.find((bucket) => bucket.matcher.test(text));
  return matched?.key || 'health';
}

export function formatCurrency(value: number) {
  return `¥${Number(value || 0).toLocaleString('zh-CN')}`;
}

export function formatCoverageAmount(value: number) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return '-';
  if (amount >= 10000) return `${(amount / 10000).toFixed(2)}万`;
  return `${amount.toLocaleString('zh-CN')}`;
}

export function summarizePolicyMembers(policies: InsurancePolicy[]): FamilyMemberSummary[] {
  const memberMap = new Map<
    string,
    {
      name: string;
      role: string;
      policyCount: number;
      annualPremium: number;
      coverage: number;
      protectionTypes: Set<string>;
    }
  >();

  for (const policy of policies) {
    const name = resolveMemberName(policy);
    const role = inferMemberRole(policy);
    const key = `${name}::${role}`;
    const current = memberMap.get(key) || {
      name,
      role,
      policyCount: 0,
      annualPremium: 0,
      coverage: 0,
      protectionTypes: new Set<string>(),
    };
    current.policyCount += 1;
    current.annualPremium += Number(policy.annualPremium || 0);
    current.coverage += Number(policy.amount || 0);
    current.protectionTypes.add(inferProtectionType(policy));
    memberMap.set(key, current);
  }

  return [...memberMap.values()].map((member) => ({
    name: member.name,
    role: member.role,
    policyCount: member.policyCount,
    annualPremium: member.annualPremium,
    coverage: member.coverage,
    protectionTypes: [...member.protectionTypes],
  }));
}

export function summarizePoliciesByApplicant(policies: InsurancePolicy[]): ApplicantSummary[] {
  const applicantMap = new Map<
    string,
    {
      name: string;
      role: string;
      policyCount: number;
      annualPremium: number;
      coverage: number;
      insuredMembers: Set<string>;
      protectionTypes: Set<string>;
    }
  >();

  for (const policy of policies) {
    const applicantName = safeText(policy.applicant, resolveMemberName(policy));
    const role = inferApplicantRole(policy);
    const key = `${applicantName}::${role}`;
    const current = applicantMap.get(key) || {
      name: applicantName,
      role,
      policyCount: 0,
      annualPremium: 0,
      coverage: 0,
      insuredMembers: new Set<string>(),
      protectionTypes: new Set<string>(),
    };
    current.policyCount += 1;
    current.annualPremium += Number(policy.annualPremium || 0);
    current.coverage += Number(policy.amount || 0);
    current.insuredMembers.add(resolveMemberName(policy));
    current.protectionTypes.add(inferProtectionType(policy));
    applicantMap.set(key, current);
  }

  return [...applicantMap.values()]
    .map((item) => ({
      name: item.name,
      role: item.role,
      policyCount: item.policyCount,
      annualPremium: item.annualPremium,
      coverage: item.coverage,
      insuredMembers: [...item.insuredMembers],
      protectionTypes: [...item.protectionTypes],
    }))
    .sort((a, b) => b.policyCount - a.policyCount || b.annualPremium - a.annualPremium);
}

export function buildProtectionDistribution(policies: InsurancePolicy[]): ProtectionDistributionItem[] {
  const distribution = new Map<string, ProtectionDistributionItem>();
  for (const policy of policies) {
    const type = inferProtectionType(policy);
    const current = distribution.get(type) || {
      type,
      coverage: 0,
      annualPremium: 0,
      policyCount: 0,
    };
    current.coverage += Number(policy.amount || 0);
    current.annualPremium += Number(policy.annualPremium || 0);
    current.policyCount += 1;
    distribution.set(type, current);
  }
  return [...distribution.values()].sort((a, b) => b.coverage - a.coverage || b.policyCount - a.policyCount);
}

function extractTimelineKey(policy: InsurancePolicy) {
  const candidates = [policy.nextPayment, policy.periodStart, policy.periodEnd];
  for (const candidate of candidates) {
    const raw = String(candidate || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw.slice(0, 7);
  }
  return '未标注';
}

export function buildPremiumTimeline(policies: InsurancePolicy[]): PremiumTimelinePoint[] {
  const timeline = new Map<string, PremiumTimelinePoint>();
  for (const policy of policies) {
    const key = extractTimelineKey(policy);
    const current = timeline.get(key) || {
      key,
      label: key === '未标注' ? '未标注' : key.replace('-', '.'),
      annualPremium: 0,
      policyCount: 0,
    };
    current.annualPremium += Number(policy.annualPremium || 0);
    current.policyCount += 1;
    timeline.set(key, current);
  }
  return [...timeline.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export function buildInsuranceNeedAxes(policies: InsurancePolicy[]): InsuranceNeedAxis[] {
  const summary = new Map<
    InsuranceNeedAxis['key'],
    {
      policyCount: number;
      annualPremium: number;
      coverage: number;
    }
  >();

  for (const bucket of INSURANCE_NEED_BUCKETS) {
    summary.set(bucket.key, {
      policyCount: 0,
      annualPremium: 0,
      coverage: 0,
    });
  }

  for (const policy of policies) {
    const bucketKey = inferInsuranceNeedBucket(policy);
    const current = summary.get(bucketKey);
    if (!current) continue;
    current.policyCount += 1;
    current.annualPremium += Number(policy.annualPremium || 0);
    current.coverage += Number(policy.amount || 0);
  }

  return INSURANCE_NEED_BUCKETS.map((bucket) => {
    const current = summary.get(bucket.key) || { policyCount: 0, annualPremium: 0, coverage: 0 };
    const coverageScore = Math.min(60, (current.coverage / bucket.coverageTarget) * 60);
    const premiumScore = Math.min(20, (current.annualPremium / bucket.annualPremiumTarget) * 20);
    const policyScore = Math.min(20, current.policyCount * 10);
    const score = Math.round(Math.min(96, coverageScore + premiumScore + policyScore));
    return {
      key: bucket.key,
      label: bucket.label,
      score,
      policyCount: current.policyCount,
      annualPremium: current.annualPremium,
      coverage: current.coverage,
      guidance: bucket.guidance,
    };
  });
}

function roleGeneration(role: string) {
  if (role === '老人') return 0;
  if (role === '本人' || role === '配偶' || role === '家庭成员') return 1;
  if (role === '子女') return 2;
  return 3;
}

function mergeRole(currentRole: string | undefined, nextRole: string) {
  if (!currentRole || currentRole === '家庭成员') return nextRole;
  if (nextRole === '家庭成员') return currentRole;
  const currentGeneration = roleGeneration(currentRole);
  const nextGeneration = roleGeneration(nextRole);
  if (nextGeneration !== currentGeneration) return nextGeneration < currentGeneration ? nextRole : currentRole;
  return currentRole;
}

export function buildFamilyStructure(policies: InsurancePolicy[]) {
  const nodeMap = new Map<string, FamilyStructureNode>();
  const linkMap = new Map<string, FamilyStructureLink>();

  for (const policy of policies) {
    const applicantName = safeText(policy.applicant, resolveMemberName(policy));
    const insuredName = resolveMemberName(policy);
    const applicantRole = inferApplicantRole(policy);
    const insuredRole = inferMemberRole(policy);

    const applicantId = `person:${applicantName}`;
    const insuredId = `person:${insuredName}`;
    const existingApplicantNode = nodeMap.get(applicantId);
    const existingInsuredNode = nodeMap.get(insuredId);

    nodeMap.set(applicantId, {
      id: applicantId,
      name: applicantName,
      role: mergeRole(existingApplicantNode?.role, applicantRole),
      generation: roleGeneration(mergeRole(existingApplicantNode?.role, applicantRole)),
      isApplicant: true,
      isInsured: existingApplicantNode?.isInsured || applicantName === insuredName,
    });

    nodeMap.set(insuredId, {
      id: insuredId,
      name: insuredName,
      role: mergeRole(existingInsuredNode?.role, insuredRole),
      generation: roleGeneration(mergeRole(existingInsuredNode?.role, insuredRole)),
      isApplicant: existingInsuredNode?.isApplicant || applicantName === insuredName,
      isInsured: true,
    });

    if (applicantName !== insuredName) {
      const linkKey = `${applicantId}=>${insuredId}`;
      const current = linkMap.get(linkKey) || {
        source: applicantId,
        target: insuredId,
        count: 0,
      };
      current.count += 1;
      linkMap.set(linkKey, current);
    }
  }

  return {
    nodes: [...nodeMap.values()].sort((a, b) => a.generation - b.generation || a.name.localeCompare(b.name, 'zh-CN')),
    links: [...linkMap.values()],
  };
}

export function buildPolicyContentRows(policies: InsurancePolicy[]): PolicyContentRow[] {
  return [...policies]
    .sort((a, b) => Number(a.id || 0) - Number(b.id || 0))
    .map((policy) => ({
      id: Number(policy.id || 0),
      company: safeText(policy.company),
      name: safeText(policy.name),
      type: safeText(policy.type),
      policyNo: safeText(policy.policyNo),
      applicant: safeText(policy.applicant, resolveMemberName(policy)),
      applicantRelation: safeText(policy.applicantRelation),
      insured: resolveMemberName(policy),
      insuredRelation: safeText(policy.insuredRelation),
      status: safeText(policy.status),
      period: `${safeText(policy.periodStart)} 至 ${safeText(policy.periodEnd)}`,
      annualPremium: Number(policy.annualPremium || 0),
      amount: Number(policy.amount || 0),
      responsibilities: (policy.responsibilities || []).map((item) => safeText(item.name)).join(' / ') || '-',
    }));
}

export function buildFamilyPolicyReportPayload(policies: InsurancePolicy[], options: BuildFamilyPolicyReportOptions = {}) {
  const normalized = [...policies]
    .filter((policy) => Number(policy.id || 0) > 0)
    .sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
  const memberSummary = summarizePolicyMembers(normalized);
  const applicantSummary = summarizePoliciesByApplicant(normalized);
  const totalPremium = normalized.reduce((sum, policy) => sum + Number(policy.annualPremium || 0), 0);
  const totalCoverage = normalized.reduce((sum, policy) => sum + Number(policy.amount || 0), 0);
  const protectionTypes = [...new Set(normalized.map((policy) => inferProtectionType(policy)))];
  const protectionDistribution = buildProtectionDistribution(normalized);
  const insuranceNeedAxes = buildInsuranceNeedAxes(normalized);
  const familyStructure = buildFamilyStructure(normalized);
  const policyContentRows = buildPolicyContentRows(normalized);

  return {
    report_name: safeText(options.reportName, '家庭保障体检报告'),
    family_profile: {
      family_name: safeText(options.customerName, '客户家庭'),
      scope_label: safeText(options.scopeLabel, '客户当前已录入保单'),
      member_count: memberSummary.length,
      total_policy_count: normalized.length,
      applicant_count: applicantSummary.length,
      notes: [
        '请基于已录入保单和家庭已有信息总结结论。',
        '如果信息不足，请把结论写成已确认、初步判断、待确认三层。',
        '请补充家庭结构、投保人维度和保单明细表视角。',
      ],
    },
    score_summary: {
      active_policy_count: normalized.length,
      annual_premium_total: totalPremium,
      coverage_total: totalCoverage,
      protection_types: protectionTypes,
    },
    family_structure: {
      nodes: familyStructure.nodes.map((node) => ({
        name: node.name,
        role: node.role,
        generation: node.generation,
        is_applicant: node.isApplicant,
        is_insured: node.isInsured,
      })),
      links: familyStructure.links.map((link) => ({
        source: link.source.replace(/^(applicant:|insured:|person:)/, ''),
        target: link.target.replace(/^(applicant:|insured:|person:)/, ''),
        count: link.count,
      })),
    },
    applicant_summary: applicantSummary.map((item) => ({
      applicant_name: item.name,
      applicant_role: item.role,
      policy_count: item.policyCount,
      annual_premium: item.annualPremium,
      coverage_amount: item.coverage,
      insured_members: item.insuredMembers,
      protection_types: item.protectionTypes,
    })),
    chart_facts: {
      protection_distribution: protectionDistribution.map((item) => ({
        type: item.type,
        coverage_amount: item.coverage,
        annual_premium: item.annualPremium,
        policy_count: item.policyCount,
      })),
      insurance_need_axes: insuranceNeedAxes.map((item) => ({
        dimension: item.label,
        score: item.score,
        policy_count: item.policyCount,
        annual_premium: item.annualPremium,
        coverage_amount: item.coverage,
        guidance: item.guidance,
      })),
    },
    policy_detail_table: policyContentRows.map((row) => ({
      policy_id: row.id,
      company_name: row.company,
      policy_name: row.name,
      policy_type: row.type,
      policy_no: row.policyNo,
      applicant: row.applicant,
      applicant_relation: row.applicantRelation,
      insured: row.insured,
      insured_relation: row.insuredRelation,
      status: row.status,
      coverage_period: row.period,
      annual_premium: row.annualPremium,
      coverage_amount: row.amount,
      responsibility_labels: row.responsibilities,
    })),
    policy_facts: normalized.map((policy) => ({
      policy_id: policy.id,
      company_name: safeText(policy.company),
      policy_name: safeText(policy.name),
      policy_type: safeText(policy.type),
      insured: resolveMemberName(policy),
      insured_relation: safeText(policy.insuredRelation),
      applicant: safeText(policy.applicant, resolveMemberName(policy)),
      applicant_relation: safeText(policy.applicantRelation),
      policy_status: safeText(policy.status),
      coverage_amount: Number(policy.amount || 0),
      annual_premium: Number(policy.annualPremium || 0),
      payment_period: safeText(policy.paymentPeriod),
      coverage_period: safeText(policy.coveragePeriod),
      period_start: safeText(policy.periodStart),
      period_end: safeText(policy.periodEnd),
      next_payment: safeText(policy.nextPayment),
      responsibilities: (policy.responsibilities || []).map((item) => ({
        name: safeText(item.name),
        description: safeText(item.desc),
        limit: Number(item.limit || 0),
      })),
    })),
    member_diagnosis: memberSummary.map((member) => ({
      member_name: member.name,
      role: member.role,
      policy_count: member.policyCount,
      annual_premium: member.annualPremium,
      coverage_amount: member.coverage,
      confirmed_protection_types: member.protectionTypes,
    })),
    analysis_facts: {
      summary: `当前共录入 ${normalized.length} 张保单，覆盖 ${memberSummary.length} 位家庭成员，涉及 ${applicantSummary.length} 位投保人。`,
      priority:
        normalized.length > 1
          ? '请按家庭整体闭环、投保人维度和成员保障分布三条线输出，不要只逐张解释。'
          : '当前保单较少，请明确哪些结论只是初步判断。',
      output_style: '先说这个家已经做对了什么，再说最值得优先补的地方，补充家庭结构、投保人维度、图表结论和保单明细表。',
    },
    boundary_notes: [
      '不要输出真实姓名、手机号、身份证号等个人隐私。',
      '不要直接推荐具体产品名或销售话术。',
      '没有足够证据的地方必须明确标注为待确认。',
    ],
    detail_mode: 'auto',
  };
}
