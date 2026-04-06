#!/usr/bin/env node

const BASE = String(process.env.API_BASE_URL || process.env.API_BASE || 'http://127.0.0.1:4000').replace(/\/+$/, '');
const ACCOUNT = String(process.env.P_ADMIN_ACCOUNT || 'platform001');
const PASSWORD = String(process.env.P_ADMIN_PASSWORD || '123456');

function fail(message, context = null) {
  const err = new Error(message);
  err.context = context;
  throw err;
}

async function request(path, { method = 'GET', token = '', csrfToken = '', body } = {}) {
  const headers = {
    ...(body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase()) ? { 'x-csrf-token': csrfToken } : {}),
  };
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data };
}

async function main() {
  const checks = [];

  const login = await request('/api/p/auth/login', {
    method: 'POST',
    body: { account: ACCOUNT, password: PASSWORD },
  });
  if (!login.ok) fail('P admin login failed', login);

  const token = String(login.data?.session?.token || '');
  const csrfToken = String(login.data?.session?.csrfToken || '');
  if (!token || !csrfToken) fail('Missing session token/csrfToken', login.data);

  let createdRuleId = 0;
  let createdEventId = 0;
  let createdEventCode = 0;

  try {
    const metricConfig = await request('/api/p/metrics/config', { token });
    if (!metricConfig.ok) fail('metrics config request failed', metricConfig);
    if (typeof metricConfig.data?.rulebookVersion !== 'string' || !metricConfig.data.rulebookVersion.trim()) {
      fail('metrics config missing rulebookVersion', metricConfig.data);
    }
    const metricRules = Array.isArray(metricConfig.data?.rules) ? metricConfig.data.rules : [];
    if (metricRules.some((rule) => Number(rule?.ruleVersion || 0) <= 0)) {
      fail('metrics config has invalid ruleVersion', metricConfig.data);
    }
    checks.push({ name: 'metrics.config.version_presence', ok: true, rulebookVersion: metricConfig.data.rulebookVersion, ruleCount: metricRules.length });

    const ts = Date.now();
    const createRule = await request('/api/p/metrics/rules', {
      method: 'POST',
      token,
      csrfToken,
      body: {
        end: 'c',
        name: `版本烟测_指标_${ts}`,
        formula: '计数(行为事件)',
        period: '每日',
        source: 'p_track_events',
        status: 'enabled',
      },
    });
    if (!createRule.ok) fail('metric rule create failed', createRule);
    createdRuleId = Number(createRule.data?.rule?.id || 0);
    const createdRuleVersion = Number(createRule.data?.rule?.ruleVersion || 0);
    if (createdRuleId <= 0 || createdRuleVersion !== 1) {
      fail('metric rule create version invalid', createRule.data);
    }

    const updateRule = await request(`/api/p/metrics/rules/${createdRuleId}`, {
      method: 'PUT',
      token,
      csrfToken,
      body: {
        end: 'c',
        name: `版本烟测_指标_${ts}`,
        formula: '计数(行为事件)+1',
        period: '每日',
        source: 'p_track_events',
        status: 'enabled',
      },
    });
    if (!updateRule.ok) fail('metric rule update failed', updateRule);
    const updatedRuleVersion = Number(updateRule.data?.rule?.ruleVersion || 0);
    if (updatedRuleVersion !== createdRuleVersion + 1) {
      fail('metric rule version not incremented', { createdRuleVersion, updatedRuleVersion, response: updateRule.data });
    }
    checks.push({ name: 'metrics.rule.version_increment', ok: true, createdRuleVersion, updatedRuleVersion });

    createdEventCode = Number(`9${String(ts).slice(-8)}`);
    const createEvent = await request('/api/p/events/definitions', {
      method: 'POST',
      token,
      csrfToken,
      body: {
        eventId: createdEventCode,
        eventName: `版本烟测事件_${ts}`,
        eventType: 'custom',
        collectMethod: 'frontend',
        status: 'enabled',
        description: 'v1',
        schema: { caliber: '测试口径v1', properties: { key: 'string' } },
      },
    });
    if (!createEvent.ok) fail('event definition create failed', createEvent);
    createdEventId = Number(createEvent.data?.item?.id || 0);
    const createdEventVersion = Number(createEvent.data?.item?.definitionVersion || 0);
    if (createdEventId <= 0 || createdEventVersion !== 1) {
      fail('event definition create version invalid', createEvent.data);
    }

    const updateEvent = await request('/api/p/events/definitions', {
      method: 'POST',
      token,
      csrfToken,
      body: {
        id: createdEventId,
        eventId: createdEventCode,
        eventName: `版本烟测事件_${ts}`,
        eventType: 'custom',
        collectMethod: 'frontend',
        status: 'enabled',
        description: 'v2',
        schema: { caliber: '测试口径v2', properties: { key: 'string', ext: 'string' } },
      },
    });
    if (!updateEvent.ok) fail('event definition update failed', updateEvent);
    const updatedEventVersion = Number(updateEvent.data?.item?.definitionVersion || 0);
    if (updatedEventVersion !== createdEventVersion + 1) {
      fail('event definition version not incremented', { createdEventVersion, updatedEventVersion, response: updateEvent.data });
    }
    checks.push({ name: 'events.definition.version_increment', ok: true, createdEventVersion, updatedEventVersion });

    const eventList = await request('/api/p/events/definitions', { token });
    if (!eventList.ok) fail('events definitions request failed', eventList);
    if (typeof eventList.data?.dictionaryVersion !== 'string' || !eventList.data.dictionaryVersion.trim()) {
      fail('events definitions missing dictionaryVersion', eventList.data);
    }
    const listRows = Array.isArray(eventList.data?.list) ? eventList.data.list : [];
    if (listRows.some((row) => Number(row?.definitionVersion || 0) <= 0)) {
      fail('events definitions has invalid definitionVersion', eventList.data);
    }
    checks.push({ name: 'events.definitions.version_presence', ok: true, dictionaryVersion: eventList.data.dictionaryVersion, definitionCount: listRows.length });
  } finally {
    if (createdRuleId > 0) {
      await request(`/api/p/metrics/rules/${createdRuleId}`, {
        method: 'DELETE',
        token,
        csrfToken,
      });
    }
    if (createdEventId > 0) {
      await request(`/api/p/events/definitions/${createdEventId}`, {
        method: 'DELETE',
        token,
        csrfToken,
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        base: BASE,
        checks,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: String(err?.message || err),
        context: err?.context || null,
      },
      null,
      2
    )
  );
  process.exit(1);
});
