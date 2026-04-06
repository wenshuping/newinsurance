#!/usr/bin/env tsx

import fs from 'node:fs';
import path from 'node:path';

type ReqOptions = {
  method?: string;
  token?: string;
  csrfToken?: string;
  body?: unknown;
};

type ReqResult = {
  ok: boolean;
  status: number;
  data: any;
};

type Check = {
  name: string;
  ok: boolean;
  status?: number;
  count?: number;
  skipped?: boolean;
  reason?: string;
};

const BASE = String(process.env.API_BASE_URL || process.env.API_BASE || 'http://127.0.0.1:4000').replace(/\/+$/, '');
const WORKDIR = process.cwd();
const DB_JSON = path.join(WORKDIR, 'server/data/db.json');

function fail(message: string, context?: unknown): never {
  const err = new Error(message) as Error & { context?: unknown };
  err.context = context;
  throw err;
}

async function request(pathname: string, options: ReqOptions = {}): Promise<ReqResult> {
  const method = String(options.method || 'GET').toUpperCase();
  const headers: Record<string, string> = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...(options.csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) ? { 'x-csrf-token': options.csrfToken } : {}),
  };
  const res = await fetch(`${BASE}${pathname}`, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data };
}

function resolveTenantId() {
  const envTenantId = Number(process.env.C_SMOKE_TENANT_ID || 0);
  if (Number.isFinite(envTenantId) && envTenantId > 0) return envTenantId;
  try {
    if (!fs.existsSync(DB_JSON)) return 1;
    const db = JSON.parse(fs.readFileSync(DB_JSON, 'utf8'));
    const tenant = Array.isArray(db?.tenants) ? db.tenants.find((x: any) => Number(x?.id) > 0) : null;
    return Number(tenant?.id || 1);
  } catch {
    return 1;
  }
}

function genMobile() {
  return `139${String(Date.now()).slice(-8)}`;
}

async function loginC() {
  const mobile = process.env.C_SMOKE_MOBILE || genMobile();
  const code = process.env.DEV_SMS_CODE || '123456';
  const tenantId = resolveTenantId();
  const sendRes = await request('/api/auth/send-code', { method: 'POST', body: { mobile } });
  if (!sendRes.ok) fail('C send-code failed', sendRes);
  const loginRes = await request('/api/auth/verify-basic', {
    method: 'POST',
    body: { name: '张三', mobile, code, tenantId },
  });
  if (!loginRes.ok) fail('C verify-basic failed', loginRes);
  const token = String(loginRes.data?.token || '');
  if (!token) fail('C token missing', loginRes.data);
  return { token, tenantId, mobile };
}

