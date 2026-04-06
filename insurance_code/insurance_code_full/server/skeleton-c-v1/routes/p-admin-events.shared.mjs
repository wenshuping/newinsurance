const EVENT_DEFINITION_SEEDS = [
  { eventId: 1001, eventName: '登录', description: '用户成功登录', collectMethod: 'frontend' },
  { eventId: 1002, eventName: '浏览页面', description: '进入任意页面', collectMethod: 'frontend' },
  { eventId: 1003, eventName: '浏览内容', description: '查看课程/文章详情', collectMethod: 'frontend' },
  { eventId: 1004, eventName: 'C端分享成功', description: 'C端客户分享成功', collectMethod: 'frontend' },
  { eventId: 1005, eventName: '签到', description: '每日签到', collectMethod: 'frontend' },
  { eventId: 1006, eventName: '兑换', description: '积分兑换商品/活动', collectMethod: 'backend' },
  { eventId: 1007, eventName: '学习完成', description: '课程学习进度达100%', collectMethod: 'backend' },
  { eventId: 1008, eventName: '活动参与', description: '成功参与活动', collectMethod: 'backend' },
  { eventId: 1009, eventName: 'B端分享成功', description: 'B端分享成功', collectMethod: 'frontend' },
];

const EVENT_DICTIONARY_VERSION = '2026-03-06.v1';

const EVENT_SCHEMA_TEMPLATES = {
  1001: {
    caliber: '用户完成登录并建立有效会话后记1次；自动登录同样记入。',
    properties: {
      login_method: 'wechat|mobile',
      is_auto_login: 'boolean',
    },
  },
  1002: {
    caliber: '页面加载完成后记1次PV；同一页面重复进入重复计数。',
    properties: {
      page_name: 'string',
      from_page: 'string',
    },
  },
  1003: {
    caliber: '进入课程/文章/活动详情页并渲染成功后记1次。',
    properties: {
      content_id: 'number|string',
      content_type: 'course|article|activity',
      content_name: 'string',
    },
  },
  1004: {
    caliber: 'C端客户分享成功(c_share_success)后记1次；取消分享不计入。',
    properties: {
      content_id: 'number|string',
      actor_side: 'c_customer',
      source: 'c-web',
      event_keys: 'c_share_success',
      share_method: 'web_share|clipboard',
      tab: 'home|activities|learning|profile|mall',
      path: 'string',
      tenant_id: 'number',
    },
  },
  1009: {
    caliber: 'B端分享成功(b_tools_share_success)后记1次；取消分享不计入。',
    properties: {
      content_id: 'number|string',
      actor_side: 'b_customer',
      source: 'b-web',
      event_keys: 'b_tools_share_success',
      share_channel: 'wechat_friend|moments|link',
      share_method: 'system|clipboard|manual',
      kind: 'content|activity|product|mall_activity',
      share_path: 'list|detail',
      tenant_id: 'number',
    },
  },
  1005: {
    caliber: '每日签到接口成功后记1次；重复签到不重复计入成功事件。',
    properties: {
      continuous_days: 'int',
      points_earned: 'int',
    },
  },
  1006: {
    caliber: '兑换订单创建并支付成功后记1次。',
    properties: {
      item_id: 'number|string',
      item_type: 'product|activity',
      points_cost: 'int',
    },
  },
  1007: {
    caliber: '学习进度达到100%且发放积分成功后记1次。',
    properties: {
      content_id: 'number|string',
      study_duration_sec: 'int',
      points_earned: 'int',
    },
  },
  1008: {
    caliber: '活动参与成功并确认有效参与后记1次。',
    properties: {
      activity_id: 'number|string',
      activity_type: 'task|competition|invite|sign',
    },
  },
};

function normalizeEventType(type) {
  const value = String(type || '').trim().toLowerCase();
  return value === 'system' ? 'system' : 'custom';
}

function normalizeCollectMethod(method) {
  const value = String(method || '').trim().toLowerCase();
  if (value === 'backend' || value === 'both') return value;
  return 'frontend';
}

function normalizeEventStatus(status) {
  const value = String(status || '').trim().toLowerCase();
  if (['0', 'disabled', 'off'].includes(value)) return 'disabled';
  if (['2', 'draft'].includes(value)) return 'draft';
  return 'enabled';
}

function toEventStatusCode(status) {
  const value = normalizeEventStatus(status);
  if (value === 'disabled') return 0;
  if (value === 'draft') return 2;
  return 1;
}

function eventSchemaTemplateById(eventId) {
  const id = Number(eventId || 0);
  const template = EVENT_SCHEMA_TEMPLATES[id];
  if (!template) return null;
  return JSON.parse(JSON.stringify(template));
}

