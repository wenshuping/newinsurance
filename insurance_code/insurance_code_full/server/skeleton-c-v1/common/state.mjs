import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';
import dotenv from 'dotenv';
import { sanitizeStoredPolicyAnalysis } from '../services/policy-analysis.service.mjs';
import { ensurePublicPoolTenantState } from './public-pool-tenant.mjs';
import {
  DEFAULT_COURSE_SOURCE_TYPE,
  mergeVideoChannelMetaIntoMedia,
  resolveCourseSourceType,
  resolveCourseVideoChannelMeta,
  stripVideoChannelMetaFromMedia,
} from './video-channel-course.mjs';

dotenv.config();

const { Pool } = pg;

const dataDir = path.resolve(process.cwd(), 'server', 'data');
const defaultSeedPath = path.join(dataDir, 'db.json');
const defaultRuntimeSnapshotPath = path.join(dataDir, 'runtime-snapshot.json');
const relationalSchemaPath = path.join(dataDir, 'schema_phase_a_prd_v1.sql');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

function resolveDataFilePath(rawPath, fallbackPath) {
  if (!rawPath) return fallbackPath;
  return path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath);
}

function clampText(value, maxLength) {
  const text = String(value || '');
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

const seedPath = resolveDataFilePath(process.env.STATE_SEED_PATH, defaultSeedPath);
const runtimeSnapshotPath = resolveDataFilePath(process.env.STATE_RUNTIME_SNAPSHOT_PATH, defaultRuntimeSnapshotPath);

if (path.resolve(seedPath) === path.resolve(runtimeSnapshotPath)) {
  throw new Error('STATE_RUNTIME_SNAPSHOT_PATH must differ from STATE_SEED_PATH');
}

const initialState = {
  users: [],
  tenants: [
    { id: 1, name: '平台租户', status: 'active', type: 'company', createdAt: new Date().toISOString() },
    { id: 2, name: '隔离租户A', status: 'active', type: 'company', createdAt: new Date().toISOString() },
    { id: 3, name: '隔离租户B', status: 'active', type: 'company', createdAt: new Date().toISOString() },
    { id: 4, name: '隔离租户C', status: 'active', type: 'company', createdAt: new Date().toISOString() },
  ],
  orgUnits: [
    { id: 1, tenantId: 1, name: '平台机构', createdAt: new Date().toISOString() },
    { id: 2, tenantId: 2, name: '租户A机构', createdAt: new Date().toISOString() },
    { id: 3, tenantId: 3, name: '租户B机构', createdAt: new Date().toISOString() },
    { id: 4, tenantId: 4, name: '租户C机构', createdAt: new Date().toISOString() },
  ],
  teams: [
    { id: 1, tenantId: 1, orgId: 1, name: '平台团队', createdAt: new Date().toISOString() },
    { id: 2, tenantId: 2, orgId: 2, name: '租户A团队', createdAt: new Date().toISOString() },
    { id: 3, tenantId: 3, orgId: 3, name: '租户B团队', createdAt: new Date().toISOString() },
    { id: 4, tenantId: 4, orgId: 4, name: '租户C团队', createdAt: new Date().toISOString() },
  ],
  agents: [
    {
      id: 8201,
      tenantId: 2,
      orgId: 2,
      teamId: 2,
      name: '租户A管理员',
      status: 'active',
      role: 'manager',
      account: 'tenanta_admin',
      email: 'tenanta_admin@demo.local',
      mobile: '13810000001',
      password: '123456',
      initialPassword: '123456',
      createdAt: new Date().toISOString(),
    },
    {
      id: 8202,
      tenantId: 2,
      orgId: 2,
      teamId: 2,
      name: '租户A业务员1',
      status: 'active',
      role: 'agent',
      account: 'tenanta_agent1',
      email: 'tenanta_agent1@demo.local',
      mobile: '13810000002',
      password: '123456',
      initialPassword: '123456',
      createdAt: new Date().toISOString(),
    },
    {
      id: 8203,
      tenantId: 2,
      orgId: 2,
      teamId: 2,
      name: '新华保险管理员',
      status: 'active',
      role: 'manager',
      account: 'xinhua_admin',
      email: 'xinhua@126.com',
      mobile: '18610000001',
      password: '123456',
      initialPassword: '123456',
      createdAt: new Date().toISOString(),
    },
    {
      id: 8204,
      tenantId: 2,
      orgId: 2,
      teamId: 2,
      name: '方雨晴',
      status: 'active',
      role: 'support',
      account: 'fangyuqing',
      email: 'fangyuqing@126.com',
      mobile: '18610000002',
      wecomContactUrl: '',
      wechatId: '',
      wechatQrUrl: '',
      password: '123456',
      initialPassword: '123456',
      createdAt: new Date().toISOString(),
    },
    {
      id: 8205,
      tenantId: 2,
      orgId: 2,
      teamId: 2,
      name: '小英',
      status: 'active',
      role: 'agent',
      account: 'xiaoying',
      email: 'xiaoying@126.com',
      mobile: '18610000003',
      password: '123456',
      initialPassword: '123456',
      createdAt: new Date().toISOString(),
    },
    {
      id: 8301,
      tenantId: 3,
      orgId: 3,
      teamId: 3,
      name: '租户B管理员',
      status: 'active',
      role: 'manager',
      account: 'tenantb_admin',
      email: 'tenantb_admin@demo.local',
      mobile: '13820000001',
      password: '123456',
      initialPassword: '123456',
      createdAt: new Date().toISOString(),
    },
    {
      id: 8302,
      tenantId: 3,
      orgId: 3,
      teamId: 3,
      name: '租户B业务员1',
      status: 'active',
      role: 'agent',
      account: 'tenantb_agent1',
      email: 'tenantb_agent1@demo.local',
      mobile: '13820000002',
      password: '123456',
      initialPassword: '123456',
      createdAt: new Date().toISOString(),
    },
    {
      id: 8401,
      tenantId: 4,
      orgId: 4,
      teamId: 4,
      name: '租户C管理员',
      status: 'active',
      role: 'manager',
      account: 'tenantc_admin',
      email: 'tenantc_admin@demo.local',
      mobile: '13830000001',
      password: '123456',
      initialPassword: '123456',
      createdAt: new Date().toISOString(),
    },
    {
      id: 8402,
      tenantId: 4,
      orgId: 4,
      teamId: 4,
      name: '租户C业务员1',
      status: 'active',
      role: 'agent',
      account: 'tenantc_agent1',
      email: 'tenantc_agent1@demo.local',
      mobile: '13830000002',
      password: '123456',
      initialPassword: '123456',
      createdAt: new Date().toISOString(),
    },
  ],
  roles: [],
  permissions: [],
  rolePermissions: [],
  userRoles: [],
  companyAdminPagePermissions: [],
  employeeRolePagePermissions: [],
  approvals: [],
  auditLogs: [],
  trackEvents: [],
  metricDailyUv: [],
  metricDailyCounters: [],
  metricHourlyCounters: [],
  idempotencyRecords: [],
  domainEvents: [],
  outboxEvents: [],
  smsCodes: [],
  sessions: [],
  actorCsrfTokens: [],
  activities: [
    { id: 1, title: '连续签到7天领鸡蛋', category: 'sign', rewardPoints: 10, sortOrder: 1, participants: 18230 },
    { id: 2, title: '保险知识王者赛', category: 'competition', rewardPoints: 50, sortOrder: 2, participants: 10230 },
    { id: 3, title: '完善保障信息', category: 'task', rewardPoints: 100, sortOrder: 3, participants: 5980 },
    { id: 4, title: '推荐好友加入', category: 'invite', rewardPoints: 500, sortOrder: 4, participants: 4200 },
  ],
  activityCompletions: [],
  signIns: [],
  pointAccounts: [],
  pointTransactions: [],
  mallItems: [
    { id: 1, name: '智能低糖电饭煲', pointsCost: 99, stock: 50, isActive: true },
    { id: 2, name: '家庭体检套餐', pointsCost: 79, stock: 80, isActive: true },
    { id: 3, name: '健康管理咨询券', pointsCost: 59, stock: 999, isActive: true },
  ],
  redemptions: [],
  orders: [],
  orderPayments: [],
  orderFulfillments: [],
  orderRefunds: [],
  bCustomerTags: [],
  bCustomerTagRels: [],
  bCustomerActivities: [],
  bWriteOffRecords: [],
  pLearningMaterials: [],
  pProducts: [],
  pActivities: [],
  mallActivities: [],
  eventDefinitions: [],
  pTags: [],
  pTagRules: [],
  pTagRuleJobs: [],
  pTagRuleJobLogs: [],
  metricRules: [],
  pointsRuleConfigs: [],
  statsWarehouse: [],
  reconciliationReports: [],
  pOpsJobs: [],
  pOpsJobLogs: [],
  learningCourses: [],
  courseCompletions: [],
  learningGames: [],
  learningTools: [],
  insuranceSummary: {},
  familyMembers: [],
  insuranceReminders: [],
  policies: [],
  familyPolicyReports: [],
};

const state = structuredClone(initialState);
let initialized = false;
let flushChain = Promise.resolve();
let transactionDepth = 0;
let relationalSchemaBootstrapped = false;

const DATABASE_URL = process.env.DATABASE_URL || '';
const STORAGE_BACKEND = process.env.STORAGE_BACKEND || 'postgres';
const usePostgres = STORAGE_BACKEND === 'postgres';
const skipPostgresStartupWriteback = String(process.env.STATE_SKIP_POSTGRES_STARTUP_WRITEBACK || 'false').toLowerCase() === 'true';

const DEFAULT_POINTS_RULE_CONFIG = Object.freeze({
  signInPoints: 10,
  newCustomerVerifyPoints: 200,
  customerShareIdentifyPoints: 0,
});

const pool = usePostgres
  ? new Pool({
      connectionString: DATABASE_URL,
      ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : false,
      max: Number(process.env.PG_POOL_MAX || 10),
    })
  : null;

export function getStorageBackend() {
  return usePostgres ? 'postgres' : 'file';
}

export async function initializeState() {
  if (initialized) return;

  if (usePostgres) {
    if (!DATABASE_URL) {
      throw new Error('DATABASE_URL is required when STORAGE_BACKEND=postgres');
    }
    await ensureRelationalSchema();

    const loaded = await loadStateFromPostgresTables();
    if (loaded) assignState(loaded);
    else assignState(loadSeedStateFromFile());

    const normalized = normalizeMallPricingForDemo();
    const seeded = ensureDomainSeedsFromFile();
    const repairedDemoAgents = ensureDemoAgentAccounts();
    const publicPool = ensurePublicPoolTenantState({ state, nextId });
    if (normalized || seeded || repairedDemoAgents || publicPool.changed || !loaded) {
      if (!skipPostgresStartupWriteback) await writeStateToPostgresTables();
    }
  } else {
    const local = loadStateFromLocalFiles();
    assignState(local.state);
    const normalized = normalizeMallPricingForDemo();
    const seeded = ensureDomainSeedsFromFile();
    const repairedDemoAgents = ensureDemoAgentAccounts();
    const publicPool = ensurePublicPoolTenantState({ state, nextId });
    if (normalized || seeded || repairedDemoAgents || publicPool.changed || local.source !== 'runtime-snapshot') {
      writeRuntimeSnapshotSync();
    }
  }
  const { recoveredCompanyAdminPages, backfilledPointsRulesPermissions, backfilledCustomerPoolPermissions } = rehydrateDerivedStateAfterLoad();
  if (
    ensureArray(state.metricDailyUv).length === 0 &&
    ensureArray(state.metricDailyCounters).length === 0 &&
    ensureArray(state.metricHourlyCounters).length === 0
  ) {
    rebuildMetricAggregatesFromEvents();
    if (usePostgres) {
      if (!skipPostgresStartupWriteback) await writeStateToPostgresTables();
    }
  }
  if (recoveredCompanyAdminPages || backfilledPointsRulesPermissions || backfilledCustomerPoolPermissions) {
    if (usePostgres) {
      if (!skipPostgresStartupWriteback) await writeStateToPostgresTables();
    }
    else writeRuntimeSnapshotSync();
  }

  initialized = true;
}

export function getState() {
  return state;
}

export function getDefaultPointsRuleConfig() {
  return {
    signInPoints: Number(DEFAULT_POINTS_RULE_CONFIG.signInPoints),
    newCustomerVerifyPoints: Number(DEFAULT_POINTS_RULE_CONFIG.newCustomerVerifyPoints),
    customerShareIdentifyPoints: Number(DEFAULT_POINTS_RULE_CONFIG.customerShareIdentifyPoints),
  };
}

export function resolveTenantPointsRuleConfig(tenantId = 1, stateOverride = state) {
  const tenantScoped = Number(tenantId || 1);
  const defaults = getDefaultPointsRuleConfig();
  const row = Array.isArray(stateOverride?.pointsRuleConfigs)
    ? stateOverride.pointsRuleConfigs.find((item) => Number(item?.tenantId || 1) === tenantScoped)
    : null;
  if (!row) {
    return {
      tenantId: tenantScoped,
      ...defaults,
    };
  }
  return {
    tenantId: tenantScoped,
    signInPoints: Number.isFinite(Number(row.signInPoints)) ? Number(row.signInPoints) : defaults.signInPoints,
    newCustomerVerifyPoints: Number.isFinite(Number(row.newCustomerVerifyPoints))
      ? Number(row.newCustomerVerifyPoints)
      : defaults.newCustomerVerifyPoints,
    customerShareIdentifyPoints: Number.isFinite(Number(row.customerShareIdentifyPoints))
      ? Number(row.customerShareIdentifyPoints)
      : defaults.customerShareIdentifyPoints,
    id: Number.isFinite(Number(row.id)) ? Number(row.id) : undefined,
    updatedAt: row.updatedAt || null,
    createdAt: row.createdAt || null,
    createdBy: Number.isFinite(Number(row.createdBy)) ? Number(row.createdBy) : null,
  };
}

export async function reloadStateFromStorage() {
  if (usePostgres) {
    const loaded = await loadStateFromPostgresTables();
    if (loaded) assignState(loaded);
  } else {
    const local = loadStateFromLocalFiles();
    assignState(local.state);
  }
  ensurePublicPoolTenantState({ state, nextId });
  rehydrateDerivedStateAfterLoad();
}

export function persistState() {
  if (!initialized) return Promise.resolve();
  if (transactionDepth > 0) return flushChain;

  if (!usePostgres) {
    writeRuntimeSnapshotSync();
    return Promise.resolve();
  }

  flushChain = flushChain
    .then(() => writeStateToPostgresTables())
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[state] postgres persist failed:', err?.message || err);
    });

  return flushChain;
}

export function persistSessionsByTokens(tokens = []) {
  if (!initialized) return Promise.resolve();
  const uniqueTokens = [...new Set(ensureArray(tokens).map((item) => String(item || '').trim()).filter(Boolean))];
  if (!uniqueTokens.length) return Promise.resolve();

  if (!usePostgres) {
    writeRuntimeSnapshotSync();
    return Promise.resolve();
  }
  return (async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const token of uniqueTokens) {
        const row = ensureArray(state.sessions).find((item) => String(item?.token || '') === token);
        if (!row) continue;
        await client.query(
          `
            INSERT INTO p_sessions (
              token,
              customer_id,
              actor_type,
              actor_id,
              tenant_id,
              org_id,
              team_id,
              csrf_token,
              expires_at,
              created_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
            ON CONFLICT (token) DO UPDATE SET
              customer_id = EXCLUDED.customer_id,
              actor_type = EXCLUDED.actor_type,
              actor_id = EXCLUDED.actor_id,
              tenant_id = EXCLUDED.tenant_id,
              org_id = EXCLUDED.org_id,
              team_id = EXCLUDED.team_id,
              csrf_token = EXCLUDED.csrf_token,
              expires_at = EXCLUDED.expires_at,
              created_at = EXCLUDED.created_at
          `,
          [
            token,
            row.userId === null || row.userId === undefined ? null : toFiniteNumber(row.userId, null),
            row.actorType ? String(row.actorType) : null,
            toFiniteNumber(row.actorId, null),
            toFiniteNumber(row.tenantId, null),
            toFiniteNumber(row.orgId, null),
            toFiniteNumber(row.teamId, null),
            row.csrfToken ? String(row.csrfToken) : null,
            row.expiresAt || new Date().toISOString(),
            row.createdAt || new Date().toISOString(),
          ]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      // eslint-disable-next-line no-console
      console.error('[state] session persist failed:', err?.message || err);
      throw err;
    } finally {
      client.release();
    }
  })();
}

export function persistSmsCodesByIds(ids = []) {
  if (!initialized) return Promise.resolve();
  const uniqueIds = [...new Set(ensureArray(ids).map((item) => Number(item || 0)).filter((item) => Number.isFinite(item) && item > 0))];
  if (!uniqueIds.length) return Promise.resolve();

  if (!usePostgres) {
    writeRuntimeSnapshotSync();
    return Promise.resolve();
  }

  return (async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const id of uniqueIds) {
        const row = ensureArray(state.smsCodes).find((item) => Number(item?.id || 0) === id);
        if (!row) continue;
        await client.query(
          `
            INSERT INTO p_sms_codes (id, mobile, code, tenant_id, expires_at, used, created_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7)
            ON CONFLICT (id) DO UPDATE SET
              mobile = EXCLUDED.mobile,
              code = EXCLUDED.code,
              tenant_id = EXCLUDED.tenant_id,
              expires_at = EXCLUDED.expires_at,
              used = EXCLUDED.used,
              created_at = EXCLUDED.created_at
          `,
          [
            id,
            String(row.mobile || ''),
            String(row.code || ''),
            toFiniteNumber(row.tenantId, null),
            row.expiresAt || new Date().toISOString(),
            Boolean(row.used),
            row.createdAt || new Date().toISOString(),
          ]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      // eslint-disable-next-line no-console
      console.error('[state] sms persist failed:', err?.message || err);
      throw err;
    } finally {
      client.release();
    }
  })();
}

function buildPolicyPersistRows(policy) {
  const policyId = Number(policy?.id || 0);
  const tenantId = Number(policy?.tenantId || 1) || 1;
  const policyRow = {
    id: policyId,
    tenant_id: tenantId,
    customer_id: Number(policy?.customerId || policy?.createdBy || 0) || null,
    family_member_id: null,
    company: policy?.company || '',
    policy_name: policy?.name || '',
    policy_no: policy?.policyNo || null,
    policy_type: policy?.type || null,
    amount: Number(policy?.amount || 0),
    annual_premium: Number(policy?.annualPremium || 0),
    period_start: policy?.periodStart || null,
    period_end: policy?.periodEnd === '终身' ? null : policy?.periodEnd || null,
    status: policy?.status === '保障中' ? 'active' : policy?.status || 'active',
    applicant: policy?.applicant || null,
    applicant_relation: policy?.applicantRelation || null,
    insured: policy?.insured || null,
    insured_relation: policy?.insuredRelation || null,
    analysis_json: sanitizeStoredPolicyAnalysis(policy?.analysis),
    created_by: Number(policy?.createdBy || 0) || null,
    created_at: policy?.createdAt || new Date().toISOString(),
    updated_at: policy?.updatedAt || new Date().toISOString(),
    is_deleted: false,
  };
  const responsibilitiesRows = ensureArray(policy?.responsibilities).map((item, idx) => ({
    id: policyId * 1000 + idx + 1,
    tenant_id: tenantId,
    policy_id: policyId,
    name: item?.name || '',
    description: item?.desc || '',
    limit_amount: Number(item?.limit || 0),
    sort_order: idx + 1,
  }));
  const paymentHistoryRows = ensureArray(policy?.paymentHistory).map((item, idx) => ({
    id: policyId * 1000 + idx + 1,
    tenant_id: tenantId,
    policy_id: policyId,
    payment_date: item?.date || dateOnly(),
    amount: Number(item?.amount || 0),
    note: item?.note || '',
    status: item?.status || '',
    sort_order: idx + 1,
  }));
  return { policyRow, responsibilitiesRows, paymentHistoryRows };
}

export function persistPoliciesByIds({ upsertPolicyIds = [], deletePolicyIds = [] } = {}) {
  if (!initialized) return Promise.resolve();

  const upsertIds = [...new Set(ensureArray(upsertPolicyIds).map((item) => Number(item || 0)).filter((item) => item > 0))];
  const deleteIds = [...new Set(ensureArray(deletePolicyIds).map((item) => Number(item || 0)).filter((item) => item > 0 && !upsertIds.includes(item)))];

  if (!upsertIds.length && !deleteIds.length) return Promise.resolve();

  if (!usePostgres) {
    writeRuntimeSnapshotSync();
    return Promise.resolve();
  }

  return (async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const touchedIds = [...new Set([...upsertIds, ...deleteIds])];
      if (touchedIds.length) {
        await client.query('DELETE FROM c_policy_payment_history WHERE policy_id = ANY($1::bigint[])', [touchedIds]);
        await client.query('DELETE FROM c_policy_responsibilities WHERE policy_id = ANY($1::bigint[])', [touchedIds]);
      }

      if (deleteIds.length) {
        await client.query('DELETE FROM c_policies WHERE id = ANY($1::bigint[])', [deleteIds]);
      }

      const upsertPolicies = ensureArray(state.policies).filter(
        (row) => upsertIds.includes(Number(row?.id || 0)) && Number(row?.customerId || row?.createdBy || 0) > 0
      );

      for (const policy of upsertPolicies) {
        const { policyRow, responsibilitiesRows, paymentHistoryRows } = buildPolicyPersistRows(policy);
        await client.query(
          `
            INSERT INTO c_policies (
              id, tenant_id, customer_id, family_member_id, company, policy_name, policy_no, policy_type, amount, annual_premium,
              period_start, period_end, status, applicant, applicant_relation, insured, insured_relation, analysis_json, created_by, created_at, updated_at, is_deleted
            ) VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
              $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22
            )
            ON CONFLICT (id) DO UPDATE SET
              tenant_id = EXCLUDED.tenant_id,
              customer_id = EXCLUDED.customer_id,
              family_member_id = EXCLUDED.family_member_id,
              company = EXCLUDED.company,
              policy_name = EXCLUDED.policy_name,
              policy_no = EXCLUDED.policy_no,
              policy_type = EXCLUDED.policy_type,
              amount = EXCLUDED.amount,
              annual_premium = EXCLUDED.annual_premium,
              period_start = EXCLUDED.period_start,
              period_end = EXCLUDED.period_end,
              status = EXCLUDED.status,
              applicant = EXCLUDED.applicant,
              applicant_relation = EXCLUDED.applicant_relation,
              insured = EXCLUDED.insured,
              insured_relation = EXCLUDED.insured_relation,
              analysis_json = EXCLUDED.analysis_json,
              created_by = EXCLUDED.created_by,
              created_at = EXCLUDED.created_at,
              updated_at = EXCLUDED.updated_at,
              is_deleted = EXCLUDED.is_deleted
          `,
          [
            policyRow.id,
            policyRow.tenant_id,
            policyRow.customer_id,
            policyRow.family_member_id,
            policyRow.company,
            policyRow.policy_name,
            policyRow.policy_no,
            policyRow.policy_type,
            policyRow.amount,
            policyRow.annual_premium,
            policyRow.period_start,
            policyRow.period_end,
            policyRow.status,
            policyRow.applicant,
            policyRow.applicant_relation,
            policyRow.insured,
            policyRow.insured_relation,
            policyRow.analysis_json,
            policyRow.created_by,
            policyRow.created_at,
            policyRow.updated_at,
            policyRow.is_deleted,
          ]
        );

        for (const row of responsibilitiesRows) {
          await client.query(
            `
              INSERT INTO c_policy_responsibilities (id, tenant_id, policy_id, name, description, limit_amount, sort_order)
              VALUES ($1,$2,$3,$4,$5,$6,$7)
              ON CONFLICT (id) DO UPDATE SET
                tenant_id = EXCLUDED.tenant_id,
                policy_id = EXCLUDED.policy_id,
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                limit_amount = EXCLUDED.limit_amount,
                sort_order = EXCLUDED.sort_order
            `,
            [row.id, row.tenant_id, row.policy_id, row.name, row.description, row.limit_amount, row.sort_order]
          );
        }

        for (const row of paymentHistoryRows) {
          await client.query(
            `
              INSERT INTO c_policy_payment_history (id, tenant_id, policy_id, payment_date, amount, note, status, sort_order)
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
              ON CONFLICT (id) DO UPDATE SET
                tenant_id = EXCLUDED.tenant_id,
                policy_id = EXCLUDED.policy_id,
                payment_date = EXCLUDED.payment_date,
                amount = EXCLUDED.amount,
                note = EXCLUDED.note,
                status = EXCLUDED.status,
                sort_order = EXCLUDED.sort_order
            `,
            [row.id, row.tenant_id, row.policy_id, row.payment_date, row.amount, row.note, row.status, row.sort_order]
          );
        }
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      // eslint-disable-next-line no-console
      console.error('[state] policy persist failed:', err?.message || err);
      throw err;
    } finally {
      client.release();
    }
  })();
}

