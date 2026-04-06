const TAG_SEEDS = [
  { tagCode: 'TAG_HNW_001', tagName: '高净值', tagType: 'enum', source: 'rule_engine', description: '近12个月高保费/高资产客户', status: 'active' },
  { tagCode: 'TAG_RENEW_024', tagName: '续保意向', tagType: 'enum', source: 'rule_engine', description: '存在续保高意向行为', status: 'active' },
  { tagCode: 'TAG_LEAD_007', tagName: '新线索', tagType: 'boolean', source: 'import_sync', description: '最近7天新增线索客户', status: 'draft' },
  { tagCode: 'MKT_VALUE_LEVEL', tagName: '客户价值等级', tagType: 'enum', source: 'rule_engine', description: '按保费与续保意向分层高/中/低', status: 'active' },
  { tagCode: 'MKT_ACTIVE_30D', tagName: '近30天活跃度', tagType: 'enum', source: 'rule_engine', description: '按30天签到天数分层高活跃/中活跃/低活跃', status: 'active' },
  { tagCode: 'MKT_CHURN_RISK', tagName: '流失风险', tagType: 'enum', source: 'rule_engine', description: '连续登录与签到偏低客户识别为高风险', status: 'active' },
  { tagCode: 'MKT_PRODUCT_PREF', tagName: '产品偏好', tagType: 'enum', source: 'rule_engine', description: '按保费层级映射险种偏好', status: 'active' },
  { tagCode: 'MKT_REDEEM_POWER', tagName: '兑换能力', tagType: 'enum', source: 'rule_engine', description: '按30天签到/兑换活跃度估算兑换能力', status: 'active' },
  { tagCode: 'MKT_SHARE_WILLING', tagName: '分享意愿', tagType: 'enum', source: 'rule_engine', description: '按近期活跃行为识别高分享意愿人群', status: 'active' },
];

const TAG_RULE_SEEDS = [
  {
    ruleCode: 'RULE_HNW_001',
    ruleName: '高净值识别规则',
    targetTagCode: 'TAG_HNW_001',
    priority: 10,
    status: 'active',
    conditionDsl: { op: 'and', children: [{ metric: 'premium_12m', cmp: '>=', value: 50000 }] },
    outputExpr: { mode: 'const', value: '高净值' },
  },
  {
    ruleCode: 'RULE_RENEW_024',
    ruleName: '续保意向识别规则',
    targetTagCode: 'TAG_RENEW_024',
    priority: 20,
    status: 'active',
    conditionDsl: { op: 'and', children: [{ metric: 'renew_intent_score', cmp: '>=', value: 80 }] },
    outputExpr: { mode: 'const', value: '高意向' },
  },
  {
    ruleCode: 'RULE_MKT_VALUE_LEVEL',
    ruleName: '营销-客户价值等级分层',
    targetTagCode: 'MKT_VALUE_LEVEL',
    priority: 30,
    status: 'active',
    conditionDsl: { op: 'and', children: [{ metric: 'premium_12m', cmp: '>=', value: 0 }] },
    outputExpr: {
      mode: 'map',
      sourceMetric: 'renew_intent_score',
      mappings: [
        { cmp: '>=', value: 80, output: '高价值' },
        { cmp: '>=', value: 50, output: '中价值' },
      ],
      defaultValue: '低价值',
    },
  },
  {
    ruleCode: 'RULE_MKT_ACTIVE_30D',
    ruleName: '营销-近30天活跃度分层',
    targetTagCode: 'MKT_ACTIVE_30D',
    priority: 31,
    status: 'active',
    conditionDsl: { op: 'and', children: [{ metric: 'sign_days_30d', cmp: '>=', value: 0 }] },
    outputExpr: {
      mode: 'map',
      sourceMetric: 'sign_days_30d',
      mappings: [
        { cmp: '>=', value: 10, output: '高活跃' },
        { cmp: '>=', value: 3, output: '中活跃' },
      ],
      defaultValue: '低活跃',
    },
  },
  {
    ruleCode: 'RULE_MKT_CHURN_RISK',
    ruleName: '营销-流失风险识别',
    targetTagCode: 'MKT_CHURN_RISK',
    priority: 32,
    status: 'active',
    conditionDsl: {
      op: 'and',
      children: [
        { metric: 'login_days_30d', cmp: '<=', value: 1 },
        { metric: 'sign_days_30d', cmp: '<=', value: 1 },
      ],
    },
    outputExpr: { mode: 'const', value: '高风险' },
  },
  {
    ruleCode: 'RULE_MKT_PRODUCT_PREF',
    ruleName: '营销-产品偏好映射',
    targetTagCode: 'MKT_PRODUCT_PREF',
    priority: 33,
    status: 'active',
    conditionDsl: { op: 'and', children: [{ metric: 'premium_12m', cmp: '>=', value: 0 }] },
    outputExpr: {
      mode: 'map',
      sourceMetric: 'premium_12m',
      mappings: [
        { cmp: '>=', value: 100000, output: '重疾偏好' },
        { cmp: '>=', value: 30000, output: '医疗偏好' },
      ],
      defaultValue: '意外偏好',
    },
  },
  {
    ruleCode: 'RULE_MKT_REDEEM_POWER',
    ruleName: '营销-兑换能力分层',
    targetTagCode: 'MKT_REDEEM_POWER',
    priority: 34,
    status: 'active',
    conditionDsl: { op: 'and', children: [{ metric: 'sign_count_30d', cmp: '>=', value: 0 }] },
    outputExpr: {
      mode: 'map',
      sourceMetric: 'sign_count_30d',
      mappings: [
        { cmp: '>=', value: 12, output: '高兑换能力' },
        { cmp: '>=', value: 5, output: '中兑换能力' },
      ],
      defaultValue: '低兑换能力',
    },
  },
  {
    ruleCode: 'RULE_MKT_SHARE_WILLING',
    ruleName: '营销-分享意愿识别',
    targetTagCode: 'MKT_SHARE_WILLING',
    priority: 35,
    status: 'active',
    conditionDsl: { op: 'and', children: [{ metric: 'login_days_30d', cmp: '>=', value: 7 }] },
    outputExpr: { mode: 'const', value: '高意愿' },
  },
];

