import os from 'node:os';
import { collectActivitySignupParticipants, collectDashboardMetrics } from '../services/share.service.mjs';

const METRIC_CARD_DEFINITIONS = {
  c: [
    { key: 'c_dau', name: 'C端日活 (DAU)' },
    { key: 'c_stay_duration', name: '人均停留时长' },
    { key: 'c_open_rate', name: '内容打开率' },
    { key: 'c_signin_rate', name: '签到率' },
    { key: 'c_login_streak_days', name: '连续登录天数' },
    { key: 'c_signin_streak_days', name: '连续签到天数' },
    { key: 'c_signin_person_days', name: '签到人天' },
    { key: 'c_policy_rate', name: '保单托管率' },
  ],
  b: [
    { key: 'b_dau', name: 'B端日活 (DAU)' },
    { key: 'b_interaction_rate', name: '客户互动率' },
    { key: 'b_remind_click_rate', name: '智能提醒点击率' },
    { key: 'b_retention_7d', name: '7日留存率' },
    { key: 'b_content_publish_cnt', name: '内容发布数' },
    { key: 'b_writeoff_cnt', name: '核销单数' },
    { key: 'b_recent_7d_active_trend', name: '最近7日日活趋势' },
    { key: 'b_recent_7d_activity_participants', name: '近7日活动参与人数' },
    { key: 'b_new_customers_today', name: '今日新客户数' },
    { key: 'b_signin_customers_today', name: '今日签到客户数' },
  ],
  p: [
    { key: 'p_tenant_total', name: '租户总数' },
    { key: 'p_tenant_active', name: '活跃租户' },
    { key: 'p_premium_mtd', name: '本月签单总额' },
    { key: 'p_interaction_avg', name: '人均客户互动数' },
    { key: 'p_team_rank', name: '团队业绩排行' },
    { key: 'p_product_pref', name: '险种偏好' },
    { key: 'p_activity_total', name: '活动总数' },
    { key: 'p_activity_share_total', name: '分享活动总次数' },
    { key: 'p_activity_share_view_total', name: '查看分享链接次数' },
    { key: 'p_activity_signup_total', name: '活动报名人数' },
  ],
  system: [
    { key: 'sys_alert_today', name: '今日告警' },
    { key: 'sys_api_uptime', name: 'API可用性' },
    { key: 'sys_api_avg_rt', name: '平均响应时间' },
    { key: 'sys_server_load', name: '服务器负载' },
    { key: 'sys_db_conn', name: '数据库连接数' },
    { key: 'sys_error_rate', name: '错误率' },
  ],
};

const METRIC_RULEBOOK_VERSION = '2026-03-14.v1';

const METRIC_RULE_SEEDS = {
  c: [
    { name: 'C端日活 (DAU)', formula: '当日有任意行为的客户数', period: '每日', source: '行为表' },
    { name: '人均停留时长', formula: '总停留时长 / 活跃客户数', period: '每日', source: '行为表' },
    { name: '内容打开率', formula: '打开人数 / 推送人数 × 100%', period: '每日', source: '内容推送日志' },
    { name: '签到率', formula: '签到人数 / 活跃客户数 × 100%', period: '每日', source: '签到表' },
    { name: '30天登录次数(C端)', formula: '单客30天登录次数(C端) = count(distinct login_date) where user_id=指定客户 and login_time in 最近30天', period: '每日', source: 'p_sessions' },
    { name: '30天签到次数(C端)', formula: '单客30天签到次数(C端) = count(distinct sign_date) where user_id=指定客户 and sign_date in 最近30天', period: '每日', source: 'c_sign_ins' },
    { name: '30天签到天数(C端)', formula: '单客30天签到天数(C端) = count(distinct sign_date) where user_id=指定客户 and sign_date in 最近30天', period: '近30天', source: 'c_sign_ins' },
    {
      name: '单客日分享次数(C端)',
      formula: '单客日分享次数(C端) = count(*) where event_name = c_share_success and actor_id = 指定客户ID and stat_date = 指定日期',
      period: '每日',
      source: 'p_track_events / p_metric_counter_daily',
    },
    { name: '连续登录天数', formula: '连续登录天数(单客) = 某客户按登录日期去重后，连续自然日登录天数', period: '累计', source: '登录日志' },
    { name: '连续签到天数', formula: '连续签到天数(单客) = 某客户按签到日期去重后，连续自然日签到天数', period: '累计', source: 'c_sign_ins' },
    { name: '签到人天', formula: '签到人天 = count(distinct customer_id, sign_date)', period: '累计', source: 'c_sign_ins' },
    { name: '积分兑换率', formula: '兑换人数 / 有积分余额客户数 × 100%', period: '每日', source: '兑换表' },
    { name: '保单托管率', formula: '托管保单客户数 / 总客户数 × 100%', period: '实时累计', source: '保单表' },
  ],
  b: [
    { name: 'B端日活 (DAU)', formula: '当日登录业务员数', period: '每日', source: '登录日志' },
    { name: '30天登录次数(B端)', formula: '单客30天登录次数(B端) = count(distinct login_date) where event_name like b_login% and actor_id=该客户所属顾问 and event_time in 最近30天', period: '每日', source: 'p_track_events' },
    { name: '客户互动率', formula: '有互动的客户数 / 客户总数 × 100%', period: '每日', source: '行为表' },
    { name: '智能提醒点击率', formula: '点击提醒数 / 推送提醒数 × 100%', period: '每日', source: '提醒日志' },
    {
      name: '单人日分享次数(B端)',
      formula: '单人日分享次数(B端) = count(*) where event_name = b_tools_share_success and actor_id = 指定人员ID and stat_date = 指定日期',
      period: '每日',
      source: 'p_track_events / p_metric_counter_daily',
    },
    { name: '7日留存率', formula: '注册后第7天登录人数 / 注册人数 × 100%', period: '按批次', source: '注册+登录表' },
    { name: '内容发布数', formula: '业务员发布的内容总数', period: '每日', source: '内容表' },
    { name: '核销单数', formula: '当日完成的核销笔数', period: '每日', source: '核销表' },
    {
      name: '最近7日日活趋势',
      formula: '最近7日日活趋势 = 最近7天每日活跃客户数序列；卡片值展示最近7天活跃客户人次总和',
      period: '近7日',
      source: 'p_track_events + c_sign_ins + c_activity_completions + c_learning_records + c_redeem_records',
    },
    {
      name: '近7日活动参与人数',
      formula: '近7日活动参与人数 = 最近7天内通过活动分享实名或完成 activity 域活动的客户去重数',
      period: '近7日',
      source: 'p_track_events + c_activity_completions + p_activities',
    },
    {
      name: '今日新客户数',
      formula: '今日新客户数 = 当前作用域内 created_at 落在今日的客户数',
      period: '每日',
      source: 'users',
    },
    {
      name: '今日签到客户数',
      formula: '今日签到客户数 = 当前作用域内 sign_date 落在今日的签到客户去重数',
      period: '每日',
      source: 'c_sign_ins',
    },
  ],
  p: [
    { name: '租户总数', formula: '状态为激活的租户数', period: '实时累计', source: 'tenant表' },
    { name: '活跃租户', formula: '近7日有管理员登录的租户数', period: '近7日', source: '登录日志' },
    { name: '本月签单总额', formula: '本月所有保单的首期保费总和', period: '月累计', source: '保单表' },
    { name: '人均客户互动数', formula: '总互动次数 / 活跃业务员数', period: '月累计', source: '行为表' },
    { name: '团队业绩排行', formula: '按团队/个人当月签单金额降序排列', period: '月累计', source: '保单表' },
    { name: '险种偏好', formula: '各险种保单数量占比', period: '实时累计', source: '保单表' },
    {
      name: '活动总数',
      formula: '活动总数 = 当前作用域内，发生过活动分享或产生过活动报名的 activity 域活动去重数',
      period: '实时累计',
      source: 'p_track_events + p_activities + c_activity_completions',
    },
    {
      name: '分享活动总次数',
      formula: '分享活动总次数 = count(*) where event_name = share_link_created and properties.shareType = activity within 当前作用域',
      period: '实时累计',
      source: 'p_track_events',
    },
    {
      name: '查看分享链接次数',
      formula: '查看分享链接次数 = count(*) where event_name = share_h5_view and shareCode 属于当前作用域内的活动分享链接',
      period: '实时累计',
      source: 'p_track_events',
    },
    {
      name: '活动报名人数',
      formula: '活动报名人数 = 当前作用域内 activity 域活动的报名客户去重数',
      period: '实时累计',
      source: 'c_activity_completions + p_activities',
    },
  ],
  system: [
    { name: '今日告警', formula: '当日系统产生的告警总数', period: '每日', source: '告警系统' },
    { name: 'API可用性', formula: '成功请求数 / 总请求数 × 100%', period: '近24小时', source: '监控系统' },
    { name: '平均响应时间', formula: '所有接口的平均耗时', period: '近1小时', source: '监控系统' },
    { name: '服务器负载', formula: 'CPU/内存平均使用率', period: '实时', source: '监控系统' },
    { name: '数据库连接数', formula: '当前数据库连接数', period: '实时', source: '数据库监控' },
    { name: '错误率', formula: '5xx错误 / 总请求数 × 100%', period: '近1小时', source: '监控系统' },
  ],
};

