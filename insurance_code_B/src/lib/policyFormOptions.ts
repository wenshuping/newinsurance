const BASE_COMPANY_OPTIONS = [
  '中国平安保险',
  '中国人寿保险',
  '新华保险',
  '中国太平洋保险',
  '中国太平',
  '太平人寿',
  '泰康保险',
  '友邦保险',
  '阳光保险',
  '人保寿险',
  '人保健康',
  '中邮保险',
  '招商信诺',
  '中信保诚',
  '工银安盛',
  '建信人寿',
  '农银人寿',
  '大家保险',
  '华夏保险',
  '富德生命人寿',
  '国华人寿',
  '百年人寿',
  '信泰保险',
  '中英人寿',
  '陆家嘴国泰人寿',
  '中荷人寿',
  '合众人寿',
  '横琴人寿',
  '君龙人寿',
  '瑞众保险',
  '同方全球人寿',
  '恒安标准人寿',
];

const BASE_PAYMENT_PERIOD_OPTIONS = [
  '趸交',
  '1年交',
  '3年交',
  '5年交',
  '10年交',
  '15年交',
  '20年交',
  '30年交',
];

const BASE_COVERAGE_PERIOD_OPTIONS = ['终身', '1年', '20年', '30年', '至60岁', '至70岁', '至80岁'];
const BASE_RELATION_OPTIONS = ['本人', '配偶', '父母', '子女', '兄弟姐妹', '其他亲属', '其他'];
const POLICY_FORM_HISTORY_KEY = 'insurance-policy-form-history:v1';
const POLICY_FORM_HISTORY_LIMIT = 20;

type PolicyFormHistory = {
  company: string[];
  name: string[];
  relation: string[];
  paymentPeriod: string[];
  coveragePeriod: string[];
};

function compact(text: string) {
  return String(text || '').trim().replace(/\s+/g, '');
}

function withCurrentOption(options: string[], currentValue: string) {
  const current = String(currentValue || '').trim();
  const merged = current ? [current, ...options] : options;
  return Array.from(new Set(merged.filter(Boolean)));
}

function emptyHistory(): PolicyFormHistory {
  return {
    company: [],
    name: [],
    relation: [],
    paymentPeriod: [],
    coveragePeriod: [],
  };
}

function readPolicyFormHistory(): PolicyFormHistory {
  if (typeof window === 'undefined') return emptyHistory();
  try {
    const raw = window.localStorage.getItem(POLICY_FORM_HISTORY_KEY);
    if (!raw) return emptyHistory();
    const parsed = JSON.parse(raw);
    const base = emptyHistory();
    return {
      company: Array.isArray(parsed?.company) ? parsed.company.map((item: unknown) => String(item || '').trim()).filter(Boolean) : base.company,
      name: Array.isArray(parsed?.name) ? parsed.name.map((item: unknown) => String(item || '').trim()).filter(Boolean) : base.name,
      relation: Array.isArray(parsed?.relation) ? parsed.relation.map((item: unknown) => String(item || '').trim()).filter(Boolean) : base.relation,
      paymentPeriod: Array.isArray(parsed?.paymentPeriod)
        ? parsed.paymentPeriod.map((item: unknown) => String(item || '').trim()).filter(Boolean)
        : base.paymentPeriod,
      coveragePeriod: Array.isArray(parsed?.coveragePeriod)
        ? parsed.coveragePeriod.map((item: unknown) => String(item || '').trim()).filter(Boolean)
        : base.coveragePeriod,
    };
  } catch {
    return emptyHistory();
  }
}

function savePolicyFormHistory(history: PolicyFormHistory) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(POLICY_FORM_HISTORY_KEY, JSON.stringify(history));
}

function rememberItems(existing: string[], values: Array<string | undefined>) {
  const normalized = values.map((item) => String(item || '').trim()).filter(Boolean);
  return Array.from(new Set([...normalized, ...existing])).slice(0, POLICY_FORM_HISTORY_LIMIT);
}

