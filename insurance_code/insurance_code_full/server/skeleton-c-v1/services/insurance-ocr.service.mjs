import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { hasConfiguredOcrServiceBaseUrl, scanInsurancePolicyOverHttp } from '../../microservices/ocr-service/client.mjs';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OCR_SWIFT_SCRIPT = path.resolve(__dirname, '../../scripts/policy_ocr_vision.swift');
const OCR_PADDLE_SCRIPT = path.resolve(__dirname, '../../scripts/policy_ocr_paddle.py');
const DEFAULT_MAX_SCAN_BYTES = 12 * 1024 * 1024;
const OCR_PROVIDER_LOCAL = 'local';
const OCR_PROVIDER_BAIDU_PRIVATE = 'baidu_private';
const OCR_PROVIDER_PADDLE_LOCAL = 'paddle_local';
const OCR_PROVIDER_OLLAMA_VISION_LOCAL = 'ollama_vision_local';
const OCR_POSTPROCESSOR_NONE = 'none';
const OCR_POSTPROCESSOR_OLLAMA_QWEN = 'ollama_qwen_local';
let paddleWarmupPromise = null;

const COMPANY_ALIASES = [
  { value: '新华保险', patterns: [/NCI\s*新华保险/i, /新华(?:人寿)?保险(?:股份有限公司|有限责任公司)?/] },
  {
    value: '中国平安保险',
    patterns: [
      /中国平安(?:人寿|健康|养老)?(?:保险)?(?:股份有限公司|有限责任公司)?/,
      /平安人寿(?:保险)?(?:股份有限公司)?/,
      /平安保险/,
      /PING\s*AN(?:\s+INSURANCE\s+COMPANY\s+OF\s+CHINA(?:,?\s*LTD\.?)?)?/i,
    ],
  },
  { value: '中国人寿保险', patterns: [/中国人寿(?:保险)?(?:股份有限公司)?/, /国寿(?:保险)?/] },
  { value: '中国太平洋保险', patterns: [/中国太平洋(?:人寿|健康)?保险(?:股份有限公司|有限责任公司)?/, /太平洋保险/, /太保寿险/, /中国太保/] },
  { value: '太平人寿', patterns: [/中国太平人寿保险(?:股份有限公司|有限责任公司)?/, /太平人寿/] },
  { value: '中国太平', patterns: [/中国太平保险集团(?:有限责任公司)?/, /中国太平(?!人寿)/, /太平保险集团/] },
  { value: '泰康保险', patterns: [/泰康人寿保险(?:有限责任公司|股份有限公司)?/, /泰康(?:人寿|养老|在线)?保险/, /泰康保险/] },
  { value: '友邦保险', patterns: [/友邦人寿保险(?:有限公司|股份有限公司)?/, /友邦保险/] },
  { value: '阳光保险', patterns: [/阳光人寿保险(?:股份有限公司|有限责任公司)?/, /阳光保险/] },
  { value: '人保寿险', patterns: [/中国人民人寿保险股份有限公司/, /人保寿险/, /中国人保寿险/] },
  { value: '人保健康', patterns: [/中国人民健康保险股份有限公司/, /人保健康/] },
  { value: '中邮保险', patterns: [/中邮人寿保险股份有限公司/, /中邮保险/, /中邮人寿/] },
  { value: '招商信诺', patterns: [/招商信诺人寿保险(?:有限公司|股份有限公司)?/, /招商信诺/] },
  { value: '中信保诚', patterns: [/中信保诚人寿保险(?:有限公司|股份有限公司)?/, /信诚人寿/, /中信保诚/] },
  { value: '工银安盛', patterns: [/工银安盛人寿保险(?:有限公司|股份有限公司)?/, /工银安盛/] },
  { value: '建信人寿', patterns: [/建信人寿保险(?:有限公司|股份有限公司)?/, /建信人寿/] },
  { value: '农银人寿', patterns: [/农银人寿保险(?:股份有限公司|有限公司)?/, /农银人寿/] },
  { value: '大家保险', patterns: [/大家人寿保险(?:股份有限公司|有限责任公司)?/, /大家保险/, /大家人寿/] },
  { value: '华夏保险', patterns: [/华夏人寿保险(?:股份有限公司|有限责任公司)?/, /华夏保险/] },
  { value: '富德生命人寿', patterns: [/富德生命人寿保险(?:股份有限公司|有限责任公司)?/, /富德生命人寿/, /生命人寿/] },
  { value: '国华人寿', patterns: [/国华人寿保险(?:股份有限公司|有限责任公司)?/, /国华人寿/] },
  { value: '百年人寿', patterns: [/百年人寿保险(?:股份有限公司|有限责任公司)?/, /百年人寿/] },
  { value: '信泰保险', patterns: [/信泰人寿保险(?:股份有限公司|有限责任公司)?/, /信泰保险/, /信泰人寿/] },
  { value: '中英人寿', patterns: [/中英人寿保险(?:有限公司|股份有限公司)?/, /中英人寿/] },
  { value: '陆家嘴国泰人寿', patterns: [/陆家嘴国泰人寿保险(?:有限责任公司|股份有限公司)?/, /国泰人寿/, /陆家嘴国泰人寿/] },
];

const LABELS = {
  company: ['投保公司', '保险公司', '承保公司', '公司名称', '承保机构', '保险机构', '承保单位', '保险公司全称'],
  name: ['产品名称', '险种名称', '保险名称', '合同名称', '产品计划', '主险名称', '保险产品名称', '险种计划', '险种/名称', '保险险种'],
  applicant: ['投保人', '投保人姓名', '要保人', '要保人姓名'],
  insured: ['被保险人', '被保险人姓名', '受保人', '受保人姓名', '被保人'],
  date: ['投保日期', '合同成立日期', '合同成立日', '承保日期', '合同生效日期', '合同生效日', '生效日期', '生效时间', '保险起期', '起保日期', '起保日', '保险合同成立及生效日'],
  paymentPeriod: ['交费方式', '交费期间', '缴费期间', '交费年期', '缴费年期', '交费年限', '缴费年限', '交费期限', '缴费期限'],
  coveragePeriod: ['保险期间', '保障期间', '保险期限', '保障期限', '保险责任期间', '合同期限'],
  amount: ['基本保险金额', '保额', '保险金额', '基本保额'],
  firstPremium: [
    '首期保险费',
    '首期保费',
    '首年保费',
    '标准保险费',
    '保险费',
    '首期应交保险费',
    '首期应交保费',
    '首次保费',
    '首次保险费',
    '首年应交保费',
    '首年应交保险费',
    '总保费',
    '总保费(人民币)',
    '总保险费',
  ],
};

const AUXILIARY_SPLIT_LABELS = ['客户号码', '保险险种', '保险期限', '缴费年期', '缴费方式', '保险金额(元)', '保险费(元)'];

const ALL_LABELS = [...Object.values(LABELS).flat(), ...AUXILIARY_SPLIT_LABELS]
  .flat()
  .sort((a, b) => b.length - a.length);