function normalizeTagType(type) {
  const value = String(type || '').trim().toLowerCase();
  if (['enum', 'boolean', 'number', 'date'].includes(value)) return value;
  return 'enum';
}

function normalizeTagStatus(status) {
  const value = String(status || '').trim().toLowerCase();
  if (['active', 'enabled'].includes(value)) return 'active';
  if (['disabled', 'inactive'].includes(value)) return 'disabled';
  return 'draft';
}

function normalizeTagRuleStatus(status) {
  return normalizeTagStatus(status);
}

function asDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function collectCustomerIdsForTagJob(state, tenantId) {
  const ids = new Set();
  (state.signIns || []).forEach((row) => {
    if (Number(row?.tenantId || 1) !== Number(tenantId)) return;
    const uid = Number(row?.userId || 0);
    if (uid > 0) ids.add(uid);
  });
  (state.redemptions || []).forEach((row) => {
    if (Number(row?.tenantId || 1) !== Number(tenantId)) return;
    const uid = Number(row?.userId || 0);
    if (uid > 0) ids.add(uid);
  });
  (state.pointTransactions || []).forEach((row) => {
    if (Number(row?.tenantId || 1) !== Number(tenantId)) return;
    const uid = Number(row?.userId || 0);
    if (uid > 0) ids.add(uid);
  });
  (state.activityCompletions || []).forEach((row) => {
    if (Number(row?.tenantId || 1) !== Number(tenantId)) return;
    const uid = Number(row?.userId || 0);
    if (uid > 0) ids.add(uid);
  });
  (state.courseCompletions || []).forEach((row) => {
    if (Number(row?.tenantId || 1) !== Number(tenantId)) return;
    const uid = Number(row?.userId || 0);
    if (uid > 0) ids.add(uid);
  });
  (state.trackEvents || []).forEach((row) => {
    if (Number(row?.tenantId || 1) !== Number(tenantId)) return;
    if (String(row?.actorType || '').toLowerCase() !== 'customer') return;
    const uid = Number(row?.actorId || 0);
    if (uid > 0) ids.add(uid);
  });
  if (!ids.size) ids.add(2);
  return [...ids];
}

function toDayKey(value) {
  const d = asDate(value);
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function inLastDays(dateValue, days, now = new Date()) {
  const d = asDate(dateValue);
  if (!d) return false;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - Math.max(0, Number(days || 0) - 1));
  return d >= start && d <= now;
}