export function normalizePolicyCompany(value: string) {
  const text = compact(value);
  if (!text) return '';
  if (/^(?:ONCI|NCI)?新华保险$/i.test(text)) return '新华保险';
  if (/中国平安(?:人寿|健康|养老)?(?:保险)?(?:股份有限公司|有限责任公司)?|平安人寿(?:保险)?(?:股份有限公司)?|平安保险|PINGAN(?:INSURANCECOMPANYOFCHINA(?:,?LTD\.?)?)?/i.test(text)) return '中国平安保险';
  if (/中国人寿(?:保险)?(?:股份有限公司)?|国寿(?:保险)?/.test(text)) return '中国人寿保险';
  if (/中国太平洋(?:人寿|健康)?保险(?:股份有限公司|有限责任公司)?|太平洋保险|太保寿险|中国太保/.test(text)) return '中国太平洋保险';
  if (/中国太平人寿保险(?:股份有限公司|有限责任公司)?|太平人寿/.test(text)) return '太平人寿';
  if (/中国太平保险集团(?:有限责任公司)?|中国太平(?!人寿)|太平保险集团/.test(text)) return '中国太平';
  if (/泰康人寿保险(?:有限责任公司|股份有限公司)?|泰康(?:人寿|养老|在线)?保险|泰康保险/.test(text)) return '泰康保险';
  if (/友邦人寿保险(?:有限公司|股份有限公司)?|友邦保险/.test(text)) return '友邦保险';
  if (/阳光人寿保险(?:股份有限公司|有限责任公司)?|阳光保险/.test(text)) return '阳光保险';
  if (/中国人民人寿保险股份有限公司|人保寿险|中国人保寿险/.test(text)) return '人保寿险';
  if (/中国人民健康保险股份有限公司|人保健康/.test(text)) return '人保健康';
  if (/中邮人寿保险股份有限公司|中邮保险|中邮人寿/.test(text)) return '中邮保险';
  if (/招商信诺人寿保险(?:有限公司|股份有限公司)?|招商信诺/.test(text)) return '招商信诺';
  if (/中信保诚人寿保险(?:有限公司|股份有限公司)?|信诚人寿|中信保诚/.test(text)) return '中信保诚';
  if (/工银安盛人寿保险(?:有限公司|股份有限公司)?|工银安盛/.test(text)) return '工银安盛';
  if (/建信人寿保险(?:有限公司|股份有限公司)?|建信人寿/.test(text)) return '建信人寿';
  if (/农银人寿保险(?:股份有限公司|有限公司)?|农银人寿/.test(text)) return '农银人寿';
  if (/大家人寿保险(?:股份有限公司|有限责任公司)?|大家保险|大家人寿/.test(text)) return '大家保险';
  if (/华夏人寿保险(?:股份有限公司|有限责任公司)?|华夏保险/.test(text)) return '华夏保险';
  if (/富德生命人寿保险(?:股份有限公司|有限责任公司)?|富德生命人寿|生命人寿/.test(text)) return '富德生命人寿';
  if (/国华人寿保险(?:股份有限公司|有限责任公司)?|国华人寿/.test(text)) return '国华人寿';
  if (/百年人寿保险(?:股份有限公司|有限责任公司)?|百年人寿/.test(text)) return '百年人寿';
  if (/信泰人寿保险(?:股份有限公司|有限责任公司)?|信泰保险|信泰人寿/.test(text)) return '信泰保险';
  if (/中英人寿保险(?:有限公司|股份有限公司)?|中英人寿/.test(text)) return '中英人寿';
  if (/陆家嘴国泰人寿保险(?:有限责任公司|股份有限公司)?|国泰人寿|陆家嘴国泰人寿/.test(text)) return '陆家嘴国泰人寿';
  return text;
}