function readBCandidates() {
  const out: Array<{ account: string; password: string }> = [];
  const envAccount = String(process.env.B_ADMIN_ACCOUNT || '').trim();
  const envPassword = String(process.env.B_ADMIN_PASSWORD || '').trim();
  if (envAccount && envPassword) out.push({ account: envAccount, password: envPassword });
  out.push({ account: 'fangyuqing@126.com', password: '123456' });
  out.push({ account: 'agent001@demo.local', password: '123456' });
  try {
    if (fs.existsSync(DB_JSON)) {
      const db = JSON.parse(fs.readFileSync(DB_JSON, 'utf8'));
      for (const a of Array.isArray(db?.agents) ? db.agents : []) {
        const account = String(a?.email || a?.account || '').trim();
        const password = String(a?.password || a?.initialPassword || '').trim();
        if (account && password) out.push({ account, password });
      }
    }
  } catch {
    // ignore
  }
  const seen = new Set<string>();
  return out.filter((x) => {
    const k = `${x.account}::${x.password}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

async function loginB() {
  for (const c of readBCandidates()) {
    const res = await request('/api/b/auth/login', { method: 'POST', body: c });
    if (!res.ok) continue;
    const token = String(res.data?.session?.token || '');
    if (!token) continue;
    return { token, account: c.account };
  }
  fail('B login failed', { candidates: readBCandidates().map((x) => x.account) });
}

async function loginP() {
  const account = String(process.env.P_ADMIN_ACCOUNT || 'platform001');
  const password = String(process.env.P_ADMIN_PASSWORD || '123456');
  const res = await request('/api/p/auth/login', { method: 'POST', body: { account, password } });
  if (!res.ok) fail('P login failed', res);
  const token = String(res.data?.session?.token || '');
  if (!token) fail('P token missing', res.data);
  return { token, account };
}

async function loadStatusContracts() {
  const mod = await import('../../../shared-contracts/template-status.ts');
  const ns = ((mod as any).default ?? (mod as any)['module.exports'] ?? mod) as {
    toRunningStatus: (value: unknown) => 'active' | 'draft' | 'inactive';
    runningStatusLabel: (value: unknown) => string;
    toOnlineStatus: (value: unknown) => 'online' | 'draft' | 'offline';
    onlineStatusLabel: (value: unknown) => string;
    normalizeContentStatus: (value: unknown) => 'published' | 'draft' | 'inactive';
    toContentStatusLabel: (value: unknown) => string;
  };
  return ns;
}

function assertRunningSet(value: string) {
  return value === 'active' || value === 'draft' || value === 'inactive';
}

function assertOnlineSet(value: string) {
  return value === 'online' || value === 'draft' || value === 'offline';
}

async function main() {
  const checks: Check[] = [];
  const c = await loginC();
  const b = await loginB();
  const p = await loginP();
  const contracts = await loadStatusContracts();

  const cActivities = await request('/api/activities', { token: c.token });
  if (!cActivities.ok) fail('C activities fetch failed', cActivities);
  const cList = Array.isArray(cActivities.data?.activities) ? cActivities.data.activities : [];
  for (const row of cList.slice(0, 50)) {
    const normalized = contracts.toRunningStatus(String(row?.status || ''));
    if (!assertRunningSet(normalized)) fail('C running status out of set', { raw: row?.status, normalized });
    const label = contracts.runningStatusLabel(String(row?.status || ''));
    if (!label) fail('C running status label empty', { raw: row?.status });
  }
  checks.push({ name: 'c_activity_running_status_contract', ok: true, status: cActivities.status, count: cList.length });

  const bContent = await request('/api/b/content/items', { token: b.token });
  if (!bContent.ok) fail('B content fetch failed', bContent);
  const bContentList = Array.isArray(bContent.data?.list) ? bContent.data.list : [];
  for (const row of bContentList.slice(0, 50)) {
    const normalized = contracts.normalizeContentStatus(String(row?.status || ''));
    if (!(normalized === 'published' || normalized === 'draft' || normalized === 'inactive')) {
      fail('B content status out of set', { raw: row?.status, normalized });
    }
    const label = contracts.toContentStatusLabel(String(row?.status || ''));
    if (!label) fail('B content status label empty', { raw: row?.status });
  }
  checks.push({ name: 'b_content_status_contract', ok: true, status: bContent.status, count: bContentList.length });

  const bActivities = await request('/api/b/activity-configs', { token: b.token });
  if (!bActivities.ok) fail('B activities fetch failed', bActivities);
  const bActivityList = Array.isArray(bActivities.data?.list) ? bActivities.data.list : [];
  for (const row of bActivityList.slice(0, 50)) {
    const normalized = contracts.toRunningStatus(String(row?.status || ''));
    if (!assertRunningSet(normalized)) fail('B activity status out of set', { raw: row?.status, normalized });
  }
  checks.push({ name: 'b_activity_running_status_contract', ok: true, status: bActivities.status, count: bActivityList.length });

  const pActivities = await request('/api/p/activities', { token: p.token });
  if (!pActivities.ok) fail('P activities fetch failed', pActivities);
  const pList = Array.isArray(pActivities.data?.list) ? pActivities.data.list : [];
  for (const row of pList.slice(0, 50)) {
    const normalized = contracts.toOnlineStatus(String(row?.status || ''));
    if (!assertOnlineSet(normalized)) fail('P online status out of set', { raw: row?.status, normalized });
    const label = contracts.onlineStatusLabel(String(row?.status || ''));
    if (!label) fail('P online status label empty', { raw: row?.status });
  }
  checks.push({ name: 'p_activity_online_status_contract', ok: true, status: pActivities.status, count: pList.length });

  const rawUnion = new Set<string>();
  for (const row of cList) rawUnion.add(String(row?.status || ''));
  for (const row of bActivityList) rawUnion.add(String(row?.status || ''));
  for (const raw of rawUnion) {
    const normalized = contracts.toRunningStatus(raw);
    if (!assertRunningSet(normalized)) fail('cross running status normalize mismatch', { raw, normalized });
  }
  checks.push({ name: 'cb_running_status_cross_normalization', ok: true, count: rawUnion.size });

  console.log(
    JSON.stringify(
      {
        ok: true,
        base: BASE,
        actors: {
          cMobile: c.mobile,
          bAccount: b.account,
          pAccount: p.account,
        },
        checks,
      },
      null,
      2
    )
  );
}

main().catch((error: any) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: String(error?.message || error),
        context: error?.context || null,
      },
      null,
      2
    )
  );
  process.exit(1);
});