function normalizeMetricEnd(end) {
  const value = String(end || '').trim().toLowerCase();
  if (['c', 'b', 'p', 'system'].includes(value)) return value;
  return 'c';
}

function normalizeMetricRuleStatus(status) {
  const value = String(status || '').trim().toLowerCase();
  if (['enabled', 'active', '生效中', 'on'].includes(value)) return 'enabled';
  if (['disabled', 'inactive', '已禁用', 'off'].includes(value)) return 'disabled';
  return 'enabled';
}

function normalizeMetricRemarkMode(mode) {
  const value = String(mode || '').trim().toLowerCase();
  if (['manual', 'custom'].includes(value)) return 'manual';
  return 'sync';
}

function inferMetricTablesBySource(source) {
  const s = String(source || '').toLowerCase();
  const tableMap = [
    { keys: ['登录', 'login'], tables: ['p_sessions', 'p_track_events'] },
    { keys: ['签到', 'sign'], tables: ['c_sign_ins'] },
    { keys: ['兑换', 'redeem', '核销', 'writeoff'], tables: ['c_redeem_records', 'b_write_off_records'] },
    { keys: ['保单', 'policy'], tables: ['c_policies'] },
    { keys: ['活动', 'activity'], tables: ['p_activities', 'b_customer_activities', 'c_activity_completions'] },
    { keys: ['学习', 'learning', '内容'], tables: ['p_learning_materials', 'c_learning_records'] },
    { keys: ['行为', '埋点', 'track', 'event'], tables: ['p_track_events'] },
    { keys: ['积分', 'point'], tables: ['c_point_transactions', 'point_accounts'] },
    { keys: ['租户', 'tenant'], tables: ['p_tenants'] },
    { keys: ['告警', '监控', 'audit'], tables: ['audit_logs', 'p_track_events'] },
  ];
  for (const item of tableMap) {
    if (item.keys.some((k) => s.includes(String(k).toLowerCase()))) return item.tables;
  }
  return ['p_track_events'];
}

function buildMetricRuleRemark({ name, formula, period, source }) {
  const tables = inferMetricTablesBySource(source || '');
  return `数据表: ${tables.join(' + ')}
时间窗口: ${period || '每日'}
计算方式: ${formula || '请填写公式'}
口径补充: 指标名=${name || '-'}；来源=${source || '-'}`;
}

function metricRuleKey(end, name) {
  return `${normalizeMetricEnd(end)}::${String(name || '').trim().toLowerCase()}`;
}

function asDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function parseNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function rowDate(row, keys = ['createdAt', 'updatedAt']) {
  for (const key of keys) {
    const d = asDate(row?.[key]);
    if (d) return d;
  }
  return null;
}

function formatInteger(num) {
  return Math.max(0, Math.round(parseNumber(num, 0))).toLocaleString('zh-CN');
}

function formatPercent(num) {
  return `${Math.max(0, parseNumber(num, 0)).toFixed(1)}%`;
}

function formatMinutes(num) {
  return `${Math.max(0, parseNumber(num, 0)).toFixed(1)}分钟`;
}

function formatDays(num) {
  return `${Math.max(0, parseNumber(num, 0)).toFixed(1)}天`;
}

function formatCurrency(num) {
  return `¥${Math.max(0, Math.round(parseNumber(num, 0))).toLocaleString('zh-CN')}`;
}

function trendByDelta(current, previous, reverse = false) {
  const cur = parseNumber(current, 0);
  const prev = parseNumber(previous, 0);
  if (prev <= 0 && cur <= 0) return { trend: '持平', trendType: 'flat' };
  if (prev <= 0 && cur > 0) return { trend: '↑ 新增', trendType: reverse ? 'down' : 'up' };
  const delta = ((cur - prev) / Math.abs(prev)) * 100;
  if (Math.abs(delta) < 0.1) return { trend: '持平', trendType: 'flat' };
  const up = delta > 0;
  const trendType = reverse ? (up ? 'down' : 'up') : up ? 'up' : 'down';
  return {
    trend: `${up ? '↑' : '↓'} ${Math.abs(delta).toFixed(1)}%`,
    trendType,
  };
}

function resolveMetricScope(state, actor) {
  const safeActor = {
    actorType: String(actor?.actorType || 'employee'),
    actorId: Number(actor?.actorId || 0),
    tenantId: Number(actor?.tenantId || 1),
    teamId: Number(actor?.teamId || 1),
  };

  const roleIds = (state.userRoles || [])
    .filter(
      (row) =>
        Number(row.tenantId) === Number(safeActor.tenantId) &&
        String(row.userType) === String(safeActor.actorType) &&
        Number(row.userId) === Number(safeActor.actorId)
    )
    .map((row) => Number(row.roleId));

  const roleKeys = new Set(
    (state.roles || [])
      .filter((row) => roleIds.includes(Number(row.id)))
      .map((row) => String(row.key || '').toLowerCase())
      .filter(Boolean)
  );

  const permissionIds = (state.rolePermissions || [])
    .filter((row) => roleIds.includes(Number(row.roleId)))
    .map((row) => Number(row.permissionId));
  const permissionKeys = new Set(
    (state.permissions || [])
      .filter((row) => permissionIds.includes(Number(row.id)))
      .map((row) => String(row.key || '').toLowerCase())
      .filter(Boolean)
  );

  const actorAgentRow = (state.agents || []).find(
    (row) => Number(row.id) === Number(safeActor.actorId) && Number(row.tenantId || 1) === Number(safeActor.tenantId)
  );
  const isManagerEmployee = String(actorAgentRow?.role || '').toLowerCase() === 'manager';
  const isPlatformAdmin = roleKeys.has('platform_admin');
  const isCompanyAdmin = roleKeys.has('company_admin') || permissionKeys.has('scope:tenant:all');
  const isTeamLead = !isCompanyAdmin && (roleKeys.has('team_lead') || permissionKeys.has('scope:team:all'));
  const isAgent = roleKeys.has('agent') || safeActor.actorType === 'agent';

  let scopeType = 'company';
  if (isPlatformAdmin) scopeType = 'platform';
  else if (isCompanyAdmin) scopeType = 'company';
  else if (isManagerEmployee || isTeamLead) scopeType = 'manager';
  else if (isAgent) scopeType = 'agent';

  const scopeTeamId = Number(actorAgentRow?.teamId || safeActor.teamId || 1);
  const agentsAll = Array.isArray(state.agents) ? state.agents : [];
  const usersAll = Array.isArray(state.users) ? state.users : [];

  const canSeeTenant = (tenantId) => {
    const tid = Number(tenantId || 1);
    if (scopeType === 'platform') return true;
    return tid === Number(safeActor.tenantId);
  };

  const visibleAgents = agentsAll.filter((row) => {
    if (!canSeeTenant(row.tenantId)) return false;
    if (scopeType === 'platform' || scopeType === 'company') return true;
    if (scopeType === 'manager') return Number(row.teamId || 1) === Number(scopeTeamId);
    return Number(row.id) === Number(safeActor.actorId);
  });

  const agentIds = new Set(visibleAgents.map((row) => Number(row.id)).filter((id) => id > 0));
  if (scopeType === 'manager' || scopeType === 'agent') {
    agentIds.add(Number(safeActor.actorId));
  }

  const visibleUsers = usersAll.filter((row) => {
    if (!canSeeTenant(row.tenantId)) return false;
    if (scopeType === 'platform' || scopeType === 'company') return true;
    if (scopeType === 'manager') {
      const ownerId = Number(row.ownerUserId || 0);
      const teamId = Number(row.teamId || 1);
      return agentIds.has(ownerId) || teamId === Number(scopeTeamId);
    }
    return Number(row.ownerUserId || 0) === Number(safeActor.actorId);
  });
  const customerIds = new Set(visibleUsers.map((row) => Number(row.id)).filter((id) => id > 0));

  return {
    ...safeActor,
    scopeType,
    scopeTeamId,
    canSeeTenant,
    agentIds,
    customerIds,
  };
}