export function persistPolicyAnalysisSnapshot({ policyId, analysis, responsibilities = [], updatedAt } = {}) {
  const targetPolicyId = Number(policyId || 0);
  if (targetPolicyId <= 0) return Promise.resolve();

  const policy = ensureArray(state.policies).find((row) => Number(row?.id || 0) === targetPolicyId);
  if (!policy) return Promise.resolve();

  const analysisSnapshot = sanitizeStoredPolicyAnalysis(analysis);
  const nextUpdatedAt = updatedAt || new Date().toISOString();
  policy.updatedAt = nextUpdatedAt;
  if (analysisSnapshot) {
    policy.analysis = analysisSnapshot;
  }
  if (Array.isArray(responsibilities)) {
    policy.responsibilities = responsibilities;
  }

  if (!initialized) return Promise.resolve();

  if (!usePostgres) {
    writeRuntimeSnapshotSync();
    return Promise.resolve();
  }

  const tenantId = Number(policy?.tenantId || 1) || 1;
  const responsibilitiesRows = ensureArray(policy.responsibilities).map((item, idx) => ({
    id: targetPolicyId * 1000 + idx + 1,
    tenant_id: tenantId,
    policy_id: targetPolicyId,
    name: item?.name || '',
    description: item?.desc || '',
    limit_amount: Number(item?.limit || 0),
    sort_order: idx + 1,
  }));

  return (async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `
          UPDATE c_policies
             SET analysis_json = $2,
                 updated_at = $3
           WHERE id = $1
        `,
        [targetPolicyId, analysisSnapshot, nextUpdatedAt]
      );
      await client.query('DELETE FROM c_policy_responsibilities WHERE policy_id = $1', [targetPolicyId]);
      for (const row of responsibilitiesRows) {
        await client.query(
          `
            INSERT INTO c_policy_responsibilities (id, tenant_id, policy_id, name, description, limit_amount, sort_order)
            VALUES ($1,$2,$3,$4,$5,$6,$7)
            ON CONFLICT (id) DO UPDATE SET
              tenant_id = EXCLUDED.tenant_id,
              policy_id = EXCLUDED.policy_id,
              name = EXCLUDED.name,
              description = EXCLUDED.description,
              limit_amount = EXCLUDED.limit_amount,
              sort_order = EXCLUDED.sort_order
          `,
          [row.id, row.tenant_id, row.policy_id, row.name, row.description, row.limit_amount, row.sort_order]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      // eslint-disable-next-line no-console
      console.error('[state] policy analysis persist failed:', err?.message || err);
      throw err;
    } finally {
      client.release();
    }
  })();
}

export function persistTrackEventsByIds(ids = []) {
  if (!initialized) return Promise.resolve();
  const uniqueIds = [...new Set(ensureArray(ids).map((item) => Number(item || 0)).filter((item) => Number.isFinite(item) && item > 0))];
  if (!uniqueIds.length) return Promise.resolve();

  if (!usePostgres) {
    writeRuntimeSnapshotSync();
    return Promise.resolve();
  }

  return (async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const id of uniqueIds) {
        const row = ensureArray(state.trackEvents).find((item) => Number(item?.id || 0) === id);
        if (!row) continue;
        await client.query(
          `
            INSERT INTO p_track_events (
              id,
              tenant_id,
              actor_type,
              actor_id,
              org_id,
              team_id,
              event_name,
              properties,
              path,
              source,
              user_agent,
              created_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
            ON CONFLICT (id) DO UPDATE SET
              tenant_id = EXCLUDED.tenant_id,
              actor_type = EXCLUDED.actor_type,
              actor_id = EXCLUDED.actor_id,
              org_id = EXCLUDED.org_id,
              team_id = EXCLUDED.team_id,
              event_name = EXCLUDED.event_name,
              properties = EXCLUDED.properties,
              path = EXCLUDED.path,
              source = EXCLUDED.source,
              user_agent = EXCLUDED.user_agent,
              created_at = EXCLUDED.created_at
          `,
          [
            id,
            toFiniteNumber(row.tenantId, 1),
            String(row.actorType || 'anonymous'),
            toFiniteNumber(row.actorId, 0),
            toFiniteNumber(row.orgId, 1),
            toFiniteNumber(row.teamId, 1),
            String(row.event || ''),
            row.properties || {},
            String(row.path || ''),
            String(row.source || ''),
            String(row.userAgent || ''),
            row.createdAt || new Date().toISOString(),
          ]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      // eslint-disable-next-line no-console
      console.error('[state] track persist failed:', err?.message || err);
      throw err;
    } finally {
      client.release();
    }
  })();
}

export function persistPointTransactionsByIds(ids = []) {
  if (!initialized) return Promise.resolve();
  const uniqueIds = [...new Set(ensureArray(ids).map((item) => Number(item || 0)).filter((item) => Number.isFinite(item) && item > 0))];
  if (!uniqueIds.length) return Promise.resolve();

  if (!usePostgres) {
    writeRuntimeSnapshotSync();
    return Promise.resolve();
  }

  return (async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const id of uniqueIds) {
        const row = ensureArray(state.pointTransactions).find((item) => Number(item?.id || 0) === id);
        const customerId = toFiniteNumber(row?.userId, null);
        const amount = Math.abs(toFiniteNumber(row?.amount, 0));
        if (!row || customerId === null || amount <= 0) continue;
        await client.query(
          `
            INSERT INTO c_point_transactions (
              id,
              tenant_id,
              customer_id,
              direction,
              amount,
              source_type,
              source_id,
              idempotency_key,
              balance_after,
              created_by,
              created_at,
              updated_at,
              is_deleted
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
            ON CONFLICT (id) DO UPDATE SET
              tenant_id = EXCLUDED.tenant_id,
              customer_id = EXCLUDED.customer_id,
              direction = EXCLUDED.direction,
              amount = EXCLUDED.amount,
              source_type = EXCLUDED.source_type,
              source_id = EXCLUDED.source_id,
              idempotency_key = EXCLUDED.idempotency_key,
              balance_after = EXCLUDED.balance_after,
              created_by = EXCLUDED.created_by,
              created_at = EXCLUDED.created_at,
              updated_at = EXCLUDED.updated_at,
              is_deleted = EXCLUDED.is_deleted
          `,
          [
            id,
            toFiniteNumber(row.tenantId, 1),
            customerId,
            row.type === 'consume' ? 'out' : 'in',
            amount,
            String(row.source || ''),
            row.sourceId || '',
            row.idempotencyKey || `tx-${id}`,
            toFiniteNumber(row.balance, 0),
            customerId,
            row.createdAt || new Date().toISOString(),
            new Date().toISOString(),
            false,
          ]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      // eslint-disable-next-line no-console
      console.error('[state] point transaction persist failed:', err?.message || err);
      throw err;
    } finally {
      client.release();
    }
  })();
}

export function persistActivityCompletionsByIds(ids = []) {
  if (!initialized) return Promise.resolve();
  const uniqueIds = [...new Set(ensureArray(ids).map((item) => Number(item || 0)).filter((item) => Number.isFinite(item) && item > 0))];
  if (!uniqueIds.length) return Promise.resolve();

  if (!usePostgres) {
    writeRuntimeSnapshotSync();
    return Promise.resolve();
  }

  return (async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const id of uniqueIds) {
        const row = ensureArray(state.activityCompletions).find((item) => Number(item?.id || 0) === id);
        const customerId = toFiniteNumber(row?.userId, null);
        const activityId = toFiniteNumber(row?.activityId, null);
        if (!row || customerId === null || activityId === null) continue;
        await client.query(
          `
            INSERT INTO c_activity_completions (
              id,
              tenant_id,
              customer_id,
              activity_id,
              completed_at,
              writeoff_token,
              written_off_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7)
            ON CONFLICT (id) DO UPDATE SET
              tenant_id = EXCLUDED.tenant_id,
              customer_id = EXCLUDED.customer_id,
              activity_id = EXCLUDED.activity_id,
              completed_at = EXCLUDED.completed_at,
              writeoff_token = EXCLUDED.writeoff_token,
              written_off_at = EXCLUDED.written_off_at
          `,
          [
            id,
            toFiniteNumber(row.tenantId, 1),
            customerId,
            activityId,
            row.completedAt || row.createdAt || new Date().toISOString(),
            row.writeoffToken || null,
            row.writtenOffAt || null,
          ]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      // eslint-disable-next-line no-console
      console.error('[state] activity completion persist failed:', err?.message || err);
      throw err;
    } finally {
      client.release();
    }
  })();
}

export function persistCustomersByIds(ids = []) {
  if (!initialized) return Promise.resolve();
  const uniqueIds = [...new Set(ensureArray(ids).map((item) => Number(item || 0)).filter((item) => Number.isFinite(item) && item > 0))];
  if (!uniqueIds.length) return Promise.resolve();

  if (!usePostgres) {
    writeRuntimeSnapshotSync();
    return Promise.resolve();
  }

  return (async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const id of uniqueIds) {
        const row = ensureArray(state.users).find((item) => Number(item?.id || 0) === id);
        if (!row) continue;
        const inferredScope = (() => {
          const ownerAgentId = toFiniteNumber(row.ownerUserId, 0);
          if (!ownerAgentId) return null;
          const owner = ensureArray(state.agents).find((agent) => Number(agent?.id || 0) === ownerAgentId);
          if (!owner) return null;
          return {
            tenantId: toFiniteNumber(owner.tenantId, toFiniteNumber(row.tenantId, 1)),
            orgId: toFiniteNumber(owner.orgId, toFiniteNumber(row.orgId, 1)),
            teamId: toFiniteNumber(owner.teamId, toFiniteNumber(row.teamId, 1)),
          };
        })();
        const tenantId = Number(toFiniteNumber(row.tenantId, inferredScope?.tenantId ?? 1));
        const ownerAgentId = toFiniteNumber(row.ownerUserId, 0);
        await client.query(
          `
            INSERT INTO c_customers (
              id,
              tenant_id,
              org_id,
              team_id,
              owner_agent_id,
              referrer_customer_id,
              referrer_share_code,
              referred_at,
              name,
              mobile_enc,
              mobile_masked,
              wechat_open_id,
              wechat_union_id,
              wechat_app_type,
              wechat_bound_at,
              nick_name,
              avatar_url,
              member_level,
              growth_value,
              last_active_at,
              device_info,
              is_verified_basic,
              gender,
              age,
              annual_income,
              verified_at,
              created_by,
              created_at,
              updated_at,
              is_deleted
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30)
            ON CONFLICT (id) DO UPDATE SET
              tenant_id = EXCLUDED.tenant_id,
              org_id = EXCLUDED.org_id,
              team_id = EXCLUDED.team_id,
              owner_agent_id = EXCLUDED.owner_agent_id,
              referrer_customer_id = EXCLUDED.referrer_customer_id,
              referrer_share_code = EXCLUDED.referrer_share_code,
              referred_at = EXCLUDED.referred_at,
              name = EXCLUDED.name,
              mobile_enc = EXCLUDED.mobile_enc,
              mobile_masked = EXCLUDED.mobile_masked,
              wechat_open_id = EXCLUDED.wechat_open_id,
              wechat_union_id = EXCLUDED.wechat_union_id,
              wechat_app_type = EXCLUDED.wechat_app_type,
              wechat_bound_at = EXCLUDED.wechat_bound_at,
              nick_name = EXCLUDED.nick_name,
              avatar_url = EXCLUDED.avatar_url,
              member_level = EXCLUDED.member_level,
              growth_value = EXCLUDED.growth_value,
              last_active_at = EXCLUDED.last_active_at,
              device_info = EXCLUDED.device_info,
              is_verified_basic = EXCLUDED.is_verified_basic,
              gender = EXCLUDED.gender,
              age = EXCLUDED.age,
              annual_income = EXCLUDED.annual_income,
              verified_at = EXCLUDED.verified_at,
              created_by = EXCLUDED.created_by,
              created_at = EXCLUDED.created_at,
              updated_at = EXCLUDED.updated_at,
              is_deleted = EXCLUDED.is_deleted
          `,
          [
            Number(row.id),
            tenantId,
            Number(toFiniteNumber(row.orgId, inferredScope?.orgId ?? 1)),
            Number(toFiniteNumber(row.teamId, inferredScope?.teamId ?? 1)),
            ownerAgentId > 0 ? ownerAgentId : null,
            Number(toFiniteNumber(row.referrerCustomerId, 0)) > 0 ? Number(toFiniteNumber(row.referrerCustomerId, 0)) : null,
            row.referrerShareCode || null,
            row.referredAt || null,
            row.name || '',
            row.mobile || '',
            row.mobile || '',
            row.openId || null,
            row.unionId || null,
            row.wechatAppType || null,
            row.wechatBoundAt || null,
            row.nickName || null,
            row.avatarUrl || null,
            Number(row.memberLevel || 1),
            Number(row.growthValue || 0),
            row.lastActiveAt || null,
            clampText(row.deviceInfo, 255) || null,
            Boolean(row.isVerifiedBasic),
            row.gender || null,
            Number(row.age || 0) || null,
            Number(row.annualIncome || 0) || null,
            row.verifiedAt || null,
            Number(row.createdBy || row.ownerUserId || 0) || null,
            row.createdAt || new Date().toISOString(),
            row.updatedAt || new Date().toISOString(),
            false,
          ]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      // eslint-disable-next-line no-console
      console.error('[state] customer persist failed:', err?.message || err);
      throw err;
    } finally {
      client.release();
    }
  })();
}

export function persistAgentsByIds(ids = []) {
  if (!initialized) return Promise.resolve();
  const uniqueIds = [...new Set(ensureArray(ids).map((item) => Number(item || 0)).filter((item) => Number.isFinite(item) && item > 0))];
  if (!uniqueIds.length) return Promise.resolve();

  if (!usePostgres) {
    writeRuntimeSnapshotSync();
    return Promise.resolve();
  }

  return (async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const id of uniqueIds) {
        const row = ensureArray(state.agents).find((item) => Number(item?.id || 0) === id);
        if (!row) continue;
        await client.query(
          `
            INSERT INTO b_agents (
              id,
              tenant_id,
              org_id,
              team_id,
              employee_id,
              display_name,
              account,
              email,
              mobile,
              password,
              initial_password,
              role,
              avatar_url,
              title,
              bio,
              wecom_contact_url,
              wechat_id,
              wechat_qr_url,
              status,
              last_active_at,
              created_by,
              created_at,
              updated_at,
              is_deleted
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
            ON CONFLICT (id) DO UPDATE SET
              tenant_id = EXCLUDED.tenant_id,
              org_id = EXCLUDED.org_id,
              team_id = EXCLUDED.team_id,
              employee_id = EXCLUDED.employee_id,
              display_name = EXCLUDED.display_name,
              account = EXCLUDED.account,
              email = EXCLUDED.email,
              mobile = EXCLUDED.mobile,
              password = EXCLUDED.password,
              initial_password = EXCLUDED.initial_password,
              role = EXCLUDED.role,
              avatar_url = EXCLUDED.avatar_url,
              title = EXCLUDED.title,
              bio = EXCLUDED.bio,
              wecom_contact_url = EXCLUDED.wecom_contact_url,
              wechat_id = EXCLUDED.wechat_id,
              wechat_qr_url = EXCLUDED.wechat_qr_url,
              status = EXCLUDED.status,
              last_active_at = EXCLUDED.last_active_at,
              created_by = EXCLUDED.created_by,
              created_at = EXCLUDED.created_at,
              updated_at = EXCLUDED.updated_at,
              is_deleted = EXCLUDED.is_deleted
          `,
          [
            Number(row.id),
            Number(row.tenantId || 1),
            Number(row.orgId || row.tenantId || 1),
            Number(row.teamId || row.tenantId || 1),
            row.employeeId ? Number(row.employeeId) : null,
            row.name || `Agent-${row.id}`,
            row.account || row.email || null,
            row.email || null,
            row.mobile || null,
            row.password || row.initialPassword || null,
            row.initialPassword || row.password || null,
            row.role || 'agent',
            row.avatarUrl || null,
            row.title || null,
            row.bio || null,
            row.wecomContactUrl || null,
            row.wechatId || null,
            row.wechatQrUrl || null,
            ['active', 'inactive', 'blocked'].includes(String(row.status || '').toLowerCase()) ? String(row.status).toLowerCase() : 'active',
            row.lastActiveAt || null,
            Number(row.createdBy || row.id || 0) || null,
            row.createdAt || new Date().toISOString(),
            row.updatedAt || new Date().toISOString(),
            false,
          ]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      // eslint-disable-next-line no-console
      console.error('[state] agent persist failed:', err?.message || err);
      throw err;
    } finally {
      client.release();
    }
  })();
}

export async function runInStateTransaction(executor, options = {}) {
  if (typeof executor !== 'function') throw new Error('INVALID_TRANSACTION_EXECUTOR');
  if (!initialized) await initializeState();
  const persistMode = String(options?.persistMode || 'full').toLowerCase();
  const reloadMode = String(options?.reloadMode || 'full').toLowerCase();
  const snapshotMode = String(options?.snapshotMode || 'full').toLowerCase();

  const queued = flushChain.then(async () => {
    if (reloadMode !== 'none') {
      if (usePostgres) {
        await reloadStateFromStorage();
      } else {
        const local = loadStateFromLocalFiles();
        assignState(local.state);
        ensurePublicPoolTenantState({ state, nextId });
        rehydrateDerivedStateAfterLoad();
      }
    }

      const snapshot =
      snapshotMode === 'policy_write'
        ? {
            policies: structuredClone(ensureArray(state.policies)),
            insuranceSummary: structuredClone(state.insuranceSummary || {}),
          }
        : snapshotMode === 'activity_write'
          ? {
              activityCompletions: structuredClone(ensureArray(state.activityCompletions)),
            }
        : snapshotMode === 'auth_write'
          ? {
              users: structuredClone(ensureArray(state.users)),
              smsCodes: structuredClone(ensureArray(state.smsCodes)),
              sessions: structuredClone(ensureArray(state.sessions)),
              pointTransactions: structuredClone(ensureArray(state.pointTransactions)),
              pointAccounts: structuredClone(ensureArray(state.pointAccounts)),
            }
        : structuredClone(state);
    transactionDepth += 1;
    try {
      const result = await executor();
      transactionDepth -= 1;

      if (persistMode === 'manual') {
        return result;
      }

      if (!usePostgres) {
        writeRuntimeSnapshotSync();
      } else {
        await writeStateToPostgresTables();
      }

      return result;
    } catch (err) {
      transactionDepth -= 1;
      if (snapshotMode === 'policy_write') {
        state.policies = structuredClone(snapshot.policies || []);
        state.insuranceSummary = structuredClone(snapshot.insuranceSummary || {});
      } else if (snapshotMode === 'activity_write') {
        state.activityCompletions = structuredClone(snapshot.activityCompletions || []);
      } else if (snapshotMode === 'auth_write') {
        state.users = structuredClone(snapshot.users || []);
        state.smsCodes = structuredClone(snapshot.smsCodes || []);
        state.sessions = structuredClone(snapshot.sessions || []);
        state.pointTransactions = structuredClone(snapshot.pointTransactions || []);
        state.pointAccounts = structuredClone(snapshot.pointAccounts || []);
      } else {
        assignState(snapshot);
      }
      throw err;
    }
  });

  flushChain = queued.catch(() => undefined);
  return queued;
}

export async function closeState() {
  if (pool) {
    await flushChain.catch(() => undefined);
    await pool.end();
  }
}