function normalizeMetricValue(metric) {
  const key = String(metric || '').trim().toLowerCase();
  if (['login_days_30d', 'c_login_days_30d', 'c_login_day_30d'].includes(key)) return 'c_login_days_30d';
  if (['login_count_30d_c', 'c_login_count_30d', 'c_login_times_30d'].includes(key)) return 'c_login_count_30d';
  if (['login_count_30d_b', 'b_login_count_30d', 'b_login_times_30d'].includes(key)) return 'b_login_count_30d';
  if (['sign_days_30d', 'c_sign_days_30d', 'signin_days_30d', 'sign_in_days_30d'].includes(key)) return 'c_sign_days_30d';
  if (['sign_count_30d', 'sign_times_30d', 'c_sign_count_30d', 'c_sign_times_30d'].includes(key)) return 'c_sign_count_30d';
  return key;
}

function compareCondition(leftRaw, cmpRaw, rightRaw) {
  const cmp = String(cmpRaw || '==').trim();
  const leftNum = Number(leftRaw);
  const rightNum = Number(rightRaw);
  const bothNumeric = Number.isFinite(leftNum) && Number.isFinite(rightNum);
  const left = bothNumeric ? leftNum : String(leftRaw ?? '').trim();
  const right = bothNumeric ? rightNum : String(rightRaw ?? '').trim();
  if (cmp === '>=' || cmp === 'gte') return left >= right;
  if (cmp === '>' || cmp === 'gt') return left > right;
  if (cmp === '<=' || cmp === 'lte') return left <= right;
  if (cmp === '<' || cmp === 'lt') return left < right;
  if (cmp === '!=' || cmp === '<>' || cmp === 'ne') return left !== right;
  if (cmp === 'in') {
    const values = Array.isArray(rightRaw) ? rightRaw : String(rightRaw ?? '').split(',').map((x) => x.trim());
    return values.includes(String(leftRaw ?? '').trim());
  }
  return left === right;
}