export function normalizePolicyPaymentPeriod(value: string) {
  const text = compact(value);
  if (!text) return '';
  if (/^(趸交|一次交清)$/.test(text)) return '趸交';
  if (/^\d+$/.test(text)) return `${text}年交`;
  if (/^\d+年(?:期)?$/.test(text)) return `${text.replace(/期$/, '')}交`;
  const yearly = text.match(/(?:^|\/)(\d+)年$/);
  if (yearly?.[1]) return `${yearly[1]}年交`;
  const direct = text.match(/^(\d+)年交$/);
  if (direct?.[1]) return `${direct[1]}年交`;
  return text;
}

export function normalizePolicyCoveragePeriod(value: string) {
  const text = compact(value);
  if (!text) return '';
  if (text.includes('终身')) return '终身';
  if (/^\d+$/.test(text)) return Number(text) >= 50 ? `至${text}岁` : `${text}年`;
  if (/^\d+年$/.test(text)) return text;
  const ageMatched = text.match(/(?:保至|保障至|至)?(\d{2,3})周?岁/);
  if (ageMatched?.[1]) return `至${ageMatched[1]}岁`;
  if (/^至\d+岁$/.test(text)) return text;
  return text;
}

export function buildPolicyNameOptions(currentValue: string) {
  return withCurrentOption(readPolicyFormHistory().name, currentValue);
}

export function buildPolicyRelationOptions(currentValue: string) {
  return withCurrentOption([...BASE_RELATION_OPTIONS, ...readPolicyFormHistory().relation], currentValue);
}

export function buildPolicyCompanyOptions(currentValue: string) {
  return withCurrentOption([...BASE_COMPANY_OPTIONS, ...readPolicyFormHistory().company], normalizePolicyCompany(currentValue));
}

export function buildPolicyPaymentPeriodOptions(currentValue: string) {
  return withCurrentOption([...BASE_PAYMENT_PERIOD_OPTIONS, ...readPolicyFormHistory().paymentPeriod], normalizePolicyPaymentPeriod(currentValue));
}

export function buildPolicyCoveragePeriodOptions(currentValue: string) {
  return withCurrentOption([...BASE_COVERAGE_PERIOD_OPTIONS, ...readPolicyFormHistory().coveragePeriod], normalizePolicyCoveragePeriod(currentValue));
}

export function rememberPolicyFormValues(values: {
  company?: string;
  name?: string;
  applicantRelation?: string;
  insuredRelation?: string;
  paymentPeriod?: string;
  coveragePeriod?: string;
}) {
  const current = readPolicyFormHistory();
  savePolicyFormHistory({
    company: rememberItems(current.company, [normalizePolicyCompany(values.company || '')]),
    name: rememberItems(current.name, [values.name]),
    relation: rememberItems(current.relation, [values.applicantRelation, values.insuredRelation]),
    paymentPeriod: rememberItems(current.paymentPeriod, [normalizePolicyPaymentPeriod(values.paymentPeriod || '')]),
    coveragePeriod: rememberItems(current.coveragePeriod, [normalizePolicyCoveragePeriod(values.coveragePeriod || '')]),
  });
}

export function isValidPolicyPaymentPeriod(value: string) {
  const normalized = normalizePolicyPaymentPeriod(value);
  return normalized === '趸交' || /^\d+年交$/.test(normalized);
}

export function isValidPolicyCoveragePeriod(value: string) {
  const normalized = normalizePolicyCoveragePeriod(value);
  return normalized === '终身' || /^\d+年$/.test(normalized) || /^至\d+岁$/.test(normalized);
}

export function sanitizePositiveNumberInput(value: string, maxDecimals = 2) {
  const normalized = String(value || '').replace(/[^\d.]/g, '');
  const [integerPart = '', ...rest] = normalized.split('.');
  const decimalPart = rest.join('').slice(0, maxDecimals);
  const compactInteger = integerPart.replace(/^0+(?=\d)/, '');
  return decimalPart ? `${compactInteger || '0'}.${decimalPart}` : compactInteger;
}

export function validatePositiveNumberInput(value: string) {
  const text = String(value || '').trim();
  if (!text) return '';
  const amount = Number(text);
  if (!Number.isFinite(amount)) return '请输入有效数字';
  if (amount <= 0) return '请输入大于0的数值';
  return '';
}