function __allocNextId(rows = [], nextIdFn) {
  if (typeof nextIdFn === 'function') return Number(nextIdFn(rows) || 1);
  const maxId = Array.isArray(rows) ? rows.reduce((m, row) => Math.max(m, Number(row?.id || 0)), 0) : 0;
  return maxId + 1;
}

function normalizeDefinitionVersion(version) {
  const n = Number(version || 0);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.floor(n);
}

function bumpDefinitionVersion(row, now) {
  row.definitionVersion = normalizeDefinitionVersion(row.definitionVersion) + 1;
  row.updatedAt = now;
}

function ensureEventDefinitionSeeds(state, tenantId, nextIdFn) {
  if (!Array.isArray(state.eventDefinitions)) state.eventDefinitions = [];
  const exists = state.eventDefinitions.some((row) => Number(row.tenantId || 1) === Number(tenantId));
  const now = new Date().toISOString();
  let changed = false;
  const seedByEventId = new Map(EVENT_DEFINITION_SEEDS.map((seed) => [Number(seed.eventId), seed]));
  if (!exists) {
    EVENT_DEFINITION_SEEDS.forEach((seed) => {
      state.eventDefinitions.push({
        id: __allocNextId(state.eventDefinitions, nextIdFn),
        tenantId: Number(tenantId || 1),
        eventId: Number(seed.eventId),
        eventName: seed.eventName,
        eventType: 'system',
        description: seed.description,
        collectMethod: seed.collectMethod,
        status: 'enabled',
        schema: eventSchemaTemplateById(seed.eventId) || {},
        definitionVersion: 1,
        createdBy: null,
        createdAt: now,
        updatedAt: now,
      });
    });
    changed = true;
  }

  const tenantRowsCurrent = state.eventDefinitions.filter((row) => Number(row.tenantId || 1) === Number(tenantId));
  const existedEventIds = new Set(tenantRowsCurrent.map((row) => Number(row.eventId || 0)));
  EVENT_DEFINITION_SEEDS.forEach((seed) => {
    const eventId = Number(seed.eventId || 0);
    if (existedEventIds.has(eventId)) return;
    state.eventDefinitions.push({
      id: __allocNextId(state.eventDefinitions, nextIdFn),
      tenantId: Number(tenantId || 1),
      eventId,
      eventName: seed.eventName,
      eventType: 'system',
      description: seed.description,
      collectMethod: seed.collectMethod,
      status: 'enabled',
      schema: eventSchemaTemplateById(seed.eventId) || {},
      definitionVersion: 1,
      createdBy: null,
      createdAt: now,
      updatedAt: now,
    });
    changed = true;
  });

  const tenantRows = state.eventDefinitions.filter((row) => Number(row.tenantId || 1) === Number(tenantId));
  tenantRows.forEach((row) => {
    let semanticChanged = false;
    const currentVersion = normalizeDefinitionVersion(row.definitionVersion);
    if (currentVersion !== Number(row.definitionVersion || 0)) {
      row.definitionVersion = currentVersion;
      changed = true;
    }
    if (normalizeEventType(row.eventType) !== 'system') return;
    const seed = seedByEventId.get(Number(row.eventId || 0));
    if (seed) {
      const nextName = String(seed.eventName || '');
      const nextDesc = String(seed.description || '');
      const nextMethod = normalizeCollectMethod(seed.collectMethod);
      if (String(row.eventName || '') !== nextName) {
        row.eventName = nextName;
        semanticChanged = true;
        changed = true;
      }
      if (String(row.description || '') !== nextDesc) {
        row.description = nextDesc;
        semanticChanged = true;
        changed = true;
      }
      if (normalizeCollectMethod(row.collectMethod) !== nextMethod) {
        row.collectMethod = nextMethod;
        semanticChanged = true;
        changed = true;
      }
    }
    const template = eventSchemaTemplateById(row.eventId);
    if (!template) return;
    const hasCaliber = row.schema && typeof row.schema === 'object' && String(row.schema.caliber || '').trim();
    const shouldSyncSchema = !hasCaliber || Number(row.eventId || 0) === 1004 || Number(row.eventId || 0) === 1009;
    if (shouldSyncSchema && JSON.stringify(row.schema || {}) !== JSON.stringify(template)) {
      row.schema = template;
      semanticChanged = true;
      changed = true;
    }
    if (semanticChanged) bumpDefinitionVersion(row, now);
  });

  return changed;
}


export {
  EVENT_DICTIONARY_VERSION,
  ensureEventDefinitionSeeds,
  eventSchemaTemplateById,
  normalizeDefinitionVersion,
  normalizeCollectMethod,
  normalizeEventStatus,
  normalizeEventType,
  toEventStatusCode,
};