function buildTagJobCustomerMetrics(state, tenantId, customerIds) {
  const now = new Date();
  const ids = new Set((customerIds || []).map((x) => Number(x || 0)).filter((x) => x > 0));
  const users = (state.users || []).filter((row) => Number(row?.tenantId || 1) === Number(tenantId));
  const userMap = new Map(users.map((row) => [Number(row.id), row]));
  const ownerByCustomer = new Map(users.map((row) => [Number(row.id), Number(row.ownerUserId || 0)]));
  const trackEvents = (state.trackEvents || []).filter((row) => Number(row?.tenantId || 1) === Number(tenantId));
  const sessions = (state.sessions || []).filter((row) => ids.has(Number(row?.userId || 0)));
  const signIns = (state.signIns || []).filter(
    (row) => Number(row?.tenantId || 1) === Number(tenantId) && ids.has(Number(row?.userId || 0))
  );
  const policies = (state.policies || []).filter((row) => Number(row?.tenantId || 1) === Number(tenantId));

  const metricsByCustomer = new Map();
  ids.forEach((customerId) => {
    const baseUser = userMap.get(customerId) || {};
    metricsByCustomer.set(customerId, {
      age: Number(baseUser.age || 0),
      gender: String(baseUser.gender || ''),
      annual_income: Number(baseUser.annualIncome || baseUser.annual_income || 0),
      member_level: Number(baseUser.memberLevel || 0),
      premium_12m: 0,
      renew_intent_score: 0,
      c_login_days_30d: 0,
      c_login_count_30d: 0,
      b_login_count_30d: 0,
      c_sign_days_30d: 0,
      c_sign_count_30d: 0,
    });
  });

  const cLoginDaySets = new Map();
  const cSignDaySets = new Map();
  sessions.forEach((row) => {
    const customerId = Number(row?.userId || 0);
    if (!ids.has(customerId)) return;
    const dt = asDate(row?.createdAt);
    if (!inLastDays(dt, 30, now)) return;
    const dayKey = toDayKey(dt);
    if (!dayKey) return;
    if (!cLoginDaySets.has(customerId)) cLoginDaySets.set(customerId, new Set());
    cLoginDaySets.get(customerId).add(dayKey);
    const m = metricsByCustomer.get(customerId);
    if (m) m.c_login_count_30d += 1;
  });
  cLoginDaySets.forEach((set, customerId) => {
    const m = metricsByCustomer.get(customerId);
    if (!m) return;
    m.c_login_days_30d = set.size;
    // 口径调整：30天登录次数按“每天最多1次”统计。
    m.c_login_count_30d = set.size;
  });

  signIns.forEach((row) => {
    const customerId = Number(row?.userId || 0);
    if (!ids.has(customerId)) return;
    const dt = asDate(row?.signDate ? `${row.signDate}T00:00:00` : row?.createdAt);
    if (!inLastDays(dt, 30, now)) return;
    const dayKey = row?.signDate ? String(row.signDate) : toDayKey(dt);
    if (!dayKey) return;
    if (!cSignDaySets.has(customerId)) cSignDaySets.set(customerId, new Set());
    cSignDaySets.get(customerId).add(dayKey);
  });
  cSignDaySets.forEach((set, customerId) => {
    const m = metricsByCustomer.get(customerId);
    if (!m) return;
    m.c_sign_days_30d = set.size;
    // 口径调整：30天签到次数按“每天最多1次”统计。
    m.c_sign_count_30d = set.size;
  });

  const bLoginDayByCustomer = new Map();
  trackEvents.forEach((row) => {
    const source = String(row?.source || '').toLowerCase();
    const event = String(row?.event || '').toLowerCase();
    if (source !== 'b-web' || !event.includes('login')) return;
    const dt = asDate(row?.createdAt);
    if (!inLastDays(dt, 30, now)) return;
    const dayKey = toDayKey(dt);
    if (!dayKey) return;
    const actorId = Number(row?.actorId || 0);
    if (actorId <= 0) return;
    ids.forEach((customerId) => {
      if (Number(ownerByCustomer.get(customerId) || 0) !== actorId) return;
      if (!bLoginDayByCustomer.has(customerId)) bLoginDayByCustomer.set(customerId, new Set());
      bLoginDayByCustomer.get(customerId).add(dayKey);
    });
  });
  bLoginDayByCustomer.forEach((set, customerId) => {
    const m = metricsByCustomer.get(customerId);
    if (m) m.b_login_count_30d = set.size;
  });

  policies.forEach((row) => {
    const customerId = Number(row?.customerId || row?.userId || 0);
    if (!ids.has(customerId)) return;
    const createdAt = asDate(row?.createdAt);
    if (!inLastDays(createdAt, 365, now)) return;
    const amount = Number(row?.annualPremium || row?.amount || 0);
    const m = metricsByCustomer.get(customerId);
    if (m) m.premium_12m += Number.isFinite(amount) ? amount : 0;
  });

  metricsByCustomer.forEach((m) => {
    const activityBase = Number(m.c_login_days_30d || 0) * 3 + Number(m.c_sign_days_30d || 0) * 5 + Number(m.b_login_count_30d || 0) * 2;
    const premiumBase = Math.min(60, Math.floor(Number(m.premium_12m || 0) / 1000));
    m.renew_intent_score = Math.min(100, activityBase + premiumBase);
    m.login_days_30d = Number(m.c_login_days_30d || 0);
    m.sign_days_30d = Number(m.c_sign_days_30d || 0);
    m.sign_count_30d = Number(m.c_sign_count_30d || 0);
  });

  return metricsByCustomer;
}

function evaluateTagRuleByCustomer(rule, customerMetrics) {
  const conditionDsl = rule?.conditionDsl && typeof rule.conditionDsl === 'object' ? rule.conditionDsl : {};
  const op = String(conditionDsl?.op || 'and').toLowerCase() === 'or' ? 'or' : 'and';
  const children = Array.isArray(conditionDsl?.children) ? conditionDsl.children : [];
  if (!children.length) return { hit: true, reason: 'empty condition' };
  const checks = children.map((cond) => {
    const metricKey = normalizeMetricValue(cond?.metric);
    const metricVal = customerMetrics?.[metricKey];
    const cmp = String(cond?.cmp || '==');
    const expected = cond?.value;
    const passed = compareCondition(metricVal, cmp, expected);
    return { metricKey, metricVal, cmp, expected, passed };
  });
  const hit = op === 'or' ? checks.some((x) => x.passed) : checks.every((x) => x.passed);
  const firstFail = checks.find((x) => !x.passed);
  const firstPass = checks.find((x) => x.passed);
  const picked = hit ? firstPass : firstFail || checks[0];
  return {
    hit,
    reason: picked
      ? `${picked.metricKey} ${picked.cmp} ${picked.expected} (actual=${picked.metricVal ?? 'null'})`
      : 'no condition',
  };
}