function escapeRegExp(text) {
  return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildLooseLabelPattern(text) {
  return Array.from(String(text || ''))
    .map((char) => `${escapeRegExp(char)}\\s*`)
    .join('');
}

function normalizeOcrText(raw) {
  return String(raw || '')
    .replace(/\r/g, '\n')
    .replace(/[：﹕]/g, ':')
    .replace(/\u3000/g, ' ')
    .replace(/([一-龥A-Za-z])[ \t]+(?=[一-龥A-Za-z])/g, '$1')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function splitRecognizedLines(raw) {
  const text = normalizeOcrText(raw);
  if (!text) return [];
  const unionPattern = ALL_LABELS.map(buildLooseLabelPattern).join('|');
  const withExplicitBreaks = text.replace(new RegExp(`(?<!^)(?=(${unionPattern}))`, 'g'), '\n');
  return withExplicitBreaks
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function cleanupFieldValue(text) {
  return String(text || '')
    .replace(/^[：:\-=\s]+/, '')
    .replace(/[|｜]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function compactLine(text) {
  return cleanupFieldValue(text).replace(/\s+/g, '');
}

function extractByLabels(lines, labels, stopLabels = []) {
  const orderedLabels = [...labels].sort((a, b) => b.length - a.length);
  const escapedStops = stopLabels.map(buildLooseLabelPattern).join('|');
  for (const label of orderedLabels) {
    const escapedLabel = buildLooseLabelPattern(label);
    const patterns = [
      new RegExp(
        `^${escapedLabel}\\s*[:：]?\\s*(.+?)${escapedStops ? `(?=\\s*(?:${escapedStops})\\s*[:：]?\\s*|$)` : '$'}`,
        'i'
      ),
      new RegExp(
        `(?:^|[\\s|｜])${escapedLabel}\\s*[:：]?\\s*(.+?)${escapedStops ? `(?=\\s*(?:${escapedStops})\\s*[:：]?\\s*|$)` : '$'}`,
        'i'
      ),
    ];
    for (const line of lines) {
      for (const pattern of patterns) {
        const matched = line.match(pattern);
        if (matched?.[1]) {
          const cleaned = cleanupFieldValue(matched[1]);
          if (cleaned) return cleaned;
        }
      }
    }
  }
  return '';
}

function formatDateValue(value) {
  const matched = String(value || '').match(/(20\d{2})[年./-](\d{1,2})[月./-](\d{1,2})/);
  if (!matched) return '';
  const year = matched[1];
  const month = matched[2].padStart(2, '0');
  const day = matched[3].padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function extractPreferredDate(lines) {
  const dateGroups = [
    ['投保日期', '合同成立日期', '合同成立日'],
    ['合同生效日期', '合同生效日', '生效日期', '生效时间', '保险起期', '起保日期', '起保日', '保险合同成立及生效日'],
    ['承保日期'],
  ];

  for (const group of dateGroups) {
    const rawValue = extractByLabels(lines, group);
    const formatted = formatDateValue(rawValue);
    if (formatted) return formatted;
  }
  return '';
}

function matchCompanyAlias(value) {
  const text = compactLine(value);
  if (!text) return '';
  const matched = COMPANY_ALIASES.find((item) => item.patterns.some((pattern) => pattern.test(text)));
  return matched?.value || '';
}

function parseAmountValue(value) {
  const text = String(value || '')
    .replace(/[,，\s]/g, '')
    .replace(/[¥￥元圆]/g, '')
    .trim();
  if (!text) return '';
  const matched = text.match(/(\d+(?:\.\d+)?)(万|亿)?/);
  if (!matched) return '';
  const base = Number(matched[1]);
  if (!Number.isFinite(base)) return '';
  const unit = matched[2] || '';
  const multiplier = unit === '亿' ? 100000000 : unit === '万' ? 10000 : 1;
  return String(Math.round(base * multiplier));
}

function findCompanyAlias(text) {
  return matchCompanyAlias(normalizeOcrText(text));
}

function normalizeCompanyName(value) {
  const text = cleanupFieldValue(value);
  return matchCompanyAlias(text) || text;
}

function looksLikeCompanyName(value) {
  const text = compactLine(value);
  if (!text) return false;
  const alias = matchCompanyAlias(text);
  if (!alias) return /(?:股份有限公司|有限责任公司|保险集团)/.test(text);
  return compactLine(alias) === text || /(?:股份有限公司|有限责任公司|保险集团)/.test(text);
}

function isGenericPolicyLine(text) {
  const line = compactLine(text);
  if (!line) return true;
  return /^(保险单|基本内容|保险利益表|特别约定|本栏空白|身故保险金受益人|被保险人的法定继承人|证件号码|受益顺序|受益份额|币值单位[:：]?.*|保险合同号[:：]?.*|关爱人生每一天|基本保险金额\/保险金额|\/保障计划\/份数|保险期间|交费方式|保险费约定支付日|\/交费期间.*|\/交费期满日|保险费|基本保险金额|保险金额)$/.test(
    line
  );
}

function normalizeNameValue(value) {
  const text = compactLine(value).replace(/^(产品名称|险种名称|保险名称|合同名称|主险名称|名称|保险险种)[:：]?/, '');
  if (!text) return '';
  if (text.length <= 2) return '';
  if (isGenericPolicyLine(text)) return '';
  if (/^(投保人|被保险人|客户号码|保险期限|缴费年期|缴费方式|保险金额|保险费)/.test(text)) return '';
  if (/保险单$/.test(text)) return '';
  if (looksLikeCompanyName(text)) return '';
  if (/客户号码|第一顺位|第二顺位|身故受益人|受益人|100%|联系电话|邮政编码/.test(text)) return '';
  if (/(?:保险|人寿|健康)(?:股份有限公司|有限责任公司)$/.test(text)) return '';
  if (/^(基本|内容|基本内容|保险|险种|名称|保险名称)$/.test(text)) return '';
  if (/保险金额|保障计划|交费期间|交费期满日|保险费约定支付日/.test(text)) return '';
  if (/^(?:ONCI|NCI)?新华保险$/i.test(text)) return '';
  if (/^(中国平安|中国平安保险|中国人寿|中国人寿保险|中国太平洋保险|中国太平)$/.test(text)) return '';
  if (/^(每年\d{1,2}月\d{1,2}日|至20\d{2}年\d{1,2}月\d{1,2}日|[¥￥]?\d+(?:\.\d+)?元?)$/.test(text)) return '';
  return text;
}

function normalizePersonNameValue(value) {
  const text = compactLine(value);
  if (!text) return '';
  const cleaned = text
    .replace(/^(投保人|投保人姓名|要保人|要保人姓名|被保险人|被保险人姓名|受保人|受保人姓名|被保人)[:：]?/, '')
    .replace(/(性别|生日|出生|生于|证件号码|证件号|受益顺序|受益份额|本栏以下空白|及保险主要事项).*$/, '')
    .trim();
  const matched = cleaned.match(/^[一-龥·]{2,8}/);
  return matched?.[0] || '';
}

function normalizePaymentPeriodValue(value) {
  const text = compactLine(value);
  if (!text) return '';
  if (/续期保险费交费日期|交费期满日|保险费约定支付日|缴费.*日期|交费.*日期/.test(text)) return '';
  if (/^(趸交|一次交清|一次性交清|一次性交费|一次性缴清)$/.test(text)) return '趸交';
  if (/^\d+年交$/.test(text)) return text;
  if (/^\d+年(?:期)?$/.test(text)) return `${text.replace(/期$/, '')}交`;
  const matched = text.match(/((?:\d+年)?(?:趸交|年交|月交|季交|一次交清))(?:\/?(\d+年))?/);
  if (matched?.[1]) {
    return matched[2] ? `${matched[1]}/${matched[2]}` : matched[1];
  }
  const freqFirst = text.match(/^(年交|月交|季交|半年交)\/?(\d+年)$/);
  if (freqFirst?.[1] && freqFirst?.[2]) {
    return `${freqFirst[1]}/${freqFirst[2]}`;
  }
  const yearAndMode = text.match(/^(\d+年)(年交|月交|季交|半年交)$/);
  if (yearAndMode?.[1] && yearAndMode?.[2]) {
    return yearAndMode[2] === '年交' ? `${yearAndMode[1]}交` : `${yearAndMode[1]}${yearAndMode[2]}`;
  }
  return '';
}

function normalizePaymentModeValue(value) {
  const text = compactLine(value);
  if (!text) return '';
  if (/^(年缴|年交)$/.test(text)) return '年交';
  if (/^(月缴|月交)$/.test(text)) return '月交';
  if (/^(季缴|季交)$/.test(text)) return '季交';
  if (/^(半年缴|半年交)$/.test(text)) return '半年交';
  if (/^(趸交|一次交清|一次性交清|一次性交费|一次性缴清)$/.test(text)) return '趸交';
  return '';
}

function normalizePaymentYearsValue(value) {
  const text = compactLine(value);
  if (!text) return '';
  const matched = text.match(/^(\d+)(?:年|期)?$/);
  return matched?.[1] || '';
}

function combinePaymentPeriod(paymentYears, paymentMode) {
  const years = normalizePaymentYearsValue(paymentYears);
  const mode = normalizePaymentModeValue(paymentMode);
  if (years && mode === '年交') return `${years}年交`;
  if (years && mode) return `${years}年${mode}`;
  return normalizePaymentPeriodValue(paymentYears) || normalizePaymentPeriodValue(paymentMode);
}

function normalizeCoveragePeriodValue(value) {
  const text = compactLine(value);
  if (!text) return '';
  const matched = text.match(/(至20\d{2}年\d{1,2}月\d{1,2}日(?:零时)?)/);
  if (matched?.[1]) return matched[1];
  if (/终身/.test(text)) return '终身';
  const ageMatched = text.match(/(?:保至|保障至|至)?(\d{2,3})周?岁/);
  if (ageMatched?.[1]) return `至${ageMatched[1]}岁`;
  if (/^\d+年$/.test(text)) return text;
  return '';
}

function isStandaloneAmountLine(text) {
  const line = compactLine(text);
  if (!line) return false;
  if (/^(每年|首期|首年|合计|¥|￥)/.test(line)) return false;
  if (/^(至20\d{2}年|年交|月交|季交|趸交|一次交清|\/\d+年|\/20\d{2}年)/.test(line)) return false;
  return Boolean(parseAmountValue(line));
}

function normalizeAmountValue(rawValue) {
  const raw = compactLine(rawValue);
  if (!raw) return '';
  if (/保险合同号|合同号|证件号码/.test(raw)) return '';
  if (/年|月|日/.test(raw)) return '';
  if (!/[¥￥元万亿]/.test(raw) && /^\d{9,}$/.test(raw)) return '';
  return parseAmountValue(raw);
}

export function normalizeExtractedPolicyFields(candidate) {
  const payload = candidate || {};
  const paymentPeriod = normalizePaymentPeriodValue(payload.paymentPeriod || '')
    || combinePaymentPeriod(payload.paymentYears || '', payload.paymentMode || '')
    || '';
  return {
    company: normalizeCompanyName(payload.company || ''),
    name: normalizeNameValue(payload.name || ''),
    applicant: normalizePersonNameValue(payload.applicant || ''),
    insured: normalizePersonNameValue(payload.insured || ''),
    date: formatDateValue(payload.date || ''),
    paymentPeriod,
    coveragePeriod: normalizeCoveragePeriodValue(payload.coveragePeriod || ''),
    amount: normalizeAmountValue(payload.amount || '') || parseAmountValue(payload.amount || ''),
    firstPremium: normalizeAmountValue(payload.firstPremium || '') || parseAmountValue(payload.firstPremium || ''),
  };
}

function fallbackFirstPremium(lines) {
  for (const raw of lines) {
    const line = compactLine(raw);
    if (!line) continue;
    if (/首期保险费合计|首期保险费|首期保费|首年保费|保险费合计|总保费/.test(line)) {
      const amount = parseAmountValue(line);
      if (amount) return amount;
    }
  }

  for (const raw of [...lines].reverse()) {
    const line = compactLine(raw);
    if (!line) continue;
    if (/^[¥￥]\d/.test(line)) {
      const amount = parseAmountValue(line);
      if (amount) return amount;
    }
  }

  return '';
}

function extractHeaderCompany(lines, rawText) {
  const headerWindow = normalizeOcrText(lines.slice(0, 16).join('\n'));
  return findCompanyAlias(headerWindow) || findCompanyAlias(rawText);
}

function fallbackCompany(lines) {
  for (const line of lines) {
    const aliased = findCompanyAlias(line);
    if (aliased) return aliased;
  }
  const excludedPattern = new RegExp(
    `^(?:${[
      ...LABELS.name,
      ...LABELS.applicant,
      ...LABELS.insured,
      ...LABELS.date,
      ...LABELS.paymentPeriod,
      ...LABELS.coveragePeriod,
      ...LABELS.amount,
      ...LABELS.firstPremium,
    ]
      .map(escapeRegExp)
      .join('|')})\\s*[:：]?`,
    'i'
  );
  return (
    lines.find((line) => !excludedPattern.test(line) && (/保险.+(公司|集团|股份)/.test(line) || /(公司|集团|股份).+保险/.test(line))) ||
    lines.find((line) => !excludedPattern.test(line) && /(保险|保司)/.test(line)) ||
    ''
  );
}

function fallbackProductName(lines, company) {
  return (
    lines.find((line) => {
      if (!line || line === company) return false;
      if (/保险(?:保单|单)$/.test(compactLine(line))) return false;
      return /(险|医疗|重疾|寿险|意外|年金|保)/.test(line);
    }) || ''
  );
}

function findLooseLabelIndex(lines, labels) {
  const patterns = labels.map((label) => new RegExp(buildLooseLabelPattern(label), 'i'));
  return lines.findIndex((line) => patterns.some((pattern) => pattern.test(line)));
}

function fallbackTableProductName(lines) {
  const index = findLooseLabelIndex(lines, LABELS.name);
  if (index < 0) return '';

  let primary = '';
  let suffix = '';
  for (const raw of lines.slice(index + 1, index + 40)) {
    const line = compactLine(raw);
    if (!line) continue;
    if (/^(首期保险费合计|特别约定)/.test(line)) break;
    if (isGenericPolicyLine(line)) continue;
    if (/^(每年\d{1,2}月\d{1,2}日|至20\d{2}年\d{1,2}月\d{1,2}日|[¥￥]?\d+(?:\.\d+)?元?|\/\d+年|\/20\d{2}年|3份|年交|月交|季交|趸交|一次交清)$/.test(line)) {
      continue;
    }

    if (!primary) {
      primary = line;
      continue;
    }

    if (!/险|保险|医疗|寿险|年金/.test(primary) && /险|保险|医疗|寿险|年金/.test(line)) {
      suffix = line;
      break;
    }
  }
  return normalizeNameValue(`${primary}${suffix}`);
}

function fallbackLooseProductName(lines, company) {
  const index = findLooseLabelIndex(lines, LABELS.name);
  if (index < 0) return '';
  let primary = '';
  let suffix = '';
  for (const raw of lines.slice(index + 1, index + 50)) {
    const line = compactLine(raw);
    if (!line) continue;
    if (isGenericPolicyLine(line)) continue;
    if (/^(投保人|被保险人|合同成立日期|合同生效日期|保险合同号|特别约定|首期保险费合计|证件号码|受益顺序|受益份额)/.test(line)) continue;
    if (/^(每年\d{1,2}月\d{1,2}日|至20\d{2}年\d{1,2}月\d{1,2}日|[¥￥]?\d+(?:\.\d+)?元?|\/\d+年|\/20\d{2}年|3份|年交|月交|季交|趸交|一次交清)$/.test(line)) continue;
    if (normalizeCompanyName(line) === company || findCompanyAlias(line) === company) continue;
    if (!/[一-龥A-Za-z]/.test(line)) continue;

    if (!primary) {
      primary = line;
      continue;
    }
    if (!/险|保险|医疗|寿险|年金/.test(primary) && /险|保险|医疗|寿险|年金/.test(line)) {
      suffix = line;
      break;
    }
  }
  return normalizeNameValue(`${primary}${suffix}`);
}

function isPolicyProductNoise(line, company) {
  if (!line) return true;
  if (isGenericPolicyLine(line)) return true;
  if (
    /^(投保人|被保险人|合同成立日期|合同生效日期|保险合同号|特别约定|首期保险费合计|证件号码|受益顺序|受益份额)/.test(
      line
    )
  ) {
    return true;
  }
  if (
    /^(每年\d{1,2}月\d{1,2}日|至20\d{2}年\d{1,2}月\d{1,2}日(?:零时)?|[¥￥]?\d+(?:\.\d+)?元?|\/\d+年|\/20\d{2}年\d{1,2}月\d{1,2}日|3份|年交|月交|季交|趸交|一次交清)$/.test(
      line
    )
  ) {
    return true;
  }
  if (/(交费|缴费|保险费|日期|合计|金额|份数|零时|受益|本栏空白|期满日|交清)/.test(line)) return true;
  if (normalizeCompanyName(line) === company || findCompanyAlias(line) === company) return true;
  if (!/[一-龥A-Za-z]/.test(line)) return true;
  if (/(?:^|[^\d])\d{3,}(?:\.\d+)?(?:元|份)?$/.test(line)) return true;
  return false;
}

function isPolicyProductComplete(line) {
  return /(保险|医疗保险|寿险|年金保险|两全保险|意外保险|疾病保险|重疾保险|护理保险)$/.test(line);
}

function isPolicyProductSuffix(line) {
  return /^(保险|医疗保险|寿险|年金保险|两全保险|意外保险|疾病保险|重疾保险|护理保险)$/.test(line);
}

function isPolicyProductSeed(line, company) {
  if (isPolicyProductNoise(line, company)) return false;
  if (isPolicyProductComplete(line)) return true;
  return !/(?:20\d{2}年|\d+(?:\.\d+)?元|\/\d+年)/.test(line);
}

function collectTablePolicyProductNames(lines, company) {
  const index = findLooseLabelIndex(lines, LABELS.name);
  if (index < 0) return [];

  const source = lines.slice(index + 1, index + 80).map((line) => compactLine(line)).filter(Boolean);
  const picked = [];
  let cursor = 0;

  while (cursor < source.length) {
    const current = source[cursor];
    if (!isPolicyProductSeed(current, company)) {
      cursor += 1;
      continue;
    }

    let product = current;
    let suffixIndex = -1;
    if (!isPolicyProductComplete(product)) {
      for (let offset = 1; offset <= 6 && cursor + offset < source.length; offset += 1) {
        const next = source[cursor + offset];
        if (isPolicyProductNoise(next, company)) {
          continue;
        }
        if (isPolicyProductSuffix(next)) {
          product = `${product}${next}`;
          suffixIndex = cursor + offset;
          break;
        }
      }
    }

    const normalized = normalizeNameValue(product);
    if (normalized && !picked.includes(normalized)) {
      picked.push(normalized);
    }
    cursor = suffixIndex >= 0 ? suffixIndex + 1 : cursor + 1;
  }

  return picked;
}

function fallbackCoveragePeriod(lines) {
  for (const raw of lines) {
    const line = normalizeCoveragePeriodValue(raw);
    if (line) return line;
  }
  return '';
}

function fallbackPaymentPeriod(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    const current = compactLine(lines[index]);
    if (!current) continue;
    const matched = current.match(/((?:\d+年)?(?:趸交|月交|年交|季交|一次交清))/);
    if (matched?.[1]) {
      if (/^\d+年交$/.test(matched[1])) return matched[1];
      for (let offset = 1; offset <= 3; offset += 1) {
        const next = compactLine(lines[index + offset] || '');
        if (next && /^\/?\d+年/.test(next)) {
          return `${matched[1]}/${next.replace(/^\/+/, '')}`;
        }
      }
      return matched[1];
    }
  }
  return '';
}

function fallbackAmount(lines) {
  const index = findLooseLabelIndex(lines, LABELS.name);
  const source = index >= 0 ? lines.slice(index + 1, index + 50) : lines;
  for (const raw of source) {
    const line = compactLine(raw);
    if (!line) continue;
    if (/保险合同号|合同号|证件号码|客户号码|保单号|联系电话|邮政编码|营业部代码|业务员姓名及代码/.test(String(raw || ''))) continue;
    if (/年\d{1,2}月\d{1,2}日|合同成立|合同生效|生效日|生效时间/.test(String(raw || ''))) continue;
    if (/^(首期保险费|首年保费|保险费合计|首期保险费合计|总保费|总保险费|每年|[¥￥])/.test(line)) continue;
    if (/^(至20\d{2}年|年交|月交|季交|趸交|一次交清|\/\d+年|\/20\d{2}年)/.test(line)) continue;
    const amount = normalizeAmountValue(raw);
    if (amount) return amount;
  }
  return '';
}

const HORIZONTAL_POLICY_TABLE_HEADERS = [
  { key: 'insured', pattern: /^被保险人(?:姓名)?$/ },
  { key: 'customerNo', pattern: /^客户号码$/ },
  { key: 'name', pattern: /^(保险险种|险种名称|保险名称|主险名称)$/ },
  { key: 'coveragePeriod', pattern: /^(保险期限|保险期间|保障期间)$/ },
  { key: 'paymentYears', pattern: /^(缴费年期|交费年期|缴费年限|交费年限)$/ },
  { key: 'paymentMode', pattern: /^(缴费方式|交费方式)$/ },
  { key: 'amount', pattern: /^(保险金额(?:\(元\)|（元）)?|基本保险金额(?:\(元\)|（元）)?)$/ },
  { key: 'firstPremium', pattern: /^(保险费(?:\(元\)|（元）)?|首期保险费(?:\(元\)|（元）)?|总保费(?:\(人民币\))?)$/ },
];

const INLINE_HORIZONTAL_HEADER_LABELS = [
  { key: 'insured', labels: ['被保险人姓名', '被保险人'] },
  { key: 'customerNo', labels: ['客户号码'] },
  { key: 'name', labels: ['保险险种', '险种名称', '保险名称', '主险名称'] },
  { key: 'coveragePeriod', labels: ['保险期限', '保险期间', '保障期间'] },
  { key: 'paymentYears', labels: ['缴费年期', '交费年期', '缴费年限', '交费年限'] },
  { key: 'paymentMode', labels: ['缴费方式', '交费方式'] },
  { key: 'amount', labels: ['保险金额(元)', '保险金额（元）', '保险金额', '基本保险金额(元)', '基本保险金额（元）', '基本保险金额'] },
  { key: 'firstPremium', labels: ['保险费(元)', '保险费（元）', '保险费', '首期保险费(元)', '首期保险费（元）', '首期保险费', '总保费(人民币)', '总保费'] },
];

function detectHorizontalPolicyHeaderKey(line) {
  const text = compactLine(line);
  if (!text) return '';
  const matched = HORIZONTAL_POLICY_TABLE_HEADERS.find((item) => item.pattern.test(text));
  return matched?.key || '';
}

function isHorizontalPolicySectionTerminator(line) {
  const text = compactLine(line);
  if (!text) return true;
  return /^(身故受益人|第一顺位|第二顺位|本栏以下空白|特别约定|营业部代码|业务员姓名及代码|养老保险领取方式|红利选择|第\d+页)/.test(
    text
  );
}

function parseTailAmountSegment(line) {
  const raw = String(line || '').trim();
  if (!raw) return null;

  const decimalMatches = Array.from(raw.matchAll(/(?:RMB|[¥￥])?\d[\d,]*\.\d{2}(?:元)?/gi));
  const genericMatches = decimalMatches.length
    ? decimalMatches
    : Array.from(raw.matchAll(/(?:RMB|[¥￥])?\d[\d,]*(?:元|万|亿)?/gi));
  const matched = [...genericMatches]
    .reverse()
    .find((item) => normalizeAmountValue(item[0]) || parseAmountValue(item[0]));
  if (!matched?.[0]) return null;

  const amount = normalizeAmountValue(matched[0]) || parseAmountValue(matched[0]);
  if (!amount) return null;
  return {
    amount,
    remaining: cleanupFieldValue(raw.slice(0, matched.index).trim()),
  };
}

function parseTailPaymentMode(line) {
  const matched = String(line || '').match(/(趸交|一次交清|一次性交清|一次性交费|一次性缴清|年缴|年交|月缴|月交|季缴|季交|半年缴|半年交)(?:\s*)$/);
  if (!matched?.[1]) return null;
  return {
    value: matched[1],
    remaining: cleanupFieldValue(String(line || '').slice(0, matched.index).trim()),
  };
}

function parseTailPaymentYears(line) {
  const matched = String(line || '').match(/(\d{1,3})(?:年|期)?(?:\s*)$/);
  if (!matched?.[1]) return null;
  return {
    value: matched[1],
    remaining: cleanupFieldValue(String(line || '').slice(0, matched.index).trim()),
  };
}

function parseTailCoveragePeriod(line) {
  const matched = String(line || '').match(/(终身|至20\d{2}年\d{1,2}月\d{1,2}日(?:零时)?|至\d{2,3}周?岁|\d+年)(?:\s*)$/);
  if (!matched?.[1]) return null;
  return {
    value: matched[1],
    remaining: cleanupFieldValue(String(line || '').slice(0, matched.index).trim()),
  };
}

function splitLeadingInsuredAndCustomerNo(line) {
  const text = cleanupFieldValue(line);
  if (!text) return { insured: '', customerNo: '', remaining: '' };
  const matched = text.match(/^([一-龥·]{2,8})\s*([A-Z]{0,4}\d{6,}[A-Z0-9]*)\s*(.*)$/i);
  if (matched) {
    return {
      insured: normalizePersonNameValue(matched[1]),
      customerNo: matched[2],
      remaining: cleanupFieldValue(matched[3]),
    };
  }
  const nameOnly = text.match(/^([一-龥·]{2,8})\s*(.*)$/);
  return {
    insured: normalizePersonNameValue(nameOnly?.[1] || ''),
    customerNo: '',
    remaining: cleanupFieldValue(nameOnly?.[2] || ''),
  };
}

function mapCompactHorizontalValueLine(headerKeys, line) {
  let remaining = cleanupFieldValue(line);
  if (!remaining) {
    return {
      name: '',
      insured: '',
      coveragePeriod: '',
      paymentPeriod: '',
      amount: '',
      firstPremium: '',
    };
  }

  const mapped = {
    name: '',
    insured: '',
    coveragePeriod: '',
    paymentPeriod: '',
    amount: '',
    firstPremium: '',
  };
  let paymentYears = '';
  let paymentMode = '';

  if (headerKeys.includes('firstPremium')) {
    const parsed = parseTailAmountSegment(remaining);
    if (parsed) {
      mapped.firstPremium = parsed.amount;
      remaining = parsed.remaining;
    }
  }

  if (headerKeys.includes('amount')) {
    const parsed = parseTailAmountSegment(remaining);
    if (parsed) {
      mapped.amount = parsed.amount;
      remaining = parsed.remaining;
    }
  }

  if (headerKeys.includes('paymentMode')) {
    const parsed = parseTailPaymentMode(remaining);
    if (parsed) {
      paymentMode = parsed.value;
      remaining = parsed.remaining;
    }
  }

  if (headerKeys.includes('paymentYears')) {
    const parsed = parseTailPaymentYears(remaining);
    if (parsed) {
      paymentYears = parsed.value;
      remaining = parsed.remaining;
    }
  }

  if (headerKeys.includes('coveragePeriod')) {
    const parsed = parseTailCoveragePeriod(remaining);
    if (parsed) {
      mapped.coveragePeriod = normalizeCoveragePeriodValue(parsed.value);
      remaining = parsed.remaining;
    }
  }

  const leading = splitLeadingInsuredAndCustomerNo(remaining);
  if (headerKeys.includes('insured')) {
    mapped.insured = leading.insured;
  }
  const productSource = headerKeys.includes('customerNo') ? leading.remaining : remaining;
  if (headerKeys.includes('name')) {
    mapped.name = normalizeNameValue(productSource);
  }
  mapped.paymentPeriod = combinePaymentPeriod(paymentYears, paymentMode);
  return mapped;
}

function extractHorizontalTableFields(lines) {
  const source = lines
    .map((line) => ({ raw: cleanupFieldValue(line), compact: compactLine(line) }))
    .filter((item) => item.compact);

  const mapHeaderKeysToValues = (headerKeys, valueTokens) => {
    const mapped = {
      name: '',
      insured: '',
      coveragePeriod: '',
      paymentPeriod: '',
      amount: '',
      firstPremium: '',
    };
    let paymentYears = '';
    let paymentMode = '';

    for (let index = 0; index < Math.min(headerKeys.length, valueTokens.length); index += 1) {
      const key = headerKeys[index];
      const value = valueTokens[index];
      if (!value) continue;
      if (key === 'insured') {
        mapped.insured = normalizePersonNameValue(value);
      } else if (key === 'name') {
        mapped.name = normalizeNameValue(value);
      } else if (key === 'coveragePeriod') {
        mapped.coveragePeriod = normalizeCoveragePeriodValue(value);
      } else if (key === 'paymentYears') {
        paymentYears = value;
      } else if (key === 'paymentMode') {
        paymentMode = value;
      } else if (key === 'amount') {
        mapped.amount = normalizeAmountValue(value);
      } else if (key === 'firstPremium') {
        mapped.firstPremium = normalizeAmountValue(value) || parseAmountValue(value);
      }
    }

    mapped.paymentPeriod = combinePaymentPeriod(paymentYears, paymentMode);
    return mapped;
  };

  for (let start = 0; start < source.length; start += 1) {
    const headerKeys = [];
    let cursor = start;
    while (cursor < source.length) {
      const key = detectHorizontalPolicyHeaderKey(source[cursor].raw);
      if (!key) {
        if (headerKeys.length === 0) break;
        break;
      }
      if (!headerKeys.includes(key)) {
        headerKeys.push(key);
      }
      cursor += 1;
    }

    if (headerKeys.length < 5) continue;

    const values = [];
    let valueCursor = cursor;
    while (valueCursor < source.length && values.length < headerKeys.length) {
      const item = source[valueCursor];
      if (!item.compact) {
        valueCursor += 1;
        continue;
      }
      if (detectHorizontalPolicyHeaderKey(item.raw)) break;
      if (isHorizontalPolicySectionTerminator(item.raw)) break;
      values.push(item.raw);
      valueCursor += 1;
    }

    if (values.length < 1) continue;
    let mapped = mapHeaderKeysToValues(headerKeys, values);
    if ((!mapped.name || !mapped.paymentPeriod || !mapped.amount || !mapped.firstPremium) && values.length === 1) {
      const compactMapped = mapCompactHorizontalValueLine(headerKeys, values[0]);
      if (
        compactMapped.name
        || compactMapped.insured
        || compactMapped.coveragePeriod
        || compactMapped.paymentPeriod
        || compactMapped.amount
        || compactMapped.firstPremium
      ) {
        mapped = compactMapped;
      }
    }
    if ((!mapped.name || !mapped.paymentPeriod || !mapped.amount || !mapped.firstPremium) && values.length === 1) {
      const inlineTokens = values[0].split(/\s+/).map((item) => cleanupFieldValue(item)).filter(Boolean);
      if (inlineTokens.length >= headerKeys.length) {
        mapped = mapHeaderKeysToValues(headerKeys, inlineTokens);
      }
    }
    if (mapped.name || mapped.insured || mapped.coveragePeriod || mapped.paymentPeriod || mapped.amount || mapped.firstPremium) {
      return mapped;
    }
  }

  return {
    name: '',
    insured: '',
    coveragePeriod: '',
    paymentPeriod: '',
    amount: '',
    firstPremium: '',
  };
}

function extractInlineHorizontalTableFields(lines) {
  const source = lines
    .map((line) => ({ raw: cleanupFieldValue(line), compact: compactLine(line) }))
    .filter((item) => item.compact);

  const findHeaderPositions = (line) =>
    INLINE_HORIZONTAL_HEADER_LABELS.flatMap((item) =>
      item.labels.map((label) => ({
        key: item.key,
        index: line.indexOf(compactLine(label)),
        label,
      }))
    )
      .filter((item) => item.index >= 0)
      .sort((a, b) => a.index - b.index);

  for (let index = 0; index < source.length; index += 1) {
    const headerLine = source[index];
    const headerPositions = findHeaderPositions(headerLine.compact);
    if (headerPositions.length < 5) continue;

    const valueLine = source[index + 1];
    if (!valueLine || isHorizontalPolicySectionTerminator(valueLine.raw)) continue;
    if (findHeaderPositions(valueLine.compact).length >= 3) continue;

    const valueTokens = valueLine.raw.split(/\s+/).map((item) => cleanupFieldValue(item)).filter(Boolean);
    if (valueTokens.length < 5) continue;

    const mapped = {
      name: '',
      insured: '',
      coveragePeriod: '',
      paymentPeriod: '',
      amount: '',
      firstPremium: '',
    };
    let paymentYears = '';
    let paymentMode = '';

    for (let cursor = 0; cursor < Math.min(headerPositions.length, valueTokens.length); cursor += 1) {
      const key = headerPositions[cursor].key;
      const token = valueTokens[cursor];
      if (!token) continue;
      if (key === 'insured') mapped.insured = normalizePersonNameValue(token);
      else if (key === 'name') mapped.name = normalizeNameValue(token);
      else if (key === 'coveragePeriod') mapped.coveragePeriod = normalizeCoveragePeriodValue(token);
      else if (key === 'paymentYears') paymentYears = token;
      else if (key === 'paymentMode') paymentMode = token;
      else if (key === 'amount') mapped.amount = normalizeAmountValue(token);
      else if (key === 'firstPremium') mapped.firstPremium = normalizeAmountValue(token) || parseAmountValue(token);
    }

    mapped.paymentPeriod = combinePaymentPeriod(paymentYears, paymentMode);
    if (mapped.name || mapped.insured || mapped.coveragePeriod || mapped.paymentPeriod || mapped.amount || mapped.firstPremium) {
      return mapped;
    }
  }

  return {
    name: '',
    insured: '',
    coveragePeriod: '',
    paymentPeriod: '',
    amount: '',
    firstPremium: '',
  };
}

function extractCompressedHorizontalTableFields(rawText, lines = []) {
  const source = Array.from(
    new Set(
      normalizeOcrText(rawText)
        .split('\n')
        .map((line) => compactLine(line))
        .filter(Boolean)
    )
  );

  const findHeaderPositions = (line) =>
    INLINE_HORIZONTAL_HEADER_LABELS.flatMap((item) =>
      item.labels.map((label) => ({
        key: item.key,
        label: compactLine(label),
        index: line.indexOf(compactLine(label)),
      }))
    )
      .filter((item) => item.index >= 0)
      .sort((a, b) => {
        if (a.index !== b.index) return a.index - b.index;
        return b.label.length - a.label.length;
      });

  for (const line of source) {
    const positions = findHeaderPositions(line);
    if (positions.length < 5) continue;

    const ordered = [];
    for (const item of positions) {
      if (ordered.length && ordered[ordered.length - 1].key === item.key) continue;
      ordered.push(item);
    }

    const lastHeader = ordered[ordered.length - 1];
    if (!lastHeader) continue;
    const tail = cleanupFieldValue(line.slice(lastHeader.index + lastHeader.label.length));
    if (!tail) continue;

    const mapped = mapCompactHorizontalValueLine(
      ordered.map((item) => item.key),
      tail,
    );
    if (mapped.name || mapped.insured || mapped.coveragePeriod || mapped.paymentPeriod || mapped.amount || mapped.firstPremium) {
      return mapped;
    }
  }

  return {
    name: '',
    insured: '',
    coveragePeriod: '',
    paymentPeriod: '',
    amount: '',
    firstPremium: '',
  };
}

function extractLoosePolicyRowFields(lines) {
  const source = lines.map((line) => cleanupFieldValue(line)).filter(Boolean);

  for (const line of source) {
    const text = compactLine(line);
    if (!text) continue;
    if (/^(投保人|被保险人|客户号码|承保日期|合同生效日期|合同成立日期|总保费|身故受益人|第一顺位|第二顺位|特别约定|营业部代码|业务员姓名及代码)/.test(text)) {
      continue;
    }
    if (!/(终身|至20\d{2}年\d{1,2}月\d{1,2}日(?:零时)?|至\d{2,3}周?岁|\d+年)/.test(text)) continue;
    if (!/(年缴|年交|月缴|月交|季缴|季交|趸交|一次交清|一次性交清|一次性交费|一次性缴清)/.test(text)) continue;
    if ((text.match(/\d[\d,.]*(?:元)?/g) || []).length < 2) continue;

    const premiumParsed = parseTailAmountSegment(line);
    if (!premiumParsed) continue;
    const amountParsed = parseTailAmountSegment(premiumParsed.remaining);
    if (!amountParsed) continue;
    const paymentModeParsed = parseTailPaymentMode(amountParsed.remaining);
    if (!paymentModeParsed) continue;
    const paymentYearsParsed = parseTailPaymentYears(paymentModeParsed.remaining);
    if (!paymentYearsParsed) continue;
    const coverageParsed = parseTailCoveragePeriod(paymentYearsParsed.remaining);
    if (!coverageParsed) continue;

    const leading = splitLeadingInsuredAndCustomerNo(coverageParsed.remaining);
    const name = normalizeNameValue(leading.remaining);
    if (!name) continue;

    return {
      name,
      insured: leading.insured,
      coveragePeriod: normalizeCoveragePeriodValue(coverageParsed.value),
      paymentPeriod: combinePaymentPeriod(paymentYearsParsed.value, paymentModeParsed.value),
      amount: amountParsed.amount,
      firstPremium: premiumParsed.amount,
    };
  }

  return {
    name: '',
    insured: '',
    coveragePeriod: '',
    paymentPeriod: '',
    amount: '',
    firstPremium: '',
  };
}

function extractInlineLabeledPolicyFields(lines) {
  const source = lines.map((line) => cleanupFieldValue(line)).filter(Boolean);
  const mapped = {
    applicant: '',
    insured: '',
    name: '',
    date: '',
    paymentPeriod: '',
    coveragePeriod: '',
    amount: '',
    firstPremium: '',
  };
  let paymentYears = '';
  let paymentMode = '';

  const extractInline = (labels, line) => {
    const ordered = [...labels].sort((a, b) => b.length - a.length);
    for (const label of ordered) {
      const pattern = new RegExp(`^${buildLooseLabelPattern(label)}\\s*[:：]?\\s*(.+)$`, 'i');
      const matched = line.match(pattern);
      if (matched?.[1]) return cleanupFieldValue(matched[1]);
    }
    return '';
  };

  for (const line of source) {
    if (!mapped.applicant) {
      const value = extractInline(LABELS.applicant, line);
      if (value) mapped.applicant = normalizePersonNameValue(value);
    }
    if (!mapped.insured) {
      const value = extractInline(LABELS.insured, line);
      if (value) mapped.insured = normalizePersonNameValue(value);
    }
    if (!mapped.name) {
      const value = extractInline(LABELS.name, line);
      if (value) mapped.name = normalizeNameValue(value);
    }
    if (!mapped.date) {
      const value = extractInline(LABELS.date, line);
      if (value) mapped.date = formatDateValue(value);
    }
    if (!paymentYears) {
      paymentYears = extractInline(['缴费年期', '交费年期', '缴费年限', '交费年限'], line) || paymentYears;
    }
    if (!paymentMode) {
      paymentMode = extractInline(['缴费方式', '交费方式'], line) || paymentMode;
    }
    if (!mapped.coveragePeriod) {
      const value = extractInline(LABELS.coveragePeriod, line);
      if (value) mapped.coveragePeriod = normalizeCoveragePeriodValue(value);
    }
    if (!mapped.amount) {
      const value = extractInline(['保险金额(元)', '保险金额（元）', ...LABELS.amount], line);
      if (value) mapped.amount = normalizeAmountValue(value);
    }
    if (!mapped.firstPremium) {
      const value = extractInline(['保险费(元)', '保险费（元）', ...LABELS.firstPremium], line);
      if (value) mapped.firstPremium = normalizeAmountValue(value);
    }
  }

  mapped.paymentPeriod = combinePaymentPeriod(paymentYears, paymentMode);
  return mapped;
}

function extractSequentialTableFields(lines, company) {
  const source = lines.map((line) => compactLine(line)).filter(Boolean);
  const findStandaloneHeaderIndex = (pattern) => source.findIndex((line) => pattern.test(line));
  const headerIndexes = [
    findStandaloneHeaderIndex(/^保险项目$/),
    findStandaloneHeaderIndex(/^保险期间$/),
    findStandaloneHeaderIndex(/^(交费年限|缴费年限|交费期间|缴费期间)$/),
    findStandaloneHeaderIndex(/^(基本保险金额\/份数\/档次|基本保险金额\/保险金额|基本保险金额)$/),
    findStandaloneHeaderIndex(/^保险费$/),
  ].filter((index) => index >= 0);

  if (headerIndexes.length < 5) {
    return { name: '', coveragePeriod: '', paymentPeriod: '', amount: '', firstPremium: '' };
  }

  const values = source.slice(Math.max(...headerIndexes) + 1, Math.max(...headerIndexes) + 16);
  let name = '';
  let coveragePeriod = '';
  let paymentPeriod = '';
  let amount = '';
  let firstPremium = '';

  for (const line of values) {
    if (!line) continue;
    if (/^\(本栏以下空白\)|^特别约定/.test(line)) break;

    const totalPremium = /首期保费合计|首期保险费合计|保险费合计/.test(line) ? parseAmountValue(line) : '';
    if (totalPremium) {
      firstPremium = totalPremium;
      continue;
    }

    if (!name) {
      const normalizedName = normalizeNameValue(line.replace(/^(投保主险|主险|保险项目|投保产品)[:：]?/, ''));
      if (
        normalizedName
        && !looksLikeCompanyName(normalizedName)
        && !/保险单|保险合同|投保人|被保险人|本栏以下空白|首期保费/.test(normalizedName)
        && !normalizeCoveragePeriodValue(normalizedName)
        && !normalizePaymentPeriodValue(normalizedName)
        && !/^[¥￥]?\d+(?:[,.]\d+)?(?:元|万|亿)?$/.test(normalizedName)
      ) {
        name = normalizedName;
        continue;
      }
    }

    if (!coveragePeriod) {
      const coverageValue = normalizeCoveragePeriodValue(line);
      if (coverageValue) {
        coveragePeriod = coverageValue;
        continue;
      }
    }

    if (!paymentPeriod) {
      const paymentValue = normalizePaymentPeriodValue(line);
      if (paymentValue) {
        paymentPeriod = paymentValue;
        continue;
      }
    }

    const amountValue = /^[¥￥]?\d[\d,.]*(?:元|万|亿)?$/.test(line) ? normalizeAmountValue(line) : '';
    if (amountValue) {
      if (!amount) {
        amount = amountValue;
        continue;
      }
      if (!firstPremium) {
        firstPremium = amountValue;
      }
    }
  }

  return {
    name,
    coveragePeriod,
    paymentPeriod,
    amount,
    firstPremium,
  };
}

function extractPrimaryPlanRowFields(lines) {
  const source = lines.map((line) => compactLine(line)).filter(Boolean);
  const productIndex = source.findIndex((line) => /^(投保主险|主险)[:：]?/.test(line));
  if (productIndex < 0) {
    return { name: '', coveragePeriod: '', paymentPeriod: '', amount: '', firstPremium: '' };
  }

  const inlineLine = source[productIndex].replace(/^(投保主险|主险)[:：]?/, '');
  let name = '';
  let coveragePeriod = '';
  let paymentPeriod = '';
  let amount = '';
  let firstPremium = '';

  const inlineCoverageMatch = inlineLine.match(/(终身|至20\d{2}年\d{1,2}月\d{1,2}日(?:零时)?|至\d{2,3}周?岁|\d+年)/);
  if (inlineCoverageMatch?.index != null) {
    const rawName = inlineLine.slice(0, inlineCoverageMatch.index);
    const rest = inlineLine.slice(inlineCoverageMatch.index + inlineCoverageMatch[1].length);
    const rawAmounts = [
      ...rest.matchAll(/(?:RMB|[¥￥])?\d[\d,]*(?:\.\d+)?元|RMB\d[\d,]*(?:\.\d+)?/gi),
    ]
      .map((matched) => normalizeAmountValue(String(matched[0] || '')))
      .filter(Boolean);

    name = normalizeNameValue(rawName);
    coveragePeriod = normalizeCoveragePeriodValue(inlineCoverageMatch[1]);

    const paymentMatch = rest.match(/(趸交|一次交清|一次性交清|一次性交费|一次性缴清|\d+年(?:交)?|年交|月交|季交|半年交)/);
    if (paymentMatch?.[1]) {
      paymentPeriod = normalizePaymentPeriodValue(paymentMatch[1]);
    }

    if (rawAmounts[0]) amount = rawAmounts[0];
    if (rawAmounts[1]) firstPremium = rawAmounts[1];
  }

  if (!name) {
    name = normalizeNameValue(inlineLine);
  }

  for (const line of source.slice(productIndex + 1, productIndex + 8)) {
    if (!coveragePeriod) {
      const coverageValue = normalizeCoveragePeriodValue(line);
      if (coverageValue) {
        coveragePeriod = coverageValue;
        continue;
      }
    }

    if (!paymentPeriod) {
      const paymentValue = normalizePaymentPeriodValue(line);
      if (paymentValue) {
        paymentPeriod = paymentValue;
        continue;
      }
    }

    const amountValue = /^[¥￥]?\d[\d,.]*(?:元|万|亿)?$/.test(line) ? normalizeAmountValue(line) : '';
    if (amountValue) {
      if (!amount) {
        amount = amountValue;
        continue;
      }
      if (!firstPremium) {
        firstPremium = amountValue;
      }
    }
  }

  if (!firstPremium) {
    for (const line of source.slice(productIndex, productIndex + 24)) {
      if (/首期保费合计|首期保险费合计|保险费合计/.test(line)) {
        const totalPremium = parseAmountValue(line);
        if (totalPremium) {
          firstPremium = totalPremium;
          break;
        }
      }
    }
  }

  return {
    name,
    coveragePeriod,
    paymentPeriod,
    amount,
    firstPremium,
  };
}

function mergeRecognizedTextCandidates(...texts) {
  const lines = [];
  const seen = new Set();
  for (const raw of texts) {
    for (const line of splitRecognizedLines(raw)) {
      const key = compactLine(line).toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      lines.push(cleanupFieldValue(line));
    }
  }
  return normalizeOcrText(lines.join('\n'));
}

function scorePolicyData(data) {
  let score = 0;
  if (data.company) score += 2;
  if (data.name) score += 3;
  if (data.applicant) score += 1.5;
  if (data.insured) score += 1.5;
  if (data.date) score += 1.5;
  if (data.paymentPeriod) score += 1;
  if (data.coveragePeriod) score += 1;
  if (data.amount) score += 2;
  if (data.firstPremium) score += 2;
  return score;
}

function pickFirstNonEmpty(values) {
  return values.find(Boolean) || '';
}

function pickLongest(values) {
  return values
    .filter(Boolean)
    .sort((a, b) => String(b).length - String(a).length)[0] || '';
}

function pickBestPaymentPeriod(values) {
  return values
    .filter(Boolean)
    .sort((a, b) => {
      const scoreA = (String(a).includes('/') ? 2 : 0) + String(a).length;
      const scoreB = (String(b).includes('/') ? 2 : 0) + String(b).length;
      return scoreB - scoreA;
    })[0] || '';
}

function pickLargestNumeric(values) {
  return values
    .filter(Boolean)
    .map((value) => ({ raw: String(value), num: Number(value) }))
    .filter((item) => Number.isFinite(item.num) && item.num > 0)
    .sort((a, b) => b.num - a.num)[0]?.raw || '';
}

function mergePolicyDataCandidates(dataList) {
  return {
    company: pickFirstNonEmpty(dataList.map((item) => item?.company || '')),
    name: pickLongest(dataList.map((item) => item?.name || '')),
    applicant: pickFirstNonEmpty(dataList.map((item) => item?.applicant || '')),
    insured: pickFirstNonEmpty(dataList.map((item) => item?.insured || '')),
    date: pickFirstNonEmpty(dataList.map((item) => item?.date || '')),
    paymentPeriod: pickBestPaymentPeriod(dataList.map((item) => item?.paymentPeriod || '')),
    coveragePeriod: pickLongest(dataList.map((item) => item?.coveragePeriod || '')),
    amount: pickLargestNumeric(dataList.map((item) => item?.amount || '')),
    firstPremium: pickLargestNumeric(dataList.map((item) => item?.firstPremium || '')),
  };
}

export function selectBestPolicyScanCandidate(texts) {
  const uniqueTexts = [];
  const seen = new Set();
  for (const raw of texts) {
    const normalized = normalizeOcrText(raw);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    uniqueTexts.push(normalized);
  }

  const evaluated = uniqueTexts.map((text) => ({
    ocrText: text,
    data: extractPolicyFieldsFromText(text),
  }));

  let best = { score: -1, data: null, ocrText: '' };
  for (const item of evaluated) {
    const data = item.data;
    const score = scorePolicyData(data);
    if (score > best.score) {
      best = { score, data, ocrText: item.ocrText };
    }
  }

  if (evaluated.length > 1) {
    const mergedData = mergePolicyDataCandidates(evaluated.map((item) => item.data));
    const mergedText = mergeRecognizedTextCandidates(...uniqueTexts);
    const mergedScore = scorePolicyData(mergedData);
    if (mergedScore >= best.score) {
      best = { score: mergedScore, data: mergedData, ocrText: mergedText };
    }
  }

  return best;
}

export function extractPolicyFieldsFromText(rawText) {
  const lines = splitRecognizedLines(rawText);
  const isTableStyle = lines.some((line) => /保险利益表/.test(line)) && findLooseLabelIndex(lines, LABELS.name) >= 0;
  const headerCompany = extractHeaderCompany(lines, rawText);
  const company = normalizeCompanyName(
    headerCompany || extractByLabels(lines, LABELS.company) || cleanupFieldValue(fallbackCompany(lines)) || findCompanyAlias(rawText)
  );
  const inlineLabeledData = extractInlineLabeledPolicyFields(lines);
  const horizontalTableData = extractHorizontalTableFields(lines);
  const inlineHorizontalTableData = extractInlineHorizontalTableFields(lines);
  const compressedHorizontalTableData = extractCompressedHorizontalTableFields(rawText, lines);
  const loosePolicyRowData = extractLoosePolicyRowFields(lines);
  const sequentialTableData = extractSequentialTableFields(lines, company);
  const primaryPlanRowData = extractPrimaryPlanRowFields(lines);
  const tableProductNames = collectTablePolicyProductNames(lines, company);
  const tableName =
    tableProductNames.filter(Boolean).join(' / ')
    || normalizeNameValue(fallbackTableProductName(lines))
    || normalizeNameValue(fallbackLooseProductName(lines, company));
  const genericName =
    normalizeNameValue(
      extractByLabels(lines, LABELS.name, [
        '客户号码',
        '身故受益人',
        '第一顺位',
        '第二顺位',
        ...LABELS.applicant,
        ...LABELS.insured,
        ...LABELS.date,
        ...LABELS.paymentPeriod,
        ...LABELS.coveragePeriod,
        ...LABELS.amount,
        ...LABELS.firstPremium,
      ])
    )
    || normalizeNameValue(fallbackProductName(lines, company));
  const name =
    inlineLabeledData.name
    ||
    compressedHorizontalTableData.name
    ||
    inlineHorizontalTableData.name
    ||
    horizontalTableData.name
    || loosePolicyRowData.name
    || (isTableStyle ? tableName : '')
    || primaryPlanRowData.name
    || sequentialTableData.name
    || genericName
    || tableName;
  const applicant = inlineLabeledData.applicant || normalizePersonNameValue(extractByLabels(lines, LABELS.applicant, LABELS.insured));
  const insured =
    inlineLabeledData.insured
    ||
    compressedHorizontalTableData.insured
    ||
    inlineHorizontalTableData.insured
    ||
    horizontalTableData.insured
    || loosePolicyRowData.insured
    || normalizePersonNameValue(
      extractByLabels(lines, LABELS.insured, [
        '客户号码',
        '保险险种',
        ...LABELS.date,
        ...LABELS.paymentPeriod,
        ...LABELS.coveragePeriod,
        ...LABELS.amount,
      ])
    );
  const date = inlineLabeledData.date || extractPreferredDate(lines);
  const paymentPeriod =
    inlineLabeledData.paymentPeriod
    ||
    compressedHorizontalTableData.paymentPeriod
    ||
    inlineHorizontalTableData.paymentPeriod
    ||
    horizontalTableData.paymentPeriod
    || loosePolicyRowData.paymentPeriod
    ||
    (isTableStyle ? fallbackPaymentPeriod(lines) : '')
    || primaryPlanRowData.paymentPeriod
    || sequentialTableData.paymentPeriod
    || normalizePaymentPeriodValue(extractByLabels(lines, LABELS.paymentPeriod, LABELS.coveragePeriod))
    || fallbackPaymentPeriod(lines);
  const coveragePeriod =
    inlineLabeledData.coveragePeriod
    ||
    compressedHorizontalTableData.coveragePeriod
    ||
    inlineHorizontalTableData.coveragePeriod
    ||
    horizontalTableData.coveragePeriod
    || loosePolicyRowData.coveragePeriod
    ||
    (isTableStyle ? normalizeCoveragePeriodValue(fallbackCoveragePeriod(lines)) : '')
    || primaryPlanRowData.coveragePeriod
    || sequentialTableData.coveragePeriod
    || normalizeCoveragePeriodValue(extractByLabels(lines, LABELS.coveragePeriod, LABELS.amount))
    || normalizeCoveragePeriodValue(fallbackCoveragePeriod(lines));
  const amount =
    inlineLabeledData.amount
    ||
    compressedHorizontalTableData.amount
    ||
    inlineHorizontalTableData.amount
    ||
    horizontalTableData.amount
    || loosePolicyRowData.amount
    ||
    (isTableStyle ? fallbackAmount(lines) : '')
    || primaryPlanRowData.amount
    || sequentialTableData.amount
    || normalizeAmountValue(extractByLabels(lines, LABELS.amount, LABELS.firstPremium))
    || fallbackAmount(lines);
  const firstPremium =
    inlineLabeledData.firstPremium
    ||
    compressedHorizontalTableData.firstPremium
    ||
    inlineHorizontalTableData.firstPremium
    ||
    horizontalTableData.firstPremium
    || loosePolicyRowData.firstPremium
    ||
    (isTableStyle ? fallbackFirstPremium(lines) : '')
    || primaryPlanRowData.firstPremium
    || sequentialTableData.firstPremium
    || normalizeAmountValue(extractByLabels(lines, LABELS.firstPremium))
    || fallbackFirstPremium(lines);

  return {
    company,
    name,
    applicant,
    insured,
    date,
    paymentPeriod,
    coveragePeriod,
    amount,
    firstPremium,
  };
}

function inferFileExtension(name, mimeType) {
  const fileName = String(name || '').trim().toLowerCase();
  const mime = String(mimeType || '').trim().toLowerCase();
  if (fileName.endsWith('.png') || mime === 'image/png') return '.png';
  if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || mime === 'image/jpeg') return '.jpg';
  if (fileName.endsWith('.heic') || mime === 'image/heic' || mime === 'image/heif') return '.heic';
  if (fileName.endsWith('.webp') || mime === 'image/webp') return '.webp';
  return '.jpg';
}

function parseDataUrl(uploadItem) {
  const dataUrl = String(uploadItem?.dataUrl || '').trim();
  const type = String(uploadItem?.type || '').trim().toLowerCase();
  if (!dataUrl.startsWith('data:')) throw new Error('INVALID_DATA_URL');
  const matched = dataUrl.match(/^data:([^;,]+)?;base64,(.+)$/);
  if (!matched?.[2]) throw new Error('INVALID_DATA_URL');
  const mimeType = String(matched[1] || type || '').trim().toLowerCase();
  if (!mimeType.startsWith('image/')) throw new Error('POLICY_SCAN_TYPE_UNSUPPORTED');
  const buffer = Buffer.from(matched[2], 'base64');
  if (!buffer.length) throw new Error('INVALID_DATA_URL');
  if (buffer.length > DEFAULT_MAX_SCAN_BYTES) throw new Error('FILE_TOO_LARGE');
  return { mimeType, buffer };
}

function getConfiguredOcrProvider() {
  const provider = String(process.env.POLICY_OCR_PROVIDER || OCR_PROVIDER_LOCAL)
    .trim()
    .toLowerCase();
  return provider || OCR_PROVIDER_LOCAL;
}

function getConfiguredOcrPostprocessor() {
  const value = String(process.env.POLICY_OCR_POSTPROCESSOR || OCR_POSTPROCESSOR_NONE)
    .trim()
    .toLowerCase();
  return value || OCR_POSTPROCESSOR_NONE;
}

function getConfiguredOllamaBaseUrl() {
  return String(process.env.POLICY_OCR_OLLAMA_BASE_URL || 'http://127.0.0.1:11434').trim().replace(/\/+$/, '');
}

function getConfiguredOllamaModel() {
  return String(process.env.POLICY_OCR_OLLAMA_MODEL || 'qwen2.5:0.5b').trim();
}

function getConfiguredOllamaVisionModel() {
  return String(process.env.POLICY_OCR_OLLAMA_VISION_MODEL || 'qwen2.5vl:3b').trim();
}

function getConfiguredOllamaVisionNumCtx() {
  const value = Number(process.env.POLICY_OCR_OLLAMA_VISION_NUM_CTX || 512);
  return Number.isFinite(value) && value >= 128 ? Math.trunc(value) : 512;
}

function getConfiguredOllamaTimeoutMs() {
  const value = Number(process.env.POLICY_OCR_OLLAMA_TIMEOUT_MS || 45000);
  return Number.isFinite(value) && value > 1000 ? value : 45000;
}

function extractJsonObjectBlock(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const fenceMatched = raw.match(/```json\s*([\s\S]+?)```/i) || raw.match(/```\s*([\s\S]+?)```/i);
  const candidate = fenceMatched?.[1] || raw;
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  if (firstBrace < 0 || lastBrace < 0 || lastBrace <= firstBrace) return null;
  return candidate.slice(firstBrace, lastBrace + 1);
}

async function postprocessPolicyFieldsWithOllama(ocrText, baseData, fetchImpl = fetch) {
  const normalizedText = normalizeOcrText(ocrText);
  if (!normalizedText) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), getConfiguredOllamaTimeoutMs());
  try {
    const response = await fetchImpl(`${getConfiguredOllamaBaseUrl()}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: getConfiguredOllamaModel(),
        stream: false,
        options: { temperature: 0 },
        messages: [
          {
            role: 'system',
            content:
              '你是保险保单OCR纠错助手。只能根据OCR原文提取字段，不能臆造。只输出JSON，不要解释。若字段不确定就返回空字符串。',
          },
          {
            role: 'user',
            content: [
              '请从下面的保单OCR文本中提取字段，并输出 JSON：',
              '{"company":"","name":"","applicant":"","insured":"","date":"","paymentPeriod":"","coveragePeriod":"","amount":"","firstPremium":""}',
              '要求：',
              '1. 保险公司优先识别页眉保司全称或英文品牌，例如 PING AN -> 中国平安保险。',
              '2. 如果出现横向表头和下一行数据，要按表头对应值抽取。',
              '3. date 使用 YYYY-MM-DD。',
              '4. paymentPeriod 用如 25年交、10年交、趸交。',
              '5. amount 和 firstPremium 只保留数字，不要逗号和单位。',
              '6. 不要把 保单号/客户号码/联系电话 当作保额或保费。',
              '',
              '当前规则解析结果（仅供参考，错了可以纠正）：',
              JSON.stringify(baseData || {}, null, 2),
              '',
              'OCR原文：',
              normalizedText,
            ].join('\n'),
          },
        ],
      }),
    });

    if (!response.ok) throw new Error('POLICY_OCR_POSTPROCESSOR_FAILED');
    const payload = await response.json().catch(() => null);
    const content = String(payload?.message?.content || payload?.response || '').trim();
    const jsonBlock = extractJsonObjectBlock(content);
    if (!jsonBlock) return null;
    const parsed = JSON.parse(jsonBlock);
    const normalized = normalizeExtractedPolicyFields(parsed);
    return Object.values(normalized).some(Boolean) ? normalized : null;
  } catch (error) {
    const message = String(error?.message || error || '');
    if (message.includes('AbortError')) {
      throw new Error('POLICY_OCR_POSTPROCESSOR_TIMEOUT');
    }
    throw new Error('POLICY_OCR_POSTPROCESSOR_FAILED');
  } finally {
    clearTimeout(timer);
  }
}

export async function extractPolicyFieldsFromImageWithOllamaVision(uploadItem, fetchImpl = fetch) {
  if (!uploadItem) throw new Error('POLICY_SCAN_INPUT_REQUIRED');
  const { buffer } = parseDataUrl(uploadItem);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), getConfiguredOllamaTimeoutMs());
  try {
    const response = await fetchImpl(`${getConfiguredOllamaBaseUrl()}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: getConfiguredOllamaVisionModel(),
        stream: false,
        options: { temperature: 0, num_ctx: getConfiguredOllamaVisionNumCtx() },
        messages: [
          {
            role: 'system',
            content:
              '你是保险保单视觉识别助手。只能根据图片提取字段，不能臆造。只输出JSON，不要解释。若字段不确定就返回空字符串。',
          },
          {
            role: 'user',
            content: [
              '请直接阅读这张保单图片，并输出 JSON：',
              '{"company":"","name":"","applicant":"","insured":"","date":"","paymentPeriod":"","coveragePeriod":"","amount":"","firstPremium":""}',
              '要求：',
              '1. 保险公司优先识别页眉保司名称或英文品牌，例如 PING AN -> 中国平安保险。',
              '2. 表格里上面是标题、下面或右侧是对应值时，必须按标题和值一一匹配。',
              '3. date 使用 YYYY-MM-DD。',
              '4. paymentPeriod 用如 25年交、10年交、趸交。',
              '5. amount 和 firstPremium 只保留数字，不要逗号和单位。',
              '6. 不要把 保单号/客户号码/联系电话/证件号码 当作保额或保费。',
            ].join('\n'),
            images: [buffer.toString('base64')],
          },
        ],
      }),
    });

    if (!response.ok) throw new Error('POLICY_OCR_VISION_FAILED');
    const payload = await response.json().catch(() => null);
    const content = String(payload?.message?.content || payload?.response || '').trim();
    const jsonBlock = extractJsonObjectBlock(content);
    if (!jsonBlock) return null;
    const parsed = JSON.parse(jsonBlock);
    const normalized = normalizeExtractedPolicyFields(parsed);
    return Object.values(normalized).some(Boolean) ? normalized : null;
  } catch (error) {
    const message = String(error?.message || error || '');
    if (message.includes('AbortError')) {
      throw new Error('POLICY_OCR_VISION_TIMEOUT');
    }
    throw new Error('POLICY_OCR_VISION_FAILED');
  } finally {
    clearTimeout(timer);
  }
}

