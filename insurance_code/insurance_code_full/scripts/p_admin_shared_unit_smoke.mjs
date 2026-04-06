import assert from 'node:assert/strict';
import {
  computeMetricCards,
  ensureMetricRuleSeeds,
} from '../server/skeleton-c-v1/routes/p-admin-metrics.shared.mjs';
import { buildTagJobCustomerMetrics, ensureTagSeeds } from '../server/skeleton-c-v1/routes/p-admin-tags.shared.mjs';
import { ensureEventDefinitionSeeds } from '../server/skeleton-c-v1/routes/p-admin-events.shared.mjs';

function isoHoursAgo(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function isoDaysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function allocNextId(rows) {
  const maxId = Array.isArray(rows) ? rows.reduce((m, row) => Math.max(m, Number(row?.id || 0)), 0) : 0;
  return maxId + 1;
}

function testTagMetricsDedup() {
  const state = {
    users: [
      { id: 2, tenantId: 1, ownerUserId: 88 },
    ],
    sessions: [
      { userId: 2, createdAt: isoDaysAgo(1) },
      { userId: 2, createdAt: isoDaysAgo(1) },
      { userId: 2, createdAt: isoDaysAgo(2) },
    ],
    signIns: [
      { tenantId: 1, userId: 2, signDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) },
      { tenantId: 1, userId: 2, signDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) },
      { tenantId: 1, userId: 2, signDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) },
    ],
    trackEvents: [
      { tenantId: 1, source: 'b-web', event: 'b_login_success', actorId: 88, createdAt: isoDaysAgo(1) },
      { tenantId: 1, source: 'b-web', event: 'b_login_success', actorId: 88, createdAt: isoDaysAgo(2) },
    ],
    policies: [
      { tenantId: 1, customerId: 2, annualPremium: 3000, createdAt: isoDaysAgo(10) },
    ],
    redemptions: [],
    pointTransactions: [],
    activityCompletions: [],
    courseCompletions: [],
  };

  const result = buildTagJobCustomerMetrics(state, 1, [2]);
  const row = result.get(2);
  assert.ok(row, 'customer metrics should exist');
  assert.equal(row.c_login_days_30d, 2, '30d login days should be distinct days');
  assert.equal(row.c_login_count_30d, 2, '30d login count should be deduped by day');
  assert.equal(row.c_sign_days_30d, 2, '30d sign-in days should be distinct days');
  assert.equal(row.c_sign_count_30d, 2, '30d sign-in count should be deduped by day');
  assert.equal(row.b_login_count_30d, 2, '30d B login count should be distinct days');
  assert.equal(row.premium_12m, 3000, '12m premium should aggregate from policies');
}

function testSystemApiUptime24h() {
  const state = {
    users: [{ id: 2, tenantId: 1, ownerUserId: 88 }],
    userRoles: [{ tenantId: 1, userType: 'employee', userId: 1, roleId: 1 }],
    roles: [{ id: 1, key: 'platform_admin' }],
    rolePermissions: [],
    permissions: [],
    agents: [{ id: 88, tenantId: 1, teamId: 1, role: 'manager' }],
    signIns: [],
    activityCompletions: [],
    courseCompletions: [],
    pointTransactions: [],
    redemptions: [],
    policies: [],
    trackEvents: [],
    bCustomerActivities: [],
    pLearningMaterials: [],
    pActivities: [],
    bWriteOffRecords: [],
    tenants: [{ id: 1, tenantId: 1, status: 'active' }],
    sessions: [],
    metricDailyUv: [],
    metricDailyCounters: [],
    metricHourlyCounters: [],
    auditLogs: [
      { tenantId: 1, result: 'success', createdAt: isoHoursAgo(1) },
      { tenantId: 1, result: 'success', createdAt: isoHoursAgo(3) },
      { tenantId: 1, result: 'fail', createdAt: isoHoursAgo(5) },
      { tenantId: 1, result: 'success', createdAt: isoHoursAgo(30) },
    ],
  };

  const cards = computeMetricCards(state, { actorType: 'employee', actorId: 1, tenantId: 1, teamId: 1 });
  const apiUptimeCard = cards.system.find((x) => x.key === 'sys_api_uptime');
  assert.ok(apiUptimeCard, 'sys_api_uptime card should exist');
  assert.equal(apiUptimeCard.value, '66.7%', 'API uptime must use 24h window');
}