export function dateOnly(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export function nextId(list) {
  if (!Array.isArray(list) || list.length === 0) return 1;
  return Math.max(...list.map((x) => Number(x.id) || 0)) + 1;
}

export function formatUser(user) {
  return {
    id: user.id,
    tenantId: Number(user.tenantId || 1),
    orgId: Number(user.orgId || 0) || null,
    teamId: Number(user.teamId || 0) || null,
    ownerUserId: Number(user.ownerUserId || 0),
    actorType: String(user.actorType || 'customer'),
    name: user.name,
    mobile: user.mobile,
    nick_name: user.nickName || '',
    avatar_url: user.avatarUrl || '',
    wechat_open_id: user.openId || '',
    wechat_union_id: user.unionId || '',
    wechat_app_type: user.wechatAppType || '',
    wechat_bound_at: user.wechatBoundAt || null,
    is_verified_basic: Boolean(user.isVerifiedBasic),
    verified_at: user.verifiedAt || null,
  };
}

export function getBalance(userId) {
  const rows = state.pointTransactions
    .filter((t) => t.userId === userId)
    .sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
  const latestTxBalance = Number(rows[0]?.balance);
  if (Number.isFinite(latestTxBalance)) return latestTxBalance;

  if (Array.isArray(state.pointAccounts)) {
    const account = state.pointAccounts.find((x) => x.userId === userId);
    const accountBalance = Number(account?.balance);
    if (Number.isFinite(accountBalance)) return accountBalance;
  }

  return 0;
}

export function appendPoints(userId, type, amount, source, sourceId, description) {
  const prev = getBalance(userId);
  const balance = type === 'earn' ? prev + amount : prev - amount;
  state.pointTransactions.push({
    id: nextId(state.pointTransactions),
    userId,
    type,
    amount,
    source,
    sourceId,
    balance,
    description,
    createdAt: new Date().toISOString(),
  });

  if (!Array.isArray(state.pointAccounts)) state.pointAccounts = [];
  let account = state.pointAccounts.find((x) => x.userId === userId);
  if (!account) {
    account = { userId, balance: 0, updatedAt: new Date().toISOString() };
    state.pointAccounts.push(account);
  }
  account.balance = balance;
  account.updatedAt = new Date().toISOString();
}

export function appendAuditLog(entry) {
  if (!Array.isArray(state.auditLogs)) state.auditLogs = [];
  const row = {
    id: nextId(state.auditLogs),
    createdAt: new Date().toISOString(),
    ...entry,
  };
  state.auditLogs.push(row);
  applyAuditMetricAggregates(row);
}

export function appendTrackEvent(entry) {
  if (!Array.isArray(state.trackEvents)) state.trackEvents = [];
  const row = {
    id: nextId(state.trackEvents),
    createdAt: new Date().toISOString(),
    ...entry,
  };
  state.trackEvents.push(row);
  applyTrackMetricAggregates(row);
  return row;
}

function dayKeyByDate(input) {
  const d = new Date(input || Date.now());
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function hourKeyByDate(input) {
  const d = new Date(input || Date.now());
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  return `${y}-${m}-${day}T${h}`;
}

function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function upsertMetricDailyUv({ tenantId, statDate, metricKey, actorId, createdAt }) {
  if (!Array.isArray(state.metricDailyUv)) state.metricDailyUv = [];
  const t = asNumber(tenantId, 1);
  const a = asNumber(actorId, 0);
  if (!statDate || !metricKey || !a) return;
  const exists = state.metricDailyUv.some(
    (row) =>
      asNumber(row.tenantId, 1) === t &&
      String(row.statDate || '') === String(statDate) &&
      String(row.metricKey || '') === String(metricKey) &&
      asNumber(row.actorId, 0) === a
  );
  if (exists) return;
  state.metricDailyUv.push({
    id: nextId(state.metricDailyUv),
    tenantId: t,
    statDate: String(statDate),
    metricKey: String(metricKey),
    actorId: a,
    createdAt: createdAt || new Date().toISOString(),
  });
}

function upsertMetricCounter({ type, tenantId, dateKey, metricKey, actorId = 0, delta = 1 }) {
  if (type === 'daily' && !Array.isArray(state.metricDailyCounters)) state.metricDailyCounters = [];
  if (type === 'hourly' && !Array.isArray(state.metricHourlyCounters)) state.metricHourlyCounters = [];
  const list = type === 'daily' ? state.metricDailyCounters : state.metricHourlyCounters;
  const t = asNumber(tenantId, 1);
  const a = asNumber(actorId, 0);
  const idx = list.findIndex(
    (row) =>
      asNumber(row.tenantId, 1) === t &&
      String(type === 'daily' ? row.statDate : row.hourKey) === String(dateKey) &&
      String(row.metricKey || '') === String(metricKey) &&
      asNumber(row.actorId, 0) === a
  );
  if (idx >= 0) {
    list[idx].cnt = asNumber(list[idx].cnt, 0) + asNumber(delta, 0);
    list[idx].updatedAt = new Date().toISOString();
    return;
  }
  list.push({
    id: nextId(list),
    tenantId: t,
    ...(type === 'daily' ? { statDate: String(dateKey) } : { hourKey: String(dateKey) }),
    metricKey: String(metricKey),
    actorId: a,
    cnt: asNumber(delta, 0),
    updatedAt: new Date().toISOString(),
  });
}

function isCustomerTrack(row) {
  const actorType = String(row?.actorType || '').toLowerCase();
  const source = String(row?.source || '').toLowerCase();
  return actorType === 'customer' || source === 'c-web';
}

function isBTrack(row) {
  const source = String(row?.source || '').toLowerCase();
  const event = String(row?.event || '').toLowerCase();
  return source === 'b-web' || event.startsWith('b_');
}

function applyTrackMetricAggregates(row) {
  const tenantId = asNumber(row?.tenantId, 1);
  const actorId = asNumber(row?.actorId, 0);
  const event = String(row?.event || '').toLowerCase();
  const createdAt = row?.createdAt || new Date().toISOString();
  const statDate = dayKeyByDate(createdAt);
  const hourKey = hourKeyByDate(createdAt);
  if (!statDate || !hourKey) return;

  if (isCustomerTrack(row) && actorId > 0) {
    upsertMetricDailyUv({ tenantId, statDate, metricKey: 'c_dau', actorId, createdAt });
  }
  if (isBTrack(row) && actorId > 0) {
    upsertMetricDailyUv({ tenantId, statDate, metricKey: 'b_dau', actorId, createdAt });
  }

  const props = row?.properties || {};
  const relatedCustomerId = asNumber(props.customerId ?? props.customer_id ?? 0, 0);
  if (isBTrack(row) && relatedCustomerId > 0) {
    upsertMetricDailyUv({ tenantId, statDate, metricKey: 'b_interaction_customer', actorId: relatedCustomerId, createdAt });
  }

  if (actorId > 0 && event === 'c_share_success') {
    upsertMetricCounter({ type: 'daily', tenantId, dateKey: statDate, metricKey: 'c_share_success_cnt', actorId, delta: 1 });
    upsertMetricCounter({ type: 'hourly', tenantId, dateKey: hourKey, metricKey: 'c_share_success_cnt', actorId, delta: 1 });
  }
  if (actorId > 0 && event === 'b_tools_share_success') {
    upsertMetricCounter({ type: 'daily', tenantId, dateKey: statDate, metricKey: 'b_share_success_cnt', actorId, delta: 1 });
    upsertMetricCounter({ type: 'hourly', tenantId, dateKey: hourKey, metricKey: 'b_share_success_cnt', actorId, delta: 1 });
  }

  if (isBTrack(row) && event.includes('remind')) {
    if (event.includes('click')) {
      upsertMetricCounter({ type: 'daily', tenantId, dateKey: statDate, metricKey: 'b_remind_click', actorId, delta: 1 });
      upsertMetricCounter({ type: 'hourly', tenantId, dateKey: hourKey, metricKey: 'b_remind_click', actorId, delta: 1 });
    }
    if (event.includes('push') || event.includes('send') || event.includes('show')) {
      upsertMetricCounter({ type: 'daily', tenantId, dateKey: statDate, metricKey: 'b_remind_push', actorId, delta: 1 });
      upsertMetricCounter({ type: 'hourly', tenantId, dateKey: hourKey, metricKey: 'b_remind_push', actorId, delta: 1 });
    }
  }
}

function applyAuditMetricAggregates(row) {
  const tenantId = asNumber(row?.tenantId, 1);
  const createdAt = row?.createdAt || new Date().toISOString();
  const statDate = dayKeyByDate(createdAt);
  const hourKey = hourKeyByDate(createdAt);
  if (!statDate || !hourKey) return;
  upsertMetricCounter({ type: 'daily', tenantId, dateKey: statDate, metricKey: 'api_total', actorId: 0, delta: 1 });
  upsertMetricCounter({ type: 'hourly', tenantId, dateKey: hourKey, metricKey: 'api_total', actorId: 0, delta: 1 });
  const result = String(row?.result || '').toLowerCase();
  if (result === 'success') {
    upsertMetricCounter({ type: 'daily', tenantId, dateKey: statDate, metricKey: 'api_success', actorId: 0, delta: 1 });
    upsertMetricCounter({ type: 'hourly', tenantId, dateKey: hourKey, metricKey: 'api_success', actorId: 0, delta: 1 });
  } else if (result === 'fail') {
    upsertMetricCounter({ type: 'daily', tenantId, dateKey: statDate, metricKey: 'api_fail', actorId: 0, delta: 1 });
    upsertMetricCounter({ type: 'hourly', tenantId, dateKey: hourKey, metricKey: 'api_fail', actorId: 0, delta: 1 });
  }
}

function rebuildMetricAggregatesFromEvents() {
  state.metricDailyUv = [];
  state.metricDailyCounters = [];
  state.metricHourlyCounters = [];
  ensureArray(state.trackEvents).forEach((row) => applyTrackMetricAggregates(row));
  ensureArray(state.auditLogs).forEach((row) => applyAuditMetricAggregates(row));
}

export function appendDomainEvent(type, payload, options = {}) {
  if (!Array.isArray(state.domainEvents)) state.domainEvents = [];
  if (!Array.isArray(state.outboxEvents)) state.outboxEvents = [];

  const event = {
    id: nextId(state.domainEvents),
    type,
    payload,
    tenantId: Number(options.tenantId || 1),
    traceId: options.traceId || null,
    createdAt: new Date().toISOString(),
  };
  state.domainEvents.push(event);
  state.outboxEvents.push({ ...event, status: 'pending' });
  return event;
}

export async function withIdempotency({ tenantId = 1, bizType, bizKey, execute }) {
  if (!Array.isArray(state.idempotencyRecords)) state.idempotencyRecords = [];
  const existed = state.idempotencyRecords.find(
    (row) => Number(row.tenantId) === Number(tenantId) && row.bizType === bizType && row.bizKey === bizKey
  );
  if (existed) {
    return { hit: true, value: existed.response };
  }

  const value = await execute();
  state.idempotencyRecords.push({
    id: nextId(state.idempotencyRecords),
    tenantId: Number(tenantId),
    bizType,
    bizKey,
    response: value,
    createdAt: new Date().toISOString(),
  });
  return { hit: false, value };
}

export function createSession(userId) {
  const token = crypto.randomUUID();
  const uid = Number(userId || 0);
  const user = Array.isArray(state.users) ? state.users.find((u) => Number(u.id) === uid) : null;
  state.sessions.push({
    token,
    userId: uid || userId,
    actorType: 'customer',
    actorId: uid || Number(user?.id || 0) || null,
    tenantId: Number(user?.tenantId || 0) || null,
    orgId: Number(user?.orgId || 0) || null,
    teamId: Number(user?.teamId || 0) || null,
    csrfToken: crypto.randomUUID(),
    expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
  });
  return token;
}

export function createActorSession(actor) {
  const token = crypto.randomUUID();
  const actorType = String(actor?.actorType || '').trim().toLowerCase();
  const actorId = Number(actor?.actorId || 0);
  const tenantId = Number(actor?.tenantId || 0) || null;
  const orgId = Number(actor?.orgId || 0) || null;
  const teamId = Number(actor?.teamId || 0) || null;

  state.sessions.push({
    token,
    userId: actorType === 'customer' ? actorId : null,
    actorType,
    actorId,
    tenantId,
    orgId,
    teamId,
    csrfToken: crypto.randomUUID(),
    expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
  });
  return token;
}

export function resolveSessionFromBearer(authorization) {
  const auth = String(authorization || '');
  if (!auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;
  const session = state.sessions.find((s) => s.token === token);
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) return null;
  if (!session.csrfToken) {
    session.csrfToken = crypto.randomUUID();
  }
  return session;
}

export function resolveUserFromBearer(authorization) {
  const session = resolveSessionFromBearer(authorization);
  if (!session) return null;
  const actorType = String(session.actorType || '').toLowerCase();
  const actorId = Number(session.actorId || 0);
  if (actorType === 'employee' || actorType === 'agent') {
    const agent = (state.agents || []).find((x) => Number(x.id) === actorId);
    if (agent) {
      return {
        id: Number(agent.id),
        actorType,
        tenantId: Number(agent.tenantId || session.tenantId || 0) || null,
        orgId: Number(agent.orgId || session.orgId || 0) || null,
        teamId: Number(agent.teamId || session.teamId || 0) || null,
        ownerUserId: 0,
        name: String(agent.name || ''),
        mobile: String(agent.mobile || ''),
        email: String(agent.email || ''),
        account: String(agent.account || agent.email || ''),
        role: String(session.role || agent.role || ''),
      };
    }
    if (actorType === 'employee' && actorId === 9001) {
      return {
        id: 9001,
        actorType: 'employee',
        tenantId: Number(session.tenantId || 1),
        orgId: Number(session.orgId || 1),
        teamId: Number(session.teamId || 1),
        ownerUserId: 0,
        name: '平台管理员',
        mobile: '',
        email: '',
        account: 'platform001',
        role: String(session.role || 'platform_admin'),
      };
    }
    return null;
  }

  return state.users.find((u) => u.id === Number(session.userId || actorId)) || null;
}

export function upsertActorCsrfToken({ tenantId, actorType, actorId }) {
  if (!Array.isArray(state.actorCsrfTokens)) state.actorCsrfTokens = [];
  const token = crypto.randomUUID();
  const t = Number(tenantId || 1);
  const aType = String(actorType || '');
  const aId = Number(actorId || 0);
  const idx = state.actorCsrfTokens.findIndex(
    (x) => Number(x.tenantId || 1) === t && String(x.actorType || '') === aType && Number(x.actorId || 0) === aId
  );
  const row = {
    tenantId: t,
    actorType: aType,
    actorId: aId,
    token,
    updatedAt: new Date().toISOString(),
  };
  if (idx >= 0) state.actorCsrfTokens[idx] = row;
  else state.actorCsrfTokens.push(row);
  return token;
}

export function resolveActorCsrfToken({ tenantId, actorType, actorId }) {
  const row = (state.actorCsrfTokens || []).find(
    (x) =>
      Number(x.tenantId || 1) === Number(tenantId || 1) &&
      String(x.actorType || '') === String(actorType || '') &&
      Number(x.actorId || 0) === Number(actorId || 0)
  );
  return row ? String(row.token || '') : '';
}

export function generateWriteoffToken() {
  let token = '';
  do {
    token = `EX${Date.now()}${Math.floor(Math.random() * 1000)}`;
  } while (state.redemptions.some((row) => row.writeoffToken === token));
  return token;
}

function assignState(next) {
  const merged = {
    ...structuredClone(initialState),
    ...(next || {}),
  };

  for (const key of Object.keys(initialState)) {
    state[key] = merged[key];
  }
}

function parseStatePayload(parsed) {
  return {
    ...structuredClone(initialState),
    ...parsed,
    users: Array.isArray(parsed.users) ? parsed.users : [],
    tenants: Array.isArray(parsed.tenants) ? parsed.tenants : structuredClone(initialState.tenants),
    orgUnits: Array.isArray(parsed.orgUnits) ? parsed.orgUnits : structuredClone(initialState.orgUnits),
    teams: Array.isArray(parsed.teams) ? parsed.teams : structuredClone(initialState.teams),
    agents: Array.isArray(parsed.agents) ? parsed.agents : structuredClone(initialState.agents),
    roles: Array.isArray(parsed.roles) ? parsed.roles : [],
    permissions: Array.isArray(parsed.permissions) ? parsed.permissions : [],
    rolePermissions: Array.isArray(parsed.rolePermissions) ? parsed.rolePermissions : [],
    userRoles: Array.isArray(parsed.userRoles) ? parsed.userRoles : [],
    companyAdminPagePermissions: Array.isArray(parsed.companyAdminPagePermissions) ? parsed.companyAdminPagePermissions : [],
    employeeRolePagePermissions: Array.isArray(parsed.employeeRolePagePermissions) ? parsed.employeeRolePagePermissions : [],
    approvals: Array.isArray(parsed.approvals) ? parsed.approvals : [],
    auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
    metricDailyUv: Array.isArray(parsed.metricDailyUv) ? parsed.metricDailyUv : [],
    metricDailyCounters: Array.isArray(parsed.metricDailyCounters) ? parsed.metricDailyCounters : [],
    metricHourlyCounters: Array.isArray(parsed.metricHourlyCounters) ? parsed.metricHourlyCounters : [],
    idempotencyRecords: Array.isArray(parsed.idempotencyRecords) ? parsed.idempotencyRecords : [],
    domainEvents: Array.isArray(parsed.domainEvents) ? parsed.domainEvents : [],
    outboxEvents: Array.isArray(parsed.outboxEvents) ? parsed.outboxEvents : [],
    smsCodes: Array.isArray(parsed.smsCodes) ? parsed.smsCodes : [],
    sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    actorCsrfTokens: Array.isArray(parsed.actorCsrfTokens) ? parsed.actorCsrfTokens : [],
    pointAccounts: Array.isArray(parsed.pointAccounts) ? parsed.pointAccounts : [],
    pointTransactions: Array.isArray(parsed.pointTransactions) ? parsed.pointTransactions : [],
    mallItems: Array.isArray(parsed.mallItems) ? parsed.mallItems : structuredClone(initialState.mallItems),
    redemptions: Array.isArray(parsed.redemptions) ? parsed.redemptions : [],
    orders: Array.isArray(parsed.orders) ? parsed.orders : [],
    orderPayments: Array.isArray(parsed.orderPayments) ? parsed.orderPayments : [],
    orderFulfillments: Array.isArray(parsed.orderFulfillments) ? parsed.orderFulfillments : [],
    orderRefunds: Array.isArray(parsed.orderRefunds) ? parsed.orderRefunds : [],
    bCustomerTags: Array.isArray(parsed.bCustomerTags) ? parsed.bCustomerTags : [],
    bCustomerTagRels: Array.isArray(parsed.bCustomerTagRels) ? parsed.bCustomerTagRels : [],
    bCustomerActivities: Array.isArray(parsed.bCustomerActivities) ? parsed.bCustomerActivities : [],
    bWriteOffRecords: Array.isArray(parsed.bWriteOffRecords) ? parsed.bWriteOffRecords : [],
    pLearningMaterials: Array.isArray(parsed.pLearningMaterials) ? parsed.pLearningMaterials : [],
    pProducts: Array.isArray(parsed.pProducts) ? parsed.pProducts : [],
    pActivities: Array.isArray(parsed.pActivities) ? parsed.pActivities : [],
    mallActivities: Array.isArray(parsed.mallActivities) ? parsed.mallActivities : [],
    eventDefinitions: Array.isArray(parsed.eventDefinitions) ? parsed.eventDefinitions : [],
    pTags: Array.isArray(parsed.pTags) ? parsed.pTags : [],
    pTagRules: Array.isArray(parsed.pTagRules) ? parsed.pTagRules : [],
    pTagRuleJobs: Array.isArray(parsed.pTagRuleJobs) ? parsed.pTagRuleJobs : [],
    pTagRuleJobLogs: Array.isArray(parsed.pTagRuleJobLogs) ? parsed.pTagRuleJobLogs : [],
    metricRules: Array.isArray(parsed.metricRules) ? parsed.metricRules : [],
    pointsRuleConfigs: Array.isArray(parsed.pointsRuleConfigs) ? parsed.pointsRuleConfigs : [],
    statsWarehouse: Array.isArray(parsed.statsWarehouse) ? parsed.statsWarehouse : [],
    reconciliationReports: Array.isArray(parsed.reconciliationReports) ? parsed.reconciliationReports : [],
    pOpsJobs: Array.isArray(parsed.pOpsJobs) ? parsed.pOpsJobs : [],
    pOpsJobLogs: Array.isArray(parsed.pOpsJobLogs) ? parsed.pOpsJobLogs : [],
    activities: Array.isArray(parsed.activities) ? parsed.activities : structuredClone(initialState.activities),
    activityCompletions: Array.isArray(parsed.activityCompletions) ? parsed.activityCompletions : [],
    signIns: Array.isArray(parsed.signIns) ? parsed.signIns : [],
    learningCourses: Array.isArray(parsed.learningCourses) ? parsed.learningCourses : [],
    courseCompletions: Array.isArray(parsed.courseCompletions) ? parsed.courseCompletions : [],
    learningGames: Array.isArray(parsed.learningGames) ? parsed.learningGames : [],
    learningTools: Array.isArray(parsed.learningTools) ? parsed.learningTools : [],
    familyMembers: Array.isArray(parsed.familyMembers) ? parsed.familyMembers : [],
    insuranceReminders: Array.isArray(parsed.insuranceReminders) ? parsed.insuranceReminders : [],
    policies: Array.isArray(parsed.policies) ? parsed.policies : [],
    familyPolicyReports: Array.isArray(parsed.familyPolicyReports) ? parsed.familyPolicyReports : [],
  };
}

function loadStateFromJsonFile(targetPath) {
  if (!fs.existsSync(targetPath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
    return parseStatePayload(parsed);
  } catch {
    return null;
  }
}

function loadSeedStateFromFile() {
  return loadStateFromJsonFile(seedPath) || structuredClone(initialState);
}

function loadRuntimeSnapshotFromFile() {
  return loadStateFromJsonFile(runtimeSnapshotPath);
}

function loadStateFromLocalFiles({ preferRuntimeSnapshot = true } = {}) {
  if (preferRuntimeSnapshot) {
    const snapshot = loadRuntimeSnapshotFromFile();
    if (snapshot) return { state: snapshot, source: 'runtime-snapshot' };
  }
  return { state: loadSeedStateFromFile(), source: 'seed' };
}

function writeRuntimeSnapshotSync(payload = state) {
  const targetDir = path.dirname(runtimeSnapshotPath);
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(runtimeSnapshotPath, JSON.stringify(payload, null, 2), 'utf-8');
}

function ensureAccessControlSeeds() {
  if (!Array.isArray(state.roles)) state.roles = [];
  if (!Array.isArray(state.permissions)) state.permissions = [];
  if (!Array.isArray(state.rolePermissions)) state.rolePermissions = [];
  if (!Array.isArray(state.userRoles)) state.userRoles = [];

  if (!state.roles.length) {
    state.roles.push(
      { id: 1, tenantId: 1, key: 'platform_admin', name: '平台管理员' },
      { id: 2, tenantId: 1, key: 'company_admin', name: '公司管理员' },
      { id: 3, tenantId: 1, key: 'team_lead', name: '团队主管' },
      { id: 4, tenantId: 1, key: 'agent', name: '业务员' },
      { id: 5, tenantId: 1, key: 'customer', name: '客户' }
    );
  }

  const permissionSeeds = [
    { key: 'tenant:read', name: '查看租户' },
    { key: 'tenant:write', name: '管理租户' },
    { key: 'customer:read', name: '查看客户' },
    { key: 'customer:write', name: '编辑客户' },
    { key: 'order:writeoff', name: '核销订单' },
    { key: 'order:refund', name: '退款订单' },
    { key: 'stats:read', name: '查看统计' },
    { key: 'approval:write', name: '审批处理' },
    { key: 'scope:tenant:all', name: '租户全量数据范围' },
    { key: 'scope:team:all', name: '团队数据范围' },
  ];
  permissionSeeds.forEach((seed) => {
    const exists = state.permissions.find((row) => row.key === seed.key);
    if (!exists) {
      state.permissions.push({ id: nextId(state.permissions), ...seed });
    }
  });

  const bind = (roleKey, permissionKey) => {
    const role = state.roles.find((r) => r.key === roleKey);
    const permission = state.permissions.find((p) => p.key === permissionKey);
    if (!role || !permission) return;
    const exists = state.rolePermissions.find((row) => row.roleId === role.id && row.permissionId === permission.id);
    if (!exists) {
      state.rolePermissions.push({
        id: nextId(state.rolePermissions),
        tenantId: role.tenantId,
        roleId: role.id,
        permissionId: permission.id,
      });
    }
  };

  ['tenant:read', 'tenant:write', 'customer:read', 'customer:write', 'order:writeoff', 'order:refund', 'stats:read', 'approval:write', 'scope:tenant:all'].forEach(
    (key) => bind('platform_admin', key)
  );
  ['tenant:read', 'customer:read', 'customer:write', 'order:writeoff', 'stats:read', 'approval:write', 'scope:tenant:all'].forEach(
    (key) => bind('company_admin', key)
  );
  ['customer:read', 'customer:write', 'order:writeoff', 'scope:team:all'].forEach((key) => bind('team_lead', key));
  ['customer:read', 'customer:write', 'order:writeoff'].forEach((key) => bind('agent', key));

  if (!state.userRoles.length) {
    state.userRoles.push(
      { id: 1, tenantId: 1, userType: 'employee', userId: 9001, roleId: 1 },
      { id: 2, tenantId: 2, userType: 'employee', userId: 8201, roleId: 2 },
      { id: 3, tenantId: 2, userType: 'agent', userId: 8202, roleId: 4 },
      { id: 4, tenantId: 3, userType: 'employee', userId: 8301, roleId: 2 },
      { id: 5, tenantId: 3, userType: 'agent', userId: 8302, roleId: 4 },
      { id: 6, tenantId: 4, userType: 'employee', userId: 8401, roleId: 2 },
      { id: 7, tenantId: 4, userType: 'agent', userId: 8402, roleId: 4 }
    );
  }

  // Backfill role bindings for tenant admins / agents loaded from DB.
  const roleIdByKey = new Map((state.roles || []).map((r) => [String(r.key), Number(r.id)]));
  for (const agent of ensureArray(state.agents)) {
    const tenantId = Number(agent.tenantId || 1);
    const userId = Number(agent.id || 0);
    if (userId <= 0) continue;
    const role = String(agent.role || '').toLowerCase();
    const roleKey = role === 'manager' ? 'company_admin' : role === 'support' ? 'team_lead' : 'agent';
    const roleId = Number(roleIdByKey.get(roleKey) || 0);
    if (roleId <= 0) continue;
    const userType = roleKey === 'agent' ? 'agent' : 'employee';
    const exists = (state.userRoles || []).some(
      (x) =>
        Number(x.tenantId) === tenantId &&
        String(x.userType) === userType &&
        Number(x.userId) === userId &&
        Number(x.roleId) === roleId
    );
    if (!exists) {
      state.userRoles.push({
        id: nextId(state.userRoles),
        tenantId,
        userType,
        userId,
        roleId,
      });
    }
  }
}

function ensureDemoAgentAccounts() {
  if (!Array.isArray(state.agents)) state.agents = [];

  const fillableKeys = ['tenantId', 'orgId', 'teamId', 'status', 'role', 'account', 'email', 'mobile', 'password', 'initialPassword'];
  let changed = false;

  for (const seed of Array.isArray(initialState.agents) ? initialState.agents : []) {
    const seedEmail = String(seed?.email || '').trim().toLowerCase();
    const seedAccount = String(seed?.account || '').trim().toLowerCase();
    const seedMobile = String(seed?.mobile || '').trim();
    const seedId = Number(seed?.id || 0);

    let existing = state.agents.find(
      (row) =>
        (seedId > 0 && Number(row?.id || 0) === seedId) ||
        (seedEmail && String(row?.email || '').trim().toLowerCase() === seedEmail) ||
        (seedAccount && String(row?.account || '').trim().toLowerCase() === seedAccount) ||
        (seedMobile && String(row?.mobile || '').trim() === seedMobile)
    );

    if (!existing) {
      state.agents.push(structuredClone(seed));
      changed = true;
      continue;
    }

    for (const key of fillableKeys) {
      const current = existing[key];
      const fallback = seed[key];
      if ((current === undefined || current === null || current === '') && fallback !== undefined && fallback !== null && fallback !== '') {
        existing[key] = fallback;
        changed = true;
      }
    }
  }

  return changed;
}

function rehydrateDerivedStateAfterLoad() {
  ensureAccessControlSeeds();
  const recoveredCompanyAdminPages = recoverCompanyAdminPagePermissionsFromAuditLogs();
  const backfilledPointsRulesPermissions = backfillPointsRulesPagePermissions();
  const backfilledCustomerPoolPermissions = backfillCustomerPoolPagePermissions();
  backfillUserScopes();
  syncOperationCatalog();
  return {
    recoveredCompanyAdminPages,
    backfilledPointsRulesPermissions,
    backfilledCustomerPoolPermissions,
  };
}

function recoverCompanyAdminPagePermissionsFromAuditLogs() {
  if (!Array.isArray(state.companyAdminPagePermissions)) state.companyAdminPagePermissions = [];
  if (!Array.isArray(state.auditLogs) || state.auditLogs.length === 0) return false;

  const latestByTenant = new Map();
  for (const row of state.auditLogs) {
    if (String(row?.action || '') !== 'company_admin_permission.update') continue;
    if (String(row?.resourceType || '') !== 'permission_matrix') continue;
    if (String(row?.result || '') !== 'success') continue;

    const tenantId = Number(row?.resourceId || row?.tenantId || 0);
    if (!Number.isFinite(tenantId) || tenantId <= 0) continue;

    const grants = Array.isArray(row?.meta?.grants)
      ? row.meta.grants
          .map((grant) => ({
            pageId: String(grant?.pageId || '').trim(),
            enabled: Boolean(grant?.enabled),
          }))
          .filter((grant) => grant.pageId)
      : [];
    if (!grants.length) continue;

    const previous = latestByTenant.get(tenantId);
    const previousTime = new Date(previous?.createdAt || 0).getTime();
    const currentTime = new Date(row?.createdAt || 0).getTime();
    if (!previous || currentTime >= previousTime) {
      latestByTenant.set(tenantId, { createdAt: row.createdAt || new Date().toISOString(), grants });
    }
  }

  let changed = false;
  for (const [tenantId, snapshot] of latestByTenant.entries()) {
    const exists = state.companyAdminPagePermissions.some(
      (row) => Number(row?.tenantId || 0) === tenantId && String(row?.roleKey || 'company_admin') === 'company_admin'
    );
    if (exists) continue;
    for (const grant of snapshot.grants) {
      state.companyAdminPagePermissions.push({
        id: nextId(state.companyAdminPagePermissions),
        tenantId,
        roleKey: 'company_admin',
        pageId: grant.pageId,
        enabled: grant.enabled,
        updatedAt: snapshot.createdAt,
      });
    }
    changed = true;
  }
  return changed;
}

function backfillPointsRulesPagePermissions() {
  if (!Array.isArray(state.companyAdminPagePermissions)) state.companyAdminPagePermissions = [];
  if (!Array.isArray(state.employeeRolePagePermissions)) state.employeeRolePagePermissions = [];

  const pageId = 'points-rules';
  let changed = false;
  const tenantIds = ensureArray(state.tenants)
    .map((row) => Number(row?.id || 0))
    .filter((id) => id > 0);

  for (const tenantId of tenantIds) {
    const companyRows = state.companyAdminPagePermissions.filter(
      (row) => Number(row?.tenantId || 0) === tenantId && String(row?.roleKey || 'company_admin') === 'company_admin'
    );
    if (companyRows.length && !companyRows.some((row) => String(row?.pageId || '') === pageId)) {
      state.companyAdminPagePermissions.push({
        id: nextId(state.companyAdminPagePermissions),
        tenantId,
        roleKey: 'company_admin',
        pageId,
        enabled: true,
        updatedAt: new Date().toISOString(),
      });
      changed = true;
    }

    for (const roleKey of ['team_lead', 'agent']) {
      const roleRows = state.employeeRolePagePermissions.filter(
        (row) => Number(row?.tenantId || 0) === tenantId && String(row?.roleKey || '') === roleKey
      );
      if (roleRows.length && !roleRows.some((row) => String(row?.pageId || '') === pageId)) {
        state.employeeRolePagePermissions.push({
          id: nextId(state.employeeRolePagePermissions),
          tenantId,
          roleKey,
          pageId,
          enabled: true,
          updatedAt: new Date().toISOString(),
        });
        changed = true;
      }
    }
  }

  return changed;
}

function backfillCustomerPoolPagePermissions() {
  if (!Array.isArray(state.companyAdminPagePermissions)) state.companyAdminPagePermissions = [];

  const pageId = 'customer-pool';
  let changed = false;
  const tenantIds = ensureArray(state.tenants)
    .map((row) => Number(row?.id || 0))
    .filter((id) => id > 0);

  for (const tenantId of tenantIds) {
    const companyRows = state.companyAdminPagePermissions.filter(
      (row) => Number(row?.tenantId || 0) === tenantId && String(row?.roleKey || 'company_admin') === 'company_admin'
    );
    if (companyRows.length && !companyRows.some((row) => String(row?.pageId || '') === pageId)) {
      state.companyAdminPagePermissions.push({
        id: nextId(state.companyAdminPagePermissions),
        tenantId,
        roleKey: 'company_admin',
        pageId,
        enabled: true,
        updatedAt: new Date().toISOString(),
      });
      changed = true;
    }
  }

  return changed;
}

function backfillUserScopes() {
  if (!Array.isArray(state.users)) return;
  state.users = state.users.map((user) => ({
    tenantId: Number(user.tenantId || 1),
    orgId: Number(user.orgId || 1),
    teamId: Number(user.teamId || 1),
    // Keep 0 as "unassigned"; never fallback to customer self id.
    ownerUserId: Number(user.ownerUserId ?? 0),
    ...user,
  }));
}

function syncOperationCatalog() {
  if (!Array.isArray(state.mallItems)) state.mallItems = [];

  const normalizeName = (row) => String(row?.name || row?.title || '').trim().toLowerCase();
  const normalizePoints = (row) => Number(row?.pointsCost ?? row?.points ?? 0) || 0;
  const normalizeTenant = (value, fallback = 1) => {
    const tenantId = Number(value || 0);
    return Number.isFinite(tenantId) && tenantId > 0 ? tenantId : fallback;
  };
  const normalizeProduct = (row) => ({
    ...row,
    id: Number(row?.id || 0),
    tenantId: normalizeTenant(row?.tenantId, 1),
    name: String(row?.name || row?.title || ''),
    pointsCost: normalizePoints(row),
    stock: Number(row?.stock || 0),
    shelfStatus: String(row?.shelfStatus || '').toLowerCase() === 'on' || String(row?.status || '').toLowerCase() === 'active' ? 'on' : 'off',
    status: String(row?.status || '').toLowerCase() === 'active' || String(row?.shelfStatus || '').toLowerCase() === 'on' ? 'active' : 'inactive',
    createdBy: Number(row?.createdBy || 0) || null,
    creatorRole: row?.creatorRole || '',
    templateScope: row?.templateScope || 'tenant',
    media: Array.isArray(row?.media) ? row.media : [],
    createdAt: row?.createdAt || new Date().toISOString(),
  });

  if (!Array.isArray(state.pProducts) || state.pProducts.length === 0) {
    state.pProducts = state.mallItems.map((item) =>
      normalizeProduct({
        id: Number(item.id || 0),
        tenantId: normalizeTenant(item.tenantId, 1),
        name: item.name || item.title,
        pointsCost: normalizePoints(item),
        stock: Number(item.stock || 0),
        shelfStatus: item.isActive ? 'on' : 'off',
        status: item.isActive ? 'active' : 'inactive',
        createdBy: Number(item.createdBy || 0) || null,
        creatorRole: item.creatorRole || '',
        templateScope: item.templateScope || 'tenant',
        media: Array.isArray(item.media) ? item.media : [],
      })
    );
  } else {
    state.pProducts = state.pProducts.map((row) => normalizeProduct(row)).filter((row) => row.id > 0);
  }

  let nextProductId = state.pProducts.reduce((maxId, row) => Math.max(maxId, Number(row.id || 0)), 0);
  state.mallItems = state.mallItems.map((item) => {
    const mapped = { ...item };

    let tenantId = normalizeTenant(mapped.tenantId, 0);
    let sourceProductId = Number(mapped.sourceProductId || 0);
    let sourceProduct = sourceProductId > 0 ? state.pProducts.find((row) => Number(row.id || 0) === sourceProductId) || null : null;

    if (tenantId <= 0 && sourceProduct) tenantId = normalizeTenant(sourceProduct.tenantId, 0);
    if (tenantId <= 0) {
      const byId = state.pProducts.find((row) => Number(row.id || 0) === Number(mapped.id || 0));
      if (byId) tenantId = normalizeTenant(byId.tenantId, 0);
    }
    if (tenantId <= 0) tenantId = 1;

    if (sourceProduct && normalizeTenant(sourceProduct.tenantId, tenantId) !== tenantId) {
      sourceProduct = null;
    }
    if (!sourceProduct) {
      sourceProduct = state.pProducts.find(
        (row) =>
          Number(row.id || 0) === Number(mapped.id || 0) &&
          normalizeTenant(row.tenantId, 1) === tenantId
      );
    }
    if (!sourceProduct) {
      sourceProduct =
        state.pProducts.find(
          (row) =>
            normalizeTenant(row.tenantId, 1) === tenantId &&
            normalizeName(row) === normalizeName(mapped) &&
            normalizePoints(row) === normalizePoints(mapped)
        ) || null;
    }
    if (!sourceProduct) {
      sourceProduct =
        state.pProducts.find(
          (row) => normalizeName(row) === normalizeName(mapped) && normalizePoints(row) === normalizePoints(mapped)
        ) || null;
      if (sourceProduct) tenantId = normalizeTenant(sourceProduct.tenantId, tenantId);
    }
    if (!sourceProduct) {
      nextProductId += 1;
      sourceProduct = normalizeProduct({
        id: nextProductId,
        tenantId,
        name: mapped.name || mapped.title || '',
        pointsCost: normalizePoints(mapped),
        stock: Number(mapped.stock || 0),
        shelfStatus: mapped.isActive === false ? 'off' : 'on',
        status: mapped.isActive === false ? 'inactive' : 'active',
        createdBy: Number(mapped.createdBy || 0) || null,
        creatorRole: mapped.creatorRole || '',
        templateScope: mapped.templateScope || 'tenant',
        media: Array.isArray(mapped.media) ? mapped.media : [],
      });
      state.pProducts.push(sourceProduct);
    }

    sourceProductId = Number(sourceProduct.id || 0);
    return {
      ...mapped,
      tenantId,
      sourceProductId,
    };
  });

  if (!Array.isArray(state.pActivities) || state.pActivities.length === 0) {
    state.pActivities = (state.activities || []).map((item) => ({
      id: Number(item.id),
      tenantId: Number(item.tenantId || 1),
      title: item.title,
      category: item.category,
      rewardPoints: Number(item.rewardPoints) || 0,
      status: 'published',
      createdBy: Number(item.createdBy || 0) || null,
      creatorRole: item.creatorRole || '',
      templateScope: item.templateScope || 'tenant',
      createdAt: new Date().toISOString(),
    }));
  }

  if (!Array.isArray(state.mallActivities)) state.mallActivities = [];
  if (state.mallActivities.length === 0 && Array.isArray(state.bCustomerActivities) && state.bCustomerActivities.length > 0) {
    state.mallActivities = state.bCustomerActivities.map((item) => ({
      ...item,
      sourceDomain: 'mall',
    }));
  }
  if (state.mallActivities.length === 0 && Array.isArray(state.pActivities) && state.pActivities.length > 0) {
    // 历史版本将“积分商城活动”写在 pActivities，这里做一次兼容回填。
    state.mallActivities = state.pActivities
      .filter((item) => item?.sourceDomain === 'mall' || item?.displayTitle)
      .map((item) => ({
        ...item,
        sourceDomain: 'mall',
      }));
  }
}

function normalizeMallPricingForDemo() {
  if (!Array.isArray(state.mallItems) || state.mallItems.length === 0) return false;

  const targetById = new Map([
    [1, 99],
    [2, 79],
    [3, 59],
  ]);

  let changed = false;
  state.mallItems = state.mallItems.map((item) => {
    const target = targetById.get(Number(item.id));
    if (!target) return item;
    if (Number(item.pointsCost) === target) return item;
    changed = true;
    return { ...item, pointsCost: target };
  });
  return changed;
}

function ensureDomainSeedsFromFile() {
  if (usePostgres) return false;
  const fileState = loadSeedStateFromFile();
  let changed = false;

  const fillArray = (key) => {
    if (ensureArray(state[key]).length > 0) return;
    const fromFile = ensureArray(fileState[key]);
    if (fromFile.length === 0) return;
    state[key] = structuredClone(fromFile);
    changed = true;
  };

  fillArray('learningCourses');
  fillArray('learningGames');
  fillArray('learningTools');
  fillArray('familyMembers');
  fillArray('insuranceReminders');
  fillArray('policies');

  if ((!state.insuranceSummary || Object.keys(state.insuranceSummary).length === 0) && fileState.insuranceSummary) {
    state.insuranceSummary = structuredClone(fileState.insuranceSummary);
    changed = true;
  }
  if (ensureArray(state.policies).length > 0) {
    const current = state.insuranceSummary || {};
    const shouldRebuild =
      !current ||
      Object.keys(current).length === 0 ||
      Number(current.activePolicies || 0) === 0 ||
      Number(current.totalCoverage || 0) === 0;
    if (shouldRebuild) {
      state.insuranceSummary = buildInsuranceSummary(state.policies, Number(current.healthScore || 85));
      changed = true;
    }
  }

  if ((!state.insuranceSummary || Object.keys(state.insuranceSummary).length === 0) && ensureArray(state.policies).length > 0) {
    state.insuranceSummary = buildInsuranceSummary(state.policies, 85);
    changed = true;
  }

  return changed;
}

async function ensureRelationalSchema() {
  if (!relationalSchemaBootstrapped && fs.existsSync(relationalSchemaPath)) {
    const baseSchemaSql = fs.readFileSync(relationalSchemaPath, 'utf8');
    await pool.query(baseSchemaSql);
    relationalSchemaBootstrapped = true;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS p_sessions (
      token TEXT PRIMARY KEY,
      customer_id BIGINT REFERENCES c_customers(id),
      actor_type TEXT,
      actor_id BIGINT,
      tenant_id BIGINT,
      org_id BIGINT,
      team_id BIGINT,
      csrf_token TEXT,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS p_sms_codes (
      id BIGINT PRIMARY KEY,
      mobile TEXT NOT NULL,
      code TEXT NOT NULL,
      tenant_id BIGINT,
      expires_at TIMESTAMPTZ NOT NULL,
      used BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE p_sms_codes ADD COLUMN IF NOT EXISTS tenant_id BIGINT;
    CREATE TABLE IF NOT EXISTS p_orders (
      id BIGINT PRIMARY KEY,
      tenant_id BIGINT NOT NULL DEFAULT 1,
      customer_id BIGINT NOT NULL REFERENCES c_customers(id),
      product_id BIGINT NOT NULL REFERENCES p_products(id),
      product_name TEXT NOT NULL,
      quantity INT NOT NULL DEFAULT 1,
      points_amount INT NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      payment_status TEXT NOT NULL,
      fulfillment_status TEXT NOT NULL,
      refund_status TEXT NOT NULL,
      order_no TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS p_order_payments (
      id BIGINT PRIMARY KEY,
      tenant_id BIGINT NOT NULL DEFAULT 1,
      order_id BIGINT NOT NULL REFERENCES p_orders(id),
      payment_method TEXT NOT NULL,
      payment_status TEXT NOT NULL,
      amount INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS p_order_fulfillments (
      id BIGINT PRIMARY KEY,
      tenant_id BIGINT NOT NULL DEFAULT 1,
      order_id BIGINT NOT NULL REFERENCES p_orders(id),
      mode TEXT NOT NULL,
      operator_agent_id BIGINT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS p_order_refunds (
      id BIGINT PRIMARY KEY,
      tenant_id BIGINT NOT NULL DEFAULT 1,
      order_id BIGINT NOT NULL REFERENCES p_orders(id),
      refund_type TEXT NOT NULL,
      status TEXT NOT NULL,
      reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS c_activity_completions (
      id BIGINT PRIMARY KEY,
      tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES p_tenants(id),
      customer_id BIGINT NOT NULL REFERENCES c_customers(id),
      activity_id BIGINT NOT NULL REFERENCES p_activities(id),
      completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE c_activity_completions ADD COLUMN IF NOT EXISTS writeoff_token TEXT;
    ALTER TABLE c_activity_completions ADD COLUMN IF NOT EXISTS written_off_at TIMESTAMPTZ;
    CREATE TABLE IF NOT EXISTS c_sign_ins (
      id BIGINT PRIMARY KEY,
      tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES p_tenants(id),
      customer_id BIGINT NOT NULL REFERENCES c_customers(id),
      sign_date DATE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS p_idempotency_records (
      id BIGINT PRIMARY KEY,
      tenant_id BIGINT NOT NULL DEFAULT 1,
      biz_type TEXT NOT NULL,
      biz_key TEXT NOT NULL,
      response JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS c_policy_responsibilities (
      id BIGINT PRIMARY KEY,
      tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES p_tenants(id),
      policy_id BIGINT NOT NULL REFERENCES c_policies(id),
      name TEXT NOT NULL,
      description TEXT,
      limit_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
      sort_order INT NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS c_policy_payment_history (
      id BIGINT PRIMARY KEY,
      tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES p_tenants(id),
      policy_id BIGINT NOT NULL REFERENCES c_policies(id),
      payment_date DATE NOT NULL,
      amount NUMERIC(14,2) NOT NULL DEFAULT 0,
      note TEXT,
      status TEXT,
      sort_order INT NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS p_track_events (
      id BIGINT PRIMARY KEY,
      tenant_id BIGINT NOT NULL DEFAULT 1,
      actor_type TEXT NOT NULL,
      actor_id BIGINT NOT NULL DEFAULT 0,
      org_id BIGINT NOT NULL DEFAULT 1,
      team_id BIGINT NOT NULL DEFAULT 1,
      event_name TEXT NOT NULL,
      properties JSONB,
      path TEXT,
      source TEXT,
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS p_audit_logs (
      id BIGINT PRIMARY KEY,
      tenant_id BIGINT NOT NULL DEFAULT 1,
      actor_type TEXT,
      actor_id BIGINT,
      action TEXT NOT NULL,
      result TEXT,
      resource_type TEXT,
      resource_id TEXT,
      meta JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS p_metric_uv_daily (
      id BIGINT PRIMARY KEY,
      tenant_id BIGINT NOT NULL DEFAULT 1,
      stat_date DATE NOT NULL,
      metric_key TEXT NOT NULL,
      actor_id BIGINT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS p_metric_counter_daily (
      id BIGINT PRIMARY KEY,
      tenant_id BIGINT NOT NULL DEFAULT 1,
      stat_date DATE NOT NULL,
      metric_key TEXT NOT NULL,
      actor_id BIGINT NOT NULL DEFAULT 0,
      cnt BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS p_metric_counter_hourly (
      id BIGINT PRIMARY KEY,
      tenant_id BIGINT NOT NULL DEFAULT 1,
      hour_key TEXT NOT NULL,
      metric_key TEXT NOT NULL,
      actor_id BIGINT NOT NULL DEFAULT 0,
      cnt BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS p_event_definitions (
      id BIGINT PRIMARY KEY,
      tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES p_tenants(id),
      event_id INT NOT NULL,
      event_name TEXT NOT NULL,
      event_type TEXT NOT NULL DEFAULT 'custom',
      description TEXT,
      collect_method TEXT NOT NULL DEFAULT 'frontend',
      status TEXT NOT NULL DEFAULT 'enabled',
      schema_json JSONB,
      definition_version INT NOT NULL DEFAULT 1,
      created_by BIGINT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS p_metric_rules (
      id BIGINT PRIMARY KEY,
      tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES p_tenants(id),
      metric_name TEXT NOT NULL,
      metric_end TEXT NOT NULL,
      formula TEXT NOT NULL,
      stat_period TEXT NOT NULL,
      data_source TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'enabled',
      threshold TEXT,
      remark TEXT,
      rule_version INT NOT NULL DEFAULT 1,
      created_by BIGINT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS p_points_rule_configs (
      id BIGINT PRIMARY KEY,
      tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES p_tenants(id),
      sign_in_points INT NOT NULL DEFAULT 10,
      new_customer_verify_points INT NOT NULL DEFAULT 200,
      customer_share_identify_points INT NOT NULL DEFAULT 0,
      created_by BIGINT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS p_ops_jobs (
      id BIGINT PRIMARY KEY,
      tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES p_tenants(id),
      job_type TEXT NOT NULL,
      payload_json JSONB,
      status TEXT NOT NULL,
      attempts INT NOT NULL DEFAULT 0,
      max_attempts INT NOT NULL DEFAULT 3,
      next_run_at TIMESTAMPTZ,
      error_text TEXT,
      result_json JSONB,
      created_by BIGINT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS p_ops_job_logs (
      id BIGINT PRIMARY KEY,
      tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES p_tenants(id),
      job_id BIGINT NOT NULL REFERENCES p_ops_jobs(id) ON DELETE CASCADE,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      detail_json JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS c_family_policy_reports (
      id BIGINT PRIMARY KEY,
      tenant_id BIGINT NOT NULL DEFAULT 1 REFERENCES p_tenants(id),
      customer_id BIGINT NOT NULL REFERENCES c_customers(id),
      scope_key TEXT NOT NULL DEFAULT 'customer_family',
      report_version TEXT NOT NULL,
      fingerprint TEXT NOT NULL,
      policy_count INT NOT NULL DEFAULT 0,
      member_count INT NOT NULL DEFAULT 0,
      report_markdown TEXT NOT NULL,
      sanitized_input_json JSONB,
      meta_json JSONB,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
      UNIQUE (tenant_id, customer_id, scope_key)
    );

    ALTER TABLE c_customers ADD COLUMN IF NOT EXISTS gender VARCHAR(10);
    ALTER TABLE c_customers ADD COLUMN IF NOT EXISTS age INT;
    ALTER TABLE c_customers ADD COLUMN IF NOT EXISTS annual_income NUMERIC(14,2);
  `);

  await pool.query(`
    ALTER TABLE p_sessions ALTER COLUMN customer_id DROP NOT NULL;
    ALTER TABLE p_sessions ADD COLUMN IF NOT EXISTS actor_type TEXT;
    ALTER TABLE p_sessions ADD COLUMN IF NOT EXISTS actor_id BIGINT;
    ALTER TABLE p_sessions ADD COLUMN IF NOT EXISTS tenant_id BIGINT;
    ALTER TABLE p_sessions ADD COLUMN IF NOT EXISTS org_id BIGINT;
    ALTER TABLE p_sessions ADD COLUMN IF NOT EXISTS team_id BIGINT;
    ALTER TABLE p_sessions ADD COLUMN IF NOT EXISTS csrf_token TEXT;
  `);

  await pool.query(`
    ALTER TABLE p_tenants ADD COLUMN IF NOT EXISTS admin_email VARCHAR(255);
    ALTER TABLE b_agents ADD COLUMN IF NOT EXISTS account VARCHAR(255);
    ALTER TABLE b_agents ADD COLUMN IF NOT EXISTS email VARCHAR(255);
    ALTER TABLE b_agents ADD COLUMN IF NOT EXISTS mobile VARCHAR(32);
    ALTER TABLE b_agents ADD COLUMN IF NOT EXISTS password VARCHAR(255);
    ALTER TABLE b_agents ADD COLUMN IF NOT EXISTS initial_password VARCHAR(255);
    ALTER TABLE b_agents ADD COLUMN IF NOT EXISTS role VARCHAR(32);
    ALTER TABLE b_agents ADD COLUMN IF NOT EXISTS org_id BIGINT;
    ALTER TABLE b_agents ADD COLUMN IF NOT EXISTS team_id BIGINT;
    ALTER TABLE b_agents ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;
    ALTER TABLE b_agents ADD COLUMN IF NOT EXISTS wecom_contact_url TEXT;
    ALTER TABLE b_agents ADD COLUMN IF NOT EXISTS wechat_id VARCHAR(120);
    ALTER TABLE b_agents ADD COLUMN IF NOT EXISTS wechat_qr_url TEXT;
    ALTER TABLE p_products ADD COLUMN IF NOT EXISTS media_json JSONB;
    ALTER TABLE p_activities ADD COLUMN IF NOT EXISTS media_json JSONB;
    ALTER TABLE p_activities ADD COLUMN IF NOT EXISTS display_title TEXT;
    ALTER TABLE p_activities ADD COLUMN IF NOT EXISTS description TEXT;
    ALTER TABLE p_activities ADD COLUMN IF NOT EXISTS source_domain TEXT;
    ALTER TABLE p_activities ADD COLUMN IF NOT EXISTS creator_role TEXT;
    ALTER TABLE p_activities ADD COLUMN IF NOT EXISTS template_scope TEXT;
    ALTER TABLE p_activities ADD COLUMN IF NOT EXISTS source_template_id BIGINT;
    ALTER TABLE p_activities ADD COLUMN IF NOT EXISTS platform_template BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE c_customers ADD COLUMN IF NOT EXISTS wechat_open_id VARCHAR(64);
    ALTER TABLE c_customers ADD COLUMN IF NOT EXISTS wechat_union_id VARCHAR(64);
    ALTER TABLE c_customers ADD COLUMN IF NOT EXISTS wechat_app_type VARCHAR(32);
    ALTER TABLE c_customers ADD COLUMN IF NOT EXISTS wechat_bound_at TIMESTAMPTZ;
    ALTER TABLE c_customers ADD COLUMN IF NOT EXISTS nick_name VARCHAR(50);
    ALTER TABLE c_customers ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(255);
    ALTER TABLE c_customers ADD COLUMN IF NOT EXISTS member_level SMALLINT NOT NULL DEFAULT 1;
    ALTER TABLE c_customers ADD COLUMN IF NOT EXISTS growth_value INT NOT NULL DEFAULT 0;
    ALTER TABLE c_customers ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;
    ALTER TABLE c_customers ADD COLUMN IF NOT EXISTS device_info VARCHAR(255);
    ALTER TABLE c_customers ADD COLUMN IF NOT EXISTS org_id BIGINT;
    ALTER TABLE c_customers ADD COLUMN IF NOT EXISTS team_id BIGINT;
    ALTER TABLE c_customers ADD COLUMN IF NOT EXISTS referrer_customer_id BIGINT REFERENCES c_customers(id);
    ALTER TABLE c_customers ADD COLUMN IF NOT EXISTS referrer_share_code TEXT;
    ALTER TABLE c_customers ADD COLUMN IF NOT EXISTS referred_at TIMESTAMPTZ;
    ALTER TABLE c_customers ALTER COLUMN referrer_share_code TYPE TEXT;
    ALTER TABLE p_learning_materials ADD COLUMN IF NOT EXISTS cover_url TEXT;
    ALTER TABLE p_learning_materials ADD COLUMN IF NOT EXISTS media_json JSONB;
    ALTER TABLE p_learning_materials ADD COLUMN IF NOT EXISTS reward_points INT NOT NULL DEFAULT 0;
    ALTER TABLE p_learning_materials ADD COLUMN IF NOT EXISTS creator_role TEXT;
    ALTER TABLE p_learning_materials ADD COLUMN IF NOT EXISTS template_scope TEXT;
    ALTER TABLE p_learning_materials ADD COLUMN IF NOT EXISTS source_template_id BIGINT;
    ALTER TABLE p_learning_materials ADD COLUMN IF NOT EXISTS platform_template BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE p_event_definitions ADD COLUMN IF NOT EXISTS definition_version INT NOT NULL DEFAULT 1;
    ALTER TABLE p_metric_rules ADD COLUMN IF NOT EXISTS rule_version INT NOT NULL DEFAULT 1;
    ALTER TABLE p_points_rule_configs ADD COLUMN IF NOT EXISTS customer_share_identify_points INT NOT NULL DEFAULT 0;
    ALTER TABLE c_policies ADD COLUMN IF NOT EXISTS applicant VARCHAR(80);
    ALTER TABLE c_policies ADD COLUMN IF NOT EXISTS applicant_relation VARCHAR(30);
    ALTER TABLE c_policies ADD COLUMN IF NOT EXISTS insured VARCHAR(80);
    ALTER TABLE c_policies ADD COLUMN IF NOT EXISTS insured_relation VARCHAR(30);
    ALTER TABLE c_policies ADD COLUMN IF NOT EXISTS analysis_json JSONB;
    ALTER TABLE c_family_policy_reports DROP CONSTRAINT IF EXISTS c_family_policy_reports_customer_id_fkey;
    ALTER TABLE c_family_policy_reports
      ADD CONSTRAINT c_family_policy_reports_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES c_customers(id) ON DELETE CASCADE;
  `);

  // Backfill customer org/team from owner agent to avoid visibility regression after restart.
  await pool.query(`
    UPDATE c_customers AS c
    SET
      org_id = COALESCE(c.org_id, a.org_id, 1),
      team_id = COALESCE(c.team_id, a.team_id, 1)
    FROM b_agents AS a
    WHERE c.owner_agent_id = a.id
      AND (c.org_id IS NULL OR c.team_id IS NULL);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_c_sign_ins_tenant_customer_sign_date ON c_sign_ins (tenant_id, customer_id, sign_date);
    CREATE INDEX IF NOT EXISTS idx_c_sign_ins_tenant_sign_date ON c_sign_ins (tenant_id, sign_date);
    CREATE INDEX IF NOT EXISTS idx_p_sessions_customer_created ON p_sessions (customer_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_p_sessions_created ON p_sessions (created_at);
    CREATE UNIQUE INDEX IF NOT EXISTS ux_metric_uv_daily ON p_metric_uv_daily (tenant_id, stat_date, metric_key, actor_id);
    CREATE INDEX IF NOT EXISTS idx_metric_uv_daily_lookup ON p_metric_uv_daily (tenant_id, metric_key, stat_date);
    CREATE UNIQUE INDEX IF NOT EXISTS ux_metric_counter_daily ON p_metric_counter_daily (tenant_id, stat_date, metric_key, actor_id);
    CREATE INDEX IF NOT EXISTS idx_metric_counter_daily_lookup ON p_metric_counter_daily (tenant_id, metric_key, stat_date);
    CREATE UNIQUE INDEX IF NOT EXISTS ux_metric_counter_hourly ON p_metric_counter_hourly (tenant_id, hour_key, metric_key, actor_id);
    CREATE INDEX IF NOT EXISTS idx_metric_counter_hourly_lookup ON p_metric_counter_hourly (tenant_id, metric_key, hour_key);
    CREATE INDEX IF NOT EXISTS idx_p_track_events_metric_lookup ON p_track_events (tenant_id, created_at, actor_type, actor_id);
    CREATE INDEX IF NOT EXISTS idx_p_audit_logs_metric_lookup ON p_audit_logs (tenant_id, created_at, result);
    CREATE INDEX IF NOT EXISTS idx_p_ops_jobs_tenant_status_next_run ON p_ops_jobs (tenant_id, status, next_run_at);
    CREATE INDEX IF NOT EXISTS idx_p_ops_job_logs_job_created ON p_ops_job_logs (job_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_c_family_policy_reports_customer ON c_family_policy_reports (tenant_id, customer_id, updated_at DESC);
  `);
}

function ensureArray(v) {
  return Array.isArray(v) ? v : [];
}

function toFiniteNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function loadStateFromPostgresTables() {
  const tenantRows = (await pool.query('SELECT * FROM p_tenants WHERE is_deleted = FALSE ORDER BY id ASC')).rows;
  const agentRows = (await pool.query('SELECT * FROM b_agents WHERE is_deleted = FALSE ORDER BY id ASC')).rows;
  const usersRows = (await pool.query('SELECT * FROM c_customers WHERE is_deleted = FALSE ORDER BY id ASC')).rows;
  const txRows = (await pool.query('SELECT * FROM c_point_transactions WHERE is_deleted = FALSE ORDER BY id ASC')).rows;
  const mallRows = (await pool.query('SELECT * FROM p_products WHERE is_deleted = FALSE ORDER BY id ASC')).rows;
  const redemptionsRows = (await pool.query('SELECT * FROM c_redeem_records WHERE is_deleted = FALSE ORDER BY id ASC')).rows;
  const sessionsRows = (await pool.query('SELECT * FROM p_sessions ORDER BY created_at ASC')).rows;
  const smsRows = (await pool.query('SELECT * FROM p_sms_codes ORDER BY id ASC')).rows;
  const orderRows = (await pool.query('SELECT * FROM p_orders ORDER BY id ASC')).rows;
  const orderPaymentRows = (await pool.query('SELECT * FROM p_order_payments ORDER BY id ASC')).rows;
  const orderFulfillmentRows = (await pool.query('SELECT * FROM p_order_fulfillments ORDER BY id ASC')).rows;
  const orderRefundRows = (await pool.query('SELECT * FROM p_order_refunds ORDER BY id ASC')).rows;
  const writeoffRows = (await pool.query('SELECT * FROM b_write_off_records WHERE is_deleted = FALSE ORDER BY id ASC')).rows;
  const learningRows = (await pool.query('SELECT * FROM p_learning_materials WHERE is_deleted = FALSE ORDER BY id ASC')).rows;
  const completionRows = (await pool.query('SELECT * FROM c_learning_records WHERE is_deleted = FALSE ORDER BY id ASC')).rows;
  const policyRows = (await pool.query('SELECT * FROM c_policies WHERE is_deleted = FALSE ORDER BY id ASC')).rows;
  const responsibilityRows = (await pool.query('SELECT * FROM c_policy_responsibilities ORDER BY sort_order ASC, id ASC')).rows;
  const paymentHistoryRows = (await pool.query('SELECT * FROM c_policy_payment_history ORDER BY sort_order ASC, id ASC')).rows;
  const activitiesRows = (await pool.query('SELECT * FROM p_activities WHERE is_deleted = FALSE ORDER BY id ASC')).rows;
  const activityCompletionRows = (await pool.query('SELECT * FROM c_activity_completions ORDER BY id ASC')).rows;
  const signInRows = (await pool.query('SELECT * FROM c_sign_ins ORDER BY id ASC')).rows;
  const idemRows = (await pool.query('SELECT * FROM p_idempotency_records ORDER BY id ASC')).rows;
  const trackRows = (await pool.query('SELECT * FROM p_track_events ORDER BY id ASC')).rows;
  const auditRows = (await pool.query('SELECT * FROM p_audit_logs ORDER BY id ASC')).rows;
  const metricUvRows = (await pool.query('SELECT * FROM p_metric_uv_daily ORDER BY id ASC')).rows;
  const metricCounterDailyRows = (await pool.query('SELECT * FROM p_metric_counter_daily ORDER BY id ASC')).rows;
  const metricCounterHourlyRows = (await pool.query('SELECT * FROM p_metric_counter_hourly ORDER BY id ASC')).rows;
  const eventDefinitionRows = (await pool.query('SELECT * FROM p_event_definitions ORDER BY event_id ASC, id ASC')).rows;
  const metricRuleRows = (await pool.query('SELECT * FROM p_metric_rules ORDER BY metric_end ASC, id ASC')).rows;
  const pointsRuleConfigRows = (await pool.query('SELECT * FROM p_points_rule_configs ORDER BY tenant_id ASC, id ASC')).rows;
  const pOpsJobRows = (await pool.query('SELECT * FROM p_ops_jobs ORDER BY id ASC')).rows;
  const pOpsJobLogRows = (await pool.query('SELECT * FROM p_ops_job_logs ORDER BY id ASC')).rows;
  const familyPolicyReportRows = (await pool.query('SELECT * FROM c_family_policy_reports WHERE is_deleted = FALSE ORDER BY id ASC')).rows;

  const hasAnyData =
    tenantRows.length ||
    agentRows.length ||
    usersRows.length ||
    txRows.length ||
    mallRows.length ||
    redemptionsRows.length ||
    learningRows.length ||
    policyRows.length ||
    eventDefinitionRows.length ||
    metricRuleRows.length ||
    pointsRuleConfigRows.length ||
    pOpsJobRows.length ||
    pOpsJobLogRows.length ||
    familyPolicyReportRows.length;
  if (!hasAnyData) return null;

  const txMapped = txRows.map((row) => ({
    id: Number(row.id),
    tenantId: Number(row.tenant_id || 1),
    userId: Number(row.customer_id),
    type: row.direction === 'out' ? 'consume' : 'earn',
    amount: Number(row.amount || 0),
    source: row.source_type || '',
    sourceId: row.source_id || '',
    idempotencyKey: row.idempotency_key || '',
    balance: Number(row.balance_after || 0),
    description: '',
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
  }));

  const accountsMapped = [];
  if (!accountsMapped.length && txMapped.length) {
    const latestByUser = new Map();
    for (const tx of txMapped) {
      const prev = latestByUser.get(tx.userId);
      if (!prev || Number(tx.id) > Number(prev.id)) latestByUser.set(tx.userId, tx);
    }
    for (const tx of latestByUser.values()) {
      accountsMapped.push({
        userId: Number(tx.userId),
        balance: Number(tx.balance || 0),
        updatedAt: tx.createdAt || new Date().toISOString(),
      });
    }
  }

  const responsibilitiesByPolicy = new Map();
  for (const row of responsibilityRows) {
    const key = Number(row.policy_id || row.c_policy_id);
    if (!responsibilitiesByPolicy.has(key)) responsibilitiesByPolicy.set(key, []);
    responsibilitiesByPolicy.get(key).push({
      name: row.name,
      desc: row.description || '',
      limit: Number(row.limit_amount || 0),
    });
  }

  const paymentHistoryByPolicy = new Map();
  for (const row of paymentHistoryRows) {
    const key = Number(row.policy_id || row.c_policy_id);
    if (!paymentHistoryByPolicy.has(key)) paymentHistoryByPolicy.set(key, []);
    paymentHistoryByPolicy.get(key).push({
      date: row.payment_date ? new Date(row.payment_date).toISOString().slice(0, 10) : '',
      amount: Number(row.amount || 0),
      note: row.note || '',
      status: row.status || '',
    });
  }

  const mappedPolicies = policyRows.map((row) => ({
    id: Number(row.id),
    tenantId: Number(row.tenant_id || 1),
    customerId: Number(row.customer_id || 0),
    company: row.company || '',
    name: row.policy_name || row.name || '',
    type: row.policy_type || row.type || '',
    amount: Number(row.amount || 0),
    nextPayment: row.period_start ? new Date(row.period_start).toISOString().slice(0, 10) : null,
    status: row.status === 'active' ? '保障中' : row.status || '',
    applicant: row.applicant || '',
    applicantRelation: row.applicant_relation || '',
    insured: row.insured || '',
    insuredRelation: row.insured_relation || '',
    analysis: sanitizeStoredPolicyAnalysis(row.analysis_json),
    periodStart: row.period_start ? new Date(row.period_start).toISOString().slice(0, 10) : null,
    periodEnd: row.period_end || '',
    annualPremium: Number(row.annual_premium || 0),
    paymentPeriod: '',
    coveragePeriod: '',
    policyNo: row.policy_no || '',
    createdBy: Number(row.created_by || row.customer_id || 0),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    responsibilities: responsibilitiesByPolicy.get(Number(row.id)) || [],
    paymentHistory: paymentHistoryByPolicy.get(Number(row.id)) || [],
  }));

  const redemptions = redemptionsRows.map((row) => ({
    id: Number(row.id),
    orderId: null,
    userId: Number(row.customer_id),
    itemId: Number(row.product_id),
    pointsCost: Number(row.points_cost || 0),
    status: row.status,
    writeoffToken: row.writeoff_token,
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    writtenOffAt: row.written_off_at ? new Date(row.written_off_at).toISOString() : null,
  }));

  const insuranceSummary = buildInsuranceSummary(mappedPolicies, state.insuranceSummary?.healthScore || 85);
  const ensureMediaArray = (raw) => (Array.isArray(raw) ? raw : []);
  const pProducts = mallRows.map((row) => ({
    id: Number(row.id),
    tenantId: Number(row.tenant_id || 1),
    title: row.name || '',
    name: row.name || '',
    points: Number(row.points_cost || 0),
    pointsCost: Number(row.points_cost || 0),
    stock: Number(row.stock || 0),
    sortOrder: Number(row.sort_order || 0),
    status: row.shelf_status === 'on' ? 'active' : 'inactive',
    description: row.description || '',
    media: ensureMediaArray(row.media_json),
    createdBy: Number(row.created_by || 0) || null,
    creatorRole: '',
    templateScope: 'tenant',
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
  }));

  const allActivities = activitiesRows.map((row) => ({
    id: Number(row.id),
    tenantId: Number(row.tenant_id || 1),
    title: row.title || '',
    displayTitle: row.display_title || row.title || '',
    type: row.category || 'task',
    category: row.category || 'task',
    rewardPoints: Number(row.reward_points || 0),
    sortOrder: Number(row.sort_order || 0),
    participants: 0,
    status: String(row.status || 'published'),
    content: row.description || '',
    description: row.description || '',
    desc: row.description || '',
    media: ensureMediaArray(row.media_json),
    sourceDomain: String(row.source_domain || 'activity'),
    createdBy: Number(row.created_by || 0) || null,
    creatorRole: String(row.creator_role || '').trim(),
    templateScope: String(row.template_scope || (row.platform_template ? 'platform' : 'tenant') || 'tenant'),
    sourceTemplateId: Number(row.source_template_id || 0) || 0,
    platformTemplate: Boolean(row.platform_template) || Number(row.source_template_id || 0) > 0,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
  }));
  const pActivities = allActivities.filter((row) => row.sourceDomain !== 'mall');
  const mallActivities = allActivities.filter((row) => row.sourceDomain === 'mall');
  const tenants = tenantRows.map((row) => ({
    id: Number(row.id),
    name: String(row.name || `租户${row.id}`),
    tenantCode: String(row.tenant_code || `tenant_${row.id}`),
    code: String(row.tenant_code || `tenant_${row.id}`),
    type: String(row.tenant_type || 'company'),
    status: String(row.status || 'active'),
    adminEmail: String(row.admin_email || ''),
    createdBy: Number(row.created_by || 9001),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
  }));
  const agents = agentRows.map((row) => ({
    id: Number(row.id),
    tenantId: Number(row.tenant_id || 1),
    orgId: Number(row.org_id || row.tenant_id || 1),
    teamId: Number(row.team_id || row.tenant_id || 1),
    employeeId: row.employee_id ? Number(row.employee_id) : null,
    name: String(row.display_name || `Agent-${row.id}`),
    email: String(row.email || ''),
    account: String(row.account || row.email || ''),
    mobile: String(row.mobile || ''),
    password: String(row.password || row.initial_password || '123456'),
    initialPassword: String(row.initial_password || row.password || '123456'),
    role: String(row.role || (String(row.display_name || '').includes('管理员') ? 'manager' : 'agent')),
    status: String(row.status || 'active'),
    avatarUrl: String(row.avatar_url || ''),
    title: String(row.title || ''),
    bio: String(row.bio || ''),
    wecomContactUrl: String(row.wecom_contact_url || ''),
    wechatId: String(row.wechat_id || ''),
    wechatQrUrl: String(row.wechat_qr_url || ''),
    createdBy: Number(row.created_by || row.id || 0) || null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
    lastActiveAt: row.last_active_at ? new Date(row.last_active_at).toISOString() : null,
  }));
  const agentScopeById = new Map(
    agents.map((row) => [
      Number(row.id),
      {
        tenantId: Number(row.tenantId || 1),
        orgId: Number(row.orgId || 1),
        teamId: Number(row.teamId || 1),
      },
    ])
  );
  return {
    ...structuredClone(initialState),
    tenants: tenants.length ? tenants : structuredClone(initialState.tenants),
    agents: agents.length ? agents : structuredClone(initialState.agents),
    users: usersRows.map((row) => ({
      id: Number(row.id),
      tenantId: Number(row.tenant_id || agentScopeById.get(Number(row.owner_agent_id || 0))?.tenantId || 1),
      orgId: Number(row.org_id || agentScopeById.get(Number(row.owner_agent_id || 0))?.orgId || 1),
      teamId: Number(row.team_id || agentScopeById.get(Number(row.owner_agent_id || 0))?.teamId || 1),
      ownerUserId: Number(row.owner_agent_id || 0),
      referrerCustomerId: Number(row.referrer_customer_id || 0) || 0,
      referrerShareCode: String(row.referrer_share_code || ''),
      referredAt: row.referred_at ? new Date(row.referred_at).toISOString() : null,
      name: row.name,
      mobile: row.mobile_enc || row.mobile_masked || '',
      openId: String(row.wechat_open_id || ''),
      unionId: String(row.wechat_union_id || ''),
      wechatAppType: String(row.wechat_app_type || ''),
      wechatBoundAt: row.wechat_bound_at ? new Date(row.wechat_bound_at).toISOString() : null,
      nickName: String(row.nick_name || ''),
      avatarUrl: String(row.avatar_url || ''),
      memberLevel: Number(row.member_level || 1),
      growthValue: Number(row.growth_value || 0),
      lastActiveAt: row.last_active_at ? new Date(row.last_active_at).toISOString() : null,
      deviceInfo: String(row.device_info || ''),
      isVerifiedBasic: Boolean(row.is_verified_basic),
      gender: String(row.gender || ''),
      age: Number(row.age || 0) || null,
      annualIncome: Number(row.annual_income || 0) || null,
      verifiedAt: row.verified_at ? new Date(row.verified_at).toISOString() : null,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    })),
    pointAccounts: accountsMapped,
    pointTransactions: txMapped,
    activities: pActivities.length > 0 ? pActivities : structuredClone(initialState.activities),
    mallItems: pProducts.map((row) => ({
      id: Number(row.id),
      tenantId: Number(row.tenantId || 1),
      name: row.name || row.title || '',
      pointsCost: Number(row.pointsCost || row.points || 0),
      stock: Number(row.stock || 0),
      isActive: String(row.status || '').toLowerCase() === 'active',
      media: Array.isArray(row.media) ? row.media : [],
      description: String(row.description || ''),
      createdBy: Number(row.createdBy || 0) || null,
      creatorRole: '',
      templateScope: 'tenant',
    })),
    pProducts,
    pActivities,
    mallActivities,
    bCustomerActivities: mallActivities,
    redemptions,
    sessions: sessionsRows.map((row) => ({
      token: row.token,
      userId: row.customer_id ? Number(row.customer_id) : null,
      actorType: String(row.actor_type || (row.customer_id ? 'customer' : '')),
      actorId: row.actor_id ? Number(row.actor_id) : row.customer_id ? Number(row.customer_id) : null,
      tenantId: row.tenant_id ? Number(row.tenant_id) : null,
      orgId: row.org_id ? Number(row.org_id) : null,
      teamId: row.team_id ? Number(row.team_id) : null,
      csrfToken: String(row.csrf_token || ''),
      expiresAt: new Date(row.expires_at).toISOString(),
      createdAt: new Date(row.created_at).toISOString(),
    })),
    smsCodes: smsRows.map((row) => ({
      id: Number(row.id),
      mobile: row.mobile,
      code: row.code,
      tenantId: row.tenant_id ? Number(row.tenant_id) : null,
      expiresAt: new Date(row.expires_at).toISOString(),
      used: Boolean(row.used),
      createdAt: new Date(row.created_at).toISOString(),
    })),
    orders: orderRows.map((row) => ({
      id: Number(row.id),
      tenantId: Number(row.tenant_id || 1),
      customerId: Number(row.customer_id),
      productId: Number(row.product_id),
      productName: row.product_name,
      quantity: Number(row.quantity || 1),
      pointsAmount: Number(row.points_amount || 0),
      status: row.status,
      paymentStatus: row.payment_status,
      fulfillmentStatus: row.fulfillment_status,
      refundStatus: row.refund_status,
      orderNo: row.order_no,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    })),
    orderPayments: orderPaymentRows.map((row) => ({
      id: Number(row.id),
      tenantId: Number(row.tenant_id || 1),
      orderId: Number(row.order_id),
      paymentMethod: row.payment_method,
      paymentStatus: row.payment_status,
      amount: Number(row.amount || 0),
      createdAt: new Date(row.created_at).toISOString(),
    })),
    orderFulfillments: orderFulfillmentRows.map((row) => ({
      id: Number(row.id),
      tenantId: Number(row.tenant_id || 1),
      orderId: Number(row.order_id),
      mode: row.mode,
      operatorAgentId: Number(row.operator_agent_id),
      createdAt: new Date(row.created_at).toISOString(),
    })),
    orderRefunds: orderRefundRows.map((row) => ({
      id: Number(row.id),
      tenantId: Number(row.tenant_id || 1),
      orderId: Number(row.order_id),
      refundType: row.refund_type,
      status: row.status,
      reason: row.reason || '',
      createdAt: new Date(row.created_at).toISOString(),
    })),
    bWriteOffRecords: writeoffRows.map((row) => ({
      id: Number(row.id),
      tenantId: Number(row.tenant_id || 1),
      redeemRecordId: Number(row.redeem_record_id),
      operatorAgentId: Number(row.operator_agent_id),
      writeoffToken: row.writeoff_token,
      status: row.status,
      createdAt: new Date(row.created_at).toISOString(),
    })),
    learningCourses: learningRows.map((row) => {
      const contentUrl = String(row.content_url || '').trim();
      const coverUrl = String(row.cover_url || '').trim();
      const mediaItems = ensureMediaArray(row.media_json);
      const videoChannelMeta = resolveCourseVideoChannelMeta({ media: mediaItems });
      const visibleMedia = stripVideoChannelMetaFromMedia(mediaItems);
      const extractMediaUrl = (raw) => {
        const text = String(raw || '').trim();
        if (!text) return '';
        if (/^\/uploads\//i.test(text)) return text;
        if (/^https?:\/\/.+\.(png|jpe?g|gif|webp|bmp|svg|mp4|mov|m4v|webm)(\?.*)?$/i.test(text)) return text;
        if (/\.(png|jpe?g|gif|webp|bmp|svg|mp4|mov|m4v|webm)$/i.test(text)) return text;
        if (text.startsWith('[') || text.startsWith('{')) {
          try {
            const parsed = JSON.parse(text);
            const first = Array.isArray(parsed) ? parsed[0] : parsed;
            if (typeof first === 'string') return first;
            if (first && typeof first === 'object') {
              return String(first.preview || first.url || first.path || first.name || '');
            }
          } catch {
            return '';
          }
        }
        return '';
      };
      const coverMediaUrl = extractMediaUrl(coverUrl);
      const contentMediaUrl = extractMediaUrl(contentUrl);
      const resolvedImage = coverMediaUrl || contentMediaUrl || String(videoChannelMeta?.coverUrl || '').trim() || '';
      const resolvedContent = contentMediaUrl ? '' : contentUrl;
      return {
        id: Number(row.id),
        tenantId: Number(row.tenant_id || 1),
        title: row.title,
        desc: '',
        type: row.material_type || 'article',
        contentType: row.material_type || 'article',
        typeLabel: '',
        progress: 0,
        timeLeft: '',
        image: resolvedImage,
        action: '',
        color: '',
        btnColor: '',
        points: Number(row.reward_points || 0),
        category: row.category || '',
        content: resolvedContent,
        coverUrl: coverMediaUrl || String(videoChannelMeta?.coverUrl || '').trim(),
        sourceType: resolveCourseSourceType(
          {
            sourceType: row.source_type,
            videoChannelMeta,
            media: mediaItems,
          },
          DEFAULT_COURSE_SOURCE_TYPE,
        ),
        videoChannelMeta,
        media: visibleMedia.length
          ? visibleMedia
          : coverMediaUrl
            ? [{ name: 'cover', type: 'image/*', preview: coverMediaUrl, url: coverMediaUrl, path: '' }]
            : [],
        rewardPoints: Number(row.reward_points || 0),
        status: row.status || 'published',
        createdBy: Number(row.created_by || 0) || null,
        creatorRole: String(row.creator_role || '').trim(),
        templateScope: String(row.template_scope || (row.platform_template ? 'platform' : 'tenant') || 'tenant'),
        sourceTemplateId: Number(row.source_template_id || 0) || 0,
        platformTemplate: Boolean(row.platform_template) || Number(row.source_template_id || 0) > 0,
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
      };
    }),
    courseCompletions: completionRows.map((row) => ({
      id: Number(row.id),
      userId: Number(row.customer_id),
      courseId: Number(row.material_id || 0),
      pointsAwarded: Number(row.points_awarded || 0),
      createdAt: new Date(row.created_at).toISOString(),
    })),
    policies: mappedPolicies,
    insuranceSummary,
    activityCompletions: activityCompletionRows.map((row) => ({
      id: Number(row.id),
      tenantId: Number(row.tenant_id || 1),
      userId: Number(row.customer_id),
      activityId: Number(row.activity_id),
      completedDate: row.completed_at ? new Date(row.completed_at).toISOString().slice(0, 10) : '',
      completedAt: new Date(row.completed_at).toISOString(),
      createdAt: new Date(row.completed_at).toISOString(),
      writeoffToken: String(row.writeoff_token || ''),
      writtenOffAt: row.written_off_at ? new Date(row.written_off_at).toISOString() : null,
    })),
    signIns: signInRows.map((row) => ({
      id: Number(row.id),
      tenantId: Number(row.tenant_id || 1),
      userId: Number(row.customer_id),
      signDate: new Date(row.sign_date).toISOString().slice(0, 10),
      createdAt: new Date(row.created_at).toISOString(),
    })),
    idempotencyRecords: idemRows.map((row) => ({
      id: Number(row.id),
      tenantId: Number(row.tenant_id || 1),
      bizType: row.biz_type,
      bizKey: row.biz_key,
      response: row.response || null,
      createdAt: new Date(row.created_at).toISOString(),
    })),
    trackEvents: trackRows.map((row) => ({
      id: Number(row.id),
      tenantId: Number(row.tenant_id || 1),
      actorType: row.actor_type || 'anonymous',
      actorId: Number(row.actor_id || 0),
      orgId: Number(row.org_id || 1),
      teamId: Number(row.team_id || 1),
      event: row.event_name || '',
      properties: row.properties || {},
      path: row.path || '',
      source: row.source || '',
      userAgent: row.user_agent || '',
      createdAt: new Date(row.created_at).toISOString(),
    })),
    auditLogs: auditRows.map((row) => ({
      id: Number(row.id),
      tenantId: Number(row.tenant_id || 1),
      actorType: String(row.actor_type || ''),
      actorId: Number(row.actor_id || 0),
      action: String(row.action || ''),
      result: String(row.result || ''),
      resourceType: String(row.resource_type || ''),
      resourceId: String(row.resource_id || ''),
      meta: row.meta || {},
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    })),
    metricDailyUv: metricUvRows.map((row) => ({
      id: Number(row.id),
      tenantId: Number(row.tenant_id || 1),
      statDate: row.stat_date ? new Date(row.stat_date).toISOString().slice(0, 10) : dateOnly(),
      metricKey: String(row.metric_key || ''),
      actorId: Number(row.actor_id || 0),
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    })),
    metricDailyCounters: metricCounterDailyRows.map((row) => ({
      id: Number(row.id),
      tenantId: Number(row.tenant_id || 1),
      statDate: row.stat_date ? new Date(row.stat_date).toISOString().slice(0, 10) : dateOnly(),
      metricKey: String(row.metric_key || ''),
      actorId: Number(row.actor_id || 0),
      cnt: Number(row.cnt || 0),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    })),
    metricHourlyCounters: metricCounterHourlyRows.map((row) => ({
      id: Number(row.id),
      tenantId: Number(row.tenant_id || 1),
      hourKey: String(row.hour_key || ''),
      metricKey: String(row.metric_key || ''),
      actorId: Number(row.actor_id || 0),
      cnt: Number(row.cnt || 0),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    })),
    eventDefinitions: eventDefinitionRows.map((row) => ({
      id: Number(row.id),
      tenantId: Number(row.tenant_id || 1),
      eventId: Number(row.event_id || 0),
      eventName: String(row.event_name || ''),
      eventType: String(row.event_type || 'custom'),
      description: String(row.description || ''),
      collectMethod: String(row.collect_method || 'frontend'),
      status: String(row.status || 'enabled'),
      schema: row.schema_json || {},
      definitionVersion: Math.max(1, Number(row.definition_version || 1)),
      createdBy: Number(row.created_by || 0) || null,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    })),
    metricRules: metricRuleRows.map((row) => ({
      id: Number(row.id),
      tenantId: Number(row.tenant_id || 1),
      name: String(row.metric_name || ''),
      end: String(row.metric_end || 'c'),
      formula: String(row.formula || ''),
      period: String(row.stat_period || '每日'),
      source: String(row.data_source || ''),
      status: String(row.status || 'enabled'),
      threshold: row.threshold ? String(row.threshold) : '',
      remark: row.remark ? String(row.remark) : '',
      ruleVersion: Math.max(1, Number(row.rule_version || 1)),
      createdBy: Number(row.created_by || 0) || null,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    })),
    pointsRuleConfigs: pointsRuleConfigRows.map((row) => ({
      id: Number(row.id),
      tenantId: Number(row.tenant_id || 1),
      signInPoints: Number(row.sign_in_points ?? DEFAULT_POINTS_RULE_CONFIG.signInPoints),
      newCustomerVerifyPoints: Number(
        row.new_customer_verify_points ?? DEFAULT_POINTS_RULE_CONFIG.newCustomerVerifyPoints
      ),
      customerShareIdentifyPoints: Number(
        row.customer_share_identify_points ?? DEFAULT_POINTS_RULE_CONFIG.customerShareIdentifyPoints
      ),
      createdBy: Number(row.created_by || 0) || null,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    })),
    pOpsJobs: pOpsJobRows.map((row) => ({
      id: Number(row.id),
      tenantId: Number(row.tenant_id || 1),
      jobType: String(row.job_type || ''),
      payload: row.payload_json || {},
      status: String(row.status || 'queued'),
      attempts: Number(row.attempts || 0),
      maxAttempts: Number(row.max_attempts || 3),
      nextRunAt: row.next_run_at ? new Date(row.next_run_at).toISOString() : null,
      error: String(row.error_text || ''),
      result: row.result_json || null,
      createdBy: Number(row.created_by || 0) || 0,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
      startedAt: row.started_at ? new Date(row.started_at).toISOString() : null,
      completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
    })),
    pOpsJobLogs: pOpsJobLogRows.map((row) => ({
      id: Number(row.id),
      tenantId: Number(row.tenant_id || 1),
      jobId: Number(row.job_id || 0),
      level: String(row.level || 'info'),
      message: String(row.message || ''),
      detail: row.detail_json || null,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    })),
    familyPolicyReports: familyPolicyReportRows.map((row) => ({
      id: Number(row.id),
      tenantId: Number(row.tenant_id || 1),
      customerId: Number(row.customer_id || 0),
      scopeKey: String(row.scope_key || 'customer_family'),
      reportVersion: String(row.report_version || ''),
      fingerprint: String(row.fingerprint || ''),
      policyCount: Number(row.policy_count || 0),
      memberCount: Number(row.member_count || 0),
      reportMarkdown: String(row.report_markdown || ''),
      sanitizedInput: row.sanitized_input_json || {},
      meta: row.meta_json || {},
      generatedAt: row.generated_at ? new Date(row.generated_at).toISOString() : new Date().toISOString(),
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    })),
  };
}

function buildInsuranceSummary(policies, healthScore = 85) {
  const activePolicies = ensureArray(policies).filter((p) => p.status === '保障中').length;
  const totalCoverage = ensureArray(policies).reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const annualPremium = ensureArray(policies).reduce((sum, p) => sum + Number(p.annualPremium || 0), 0);
  return { totalCoverage, activePolicies, annualPremium, healthScore };
}

async function truncateAndInsert(client, tableName, columns, rows) {
  await client.query(`DELETE FROM ${tableName}`);
  if (!rows.length) return;
  for (const row of rows) {
    const values = columns.map((col) => {
      const raw = row[col];
      if (raw === undefined) return null;
      if (typeof raw === 'number' && !Number.isFinite(raw)) return null;
      if (raw && typeof raw === 'object' && !(raw instanceof Date)) return JSON.stringify(raw);
      return raw;
    });
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    await client.query(`INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`, values);
  }
}

function sqlValue(raw) {
  if (raw === undefined) return null;
  if (typeof raw === 'number' && !Number.isFinite(raw)) return null;
  if (raw && typeof raw === 'object' && !(raw instanceof Date)) return JSON.stringify(raw);
  return raw;
}

function rowKey(row, keyColumns) {
  return keyColumns.map((col) => String(row?.[col] ?? '')).join('|');
}

async function syncTableByPrimaryKeys(client, tableName, keyColumns, columns, rows) {
  if (!Array.isArray(keyColumns) || keyColumns.length === 0) {
    throw new Error(`syncTableByPrimaryKeys invalid key columns for ${tableName}`);
  }
  const nonKeyColumns = columns.filter((col) => !keyColumns.includes(col));
  const existingRows = await client.query(`SELECT ${keyColumns.join(', ')} FROM ${tableName}`);
  const existingMap = new Map(existingRows.rows.map((row) => [rowKey(row, keyColumns), row]));
  const nextMap = new Map(rows.map((row) => [rowKey(row, keyColumns), row]));
  let deleted = 0;
  let inserted = 0;
  let updatedByKey = 0;

  for (const [key, existing] of existingMap.entries()) {
    if (nextMap.has(key)) continue;
    const whereSql = keyColumns.map((col, idx) => `${col} = $${idx + 1}`).join(' AND ');
    await client.query(
      `DELETE FROM ${tableName} WHERE ${whereSql}`,
      keyColumns.map((col) => sqlValue(existing[col]))
    );
    deleted += 1;
  }

  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const conflictSql = keyColumns.join(', ');
  const updateSql = nonKeyColumns.length > 0 ? nonKeyColumns.map((col) => `${col}=EXCLUDED.${col}`).join(', ') : null;

  for (const row of rows) {
    if (existingMap.has(rowKey(row, keyColumns))) updatedByKey += 1;
    else inserted += 1;
    const values = columns.map((col) => sqlValue(row[col]));
    const upsertSql = updateSql
      ? `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT (${conflictSql}) DO UPDATE SET ${updateSql}`
      : `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT (${conflictSql}) DO NOTHING`;
    await client.query(upsertSql, values);
  }

  return {
    table: tableName,
    primaryKeys: keyColumns,
    existingCount: existingMap.size,
    nextCount: rows.length,
    inserted,
    updatedByKey,
    deleted,
  };
}

function writePersistSyncStatsSnapshot(snapshot) {
  try {
    const reportsDir = path.resolve(process.cwd(), 'docs', 'reports');
    if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
    const target = path.join(reportsDir, 'persist-sync-stats-latest.json');
    fs.writeFileSync(target, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf-8');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[state] persist sync stats snapshot write failed:', err?.message || err);
  }
}

function dedupeRowsByCompositeKey(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    map.set(keyFn(row), row);
  }
  return [...map.values()];
}

async function writeStateToPostgresTables() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const fkDropStats = {
      sessions: 0,
      orders: 0,
      redemptions: 0,
      signIns: 0,
      activityCompletions: 0,
      learningRecords: 0,
    };
    const incrementalSyncStats = {};

    const responsibilitiesRows = [];
    const paymentHistoryRows = [];
    for (const policy of ensureArray(state.policies)) {
      for (const [idx, item] of ensureArray(policy.responsibilities).entries()) {
        responsibilitiesRows.push({
          id: nextId(responsibilitiesRows),
          tenant_id: 1,
          policy_id: Number(policy.id),
          name: item.name || '',
          description: item.desc || '',
          limit_amount: Number(item.limit || 0),
          sort_order: idx + 1,
        });
      }
      for (const [idx, item] of ensureArray(policy.paymentHistory).entries()) {
        paymentHistoryRows.push({
          id: nextId(paymentHistoryRows),
          tenant_id: 1,
          policy_id: Number(policy.id),
          payment_date: item.date || dateOnly(),
          amount: Number(item.amount || 0),
          note: item.note || '',
          status: item.status || '',
          sort_order: idx + 1,
        });
      }
    }

    await client.query(`
      INSERT INTO p_tenants (id, tenant_code, tenant_type, name, status, package_name, quota_max_customers, quota_max_templates, admin_email, created_at, updated_at, is_deleted)
      VALUES (1, 'default', 'company', '默认租户', 'active', 'default', 0, 0, NULL, NOW(), NOW(), FALSE)
      ON CONFLICT (id) DO NOTHING
    `);

    const clearOrder = [
      'b_write_off_records',
      'p_order_refunds',
      'p_order_fulfillments',
      'p_order_payments',
      'p_sms_codes',
      'p_idempotency_records',
      'c_policy_payment_history',
      'c_policy_responsibilities',
      'c_policies',
    ];
    for (const tableName of clearOrder) {
      await client.query(`DELETE FROM ${tableName}`);
    }

    const tenantRows = ensureArray(state.tenants).length
      ? ensureArray(state.tenants)
      : [{ id: 1, name: '默认租户', status: 'active', type: 'company', createdAt: new Date().toISOString() }];

    for (const [idx, row] of tenantRows.entries()) {
      const id = Number(row.id || idx + 1);
      const tenantCode = String(row.tenantCode || row.code || `tenant_${id}`);
      const tenantType = String(row.type || row.tenantType || 'company');
      const name = String(row.name || `租户${id}`);
      const status = String(row.status || 'active') === 'disabled' ? 'disabled' : 'active';
      const packageName = String(row.packageName || 'default');
      const quotaMaxCustomers = Number(row.quotaMaxCustomers || 0);
      const quotaMaxTemplates = Number(row.quotaMaxTemplates || 0);
      const adminEmail = String(row.adminEmail || '');
      const createdBy = Number(row.createdBy || 9001);
      const createdAt = row.createdAt || new Date().toISOString();
      await client.query(
        `
          INSERT INTO p_tenants (
            id, tenant_code, tenant_type, name, status, package_name, quota_max_customers, quota_max_templates, admin_email, created_by, created_at, updated_at, is_deleted
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),FALSE)
          ON CONFLICT (id) DO UPDATE SET
            tenant_code = EXCLUDED.tenant_code,
            tenant_type = EXCLUDED.tenant_type,
            name = EXCLUDED.name,
            status = EXCLUDED.status,
            package_name = EXCLUDED.package_name,
            quota_max_customers = EXCLUDED.quota_max_customers,
            quota_max_templates = EXCLUDED.quota_max_templates,
            admin_email = EXCLUDED.admin_email,
            created_by = EXCLUDED.created_by,
            updated_at = NOW(),
            is_deleted = FALSE
        `,
        [id, tenantCode, tenantType, name, status, packageName, quotaMaxCustomers, quotaMaxTemplates, adminEmail || null, createdBy, createdAt]
      );
    }

    const agentTenantById = new Map(
      ensureArray(state.agents)
        .map((row) => [toFiniteNumber(row.id, null), toFiniteNumber(row.tenantId, null)])
        .filter(([id, tenantId]) => Number.isFinite(Number(id)) && Number(id) > 0 && Number.isFinite(Number(tenantId)) && Number(tenantId) > 0)
    );
    const agentScopeById = new Map(
      ensureArray(state.agents)
        .map((row) => [
          toFiniteNumber(row.id, null),
          {
            orgId: toFiniteNumber(row.orgId, 1),
            teamId: toFiniteNumber(row.teamId, 1),
          },
        ])
        .filter(([id]) => Number.isFinite(Number(id)) && Number(id) > 0)
    );
    let validCustomerIds = new Set();

    const customerRows = ensureArray(state.users)
      .map((row) => {
        const ownerAgentId = toFiniteNumber(row.ownerUserId, 0);
        const inferredTenantId = ownerAgentId > 0 ? toFiniteNumber(agentTenantById.get(ownerAgentId), null) : null;
        const inferredScope = ownerAgentId > 0 ? agentScopeById.get(ownerAgentId) : null;
        const rawTenantId = toFiniteNumber(row.tenantId, inferredTenantId);
        const tenantId = Number.isFinite(Number(rawTenantId)) && Number(rawTenantId) > 0 ? Number(rawTenantId) : null;
        if (!tenantId) return null;
        return {
          id: Number(row.id),
          tenant_id: tenantId,
          org_id: Number(toFiniteNumber(row.orgId, inferredScope?.orgId ?? 1)),
          team_id: Number(toFiniteNumber(row.teamId, inferredScope?.teamId ?? 1)),
          owner_agent_id: ownerAgentId > 0 ? ownerAgentId : null,
          referrer_customer_id: Number(toFiniteNumber(row.referrerCustomerId, 0)) || null,
          referrer_share_code: row.referrerShareCode || null,
          referred_at: row.referredAt || null,
          name: row.name || '',
          mobile_enc: row.mobile || '',
          mobile_masked: row.mobile || '',
          wechat_open_id: row.openId || null,
          wechat_union_id: row.unionId || null,
          wechat_app_type: row.wechatAppType || null,
          wechat_bound_at: row.wechatBoundAt || null,
          nick_name: row.nickName || null,
          avatar_url: row.avatarUrl || null,
          member_level: Number(row.memberLevel || 1),
          growth_value: Number(row.growthValue || 0),
          last_active_at: row.lastActiveAt || null,
          device_info: clampText(row.deviceInfo, 255) || null,
          is_verified_basic: Boolean(row.isVerifiedBasic),
          gender: row.gender || null,
          age: Number(row.age || 0) || null,
          annual_income: Number(row.annualIncome || 0) || null,
          verified_at: row.verifiedAt || null,
          created_by: Number(row.createdBy || row.ownerUserId || 0) || null,
          created_at: row.createdAt || new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_deleted: false,
        };
      })
      .filter(Boolean);

    validCustomerIds = new Set(customerRows.map((row) => toFiniteNumber(row.id, null)).filter((id) => Number(id) > 0));

    incrementalSyncStats.c_customers = await syncTableByPrimaryKeys(
      client,
      'c_customers',
      ['id'],
      [
        'id',
        'tenant_id',
        'org_id',
        'team_id',
        'owner_agent_id',
        'referrer_customer_id',
        'referrer_share_code',
        'referred_at',
        'name',
        'mobile_enc',
        'mobile_masked',
        'wechat_open_id',
        'wechat_union_id',
        'wechat_app_type',
        'wechat_bound_at',
        'nick_name',
        'avatar_url',
        'member_level',
        'growth_value',
        'last_active_at',
        'device_info',
        'is_verified_basic',
        'gender',
        'age',
        'annual_income',
        'verified_at',
        'created_by',
        'created_at',
        'updated_at',
        'is_deleted',
      ],
      customerRows
    );

    incrementalSyncStats.b_agents = await syncTableByPrimaryKeys(
      client,
      'b_agents',
      ['id'],
      [
        'id',
        'tenant_id',
        'org_id',
        'team_id',
        'employee_id',
        'display_name',
        'account',
        'email',
        'mobile',
        'password',
        'initial_password',
        'role',
        'avatar_url',
        'title',
        'bio',
        'status',
        'last_active_at',
        'created_by',
        'created_at',
        'updated_at',
        'is_deleted',
      ],
      ensureArray(state.agents).map((row) => ({
        id: Number(row.id),
        tenant_id: Number(row.tenantId || 1),
        org_id: Number(row.orgId || row.tenantId || 1),
        team_id: Number(row.teamId || row.tenantId || 1),
        employee_id: row.employeeId ? Number(row.employeeId) : null,
        display_name: row.name || `Agent-${row.id}`,
        account: row.account || row.email || null,
        email: row.email || null,
        mobile: row.mobile || null,
        password: row.password || row.initialPassword || null,
        initial_password: row.initialPassword || row.password || null,
        role: row.role || 'agent',
        avatar_url: row.avatarUrl || null,
        title: row.title || null,
        bio: row.bio || null,
        wecom_contact_url: row.wecomContactUrl || null,
        wechat_id: row.wechatId || null,
        wechat_qr_url: row.wechatQrUrl || null,
        status: ['active', 'inactive', 'blocked'].includes(String(row.status || '').toLowerCase()) ? String(row.status).toLowerCase() : 'active',
        last_active_at: row.lastActiveAt || null,
        created_by: Number(row.createdBy || row.id || 0) || null,
        created_at: row.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_deleted: false,
      }))
    );

    const productRows = (ensureArray(state.pProducts).length ? ensureArray(state.pProducts) : ensureArray(state.mallItems)).map((row) => ({
      id: Number(row.id),
      tenantId: Number(row.tenantId || 1),
      name: String(row.name || row.title || ''),
      description: String(row.description || row.desc || ''),
      pointsCost: Math.max(1, Number(row.pointsCost || row.points || 0)),
      stock: Number(row.stock || 0),
      shelfStatus:
        String(row.status || '').toLowerCase() === 'active' ||
        String(row.status || '').toLowerCase() === 'online' ||
        row.isActive === true
          ? 'on'
          : 'off',
      sortOrder: Number(row.sortOrder || 0),
      createdBy: Number(row.createdBy || 0) || null,
      media: Array.isArray(row.media) ? row.media : [],
    }));
    const validProductIds = new Set(productRows.map((row) => toFiniteNumber(row.id, null)).filter((id) => Number(id) > 0));

    incrementalSyncStats.p_products = await syncTableByPrimaryKeys(
      client,
      'p_products',
      ['id'],
      ['id', 'tenant_id', 'name', 'description', 'points_cost', 'stock', 'shelf_status', 'sort_order', 'media_json', 'created_by', 'created_at', 'updated_at', 'is_deleted'],
      productRows.map((row) => ({
        id: row.id,
        tenant_id: row.tenantId,
        name: row.name,
        description: row.description,
        points_cost: row.pointsCost,
        stock: row.stock,
        shelf_status: row.shelfStatus,
        sort_order: row.sortOrder,
        media_json: row.media,
        created_by: row.createdBy,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_deleted: false,
      }))
    );

    const activityRowsRaw = [
      ...ensureArray(state.pActivities).map((row) => ({ ...row, sourceDomain: String(row.sourceDomain || 'activity') })),
      ...ensureArray(state.mallActivities).map((row) => ({ ...row, sourceDomain: 'mall' })),
    ];
    const usedIds = new Set();
    let maxId = activityRowsRaw.reduce((mx, row) => Math.max(mx, Number(row.id) || 0), 0);
    const activityRows = activityRowsRaw.map((row) => {
      let id = Number(row.id) || 0;
      if (!id || usedIds.has(id)) {
        maxId += 1;
        id = maxId;
      }
      usedIds.add(id);
      return { ...row, id };
    });
    const validActivityIds = new Set(activityRows.map((row) => toFiniteNumber(row.id, null)).filter((id) => Number(id) > 0));

    incrementalSyncStats.p_activities = await syncTableByPrimaryKeys(
      client,
      'p_activities',
      ['id'],
      [
        'id',
        'tenant_id',
        'title',
        'display_title',
        'description',
        'source_domain',
        'category',
        'reward_points',
        'start_at',
        'end_at',
        'status',
        'sort_order',
        'media_json',
        'created_by',
        'creator_role',
        'template_scope',
        'source_template_id',
        'platform_template',
        'created_at',
        'updated_at',
        'is_deleted',
      ],
      activityRows.map((row) => ({
        // p_activities.status 受DB约束：draft/published/ended
        // 这里把前端常用 active/online/ongoing 映射为 published。
        id: Number(row.id),
        tenant_id: Number(row.tenantId || 1),
        title: String(row.title || ''),
        display_title: String(row.displayTitle || row.title || ''),
        description: String(row.description || row.desc || row.content || ''),
        source_domain: String(row.sourceDomain || 'activity'),
        category: String(row.category || row.type || 'task'),
        reward_points: Number(row.rewardPoints || 0),
        start_at: null,
        end_at: null,
        status: (() => {
          const s = String(row.status || '').toLowerCase();
          if (['published', 'active', 'online', 'ongoing', 'on', '进行中', '生效'].includes(s)) return 'published';
          if (['ended', 'offline', 'inactive', 'off', '下线', '结束'].includes(s)) return 'ended';
          return 'draft';
        })(),
        sort_order: Number(row.sortOrder || 0),
        media_json: Array.isArray(row.media) ? row.media : [],
        created_by: Number(row.createdBy || 0) || null,
        creator_role: String(row.creatorRole || ''),
        template_scope: String(row.templateScope || (row.platformTemplate ? 'platform' : 'tenant') || 'tenant'),
        source_template_id: Number(row.sourceTemplateId || 0) || null,
        platform_template:
          Boolean(row.platformTemplate) || Number(row.sourceTemplateId || 0) > 0 || String(row.creatorRole || '') === 'platform_admin',
        created_at: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
        updated_at: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
        is_deleted: false,
      }))
    );

    incrementalSyncStats.p_learning_materials = await syncTableByPrimaryKeys(
      client,
      'p_learning_materials',
      ['id'],
      [
        'id',
        'tenant_id',
        'title',
        'material_type',
        'category',
        'difficulty',
        'status',
        'cover_url',
        'content_url',
        'media_json',
        'reward_points',
        'sort_order',
        'created_by',
        'creator_role',
        'template_scope',
        'source_template_id',
        'platform_template',
        'created_at',
        'updated_at',
        'is_deleted',
      ],
      ensureArray(state.learningCourses).map((row, idx) => ({
        id: Number(row.id),
        tenant_id: Number(row.tenantId || 1),
        title: row.title || '',
        material_type: row.type || row.contentType || 'article',
        category: row.category || null,
        difficulty: null,
        status: (() => {
          const s = String(row.status || '').toLowerCase();
          if (['published', 'active', 'online', 'ongoing', 'on', '进行中', '生效'].includes(s)) return 'published';
          if (['offline', 'inactive', 'off', '下线'].includes(s)) return 'offline';
          return 'draft';
        })(),
        cover_url: row.coverUrl || row.image || null,
        content_url: row.content || row.desc || null,
        media_json: mergeVideoChannelMetaIntoMedia(
          Array.isArray(row.media) ? row.media : [],
          row.videoChannelMeta,
        ),
        reward_points: Number(row.rewardPoints || row.points || 0),
        sort_order: idx,
        created_by: Number(row.createdBy || 0) || null,
        creator_role: String(row.creatorRole || ''),
        template_scope: String(row.templateScope || (row.platformTemplate ? 'platform' : 'tenant') || 'tenant'),
        source_template_id: Number(row.sourceTemplateId || 0) || null,
        platform_template:
          Boolean(row.platformTemplate) || Number(row.sourceTemplateId || 0) > 0 || String(row.creatorRole || '') === 'platform_admin',
        created_at: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
        updated_at: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
        is_deleted: false,
      }))
    );
    const validMaterialIds = new Set(
      ensureArray(state.learningCourses)
        .map((row) => toFiniteNumber(row.id, null))
        .filter((id) => Number(id) > 0)
    );

    await truncateAndInsert(
      client,
      'c_policies',
      [
        'id',
        'tenant_id',
        'customer_id',
        'family_member_id',
        'company',
        'policy_name',
        'policy_no',
        'policy_type',
        'amount',
        'annual_premium',
        'period_start',
        'period_end',
        'status',
        'applicant',
        'applicant_relation',
        'insured',
        'insured_relation',
        'analysis_json',
        'created_by',
        'created_at',
        'updated_at',
        'is_deleted',
      ],
      ensureArray(state.policies)
        .map((row) => ({
        id: Number(row.id),
        tenant_id: Number(row.tenantId || 1) || 1,
        customer_id: Number(row.customerId || row.createdBy || 0) || null,
        family_member_id: null,
        company: row.company || '',
        policy_name: row.name || '',
        policy_no: row.policyNo || null,
        policy_type: row.type || null,
        amount: Number(row.amount || 0),
        annual_premium: Number(row.annualPremium || 0),
        period_start: row.periodStart || null,
        period_end: row.periodEnd === '终身' ? null : row.periodEnd || null,
        status: row.status === '保障中' ? 'active' : row.status || 'active',
        applicant: row.applicant || null,
        applicant_relation: row.applicantRelation || null,
        insured: row.insured || null,
        insured_relation: row.insuredRelation || null,
        analysis_json: sanitizeStoredPolicyAnalysis(row.analysis),
        created_by: Number(row.createdBy || 0) || null,
        created_at: row.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_deleted: false,
      }))
        .filter((row) => Number(row.customer_id || 0) > 0)
    );

    incrementalSyncStats.c_point_transactions = await syncTableByPrimaryKeys(
      client,
      'c_point_transactions',
      ['id'],
      ['id', 'tenant_id', 'customer_id', 'direction', 'amount', 'source_type', 'source_id', 'idempotency_key', 'balance_after', 'created_by', 'created_at', 'updated_at', 'is_deleted'],
      ensureArray(state.pointTransactions)
        .map((row, idx) => ({
          id: toFiniteNumber(row.id, idx + 1),
          tenant_id: toFiniteNumber(row.tenantId, 1),
          customer_id: toFiniteNumber(row.userId, null),
          direction: row.type === 'consume' ? 'out' : 'in',
          amount: Math.abs(toFiniteNumber(row.amount, 0)),
          source_type: row.source || '',
          source_id: row.sourceId || '',
          idempotency_key: row.idempotencyKey || `tx-${idx + 1}`,
          balance_after: toFiniteNumber(row.balance, 0),
          created_by: toFiniteNumber(row.userId, null),
          created_at: row.createdAt || new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_deleted: false,
        }))
        .filter((row) => row.customer_id !== null && validCustomerIds.has(row.customer_id) && Number(row.amount || 0) > 0)
        .map((row, idx) => ({
          ...row,
          id: toFiniteNumber(row.id, idx + 1),
        }))
    );

    await truncateAndInsert(
      client,
      'p_sms_codes',
      ['id', 'mobile', 'code', 'tenant_id', 'expires_at', 'used', 'created_at'],
      ensureArray(state.smsCodes).map((row, idx) => ({
        id: toFiniteNumber(row.id, idx + 1),
        mobile: row.mobile,
        code: row.code,
        tenant_id: toFiniteNumber(row.tenantId, null),
        expires_at: row.expiresAt || new Date().toISOString(),
        used: Boolean(row.used),
        created_at: row.createdAt || new Date().toISOString(),
      }))
    );

    const sessionRowsSource = ensureArray(state.sessions).map((row) => ({
      token: row.token,
      customer_id: row.userId === null || row.userId === undefined ? null : toFiniteNumber(row.userId, null),
      actor_type: row.actorType ? String(row.actorType) : null,
      actor_id: toFiniteNumber(row.actorId, null),
      tenant_id: toFiniteNumber(row.tenantId, null),
      org_id: toFiniteNumber(row.orgId, null),
      team_id: toFiniteNumber(row.teamId, null),
      csrf_token: row.csrfToken ? String(row.csrfToken) : null,
      expires_at: row.expiresAt || new Date().toISOString(),
      created_at: row.createdAt || new Date().toISOString(),
    }));
    const sessionRows = sessionRowsSource.filter((row) => {
      if (row.customer_id === null) return true;
      return validCustomerIds.has(row.customer_id);
    });
    fkDropStats.sessions = Math.max(0, sessionRowsSource.length - sessionRows.length);
    incrementalSyncStats.p_sessions = await syncTableByPrimaryKeys(
      client,
      'p_sessions',
      ['token'],
      ['token', 'customer_id', 'actor_type', 'actor_id', 'tenant_id', 'org_id', 'team_id', 'csrf_token', 'expires_at', 'created_at'],
      sessionRows
    );

    const orderRowsSource = ensureArray(state.orders).map((row, idx) => ({
      id: toFiniteNumber(row.id, idx + 1),
      tenant_id: toFiniteNumber(row.tenantId, 1),
      customer_id: toFiniteNumber(row.customerId, null),
      product_id: toFiniteNumber(row.productId, null),
      product_name: row.productName || '',
      quantity: toFiniteNumber(row.quantity, 1),
      points_amount: toFiniteNumber(row.pointsAmount, 0),
      status: row.status || 'created',
      payment_status: row.paymentStatus || 'pending',
      fulfillment_status: row.fulfillmentStatus || 'pending',
      refund_status: row.refundStatus || 'none',
      order_no: row.orderNo || '',
      created_at: row.createdAt || new Date().toISOString(),
      updated_at: row.updatedAt || new Date().toISOString(),
    }));
    const orderRows = orderRowsSource.filter(
      (row) => row.customer_id !== null && validCustomerIds.has(row.customer_id) && row.product_id !== null && validProductIds.has(row.product_id)
    );
    fkDropStats.orders = Math.max(0, orderRowsSource.length - orderRows.length);
    incrementalSyncStats.p_orders = await syncTableByPrimaryKeys(
      client,
      'p_orders',
      ['id'],
      ['id', 'tenant_id', 'customer_id', 'product_id', 'product_name', 'quantity', 'points_amount', 'status', 'payment_status', 'fulfillment_status', 'refund_status', 'order_no', 'created_at', 'updated_at'],
      orderRows
    );

    const redemptionRowsSource = ensureArray(state.redemptions).map((row, idx) => ({
      id: toFiniteNumber(row.id, idx + 1),
      tenant_id: 1,
      customer_id: toFiniteNumber(row.userId, null),
      product_id: toFiniteNumber(row.itemId, null),
      points_cost: Math.max(1, toFiniteNumber(row.pointsCost, 0)),
      writeoff_token: row.writeoffToken || `EX-${idx + 1}`,
      status: row.status || 'pending',
      expires_at: row.expiresAt || null,
      written_off_at: row.writtenOffAt || null,
      created_by: toFiniteNumber(row.userId, null),
      created_at: row.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_deleted: false,
    }));
    const redemptionRows = redemptionRowsSource.filter(
      (row) => row.customer_id !== null && validCustomerIds.has(row.customer_id) && row.product_id !== null && validProductIds.has(row.product_id)
    );
    fkDropStats.redemptions = Math.max(0, redemptionRowsSource.length - redemptionRows.length);
    incrementalSyncStats.c_redeem_records = await syncTableByPrimaryKeys(
      client,
      'c_redeem_records',
      ['id'],
      ['id', 'tenant_id', 'customer_id', 'product_id', 'points_cost', 'writeoff_token', 'status', 'expires_at', 'written_off_at', 'created_by', 'created_at', 'updated_at', 'is_deleted'],
      redemptionRows
    );

    const existingSignInIdRows = await client.query(`SELECT id, tenant_id, customer_id, sign_date FROM c_sign_ins`);
    const existingSignInIdByBizKey = new Map(
      existingSignInIdRows.rows.map((row) => [
        `${toFiniteNumber(row.tenant_id, 1)}::${toFiniteNumber(row.customer_id, 0)}::${String(row.sign_date || '')}`,
        toFiniteNumber(row.id, 0),
      ])
    );
    const signInRowsSource = ensureArray(state.signIns).map((row, idx) => {
      const tenantId = toFiniteNumber(row.tenantId, 1);
      const customerId = toFiniteNumber(row.userId ?? row.customerId, null);
      const signDate = row.signDate || dateOnly();
      const bizKey = `${tenantId}::${toFiniteNumber(customerId, 0)}::${String(signDate)}`;
      const existingId = existingSignInIdByBizKey.get(bizKey);
      return {
        id: existingId > 0 ? existingId : toFiniteNumber(row.id, idx + 1),
        tenant_id: tenantId,
        customer_id: customerId,
        sign_date: signDate,
        created_at: row.createdAt || new Date().toISOString(),
      };
    });
    const signInRowsUnique = dedupeRowsByCompositeKey(
      signInRowsSource,
      (row) => `${row.tenant_id}::${row.customer_id}::${row.sign_date}`
    );
    const signInRows = signInRowsUnique.filter((row) => row.customer_id !== null && validCustomerIds.has(row.customer_id));
    fkDropStats.signIns = Math.max(0, signInRowsSource.length - signInRows.length);
    incrementalSyncStats.c_sign_ins = await syncTableByPrimaryKeys(
      client,
      'c_sign_ins',
      ['id'],
      ['id', 'tenant_id', 'customer_id', 'sign_date', 'created_at'],
      signInRows
    );

    const activityCompletionRowsSource = ensureArray(state.activityCompletions).map((row, idx) => ({
      id: toFiniteNumber(row.id, idx + 1),
      tenant_id: toFiniteNumber(row.tenantId, 1),
      customer_id: toFiniteNumber(row.userId, null),
      activity_id: toFiniteNumber(row.activityId, null),
      completed_at: row.completedAt || row.createdAt || new Date().toISOString(),
      writeoff_token: row.writeoffToken || null,
      written_off_at: row.writtenOffAt || null,
    }));
    const activityCompletionRows = activityCompletionRowsSource.filter(
      (row) => row.customer_id !== null && validCustomerIds.has(row.customer_id) && row.activity_id !== null && validActivityIds.has(row.activity_id)
    );
    fkDropStats.activityCompletions = Math.max(0, activityCompletionRowsSource.length - activityCompletionRows.length);
    incrementalSyncStats.c_activity_completions = await syncTableByPrimaryKeys(
      client,
      'c_activity_completions',
      ['id'],
      ['id', 'tenant_id', 'customer_id', 'activity_id', 'completed_at', 'writeoff_token', 'written_off_at'],
      activityCompletionRows
    );

    const learningRowsSource = ensureArray(state.courseCompletions).map((row, idx) => ({
      id: toFiniteNumber(row.id, idx + 1),
      tenant_id: 1,
      customer_id: toFiniteNumber(row.userId, null),
      material_id: toFiniteNumber(row.courseId, null),
      title: ensureArray(state.learningCourses).find((c) => Number(c.id) === Number(row.courseId))?.title || '学习记录',
      material_type: ensureArray(state.learningCourses).find((c) => Number(c.id) === Number(row.courseId))?.type || 'article',
      progress: 100,
      points_awarded: toFiniteNumber(row.pointsAwarded, 0),
      completed_at: row.createdAt || new Date().toISOString(),
      created_by: toFiniteNumber(row.userId, null),
      created_at: row.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_deleted: false,
    }));
    const learningRows = learningRowsSource.filter(
      (row) => row.customer_id !== null && validCustomerIds.has(row.customer_id) && row.material_id !== null && validMaterialIds.has(row.material_id)
    );
    fkDropStats.learningRecords = Math.max(0, learningRowsSource.length - learningRows.length);
    incrementalSyncStats.c_learning_records = await syncTableByPrimaryKeys(
      client,
      'c_learning_records',
      ['id'],
      ['id', 'tenant_id', 'customer_id', 'material_id', 'title', 'material_type', 'progress', 'points_awarded', 'completed_at', 'created_by', 'created_at', 'updated_at', 'is_deleted'],
      learningRows
    );

    await truncateAndInsert(
      client,
      'c_policy_responsibilities',
      ['id', 'tenant_id', 'policy_id', 'name', 'description', 'limit_amount', 'sort_order'],
      responsibilitiesRows
    );

    await truncateAndInsert(
      client,
      'c_policy_payment_history',
      ['id', 'tenant_id', 'policy_id', 'payment_date', 'amount', 'note', 'status', 'sort_order'],
      paymentHistoryRows
    );

    await truncateAndInsert(
      client,
      'p_order_payments',
      ['id', 'tenant_id', 'order_id', 'payment_method', 'payment_status', 'amount', 'created_at'],
      ensureArray(state.orderPayments)
        .map((row, idx) => ({
          id: toFiniteNumber(row.id, idx + 1),
          tenant_id: toFiniteNumber(row.tenantId, 1),
          order_id: toFiniteNumber(row.orderId, null),
          payment_method: row.paymentMethod || 'points',
          payment_status: row.paymentStatus || 'paid',
          amount: toFiniteNumber(row.amount, 0),
          created_at: row.createdAt || new Date().toISOString(),
        }))
        .filter((row) => row.order_id !== null)
    );

    await truncateAndInsert(
      client,
      'p_order_fulfillments',
      ['id', 'tenant_id', 'order_id', 'mode', 'operator_agent_id', 'created_at'],
      ensureArray(state.orderFulfillments)
        .map((row, idx) => ({
          id: toFiniteNumber(row.id, idx + 1),
          tenant_id: toFiniteNumber(row.tenantId, 1),
          order_id: toFiniteNumber(row.orderId, null),
          mode: row.mode || 'writeoff',
          operator_agent_id: toFiniteNumber(row.operatorAgentId, 0),
          created_at: row.createdAt || new Date().toISOString(),
        }))
        .filter((row) => row.order_id !== null)
    );

    await truncateAndInsert(
      client,
      'p_order_refunds',
      ['id', 'tenant_id', 'order_id', 'refund_type', 'status', 'reason', 'created_at'],
      ensureArray(state.orderRefunds)
        .map((row, idx) => ({
          id: toFiniteNumber(row.id, idx + 1),
          tenant_id: toFiniteNumber(row.tenantId, 1),
          order_id: toFiniteNumber(row.orderId, null),
          refund_type: row.refundType || 'manual',
          status: row.status || 'success',
          reason: row.reason || '',
          created_at: row.createdAt || new Date().toISOString(),
        }))
        .filter((row) => row.order_id !== null)
    );

    const validAgentIds = new Set(ensureArray(state.agents).map((x) => toFiniteNumber(x.id, 0)).filter((x) => x > 0));
    const fallbackAgentByTenant = new Map();
    ensureArray(state.agents).forEach((x) => {
      const tid = toFiniteNumber(x.tenantId, 1);
      const aid = toFiniteNumber(x.id, 0);
      if (aid > 0 && !fallbackAgentByTenant.has(tid)) fallbackAgentByTenant.set(tid, aid);
    });

    await truncateAndInsert(
      client,
      'b_write_off_records',
      ['id', 'tenant_id', 'redeem_record_id', 'operator_agent_id', 'writeoff_token', 'status', 'reason', 'created_by', 'created_at', 'updated_at', 'is_deleted'],
      ensureArray(state.bWriteOffRecords)
        .map((row, idx) => {
          const tenantId = toFiniteNumber(row.tenantId, 1);
          const rawOperator = toFiniteNumber(row.operatorAgentId, 0);
          const fallbackOperator = fallbackAgentByTenant.get(tenantId) || [...validAgentIds][0] || null;
          const operatorAgentId = validAgentIds.has(rawOperator) ? rawOperator : fallbackOperator;
          return {
            id: toFiniteNumber(row.id, idx + 1),
            tenant_id: tenantId,
            redeem_record_id: toFiniteNumber(row.redeemRecordId, null),
            operator_agent_id: operatorAgentId,
            writeoff_token: row.writeoffToken || '',
            status: row.status || 'success',
            reason: row.reason || null,
            created_by: operatorAgentId,
            created_at: row.createdAt || new Date().toISOString(),
            updated_at: new Date().toISOString(),
            is_deleted: false,
          };
        })
        .filter((row) => row.redeem_record_id !== null && row.operator_agent_id !== null)
    );

    await truncateAndInsert(
      client,
      'p_idempotency_records',
      ['id', 'tenant_id', 'biz_type', 'biz_key', 'response', 'created_at'],
      ensureArray(state.idempotencyRecords).map((row, idx) => ({
        id: toFiniteNumber(row.id, idx + 1),
        tenant_id: toFiniteNumber(row.tenantId, 1),
        biz_type: row.bizType,
        biz_key: row.bizKey,
        response: row.response || null,
        created_at: row.createdAt || new Date().toISOString(),
      }))
    );

    incrementalSyncStats.p_track_events = await syncTableByPrimaryKeys(
      client,
      'p_track_events',
      ['id'],
      ['id', 'tenant_id', 'actor_type', 'actor_id', 'org_id', 'team_id', 'event_name', 'properties', 'path', 'source', 'user_agent', 'created_at'],
      ensureArray(state.trackEvents).map((row) => ({
        id: Number(row.id),
        tenant_id: Number(row.tenantId || 1),
        actor_type: String(row.actorType || 'anonymous'),
        actor_id: Number(row.actorId || 0),
        org_id: Number(row.orgId || 1),
        team_id: Number(row.teamId || 1),
        event_name: String(row.event || ''),
        properties: row.properties || {},
        path: row.path || null,
        source: row.source || null,
        user_agent: row.userAgent || null,
        created_at: row.createdAt || new Date().toISOString(),
      }))
    );

    incrementalSyncStats.p_audit_logs = await syncTableByPrimaryKeys(
      client,
      'p_audit_logs',
      ['id'],
      ['id', 'tenant_id', 'actor_type', 'actor_id', 'action', 'result', 'resource_type', 'resource_id', 'meta', 'created_at'],
      ensureArray(state.auditLogs).map((row, idx) => ({
        id: toFiniteNumber(row.id, idx + 1),
        tenant_id: toFiniteNumber(row.tenantId, 1),
        actor_type: row.actorType ? String(row.actorType) : null,
        actor_id: toFiniteNumber(row.actorId, null),
        action: String(row.action || 'unknown'),
        result: row.result ? String(row.result) : null,
        resource_type: row.resourceType ? String(row.resourceType) : null,
        resource_id: row.resourceId ? String(row.resourceId) : null,
        meta: row.meta || null,
        created_at: row.createdAt || new Date().toISOString(),
      }))
    );

    incrementalSyncStats.p_metric_uv_daily = await syncTableByPrimaryKeys(
      client,
      'p_metric_uv_daily',
      ['id'],
      ['id', 'tenant_id', 'stat_date', 'metric_key', 'actor_id', 'created_at'],
      ensureArray(state.metricDailyUv)
        .map((row, idx) => ({
          id: toFiniteNumber(row.id, idx + 1),
          tenant_id: toFiniteNumber(row.tenantId, 1),
          stat_date: row.statDate || dateOnly(),
          metric_key: String(row.metricKey || ''),
          actor_id: toFiniteNumber(row.actorId, 0),
          created_at: row.createdAt || new Date().toISOString(),
        }))
        .filter((row) => row.metric_key && row.actor_id > 0)
    );

    incrementalSyncStats.p_metric_counter_daily = await syncTableByPrimaryKeys(
      client,
      'p_metric_counter_daily',
      ['id'],
      ['id', 'tenant_id', 'stat_date', 'metric_key', 'actor_id', 'cnt', 'updated_at'],
      ensureArray(state.metricDailyCounters)
        .map((row, idx) => ({
          id: toFiniteNumber(row.id, idx + 1),
          tenant_id: toFiniteNumber(row.tenantId, 1),
          stat_date: row.statDate || dateOnly(),
          metric_key: String(row.metricKey || ''),
          actor_id: toFiniteNumber(row.actorId, 0),
          cnt: toFiniteNumber(row.cnt, 0),
          updated_at: row.updatedAt || new Date().toISOString(),
        }))
        .filter((row) => row.metric_key)
    );

    incrementalSyncStats.p_metric_counter_hourly = await syncTableByPrimaryKeys(
      client,
      'p_metric_counter_hourly',
      ['id'],
      ['id', 'tenant_id', 'hour_key', 'metric_key', 'actor_id', 'cnt', 'updated_at'],
      ensureArray(state.metricHourlyCounters)
        .map((row, idx) => ({
          id: toFiniteNumber(row.id, idx + 1),
          tenant_id: toFiniteNumber(row.tenantId, 1),
          hour_key: String(row.hourKey || ''),
          metric_key: String(row.metricKey || ''),
          actor_id: toFiniteNumber(row.actorId, 0),
          cnt: toFiniteNumber(row.cnt, 0),
          updated_at: row.updatedAt || new Date().toISOString(),
        }))
        .filter((row) => row.metric_key && row.hour_key)
    );

    incrementalSyncStats.p_event_definitions = await syncTableByPrimaryKeys(
      client,
      'p_event_definitions',
      ['id'],
      [
        'id',
        'tenant_id',
        'event_id',
        'event_name',
        'event_type',
        'description',
        'collect_method',
        'status',
        'schema_json',
        'definition_version',
        'created_by',
        'created_at',
        'updated_at',
      ],
      ensureArray(state.eventDefinitions).map((row, idx) => ({
        id: toFiniteNumber(row.id, idx + 1),
        tenant_id: toFiniteNumber(row.tenantId, 1),
        event_id: toFiniteNumber(row.eventId, idx + 1),
        event_name: String(row.eventName || ''),
        event_type: String(row.eventType || 'custom'),
        description: row.description ? String(row.description) : null,
        collect_method: String(row.collectMethod || 'frontend'),
        status: String(row.status || 'enabled'),
        schema_json: row.schema || {},
        definition_version: Math.max(1, toFiniteNumber(row.definitionVersion, 1)),
        created_by: toFiniteNumber(row.createdBy, null),
        created_at: row.createdAt || new Date().toISOString(),
        updated_at: row.updatedAt || new Date().toISOString(),
      }))
    );

    incrementalSyncStats.p_metric_rules = await syncTableByPrimaryKeys(
      client,
      'p_metric_rules',
      ['id'],
      [
        'id',
        'tenant_id',
        'metric_name',
        'metric_end',
        'formula',
        'stat_period',
        'data_source',
        'status',
        'threshold',
        'remark',
        'rule_version',
        'created_by',
        'created_at',
        'updated_at',
      ],
      ensureArray(state.metricRules).map((row, idx) => ({
        id: toFiniteNumber(row.id, idx + 1),
        tenant_id: toFiniteNumber(row.tenantId, 1),
        metric_name: String(row.name || ''),
        metric_end: String(row.end || 'c'),
        formula: String(row.formula || ''),
        stat_period: String(row.period || '每日'),
        data_source: String(row.source || ''),
        status: String(row.status || 'enabled'),
        threshold: row.threshold ? String(row.threshold) : null,
        remark: row.remark ? String(row.remark) : null,
        rule_version: Math.max(1, toFiniteNumber(row.ruleVersion, 1)),
        created_by: toFiniteNumber(row.createdBy, null),
        created_at: row.createdAt || new Date().toISOString(),
        updated_at: row.updatedAt || new Date().toISOString(),
      }))
    );

    incrementalSyncStats.p_points_rule_configs = await syncTableByPrimaryKeys(
      client,
      'p_points_rule_configs',
      ['id'],
      ['id', 'tenant_id', 'sign_in_points', 'new_customer_verify_points', 'customer_share_identify_points', 'created_by', 'created_at', 'updated_at'],
      ensureArray(state.pointsRuleConfigs).map((row, idx) => ({
        id: toFiniteNumber(row.id, idx + 1),
        tenant_id: toFiniteNumber(row.tenantId, 1),
        sign_in_points: Math.max(0, toFiniteNumber(row.signInPoints, DEFAULT_POINTS_RULE_CONFIG.signInPoints)),
        new_customer_verify_points: Math.max(
          0,
          toFiniteNumber(row.newCustomerVerifyPoints, DEFAULT_POINTS_RULE_CONFIG.newCustomerVerifyPoints)
        ),
        customer_share_identify_points: Math.max(
          0,
          toFiniteNumber(row.customerShareIdentifyPoints, DEFAULT_POINTS_RULE_CONFIG.customerShareIdentifyPoints)
        ),
        created_by: toFiniteNumber(row.createdBy, null),
        created_at: row.createdAt || new Date().toISOString(),
        updated_at: row.updatedAt || new Date().toISOString(),
      }))
    );

    incrementalSyncStats.p_ops_jobs = await syncTableByPrimaryKeys(
      client,
      'p_ops_jobs',
      ['id'],
      [
        'id',
        'tenant_id',
        'job_type',
        'payload_json',
        'status',
        'attempts',
        'max_attempts',
        'next_run_at',
        'error_text',
        'result_json',
        'created_by',
        'created_at',
        'updated_at',
        'started_at',
        'completed_at',
      ],
      ensureArray(state.pOpsJobs).map((row, idx) => ({
        id: toFiniteNumber(row.id, idx + 1),
        tenant_id: toFiniteNumber(row.tenantId, 1),
        job_type: String(row.jobType || ''),
        payload_json: row.payload || {},
        status: String(row.status || 'queued'),
        attempts: toFiniteNumber(row.attempts, 0),
        max_attempts: Math.max(1, toFiniteNumber(row.maxAttempts, 3)),
        next_run_at: row.nextRunAt || null,
        error_text: row.error ? String(row.error) : null,
        result_json: row.result || null,
        created_by: toFiniteNumber(row.createdBy, null),
        created_at: row.createdAt || new Date().toISOString(),
        updated_at: row.updatedAt || new Date().toISOString(),
        started_at: row.startedAt || null,
        completed_at: row.completedAt || null,
      }))
    );

    incrementalSyncStats.p_ops_job_logs = await syncTableByPrimaryKeys(
      client,
      'p_ops_job_logs',
      ['id'],
      ['id', 'tenant_id', 'job_id', 'level', 'message', 'detail_json', 'created_at'],
      ensureArray(state.pOpsJobLogs)
        .map((row, idx) => ({
          id: toFiniteNumber(row.id, idx + 1),
          tenant_id: toFiniteNumber(row.tenantId, 1),
          job_id: toFiniteNumber(row.jobId, null),
          level: String(row.level || 'info'),
          message: String(row.message || ''),
          detail_json: row.detail || null,
          created_at: row.createdAt || new Date().toISOString(),
        }))
        .filter((row) => row.job_id !== null)
    );

    incrementalSyncStats.c_family_policy_reports = await syncTableByPrimaryKeys(
      client,
      'c_family_policy_reports',
      ['id'],
      [
        'id',
        'tenant_id',
        'customer_id',
        'scope_key',
        'report_version',
        'fingerprint',
        'policy_count',
        'member_count',
        'report_markdown',
        'sanitized_input_json',
        'meta_json',
        'generated_at',
        'created_at',
        'updated_at',
        'is_deleted',
      ],
      ensureArray(state.familyPolicyReports).map((row, idx) => ({
        id: toFiniteNumber(row.id, idx + 1),
        tenant_id: toFiniteNumber(row.tenantId, 1),
        customer_id: toFiniteNumber(row.customerId, null),
        scope_key: String(row.scopeKey || 'customer_family'),
        report_version: String(row.reportVersion || ''),
        fingerprint: String(row.fingerprint || ''),
        policy_count: Math.max(0, toFiniteNumber(row.policyCount, 0)),
        member_count: Math.max(0, toFiniteNumber(row.memberCount, 0)),
        report_markdown: String(row.reportMarkdown || ''),
        sanitized_input_json: row.sanitizedInput || {},
        meta_json: row.meta || {},
        generated_at: row.generatedAt || new Date().toISOString(),
        created_at: row.createdAt || new Date().toISOString(),
        updated_at: row.updatedAt || new Date().toISOString(),
        is_deleted: false,
      })).filter((row) => row.customer_id !== null && row.report_markdown.trim().length > 0)
    );

    await client.query('COMMIT');
    writePersistSyncStatsSnapshot({
      generatedAt: new Date().toISOString(),
      backend: 'postgres',
      fkDropStats,
      incrementalSyncStats,
    });
    if (Object.values(fkDropStats).some((n) => Number(n) > 0)) {
      // eslint-disable-next-line no-console
      console.warn('[state] foreign-key orphan rows dropped on persist:', JSON.stringify(fkDropStats));
    }
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
