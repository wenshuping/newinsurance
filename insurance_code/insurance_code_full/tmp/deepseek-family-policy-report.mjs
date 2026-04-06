import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const cwd = process.cwd();
const args = process.argv.slice(2);
const piiFieldPattern = /(?:^|_)(?:name|full_name|real_name|customer_name|insured_name|applicant_name|holder_name|family_name|id_no|id_number|id_card|identity_no|identity_number|certificate_no|cert_no|phone|mobile|mobile_phone|telephone|tel|contact_phone|contact_mobile|email|mail|wechat|wx)(?:$|_)/i;
const nonPiiNameFields = new Set([
  'report_name',
  'product_name',
  'generator_name',
  'company_name',
  'insurer_name',
  'plan_name',
  'policy_name',
]);
const childRolePattern = /(子女|孩子|女儿|儿子)/;
const elderRolePattern = /(老人|父亲|母亲|爸爸|妈妈|公公|婆婆|岳父|岳母|爷爷|奶奶|外公|外婆)/;

function getArg(name, fallback = '') {
  const exact = args.find((item) => item.startsWith(`${name}=`));
  if (exact) return exact.slice(name.length + 1);
  const idx = args.indexOf(name);
  if (idx >= 0 && args[idx + 1]) return args[idx + 1];
  return fallback;
}

const inputPath = path.resolve(cwd, getArg('--input', './tmp/family-policy-report-sample-input.json'));
const outputPath = path.resolve(cwd, getArg('--output', './tmp/family-policy-report-sample-output.md'));
const rulesPath = path.resolve(cwd, getArg('--rules', './docs/family-policy-report-deepseek-rules-v1.md'));
const sanitizedPathArg = getArg('--sanitized-output', '');
const sanitizedOutputPath = sanitizedPathArg ? path.resolve(cwd, sanitizedPathArg) : '';
const apiKey = String(process.env.DEEPSEEK_API_KEY || '').trim();

if (!apiKey) {
  console.error('Missing DEEPSEEK_API_KEY');
  process.exit(1);
}

const rulesText = await readFile(rulesPath, 'utf8');
const inputText = await readFile(inputPath, 'utf8');
const inputJson = JSON.parse(inputText);

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

  if (typeof source.name === 'string' && source.name.trim()) {
    const alias = nextAliasForRole(String(source.role || source.relation || ''), state);
    aliasMap.set(source.name.trim(), alias);
  }

  if (typeof source.insured === 'string' && source.insured.trim() && !aliasMap.has(source.insured.trim())) {
    const alias = nextAliasForRole(String(source.role || source.relation || ''), state);
    aliasMap.set(source.insured.trim(), alias);
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

  result = result
    .replace(/\b1[3-9]\d{9}\b/g, '[已脱敏手机号]')
    .replace(/\b\d{17}[\dXx]\b/g, '[已脱敏身份证号]')
    .replace(/\b\d{15}\b/g, '[已脱敏证件号]');

  return result;
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

    if (key === 'insured' && typeof value === 'string') {
      result[key] = aliasMap.get(value.trim()) || '家庭成员';
      continue;
    }

    result[key] = sanitizeForLLM(value, aliasMap);
  }

  return result;
}

function hasMeaningfulValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function detectPolicyDetailLevel(input) {
  const policies = Array.isArray(input.policy_facts) ? input.policy_facts : [];

  if (!policies.length) {
    return {
      level: 'basic',
      reason: '未检测到 policy_facts，按基础信息模式处理',
    };
  }

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

  const partialKeys = [
    'mapping_summary',
    'known_from_user',
    'coverage_hints',
    'benefit_hints',
    'product_type_hint',
    'user_summary',
  ];

  let detailedScore = 0;
  let partialScore = 0;

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

  if (partialScore > 0) {
    return {
      level: 'partial',
      reason: '检测到部分保单事实或保障提示，按部分信息模式处理',
    };
  }

  return {
    level: 'basic',
    reason: '仅检测到产品名或基础投保信息，按基础信息模式处理',
  };
}

const aliasMap = collectNameAliases(inputJson);
const sanitizedInputJson = sanitizeForLLM(inputJson, aliasMap);
const detailMode = detectPolicyDetailLevel(sanitizedInputJson);

const llmInputJson = {
  ...sanitizedInputJson,
  _input_meta: {
    privacy_mode: 'desensitized',
    policy_detail_level: detailMode.level,
    policy_detail_reason: detailMode.reason,
  },
};

if (sanitizedOutputPath) {
  await writeFile(sanitizedOutputPath, JSON.stringify(llmInputJson, null, 2) + '\n', 'utf8');
}

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
  '',
  '结构化数据如下：',
  '```json',
  JSON.stringify(llmInputJson, null, 2),
  '```',
].join('\n');

const requestBody = {
  model: 'deepseek-chat',
  temperature: 0.7,
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ],
};

let resp;
let lastError;

for (let attempt = 1; attempt <= 3; attempt += 1) {
  try {
    resp = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(120000),
    });
    lastError = null;
    break;
  } catch (err) {
    lastError = err;
    if (attempt === 3) break;
    await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
  }
}

if (!resp && lastError) {
  console.error(lastError);
  process.exit(1);
}

if (!resp.ok) {
  const errText = await resp.text();
  console.error(`DeepSeek request failed: ${resp.status}`);
  console.error(errText);
  process.exit(1);
}

const data = await resp.json();
const content = data?.choices?.[0]?.message?.content;

if (!content) {
  console.error('DeepSeek response missing message content');
  process.exit(1);
}

await writeFile(outputPath, String(content).trim() + '\n', 'utf8');
console.log(`Saved report to ${outputPath}`);