function testTagSeedIdempotent() {
  const state = {
    pTags: [],
    pTagRules: [],
    pTagRuleJobs: [],
    pTagRuleJobLogs: [],
  };
  const first = ensureTagSeeds(state, 2, allocNextId);
  assert.equal(first, true, 'first seed should mutate state');
  assert.ok(state.pTags.length > 0, 'tags should be seeded');
  assert.ok(state.pTagRules.length > 0, 'tag rules should be seeded');
  const tagIdSet = new Set(state.pTags.map((x) => Number(x.id)));
  state.pTagRules.forEach((rule) => {
    const targetIds = Array.isArray(rule.targetTagIds) ? rule.targetTagIds : [rule.targetTagId];
    targetIds.forEach((id) => assert.ok(tagIdSet.has(Number(id)), 'rule target tag must exist'));
  });
  const second = ensureTagSeeds(state, 2, allocNextId);
  assert.equal(second, false, 'second seed should be idempotent');
}

function testEventSeedSchemaBackfill() {
  const now = new Date().toISOString();
  const state = {
    eventDefinitions: [
      {
        id: 1,
        tenantId: 3,
        eventId: 1004,
        eventName: '旧事件名',
        eventType: 'system',
        description: '',
        collectMethod: 'backend',
        status: 'enabled',
        schema: {},
        createdAt: now,
        updatedAt: now,
      },
    ],
  };

  const first = ensureEventDefinitionSeeds(state, 3, allocNextId);
  assert.equal(first, true, 'seed should backfill and sync system events');
  assert.ok(state.eventDefinitions.length >= 9, 'system seed set should be present');
  const shareC = state.eventDefinitions.find((x) => Number(x.eventId) === 1004);
  assert.ok(shareC, 'event 1004 should exist');
  assert.equal(String(shareC.collectMethod), 'frontend', '1004 collectMethod should sync to seed');
  assert.ok(String(shareC.schema?.caliber || '').includes('c_share_success'), '1004 schema should include caliber');
}

function testMetricSeedIdempotentAndDedupe() {
  const now = new Date().toISOString();
  const state = {
    metricRules: [
      {
        id: 1,
        tenantId: 5,
        end: 'c',
        name: '累计登录天数',
        formula: 'old formula',
        period: '每日',
        source: 'old',
        status: 'enabled',
        threshold: '',
        remark: '',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 2,
        tenantId: 5,
        end: 'c',
        name: '连续登录天数',
        formula: 'newer formula',
        period: '累计',
        source: '登录日志',
        status: 'enabled',
        threshold: '',
        remark: '',
        createdAt: now,
        updatedAt: new Date(Date.now() + 1000).toISOString(),
      },
    ],
  };

  const first = ensureMetricRuleSeeds(state, 5, allocNextId);
  assert.equal(first, true, 'first metric seed should mutate state');
  assert.ok(state.metricRules.length > 2, 'metric seeds should be appended');

  const cLoginStreak = state.metricRules.filter(
    (x) => Number(x.tenantId) === 5 && String(x.end) === 'c' && String(x.name) === '连续登录天数'
  );
  assert.equal(cLoginStreak.length, 1, 'same end+name should dedupe to one row');
  assert.ok(String(cLoginStreak[0].remark || '').includes('数据表:'), 'remark should be auto-filled');

  const countAfterFirst = state.metricRules.length;
  const second = ensureMetricRuleSeeds(state, 5, allocNextId);
  assert.equal(second, false, 'second run should be idempotent after first normalization');
  const countAfterSecond = state.metricRules.length;
  assert.equal(countAfterSecond, countAfterFirst, 'second run should not create duplicate seed rows');
}

function main() {
  testTagMetricsDedup();
  testSystemApiUptime24h();
  testTagSeedIdempotent();
  testEventSeedSchemaBackfill();
  testMetricSeedIdempotentAndDedupe();
  console.log(
    JSON.stringify(
      {
        ok: true,
        checks: [
          'tag_metrics_dedup',
          'sys_api_uptime_24h',
          'tag_seed_idempotent',
          'event_seed_schema_backfill',
          'metric_seed_idempotent_and_dedupe',
        ],
      },
      null,
      2
    )
  );
}

main();