function resolveTagRuleOutputValue(rule, customerMetrics) {
  const outputExpr = rule?.outputExpr && typeof rule.outputExpr === 'object' ? rule.outputExpr : {};
  const mode = String(outputExpr?.mode || 'const').trim().toLowerCase();
  if (mode !== 'map') {
    return String(outputExpr?.value ?? '');
  }
  const sourceMetric = normalizeMetricValue(outputExpr?.sourceMetric || outputExpr?.source || outputExpr?.metric);
  const sourceValue = customerMetrics?.[sourceMetric];
  const mappings = Array.isArray(outputExpr?.mappings) ? outputExpr.mappings : [];
  for (const row of mappings) {
    const cmp = String(row?.cmp || '=').trim();
    const expected = row?.value;
    if (compareCondition(sourceValue, cmp, expected)) {
      return String(row?.output ?? row?.label ?? '');
    }
  }
  return String(outputExpr?.defaultValue ?? '');
}

function __allocNextId(rows = [], nextIdFn) {
  if (typeof nextIdFn === 'function') return Number(nextIdFn(rows) || 1);
  const maxId = Array.isArray(rows) ? rows.reduce((m, row) => Math.max(m, Number(row?.id || 0)), 0) : 0;
  return maxId + 1;
}


function ensureTagSeeds(state, tenantId, nextIdFn) {
  if (!Array.isArray(state.pTags)) state.pTags = [];
  if (!Array.isArray(state.pTagRules)) state.pTagRules = [];
  if (!Array.isArray(state.pTagRuleJobs)) state.pTagRuleJobs = [];
  if (!Array.isArray(state.pTagRuleJobLogs)) state.pTagRuleJobLogs = [];
  const now = new Date().toISOString();
  let changed = false;

  const tenantTags = state.pTags.filter((row) => Number(row.tenantId || 1) === Number(tenantId));
  const tagByCode = new Map(tenantTags.map((row) => [String(row.tagCode || ''), row]));
  TAG_SEEDS.forEach((seed) => {
    if (tagByCode.has(seed.tagCode)) return;
    const row = {
      id: __allocNextId(state.pTags, nextIdFn),
      tenantId: Number(tenantId || 1),
      tagCode: seed.tagCode,
      tagName: seed.tagName,
      tagType: normalizeTagType(seed.tagType),
      source: seed.source || 'manual',
      description: seed.description || '',
      status: normalizeTagStatus(seed.status),
      valueSchema: {},
      hitCount: 0,
      createdBy: null,
      createdAt: now,
      updatedAt: now,
    };
    state.pTags.push(row);
    tagByCode.set(seed.tagCode, row);
    changed = true;
  });

  const tenantRules = state.pTagRules.filter((row) => Number(row.tenantId || 1) === Number(tenantId));
  const ruleByCode = new Set(tenantRules.map((row) => String(row.ruleCode || '')));
  TAG_RULE_SEEDS.forEach((seed) => {
    if (ruleByCode.has(seed.ruleCode)) return;
    const targetTag = tagByCode.get(seed.targetTagCode);
    if (!targetTag) return;
    state.pTagRules.push({
      id: __allocNextId(state.pTagRules, nextIdFn),
      tenantId: Number(tenantId || 1),
      ruleCode: seed.ruleCode,
      ruleName: seed.ruleName,
      targetTagId: Number(targetTag.id),
      targetTagIds: [Number(targetTag.id)],
      priority: Number(seed.priority || 100),
      status: normalizeTagRuleStatus(seed.status),
      conditionDsl: seed.conditionDsl || { op: 'and', children: [] },
      outputExpr: seed.outputExpr || { mode: 'const', value: '' },
      effectiveStartAt: null,
      effectiveEndAt: null,
      createdBy: null,
      createdAt: now,
      updatedAt: now,
    });
    changed = true;
  });

  return changed;
}


export {
  buildTagJobCustomerMetrics,
  collectCustomerIdsForTagJob,
  ensureTagSeeds,
  evaluateTagRuleByCustomer,
  normalizeTagRuleStatus,
  normalizeTagStatus,
  normalizeTagType,
  resolveTagRuleOutputValue,
};