export function extractBaiduPrivateOcrText(payload) {
  const candidateArrays = [
    payload?.words_result,
    payload?.data?.words_result,
    payload?.result?.words_result,
    payload?.ret,
    payload?.data?.ret,
    payload?.results,
  ];

  for (const candidate of candidateArrays) {
    if (!Array.isArray(candidate)) continue;
    const joined = candidate
      .map((item) => cleanupFieldValue(item?.words || item?.word || item?.text || item?.content || item?.value || ''))
      .filter(Boolean)
      .join('\n');
    const normalized = normalizeOcrText(joined);
    if (normalized) return normalized;
  }

  const directText = normalizeOcrText(payload?.text || payload?.data?.text || payload?.result?.text || '');
  return directText;
}

export function extractPaddleOcrText(payload) {
  const lineArrays = [
    payload?.lines,
    payload?.data?.lines,
    payload?.result?.lines,
    ...(Array.isArray(payload?.result) ? payload.result.map((item) => item?.res?.rec_texts || item?.rec_texts) : []),
  ];

  for (const candidate of lineArrays) {
    if (!Array.isArray(candidate)) continue;
    const joined = candidate
      .map((item) => cleanupFieldValue(item?.words || item?.word || item?.text || item?.content || item?.value || item || ''))
      .filter(Boolean)
      .join('\n');
    const normalized = normalizeOcrText(joined);
    if (normalized) return normalized;
  }

  return normalizeOcrText(payload?.ocrText || payload?.text || payload?.data?.ocrText || payload?.result?.ocrText || '');
}