function computeMetricCards(state, actor) {
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const prevDayStart = new Date(dayStart);
  prevDayStart.setDate(prevDayStart.getDate() - 1);
  const weekAgo = new Date(dayStart);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const prevWeekStart = new Date(dayStart);
  prevWeekStart.setDate(prevWeekStart.getDate() - 14);
  const monthStart = new Date(dayStart);
  monthStart.setDate(1);
  const prevMonthStart = new Date(monthStart);
  prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);

  const scope = resolveMetricScope(state, actor);
  const usersAll = Array.isArray(state.users) ? state.users : [];
  const users = usersAll.filter((row) => scope.customerIds.has(Number(row.id)));
  const signIns = (Array.isArray(state.signIns) ? state.signIns : []).filter((row) =>
    scope.customerIds.has(parseNumber(row?.userId, 0))
  );
  const activityCompletions = (Array.isArray(state.activityCompletions) ? state.activityCompletions : []).filter((row) =>
    scope.customerIds.has(parseNumber(row?.userId, 0))
  );
  const courseCompletions = (Array.isArray(state.courseCompletions) ? state.courseCompletions : []).filter((row) =>
    scope.customerIds.has(parseNumber(row?.userId, 0))
  );
  const pointTx = (Array.isArray(state.pointTransactions) ? state.pointTransactions : []).filter((row) =>
    scope.customerIds.has(parseNumber(row?.userId, 0))
  );
  const redemptions = (Array.isArray(state.redemptions) ? state.redemptions : []).filter((row) =>
    scope.customerIds.has(parseNumber(row?.userId, 0))
  );
  const policies = (Array.isArray(state.policies) ? state.policies : []).filter((row) => {
    const customerId = parseNumber(row?.customerId ?? row?.userId ?? 0, 0);
    if (customerId > 0) return scope.customerIds.has(customerId);
    const createdBy = parseNumber(row?.createdBy, 0);
    return scope.scopeType === 'platform' || scope.agentIds.has(createdBy);
  });
  const trackEvents = (Array.isArray(state.trackEvents) ? state.trackEvents : []).filter((row) =>
    scope.canSeeTenant(parseNumber(row?.tenantId, 1))
  );
  const bCustomerActivities = (Array.isArray(state.bCustomerActivities) ? state.bCustomerActivities : []).filter((row) => {
    const customerId = parseNumber(row?.customerId, 0);
    const agentId = parseNumber(row?.agentId, 0);
    const customerOk = customerId ? scope.customerIds.has(customerId) : true;
    const agentOk =
      scope.scopeType === 'platform' ||
      scope.scopeType === 'company' ||
      scope.agentIds.has(agentId) ||
      agentId === Number(scope.actorId);
    return customerOk && agentOk;
  });
  const agents = (Array.isArray(state.agents) ? state.agents : []).filter((row) => {
    if (scope.scopeType === 'platform') return true;
    if (!scope.canSeeTenant(row.tenantId)) return false;
    if (scope.scopeType === 'company') return true;
    if (scope.scopeType === 'manager') return scope.agentIds.has(Number(row.id)) || Number(row.teamId || 1) === Number(scope.scopeTeamId);
    return Number(row.id) === Number(scope.actorId);
  });
  const pLearningMaterials = (Array.isArray(state.pLearningMaterials) ? state.pLearningMaterials : []).filter((row) => {
    if (!scope.canSeeTenant(row.tenantId)) return false;
    if (scope.scopeType === 'platform' || scope.scopeType === 'company') return true;
    const createdBy = parseNumber(row?.createdBy, 0);
    return scope.agentIds.has(createdBy) || createdBy === Number(scope.actorId);
  });
  const pActivities = (Array.isArray(state.pActivities) ? state.pActivities : []).filter((row) => {
    if (!scope.canSeeTenant(row.tenantId)) return false;
    if (scope.scopeType === 'platform' || scope.scopeType === 'company') return true;
    const createdBy = parseNumber(row?.createdBy, 0);
    return scope.agentIds.has(createdBy) || createdBy === Number(scope.actorId);
  });
  const activityCatalogRows = (Array.isArray(state.activities) ? state.activities : []).filter((row) => {
    const domain = String(row?.sourceDomain || row?.source_domain || 'activity').trim().toLowerCase();
    if (domain !== 'activity') return false;
    return scope.canSeeTenant(row?.tenantId);
  });
  const bWriteOffRecords = (Array.isArray(state.bWriteOffRecords) ? state.bWriteOffRecords : []).filter((row) => {
    const agentId = parseNumber(row?.operatorAgentId, 0);
    if (scope.scopeType === 'platform') return true;
    if (!scope.canSeeTenant(row.tenantId)) return false;
    if (scope.scopeType === 'company') return true;
    return scope.agentIds.has(agentId) || agentId === Number(scope.actorId);
  });
  const auditLogs = (Array.isArray(state.auditLogs) ? state.auditLogs : []).filter((row) => {
    if (scope.scopeType === 'platform') return true;
    return scope.canSeeTenant(parseNumber(row?.tenantId, scope.tenantId));
  });
  const tenants = (Array.isArray(state.tenants) ? state.tenants : []).filter((row) => scope.canSeeTenant(row.tenantId || row.id));
  const sessions = (Array.isArray(state.sessions) ? state.sessions : []).filter((row) => {
    if (scope.scopeType === 'platform') return true;
    const tenantFromSession = parseNumber(row?.tenantId, scope.tenantId);
    return scope.canSeeTenant(tenantFromSession);
  });

  const inRange = (d, start, end) => Boolean(d && d >= start && d < end);
  const toMetricDayKey = (d) => {
    if (!d) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const toMetricHourKey = (d) => `${toMetricDayKey(d)}T${String(d.getHours()).padStart(2, '0')}`;
  const isCustomerEvent = (row) =>
    String(row?.actorType || '').toLowerCase() === 'customer' || String(row?.source || '').toLowerCase() === 'c-web';
  const isBEvent = (row) => {
    const source = String(row?.source || '').toLowerCase();
    const event = String(row?.event || '').toLowerCase();
    return source === 'b-web' || event.startsWith('b_');
  };
  const bEventActorInScope = (actorId) => {
    const aid = parseNumber(actorId, 0);
    if (!aid) return false;
    if (scope.scopeType === 'platform' || scope.scopeType === 'company') return true;
    if (scope.scopeType === 'manager') return scope.agentIds.has(aid) || aid === Number(scope.actorId);
    return aid === Number(scope.actorId);
  };
  const metricDailyUv = (Array.isArray(state.metricDailyUv) ? state.metricDailyUv : []).filter((row) =>
    scope.canSeeTenant(parseNumber(row?.tenantId, 1))
  );
  const metricDailyCounters = (Array.isArray(state.metricDailyCounters) ? state.metricDailyCounters : []).filter((row) =>
    scope.canSeeTenant(parseNumber(row?.tenantId, 1))
  );
  const metricHourlyCounters = (Array.isArray(state.metricHourlyCounters) ? state.metricHourlyCounters : []).filter((row) =>
    scope.canSeeTenant(parseNumber(row?.tenantId, 1))
  );
  const hasMetricAgg = metricDailyUv.length > 0 || metricDailyCounters.length > 0 || metricHourlyCounters.length > 0;
  const hasUvKey = (metricKey) => metricDailyUv.some((row) => String(row.metricKey || '') === metricKey);
  const hasDailyCounterKey = (metricKey) => metricDailyCounters.some((row) => String(row.metricKey || '') === metricKey);
  const hasHourlyCounterKey = (metricKey) => metricHourlyCounters.some((row) => String(row.metricKey || '') === metricKey);
  const dailyUvCount = (metricKey, dayKey, actorFilter) =>
    new Set(
      metricDailyUv
        .filter((row) => String(row.metricKey || '') === metricKey && String(row.statDate || '') === dayKey)
        .map((row) => parseNumber(row.actorId, 0))
        .filter((id) => id > 0 && (!actorFilter || actorFilter(id)))
    ).size;
  const dailyCounterSum = (metricKey, dayKey, actorFilter) =>
    metricDailyCounters
      .filter(
        (row) =>
          String(row.metricKey || '') === metricKey &&
          String(row.statDate || '') === dayKey &&
          (!actorFilter || actorFilter(parseNumber(row.actorId, 0)))
      )
      .reduce((sum, row) => sum + parseNumber(row.cnt, 0), 0);
  const hourlyCounterSum = (metricKey, start, end, actorFilter) =>
    metricHourlyCounters
      .filter((row) => {
        if (String(row.metricKey || '') !== metricKey) return false;
        if (actorFilter && !actorFilter(parseNumber(row.actorId, 0))) return false;
        const hk = String(row.hourKey || '');
        const hourTime = new Date(`${hk}:00:00`);
        return Boolean(hourTime && !Number.isNaN(hourTime.getTime()) && hourTime >= start && hourTime <= end);
      })
      .reduce((sum, row) => sum + parseNumber(row.cnt, 0), 0);

  const activeCustomerIdsToday = new Set();
  const activeCustomerIdsPrev = new Set();

  signIns.forEach((row) => {
    const date = asDate(row?.signDate ? `${row.signDate}T00:00:00` : row?.createdAt);
    const uid = parseNumber(row?.userId, 0);
    if (!uid) return;
    if (inRange(date, dayStart, dayEnd)) activeCustomerIdsToday.add(uid);
    if (inRange(date, prevDayStart, dayStart)) activeCustomerIdsPrev.add(uid);
  });

  activityCompletions.forEach((row) => {
    const date = rowDate(row, ['completedAt', 'createdAt']);
    const uid = parseNumber(row?.userId, 0);
    if (!uid) return;
    if (inRange(date, dayStart, dayEnd)) activeCustomerIdsToday.add(uid);
    if (inRange(date, prevDayStart, dayStart)) activeCustomerIdsPrev.add(uid);
  });

  courseCompletions.forEach((row) => {
    const date = rowDate(row, ['completedAt', 'createdAt']);
    const uid = parseNumber(row?.userId, 0);
    if (!uid) return;
    if (inRange(date, dayStart, dayEnd)) activeCustomerIdsToday.add(uid);
    if (inRange(date, prevDayStart, dayStart)) activeCustomerIdsPrev.add(uid);
  });

  pointTx.forEach((row) => {
    const date = rowDate(row, ['createdAt']);
    const uid = parseNumber(row?.userId, 0);
    if (!uid) return;
    if (inRange(date, dayStart, dayEnd)) activeCustomerIdsToday.add(uid);
    if (inRange(date, prevDayStart, dayStart)) activeCustomerIdsPrev.add(uid);
  });

  redemptions.forEach((row) => {
    const date = rowDate(row, ['createdAt']);
    const uid = parseNumber(row?.userId, 0);
    if (!uid) return;
    if (inRange(date, dayStart, dayEnd)) activeCustomerIdsToday.add(uid);
    if (inRange(date, prevDayStart, dayStart)) activeCustomerIdsPrev.add(uid);
  });

  trackEvents.forEach((row) => {
    const date = rowDate(row, ['createdAt']);
    const uid = parseNumber(row?.actorId, 0);
    if (!uid || !isCustomerEvent(row) || !scope.customerIds.has(uid)) return;
    if (inRange(date, dayStart, dayEnd)) activeCustomerIdsToday.add(uid);
    if (inRange(date, prevDayStart, dayStart)) activeCustomerIdsPrev.add(uid);
  });

  let cDau = activeCustomerIdsToday.size;
  let cDauPrev = activeCustomerIdsPrev.size;
  if (hasMetricAgg && hasUvKey('c_dau')) {
    cDau = dailyUvCount('c_dau', toMetricDayKey(dayStart), (id) => scope.customerIds.has(id));
    cDauPrev = dailyUvCount('c_dau', toMetricDayKey(prevDayStart), (id) => scope.customerIds.has(id));
  }

  const stayDuration = (start, end) => {
    let totalSeconds = 0;
    const usersSet = new Set();
    trackEvents.forEach((row) => {
      const date = rowDate(row, ['createdAt']);
      if (!inRange(date, start, end) || !isCustomerEvent(row)) return;
      const uid = parseNumber(row?.actorId, 0);
      if (!uid || !scope.customerIds.has(uid)) return;
      const props = row?.properties || {};
      const ms = parseNumber(props.durationMs ?? props.latencyMs ?? props.costMs, 0);
      const sec = parseNumber(props.durationSeconds ?? props.staySeconds ?? props.duration, 0);
      const durationSeconds = sec > 0 ? sec : ms > 0 ? ms / 1000 : 0;
      if (durationSeconds > 0) {
        totalSeconds += durationSeconds;
        usersSet.add(uid);
      }
    });
    const avgMin = usersSet.size > 0 ? totalSeconds / usersSet.size / 60 : 0;
    return avgMin;
  };

  const cStay = stayDuration(dayStart, dayEnd);
  const cStayPrev = stayDuration(prevDayStart, dayStart);

  const openRate = (start, end) => {
    const openUsers = new Set();
    const exposureUsers = new Set();
    trackEvents.forEach((row) => {
      const date = rowDate(row, ['createdAt']);
      if (!inRange(date, start, end) || !isCustomerEvent(row)) return;
      const uid = parseNumber(row?.actorId, 0);
      if (!uid || !scope.customerIds.has(uid)) return;
      const event = String(row?.event || '').toLowerCase();
      if (/open|view|detail|click/.test(event)) openUsers.add(uid);
      if (/push|send|exposure|impression|reach/.test(event)) exposureUsers.add(uid);
    });
    if (exposureUsers.size === 0) return 0;
    return (openUsers.size / exposureUsers.size) * 100;
  };

  const cOpenRate = openRate(dayStart, dayEnd);
  const cOpenPrev = openRate(prevDayStart, dayStart);

  const signInUsersToday = new Set(
    signIns
      .filter((row) => inRange(asDate(row?.signDate ? `${row.signDate}T00:00:00` : row?.createdAt), dayStart, dayEnd))
      .map((row) => parseNumber(row?.userId, 0))
      .filter((x) => x > 0)
  ).size;
  const signInUsersPrev = new Set(
    signIns
      .filter((row) => inRange(asDate(row?.signDate ? `${row.signDate}T00:00:00` : row?.createdAt), prevDayStart, dayStart))
      .map((row) => parseNumber(row?.userId, 0))
      .filter((x) => x > 0)
  ).size;
  const cSigninRate = cDau > 0 ? (signInUsersToday / cDau) * 100 : 0;
  const cSigninPrev = cDauPrev > 0 ? (signInUsersPrev / cDauPrev) * 100 : 0;

  const toLocalDayKey = (d) => {
    if (!d) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const parseDayKey = (dayKey) => {
    const parts = String(dayKey || '').split('-').map((x) => Number(x));
    if (parts.length !== 3 || parts.some((x) => !Number.isFinite(x) || x <= 0)) return null;
    const [y, m, d] = parts;
    return new Date(y, m - 1, d);
  };
  const streakAsOfDay = (daySet, asOfKey) => {
    if (!(daySet instanceof Set) || daySet.size === 0) return 0;
    const asOfDate = parseDayKey(asOfKey);
    if (!asOfDate) return 0;
    const days = [...daySet]
      .map((dayKey) => ({ key: String(dayKey), d: parseDayKey(dayKey) }))
      .filter((x) => x.d && x.d <= asOfDate)
      .sort((a, b) => a.d - b.d);
    if (days.length === 0) return 0;
    let streak = 1;
    for (let i = days.length - 1; i > 0; i -= 1) {
      const delta = (days[i].d - days[i - 1].d) / (24 * 60 * 60 * 1000);
      if (delta === 1) streak += 1;
      else break;
    }
    return streak;
  };
  const pickMetricCustomerId = (scopeInfo, loginMap, signinMap) => {
    const actorId = parseNumber(scopeInfo?.actorId, 0);
    if (String(scopeInfo?.actorType || '').toLowerCase() === 'customer' && scopeInfo?.customerIds?.has(actorId)) return actorId;
    const merged = new Map();
    const mergeMap = (m) => {
      m.forEach((days, uid) => {
        if (!scopeInfo.customerIds.has(uid)) return;
        const daySet = days instanceof Set ? days : new Set();
        const prev = merged.get(uid) || { size: 0, latest: '' };
        const latest = [...daySet].sort().pop() || prev.latest;
        merged.set(uid, { size: prev.size + daySet.size, latest: latest > prev.latest ? latest : prev.latest });
      });
    };
    mergeMap(loginMap);
    mergeMap(signinMap);
    const winner = [...merged.entries()].sort((a, b) => {
      if (b[1].size !== a[1].size) return b[1].size - a[1].size;
      if (b[1].latest !== a[1].latest) return b[1].latest.localeCompare(a[1].latest);
      return a[0] - b[0];
    })[0];
    return winner ? winner[0] : 0;
  };
  const todayDayKey = toLocalDayKey(dayStart);
  const prevDayKey = toLocalDayKey(prevDayStart);
  const allLoginUserDays = new Set();
  const prevLoginUserDays = new Set();
  const loginDaysByUser = new Map();
  sessions.forEach((row) => {
    const uid = parseNumber(row?.userId, 0);
    const dt = rowDate(row, ['createdAt']);
    if (!uid || !dt || !scope.customerIds.has(uid)) return;
    const dayKey = toLocalDayKey(dt);
    if (!dayKey) return;
    if (!loginDaysByUser.has(uid)) loginDaysByUser.set(uid, new Set());
    loginDaysByUser.get(uid).add(dayKey);
    if (dt < dayEnd) {
      allLoginUserDays.add(`${uid}:${dayKey}`);
    }
    if (dt < dayStart) {
      prevLoginUserDays.add(`${uid}:${dayKey}`);
    }
  });

  const allSigninUserDays = new Set();
  const prevSigninUserDays = new Set();
  const signinDaysByUser = new Map();
  signIns.forEach((row) => {
    const uid = parseNumber(row?.userId, 0);
    if (!uid || !scope.customerIds.has(uid)) return;
    const rawSignDate = String(row?.signDate || '').trim();
    const dt = rawSignDate ? asDate(`${rawSignDate}T00:00:00`) : rowDate(row, ['createdAt']);
    if (!dt) return;
    const dayKey = rawSignDate || toLocalDayKey(dt);
    if (!dayKey) return;
    if (!signinDaysByUser.has(uid)) signinDaysByUser.set(uid, new Set());
    signinDaysByUser.get(uid).add(dayKey);
    if (dt < dayEnd) {
      allSigninUserDays.add(`${uid}:${dayKey}`);
    }
    if (dt < dayStart) {
      prevSigninUserDays.add(`${uid}:${dayKey}`);
    }
  });
  const cSigninPersonDays = allSigninUserDays.size;
  const cSigninPersonDaysPrev = prevSigninUserDays.size;

  const metricCustomerId = pickMetricCustomerId(scope, loginDaysByUser, signinDaysByUser);
  const loginDaySet = loginDaysByUser.get(metricCustomerId) || new Set();
  const signinDaySet = signinDaysByUser.get(metricCustomerId) || new Set();
  const cLoginStreakDays = streakAsOfDay(loginDaySet, todayDayKey);
  const cLoginStreakDaysPrev = streakAsOfDay(loginDaySet, prevDayKey);
  const cSigninStreakDays = streakAsOfDay(signinDaySet, todayDayKey);
  const cSigninStreakDaysPrev = streakAsOfDay(signinDaySet, prevDayKey);

  const activePolicyCustomers = new Set();
  policies.forEach((row) => {
    const status = String(row?.status || '').toLowerCase();
    const active = status.includes('保障') || status === 'active' || status === 'in_force' || status === 'on';
    if (!active) return;
    const uid = parseNumber(row?.customerId ?? row?.userId ?? row?.createdBy, 0);
    if (uid) activePolicyCustomers.add(uid);
  });
  const totalUsers = users.length;
  const cPolicyRate = totalUsers > 0 ? (activePolicyCustomers.size / totalUsers) * 100 : 0;

  const bDauUsers = new Set(
    trackEvents
      .filter(
        (row) =>
          isBEvent(row) &&
          bEventActorInScope(row?.actorId) &&
          inRange(rowDate(row, ['createdAt']), dayStart, dayEnd)
      )
      .map((row) => parseNumber(row?.actorId, 0))
      .filter((x) => x > 0)
  );
  const bDauUsersPrev = new Set(
    trackEvents
      .filter(
        (row) =>
          isBEvent(row) &&
          bEventActorInScope(row?.actorId) &&
          inRange(rowDate(row, ['createdAt']), prevDayStart, dayStart)
      )
      .map((row) => parseNumber(row?.actorId, 0))
      .filter((x) => x > 0)
  );
  let bDau = bDauUsers.size;
  let bDauPrev = bDauUsersPrev.size;
  if (hasMetricAgg && hasUvKey('b_dau')) {
    bDau = dailyUvCount('b_dau', toMetricDayKey(dayStart), (id) => bEventActorInScope(id));
    bDauPrev = dailyUvCount('b_dau', toMetricDayKey(prevDayStart), (id) => bEventActorInScope(id));
  }

  const bActiveCustomerToday = new Set(
    bCustomerActivities
      .filter((row) => inRange(rowDate(row, ['happenedAt', 'createdAt']), dayStart, dayEnd))
      .map((row) => parseNumber(row?.customerId, 0))
      .filter((x) => x > 0)
  );
  const bActiveCustomerPrev = new Set(
    bCustomerActivities
      .filter((row) => inRange(rowDate(row, ['happenedAt', 'createdAt']), prevDayStart, dayStart))
      .map((row) => parseNumber(row?.customerId, 0))
      .filter((x) => x > 0)
  );
  let bInteractionRate = totalUsers > 0 ? (bActiveCustomerToday.size / totalUsers) * 100 : 0;
  let bInteractionPrev = totalUsers > 0 ? (bActiveCustomerPrev.size / totalUsers) * 100 : 0;
  if (hasMetricAgg && hasUvKey('b_interaction_customer')) {
    const bInteractTodayUv = dailyUvCount('b_interaction_customer', toMetricDayKey(dayStart), (id) => scope.customerIds.has(id));
    const bInteractPrevUv = dailyUvCount('b_interaction_customer', toMetricDayKey(prevDayStart), (id) => scope.customerIds.has(id));
    bInteractionRate = totalUsers > 0 ? (bInteractTodayUv / totalUsers) * 100 : 0;
    bInteractionPrev = totalUsers > 0 ? (bInteractPrevUv / totalUsers) * 100 : 0;
  }

  const remindStats = (start, end) => {
    let click = 0;
    let push = 0;
    trackEvents.forEach((row) => {
      if (!isBEvent(row) || !bEventActorInScope(row?.actorId) || !inRange(rowDate(row, ['createdAt']), start, end)) return;
      const event = String(row?.event || '').toLowerCase();
      if (!event.includes('remind')) return;
      if (event.includes('click')) click += 1;
      if (event.includes('push') || event.includes('send') || event.includes('show')) push += 1;
    });
    return push > 0 ? (click / push) * 100 : 0;
  };

  let bRemindRate = remindStats(dayStart, dayEnd);
  let bRemindPrev = remindStats(prevDayStart, dayStart);
  if (hasMetricAgg && (hasDailyCounterKey('b_remind_push') || hasDailyCounterKey('b_remind_click'))) {
    const actorFilter = (id) => bEventActorInScope(id);
    const pushToday = dailyCounterSum('b_remind_push', toMetricDayKey(dayStart), actorFilter);
    const clickToday = dailyCounterSum('b_remind_click', toMetricDayKey(dayStart), actorFilter);
    const pushPrev = dailyCounterSum('b_remind_push', toMetricDayKey(prevDayStart), actorFilter);
    const clickPrev = dailyCounterSum('b_remind_click', toMetricDayKey(prevDayStart), actorFilter);
    bRemindRate = pushToday > 0 ? (clickToday / pushToday) * 100 : 0;
    bRemindPrev = pushPrev > 0 ? (clickPrev / pushPrev) * 100 : 0;
  }

  const retentionWindowStart = new Date(dayStart);
  retentionWindowStart.setDate(retentionWindowStart.getDate() - 7);
  const retentionWindowEnd = new Date(retentionWindowStart);
  retentionWindowEnd.setDate(retentionWindowEnd.getDate() + 1);
  const cohortAgentIds = new Set(
    agents
      .filter((row) => inRange(rowDate(row, ['createdAt']), retentionWindowStart, retentionWindowEnd))
      .map((row) => parseNumber(row?.id, 0))
      .filter((x) => x > 0)
  );
  const retainedAgentIds = new Set(
    trackEvents
      .filter(
        (row) =>
          isBEvent(row) &&
          bEventActorInScope(row?.actorId) &&
          inRange(rowDate(row, ['createdAt']), dayStart, dayEnd)
      )
      .map((row) => parseNumber(row?.actorId, 0))
      .filter((x) => x > 0 && cohortAgentIds.has(x))
  );
  const bRetention7d = cohortAgentIds.size > 0 ? (retainedAgentIds.size / cohortAgentIds.size) * 100 : 0;

  const createdTodayCount = (rows) =>
    rows.filter((row) => inRange(rowDate(row, ['createdAt', 'updatedAt']), dayStart, dayEnd)).length;
  const createdPrevCount = (rows) =>
    rows.filter((row) => inRange(rowDate(row, ['createdAt', 'updatedAt']), prevDayStart, dayStart)).length;

  const bContentPublishCnt = createdTodayCount([...pLearningMaterials, ...pActivities]);
  const bContentPublishPrev = createdPrevCount([...pLearningMaterials, ...pActivities]);

  const bWriteoffCnt = bWriteOffRecords.filter(
    (row) => inRange(rowDate(row, ['createdAt']), dayStart, dayEnd) && String(row?.status || '').toLowerCase() === 'success'
  ).length;
  const bWriteoffPrev = bWriteOffRecords.filter(
    (row) => inRange(rowDate(row, ['createdAt']), prevDayStart, dayStart) && String(row?.status || '').toLowerCase() === 'success'
  ).length;

  const bDashboardMetrics = collectDashboardMetrics({ actor, days: 7 });
  const bRecent7dActiveTotal = parseNumber(bDashboardMetrics?.dailyActive7dTotal, 0);
  const bRecent7dActivePrev = parseNumber(bDashboardMetrics?.dailyActive7dPrevTotal, 0);
  const bRecent7dActivityParticipants = parseNumber(bDashboardMetrics?.activityParticipants7d, 0);
  const bRecent7dActivityParticipantsPrev = parseNumber(bDashboardMetrics?.activityParticipants7dPrev, 0);
  const bNewCustomersToday = parseNumber(bDashboardMetrics?.newCustomersToday, 0);
  const bNewCustomersPrev = parseNumber(bDashboardMetrics?.newCustomersPrev, 0);
  const bSignInCustomersToday = parseNumber(bDashboardMetrics?.signInCustomersToday, 0);
  const bSignInCustomersPrev = parseNumber(bDashboardMetrics?.signInCustomersPrev, 0);

  const pTenantTotal = tenants.filter((row) => String(row?.status || 'active').toLowerCase() !== 'inactive').length;
  const activeTenantIds7d = new Set(
    trackEvents
      .filter((row) => inRange(rowDate(row, ['createdAt']), weekAgo, dayEnd) && scope.canSeeTenant(parseNumber(row?.tenantId, scope.tenantId)))
      .map((row) => parseNumber(row?.tenantId, 0))
      .filter((x) => x > 0)
  );
  const activeTenantIdsPrev7d = new Set(
    trackEvents
      .filter((row) => inRange(rowDate(row, ['createdAt']), prevWeekStart, weekAgo) && scope.canSeeTenant(parseNumber(row?.tenantId, scope.tenantId)))
      .map((row) => parseNumber(row?.tenantId, 0))
      .filter((x) => x > 0)
  );
  const pTenantActive = activeTenantIds7d.size;
  const pTenantActivePrev = activeTenantIdsPrev7d.size;

  const policyValue = (row) => {
    const annual = parseNumber(row?.annualPremium, NaN);
    if (Number.isFinite(annual) && annual > 0) return annual;
    return parseNumber(row?.amount, 0);
  };
  const pPremiumMtd = policies
    .filter((row) => inRange(rowDate(row, ['createdAt']), monthStart, dayEnd))
    .reduce((sum, row) => sum + policyValue(row), 0);
  const pPremiumPrevMonth = policies
    .filter((row) => inRange(rowDate(row, ['createdAt']), prevMonthStart, monthStart))
    .reduce((sum, row) => sum + policyValue(row), 0);

  const monthInteractions = bCustomerActivities.filter((row) => inRange(rowDate(row, ['happenedAt', 'createdAt']), monthStart, dayEnd));
  const activeAgentsThisMonth = new Set(monthInteractions.map((row) => parseNumber(row?.agentId, 0)).filter((x) => x > 0));
  const pInteractionAvg = activeAgentsThisMonth.size > 0 ? monthInteractions.length / activeAgentsThisMonth.size : 0;

  const prevMonthInteractions = bCustomerActivities.filter((row) => inRange(rowDate(row, ['happenedAt', 'createdAt']), prevMonthStart, monthStart));
  const activeAgentsPrevMonth = new Set(prevMonthInteractions.map((row) => parseNumber(row?.agentId, 0)).filter((x) => x > 0));
  const pInteractionAvgPrev = activeAgentsPrevMonth.size > 0 ? prevMonthInteractions.length / activeAgentsPrevMonth.size : 0;

  const usersById = new Map(users.map((row) => [parseNumber(row?.id, 0), row]));
  const agentsById = new Map(agents.map((row) => [parseNumber(row?.id, 0), row]));
  const teamAmount = new Map();
  policies
    .filter((row) => inRange(rowDate(row, ['createdAt']), monthStart, dayEnd))
    .forEach((row) => {
      const customerId = parseNumber(row?.customerId ?? row?.userId ?? row?.createdBy, 0);
      const ownerId = parseNumber(usersById.get(customerId)?.ownerUserId, 0);
      const teamId = parseNumber(agentsById.get(ownerId)?.teamId, 0);
      if (!teamId) return;
      teamAmount.set(teamId, parseNumber(teamAmount.get(teamId), 0) + policyValue(row));
    });
  const topTeam = [...teamAmount.entries()].sort((a, b) => b[1] - a[1])[0] || null;

  const typeCount = new Map();
  policies.forEach((row) => {
    const t = String(row?.type || '其他').trim() || '其他';
    typeCount.set(t, parseNumber(typeCount.get(t), 0) + 1);
  });
  const totalPolicyType = [...typeCount.values()].reduce((sum, v) => sum + parseNumber(v, 0), 0);
  const topType = [...typeCount.entries()].sort((a, b) => b[1] - a[1])[0] || null;
  const topTypeRate = topType && totalPolicyType > 0 ? (topType[1] / totalPolicyType) * 100 : 0;

  const activityCreateRows = trackEvents.filter((row) => {
    if (String(row?.event || '') !== 'share_link_created') return false;
    if (String(row?.properties?.shareType || '').trim().toLowerCase() !== 'activity') return false;
    const actorId = parseNumber(row?.actorId, 0);
    if (scope.scopeType === 'platform' || scope.scopeType === 'company') return true;
    if (scope.scopeType === 'manager') return scope.agentIds.has(actorId) || actorId === Number(scope.actorId);
    return actorId === Number(scope.actorId);
  });
  const activityShareCodes = new Set(
    activityCreateRows.map((row) => String(row?.properties?.shareCode || '').trim()).filter(Boolean)
  );
  const activityShareViews = trackEvents.filter((row) => {
    if (String(row?.event || '') !== 'share_h5_view') return false;
    const shareCode = String(row?.properties?.shareCode || '').trim();
    return Boolean(shareCode && activityShareCodes.has(shareCode));
  });
  const activityCatalogMap = new Map(activityCatalogRows.map((row) => [parseNumber(row?.id, 0), row]));
  const completedActivityRows = activityCompletions.filter((row) => activityCatalogMap.has(parseNumber(row?.activityId, 0)));
  const sharedActivityIds = new Set(
    activityCreateRows.map((row) => parseNumber(row?.properties?.targetId, 0)).filter((id) => id > 0)
  );
  const completedActivityIds = new Set(completedActivityRows.map((row) => parseNumber(row?.activityId, 0)).filter((id) => id > 0));
  const activitySignupSummary = collectActivitySignupParticipants({
    state,
    scope,
    createdRows: trackEvents
      .filter((row) => String(row?.event || '') === 'share_link_created')
      .filter((row) => {
        const shareType = String(row?.properties?.shareType || '').trim().toLowerCase();
        if (shareType !== 'activity') return false;
        const actorId = parseNumber(row?.actorId, 0);
        if (scope.scopeType === 'platform' || scope.scopeType === 'company') return true;
        if (scope.scopeType === 'manager') return scope.agentIds.has(actorId) || actorId === Number(scope.actorId);
        return actorId === Number(scope.actorId);
      }),
    trackEvents,
  });
  const activityTotal = new Set([...sharedActivityIds, ...completedActivityIds]).size;
  const activityShareTotal = activityCreateRows.length;
  const activityShareViewTotal = activityShareViews.length;
  const activitySignupTotal = Number(activitySignupSummary.total || 0);

  let failToday = auditLogs.filter(
    (row) => inRange(rowDate(row, ['createdAt']), dayStart, dayEnd) && String(row?.result || '').toLowerCase() === 'fail'
  ).length;
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const audit24h = auditLogs.filter((row) => {
    const d = rowDate(row, ['createdAt']);
    const tenantOk = scope.scopeType === 'platform' || scope.canSeeTenant(parseNumber(row?.tenantId, scope.tenantId));
    return Boolean(d && d >= twentyFourHoursAgo && d <= now && tenantOk);
  });
  const success24h = audit24h.filter((row) => String(row?.result || '').toLowerCase() === 'success').length;
  let apiUptime = audit24h.length > 0 ? (success24h / audit24h.length) * 100 : 100;

  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const durationValues = [];
  trackEvents.forEach((row) => {
    const d = rowDate(row, ['createdAt']);
    if (!d || d < oneHourAgo || d > now) return;
    const props = row?.properties || {};
    const v = parseNumber(props.durationMs ?? props.latencyMs ?? props.costMs, 0);
    if (v > 0) durationValues.push(v);
  });
  const avgRt = durationValues.length > 0 ? durationValues.reduce((s, v) => s + v, 0) / durationValues.length : 0;

  const cpuCount = Math.max(1, os.cpus()?.length || 1);
  const serverLoad = Math.min(100, (parseNumber(os.loadavg?.()[0], 0) / cpuCount) * 100);

  const dbConn = sessions.filter((row) => {
    const exp = rowDate(row, ['expiresAt']);
    return Boolean(exp && exp > now);
  }).length;

  const oneHourAudit = auditLogs.filter((row) => {
    const d = rowDate(row, ['createdAt']);
    const tenantOk = scope.scopeType === 'platform' || scope.canSeeTenant(parseNumber(row?.tenantId, scope.tenantId));
    return Boolean(d && d >= oneHourAgo && d <= now && tenantOk);
  });
  const errorOneHour = oneHourAudit.filter((row) => String(row?.result || '').toLowerCase() === 'fail').length;
  let errorRate = oneHourAudit.length > 0 ? (errorOneHour / oneHourAudit.length) * 100 : 0;
  if (hasMetricAgg && (hasHourlyCounterKey('api_total') || hasHourlyCounterKey('api_success') || hasHourlyCounterKey('api_fail'))) {
    failToday = dailyCounterSum('api_fail', toMetricDayKey(dayStart));
    const total24h = hourlyCounterSum('api_total', twentyFourHoursAgo, now);
    const success24hAgg = hourlyCounterSum('api_success', twentyFourHoursAgo, now);
    apiUptime = total24h > 0 ? (success24hAgg / total24h) * 100 : 100;
    const total1h = hourlyCounterSum('api_total', oneHourAgo, now);
    const fail1h = hourlyCounterSum('api_fail', oneHourAgo, now);
    errorRate = total1h > 0 ? (fail1h / total1h) * 100 : 0;
  }

  return {
    c: [
      {
        ...METRIC_CARD_DEFINITIONS.c[0],
        value: formatInteger(cDau),
        ...trendByDelta(cDau, cDauPrev),
      },
      {
        ...METRIC_CARD_DEFINITIONS.c[1],
        value: formatMinutes(cStay),
        ...trendByDelta(cStay, cStayPrev),
      },
      {
        ...METRIC_CARD_DEFINITIONS.c[2],
        value: formatPercent(cOpenRate),
        ...trendByDelta(cOpenRate, cOpenPrev),
      },
      {
        ...METRIC_CARD_DEFINITIONS.c[3],
        value: formatPercent(cSigninRate),
        ...trendByDelta(cSigninRate, cSigninPrev),
      },
      {
        ...METRIC_CARD_DEFINITIONS.c[4],
        value: formatDays(cLoginStreakDays),
        ...trendByDelta(cLoginStreakDays, cLoginStreakDaysPrev),
      },
      {
        ...METRIC_CARD_DEFINITIONS.c[5],
        value: formatDays(cSigninStreakDays),
        ...trendByDelta(cSigninStreakDays, cSigninStreakDaysPrev),
      },
      {
        ...METRIC_CARD_DEFINITIONS.c[6],
        value: formatInteger(cSigninPersonDays),
        trend: `较昨日 ${trendByDelta(cSigninPersonDays, cSigninPersonDaysPrev).trend}`,
        trendType: trendByDelta(cSigninPersonDays, cSigninPersonDaysPrev).trendType,
      },
      {
        ...METRIC_CARD_DEFINITIONS.c[7],
        value: formatPercent(cPolicyRate),
        trend: `${activePolicyCustomers.size}/${formatInteger(totalUsers)}`,
        trendType: 'flat',
      },
    ],
    b: [
      {
        ...METRIC_CARD_DEFINITIONS.b[0],
        value: formatInteger(bDau),
        ...trendByDelta(bDau, bDauPrev),
      },
      {
        ...METRIC_CARD_DEFINITIONS.b[1],
        value: formatPercent(bInteractionRate),
        ...trendByDelta(bInteractionRate, bInteractionPrev),
      },
      {
        ...METRIC_CARD_DEFINITIONS.b[2],
        value: formatPercent(bRemindRate),
        ...trendByDelta(bRemindRate, bRemindPrev),
      },
      {
        ...METRIC_CARD_DEFINITIONS.b[3],
        value: formatPercent(bRetention7d),
        trend: `样本 ${formatInteger(cohortAgentIds.size)}`,
        trendType: 'flat',
      },
      {
        ...METRIC_CARD_DEFINITIONS.b[4],
        value: formatInteger(bContentPublishCnt),
        ...trendByDelta(bContentPublishCnt, bContentPublishPrev),
      },
      {
        ...METRIC_CARD_DEFINITIONS.b[5],
        value: formatInteger(bWriteoffCnt),
        ...trendByDelta(bWriteoffCnt, bWriteoffPrev),
      },
      {
        ...METRIC_CARD_DEFINITIONS.b[6],
        value: formatInteger(bRecent7dActiveTotal),
        ...trendByDelta(bRecent7dActiveTotal, bRecent7dActivePrev),
      },
      {
        ...METRIC_CARD_DEFINITIONS.b[7],
        value: formatInteger(bRecent7dActivityParticipants),
        ...trendByDelta(bRecent7dActivityParticipants, bRecent7dActivityParticipantsPrev),
      },
      {
        ...METRIC_CARD_DEFINITIONS.b[8],
        value: formatInteger(bNewCustomersToday),
        ...trendByDelta(bNewCustomersToday, bNewCustomersPrev),
      },
      {
        ...METRIC_CARD_DEFINITIONS.b[9],
        value: formatInteger(bSignInCustomersToday),
        ...trendByDelta(bSignInCustomersToday, bSignInCustomersPrev),
      },
    ],
    p: [
      {
        ...METRIC_CARD_DEFINITIONS.p[0],
        value: formatInteger(pTenantTotal),
        trend: `活跃 ${formatInteger(pTenantActive)}`,
        trendType: 'flat',
      },
      {
        ...METRIC_CARD_DEFINITIONS.p[1],
        value: formatInteger(pTenantActive),
        ...trendByDelta(pTenantActive, pTenantActivePrev),
      },
      {
        ...METRIC_CARD_DEFINITIONS.p[2],
        value: formatCurrency(pPremiumMtd),
        ...trendByDelta(pPremiumMtd, pPremiumPrevMonth),
      },
      {
        ...METRIC_CARD_DEFINITIONS.p[3],
        value: parseNumber(pInteractionAvg, 0).toFixed(1),
        ...trendByDelta(pInteractionAvg, pInteractionAvgPrev),
      },
      {
        ...METRIC_CARD_DEFINITIONS.p[4],
        value: topTeam ? `团队 ${topTeam[0]}` : '-',
        trend: topTeam ? formatCurrency(topTeam[1]) : '暂无',
        trendType: 'flat',
      },
      {
        ...METRIC_CARD_DEFINITIONS.p[5],
        value: topType ? `${topType[0]} ${topTypeRate.toFixed(1)}%` : '-',
        trend: `样本 ${formatInteger(totalPolicyType)}`,
        trendType: 'flat',
      },
      {
        ...METRIC_CARD_DEFINITIONS.p[6],
        value: formatInteger(activityTotal),
        trend: `报名活动 ${formatInteger(completedActivityIds.size)}`,
        trendType: 'flat',
      },
      {
        ...METRIC_CARD_DEFINITIONS.p[7],
        value: formatInteger(activityShareTotal),
        trend: `分享链接 ${formatInteger(activityShareCodes.size)}`,
        trendType: 'flat',
      },
      {
        ...METRIC_CARD_DEFINITIONS.p[8],
        value: formatInteger(activityShareViewTotal),
        trend: '来源 活动分享',
        trendType: 'flat',
      },
      {
        ...METRIC_CARD_DEFINITIONS.p[9],
        value: formatInteger(activitySignupTotal),
        trend: '去重客户',
        trendType: 'flat',
      },
    ],
    system: [
      {
        ...METRIC_CARD_DEFINITIONS.system[0],
        value: formatInteger(failToday),
        trend: failToday > 0 ? '需关注' : '正常',
        trendType: failToday > 0 ? 'down' : 'up',
      },
      {
        ...METRIC_CARD_DEFINITIONS.system[1],
        value: formatPercent(apiUptime),
        trend: '近24小时',
        trendType: apiUptime >= 99 ? 'up' : 'down',
      },
      {
        ...METRIC_CARD_DEFINITIONS.system[2],
        value: `${Math.round(avgRt)}ms`,
        trend: '近1小时',
        trendType: avgRt <= 250 ? 'up' : 'down',
      },
      {
        ...METRIC_CARD_DEFINITIONS.system[3],
        value: formatPercent(serverLoad),
        trend: 'CPU负载估算',
        trendType: serverLoad <= 80 ? 'up' : 'down',
      },
      {
        ...METRIC_CARD_DEFINITIONS.system[4],
        value: formatInteger(dbConn),
        trend: '活动会话',
        trendType: 'flat',
      },
      {
        ...METRIC_CARD_DEFINITIONS.system[5],
        value: formatPercent(errorRate),
        trend: '近1小时',
        trendType: errorRate <= 2 ? 'up' : 'down',
      },
    ],
  };
}

function __allocNextId(rows = [], nextIdFn) {
  if (typeof nextIdFn === 'function') return Number(nextIdFn(rows) || 1);
  const maxId = Array.isArray(rows) ? rows.reduce((m, row) => Math.max(m, Number(row?.id || 0)), 0) : 0;
  return maxId + 1;
}

function normalizeRuleVersion(version) {
  const n = Number(version || 0);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.floor(n);
}

function bumpRuleVersion(row, now) {
  row.ruleVersion = normalizeRuleVersion(row.ruleVersion) + 1;
  row.updatedAt = now;
}

function ensureMetricRuleSeeds(state, tenantId, nextIdFn) {
  if (!Array.isArray(state.metricRules)) state.metricRules = [];
  const tenantRows = state.metricRules.filter((row) => Number(row.tenantId || 1) === Number(tenantId));
  let changed = false;
  const now = new Date().toISOString();
  const legacyNameMap = {
    累计登录天数: '连续登录天数',
    累计签到天数: '连续签到天数',
    单客累计登录天数: '连续登录天数',
    单客累计签到天数: '连续签到天数',
  };
  tenantRows.forEach((row) => {
    const currentVersion = normalizeRuleVersion(row.ruleVersion);
    if (currentVersion !== Number(row.ruleVersion || 0)) {
      row.ruleVersion = currentVersion;
      changed = true;
    }
    let semanticChanged = false;
    const nextName = legacyNameMap[String(row.name || '').trim()];
    if (nextName && String(row.name || '') !== nextName) {
      row.name = nextName;
      semanticChanged = true;
      changed = true;
    }
    if (row.name === '连续登录天数') {
      if (String(row.formula || '') !== '连续登录天数(单客) = 某客户按登录日期去重后，连续自然日登录天数') {
        row.formula = '连续登录天数(单客) = 某客户按登录日期去重后，连续自然日登录天数';
        semanticChanged = true;
        changed = true;
      }
      if (String(row.period || '') !== '累计') {
        row.period = '累计';
        semanticChanged = true;
        changed = true;
      }
      if (String(row.source || '') !== '登录日志') {
        row.source = '登录日志';
        semanticChanged = true;
        changed = true;
      }
    }
    if (row.name === '连续签到天数') {
      if (String(row.formula || '') !== '连续签到天数(单客) = 某客户按签到日期去重后，连续自然日签到天数') {
        row.formula = '连续签到天数(单客) = 某客户按签到日期去重后，连续自然日签到天数';
        semanticChanged = true;
        changed = true;
      }
      if (String(row.period || '') !== '累计') {
        row.period = '累计';
        semanticChanged = true;
        changed = true;
      }
      if (String(row.source || '') !== 'c_sign_ins') {
        row.source = 'c_sign_ins';
        semanticChanged = true;
        changed = true;
      }
    }
    if (row.name === '签到人天') {
      if (String(row.formula || '') !== '签到人天 = count(distinct customer_id, sign_date)') {
        row.formula = '签到人天 = count(distinct customer_id, sign_date)';
        semanticChanged = true;
        changed = true;
      }
      if (String(row.period || '') !== '累计') {
        row.period = '累计';
        semanticChanged = true;
        changed = true;
      }
      if (String(row.source || '') !== 'c_sign_ins') {
        row.source = 'c_sign_ins';
        semanticChanged = true;
        changed = true;
      }
    }
    if (semanticChanged) {
      bumpRuleVersion(row, now);
    }
  });

  // 同端同名去重：保留最后开发/最后更新的一条（updatedAt优先，其次id）
  const grouped = new Map();
  tenantRows.forEach((row) => {
    const key = metricRuleKey(row.end, row.name);
    const list = grouped.get(key) || [];
    list.push(row);
    grouped.set(key, list);
  });
  const removeIds = new Set();
  grouped.forEach((list) => {
    if (!Array.isArray(list) || list.length <= 1) return;
    const sorted = [...list].sort((a, b) => {
      const at = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
      const bt = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
      if (at !== bt) return bt - at;
      return Number(b?.id || 0) - Number(a?.id || 0);
    });
    sorted.slice(1).forEach((row) => removeIds.add(Number(row.id || 0)));
  });
  if (removeIds.size > 0) {
    state.metricRules = state.metricRules.filter(
      (row) => !(Number(row.tenantId || 1) === Number(tenantId) && removeIds.has(Number(row.id || 0)))
    );
    changed = true;
  }

  const tenantRowsAfterDedupe = state.metricRules.filter((row) => Number(row.tenantId || 1) === Number(tenantId));
  const existingKeys = new Set(tenantRowsAfterDedupe.map((row) => metricRuleKey(row.end, row.name)));
  tenantRowsAfterDedupe.forEach((row) => {
    if (String(row.remark || '').trim()) return;
    row.remark = buildMetricRuleRemark({
      name: String(row.name || ''),
      formula: String(row.formula || ''),
      period: String(row.period || '每日'),
      source: String(row.source || ''),
    });
    row.updatedAt = now;
    changed = true;
  });

  Object.entries(METRIC_RULE_SEEDS).forEach(([end, list]) => {
    list.forEach((seed) => {
      const key = metricRuleKey(end, seed.name);
      if (existingKeys.has(key)) return;
      state.metricRules.push({
        id: __allocNextId(state.metricRules, nextIdFn),
        tenantId: Number(tenantId || 1),
        end,
        name: seed.name,
        formula: seed.formula,
        period: seed.period,
        source: seed.source,
        status: 'enabled',
        threshold: '',
        remark: buildMetricRuleRemark(seed),
        createdBy: null,
        createdAt: now,
        updatedAt: now,
        ruleVersion: 1,
      });
      existingKeys.add(key);
      changed = true;
    });
  });
  return changed;
}


export {
  METRIC_RULEBOOK_VERSION,
  buildMetricRuleRemark,
  bumpRuleVersion,
  computeMetricCards,
  ensureMetricRuleSeeds,
  metricRuleKey,
  normalizeRuleVersion,
  normalizeMetricEnd,
  normalizeMetricRemarkMode,
  normalizeMetricRuleStatus,
  parseNumber,
  rowDate,
};