function buildBaiduPrivateRequest(uploadItem) {
  const { buffer } = parseDataUrl(uploadItem);
  const rawUrl = String(process.env.POLICY_OCR_BAIDU_PRIVATE_URL || '').trim();
  if (!rawUrl) throw new Error('POLICY_OCR_PROVIDER_NOT_CONFIGURED');

  const requestUrl = new URL(rawUrl);
  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  const token = String(process.env.POLICY_OCR_BAIDU_PRIVATE_ACCESS_TOKEN || '').trim();
  const authMode = String(process.env.POLICY_OCR_BAIDU_PRIVATE_AUTH_MODE || (token ? 'query' : 'none'))
    .trim()
    .toLowerCase();
  const authHeader = String(process.env.POLICY_OCR_BAIDU_PRIVATE_AUTH_HEADER || 'X-Auth-Token').trim() || 'X-Auth-Token';

  if (token) {
    if (authMode === 'query') {
      requestUrl.searchParams.set('access_token', token);
    } else if (authMode === 'bearer') {
      headers.Authorization = `Bearer ${token}`;
    } else if (authMode === 'header') {
      headers[authHeader] = token;
    }
  }

  const body = new URLSearchParams();
  body.set('image', buffer.toString('base64'));
  body.set('detect_direction', 'true');
  body.set('probability', 'true');
  return {
    url: requestUrl.toString(),
    headers,
    body,
  };
}

async function recognizeTextWithVision(uploadItem) {
  const { mimeType, buffer } = parseDataUrl(uploadItem);
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'policy-ocr-'));
  const absPath = path.join(tmpDir, `scan${inferFileExtension(uploadItem?.name, mimeType)}`);
  try {
    await writeFile(absPath, buffer);
    const { stdout } = await execFileAsync('swift', [OCR_SWIFT_SCRIPT, absPath], {
      timeout: 15000,
      maxBuffer: 10 * 1024 * 1024,
    });
    return normalizeOcrText(stdout);
  } catch (err) {
    const message = String(err?.message || err || '');
    if (message.includes('POLICY_OCR_EMPTY')) throw new Error('POLICY_OCR_EMPTY');
    throw new Error('POLICY_OCR_FAILED');
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

function getConfiguredPaddlePython() {
  const explicitPython = String(process.env.POLICY_OCR_PADDLE_PYTHON || '').trim();
  if (explicitPython) return explicitPython;
  return 'python3';
}

async function warmupPaddleLocalIfNeeded() {
  const provider = getConfiguredOcrProvider();
  if (provider !== OCR_PROVIDER_PADDLE_LOCAL) return;
  if (paddleWarmupPromise) return paddleWarmupPromise;

  const env = { ...process.env };
  const projectDir = String(env.POLICY_OCR_PADDLE_PROJECT_DIR || '').trim();
  const pythonCmd = getConfiguredPaddlePython();

  paddleWarmupPromise = execFileAsync(pythonCmd, [OCR_PADDLE_SCRIPT, '--warmup'], {
    env,
    cwd: projectDir || undefined,
    timeout: 60000,
    maxBuffer: 10 * 1024 * 1024,
  })
    .catch(() => undefined)
    .finally(() => {
      paddleWarmupPromise = Promise.resolve();
    });

  return paddleWarmupPromise;
}

async function recognizeTextWithPaddleLocal(uploadItem) {
  await warmupPaddleLocalIfNeeded();
  const { mimeType, buffer } = parseDataUrl(uploadItem);
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'policy-ocr-paddle-'));
  const absPath = path.join(tmpDir, `scan${inferFileExtension(uploadItem?.name, mimeType)}`);
  try {
    await writeFile(absPath, buffer);
    const env = { ...process.env };
    const projectDir = String(env.POLICY_OCR_PADDLE_PROJECT_DIR || '').trim();
    const pythonCmd = getConfiguredPaddlePython();
    const { stdout } = await execFileAsync(pythonCmd, [OCR_PADDLE_SCRIPT, absPath], {
      env,
      cwd: projectDir || undefined,
      timeout: 60000,
      maxBuffer: 20 * 1024 * 1024,
    });
    let payload = null;
    try {
      payload = JSON.parse(stdout);
    } catch {
      throw new Error('POLICY_OCR_FAILED');
    }
    const recognized = extractPaddleOcrText(payload);
    if (!recognized) throw new Error('POLICY_OCR_EMPTY');
    return recognized;
  } catch (err) {
    const message = String(err?.stderr || err?.message || err || '');
    if (message.includes('POLICY_OCR_EMPTY')) throw new Error('POLICY_OCR_EMPTY');
    if (message.includes('POLICY_OCR_PADDLE_IMPORT_FAILED')) throw new Error('POLICY_OCR_PROVIDER_NOT_READY');
    throw new Error('POLICY_OCR_FAILED');
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function recognizeTextWithBaiduPrivate(uploadItem) {
  const request = buildBaiduPrivateRequest(uploadItem);
  let response;
  try {
    response = await fetch(request.url, {
      method: 'POST',
      headers: request.headers,
      body: request.body,
    });
  } catch {
    throw new Error('POLICY_OCR_FAILED');
  }

  if (!response.ok) {
    throw new Error('POLICY_OCR_FAILED');
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    throw new Error('POLICY_OCR_FAILED');
  }

  const recognized = extractBaiduPrivateOcrText(payload);
  if (!recognized) throw new Error('POLICY_OCR_EMPTY');
  return recognized;
}

async function recognizeTextFromUpload(uploadItem) {
  const provider = getConfiguredOcrProvider();
  if (provider === OCR_PROVIDER_BAIDU_PRIVATE) {
    return recognizeTextWithBaiduPrivate(uploadItem);
  }
  if (provider === OCR_PROVIDER_PADDLE_LOCAL) {
    return recognizeTextWithPaddleLocal(uploadItem);
  }
  return recognizeTextWithVision(uploadItem);
}

export async function scanInsurancePolicyLocal({ uploadItem, ocrText }) {
  const recognizedText = normalizeOcrText(ocrText);
  if (!recognizedText && !uploadItem) throw new Error('POLICY_SCAN_INPUT_REQUIRED');

  let data = null;
  let bestOcrText = recognizedText;
  if (recognizedText) {
    data = extractPolicyFieldsFromText(recognizedText);
  } else {
    const provider = getConfiguredOcrProvider();
    if (provider === OCR_PROVIDER_OLLAMA_VISION_LOCAL) {
      data = await extractPolicyFieldsFromImageWithOllamaVision(uploadItem);
      bestOcrText = '';
    } else {
      const candidates = [];
      if (provider === OCR_PROVIDER_PADDLE_LOCAL) {
        const paddleText = await recognizeTextWithPaddleLocal(uploadItem);
        candidates.push(paddleText);
      } else {
        candidates.push(await recognizeTextFromUpload(uploadItem));
      }
      const best = selectBestPolicyScanCandidate(candidates);
      data = best.data;
      bestOcrText = best.ocrText;
    }
  }

  if (getConfiguredOcrProvider() !== OCR_PROVIDER_OLLAMA_VISION_LOCAL && getConfiguredOcrPostprocessor() === OCR_POSTPROCESSOR_OLLAMA_QWEN && bestOcrText) {
    try {
      const llmData = await postprocessPolicyFieldsWithOllama(bestOcrText, data);
      if (llmData) {
        const merged = mergePolicyDataCandidates([data, llmData]);
        if (scorePolicyData(merged) >= scorePolicyData(data)) {
          data = merged;
        }
      }
    } catch {
      // Keep OCR flow available even when the local LLM is unavailable.
    }
  }

  if (!Object.values(data).some(Boolean)) throw new Error('POLICY_OCR_EMPTY');
  return {
    ok: true,
    data,
    ocrText: bestOcrText,
  };
}

function shouldForceLocalOcr(env = process.env) {
  return String(env.POLICY_OCR_FORCE_LOCAL || '').trim().toLowerCase() === 'true';
}

export async function scanInsurancePolicy({ uploadItem, ocrText }) {
  if (!shouldForceLocalOcr() && hasConfiguredOcrServiceBaseUrl()) {
    return scanInsurancePolicyOverHttp({ uploadItem, ocrText });
  }
  return scanInsurancePolicyLocal({ uploadItem, ocrText });
}

void warmupPaddleLocalIfNeeded();
