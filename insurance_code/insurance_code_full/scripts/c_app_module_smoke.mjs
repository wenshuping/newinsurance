#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const BASE = String(process.env.API_BASE_URL || process.env.API_BASE || 'http://127.0.0.1:4000').replace(/\/+$/, '');
const WORKDIR = process.cwd();
const DB_JSON = path.join(WORKDIR, 'server/data/db.json');

function fail(message, context) {
  const err = new Error(message);
  err.context = context;
  throw err;
}

async function request(pathname, { method = 'GET', token = '', csrfToken = '', body } = {}) {
  const headers = {
    ...(body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase()) ? { 'x-csrf-token': csrfToken } : {}),
  };
  const res = await fetch(`${BASE}${pathname}`, {
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

function resolveTenantId() {
  const envTenantId = Number(process.env.C_SMOKE_TENANT_ID || 0);
  if (Number.isFinite(envTenantId) && envTenantId > 0) return envTenantId;

  try {
    if (!fs.existsSync(DB_JSON)) return 1;
    const raw = fs.readFileSync(DB_JSON, 'utf8');
    const db = JSON.parse(raw);
    const tenantList = Array.isArray(db?.tenants) ? db.tenants : [];
    const first = tenantList.find((item) => Number(item?.id) > 0);
    return Number(first?.id || 1);
  } catch {
    return 1;
  }
}

function generateMobile() {
  const suffix = String(Date.now()).slice(-8);
  return `139${suffix}`;
}

async function loginCustomer() {
  const tenantId = resolveTenantId();
  const mobile = process.env.C_SMOKE_MOBILE || generateMobile();
  const name = process.env.C_SMOKE_NAME || '张三';
  const code = process.env.DEV_SMS_CODE || '123456';

  const sendCode = await request('/api/auth/send-code', {
    method: 'POST',
    body: { mobile },
  });
  if (!sendCode.ok) fail('customer send-code failed', { mobile, sendCode });

  const login = await request('/api/auth/verify-basic', {
    method: 'POST',
    body: { name, mobile, code, tenantId },
  });
  if (!login.ok) fail('customer verify-basic failed', { name, mobile, tenantId, login });

  const token = String(login.data?.token || '');
  const csrfToken = String(login.data?.csrfToken || '');
  if (!token || !csrfToken) fail('missing customer token/csrfToken', { login: login.data });
  return { token, csrfToken, mobile, name, tenantId };
}

async function main() {
  const checks = [];
  const addCheck = (name, path, res, extra = {}) => {
    const row = { name, path, status: res.status, ok: res.ok, ...extra };
    checks.push(row);
    if (!res.ok) fail(`Smoke check failed: ${name}`, { path, response: res });
  };

  const health = await request('/api/health');
  addCheck('health', '/api/health', health);

  const bootstrapAnon = await request('/api/bootstrap');
  addCheck('bootstrap.anon', '/api/bootstrap', bootstrapAnon);

  const auth = await loginCustomer();

  const me = await request('/api/me', { token: auth.token });
  addCheck('me', '/api/me', me);

  const bootstrapAuthed = await request('/api/bootstrap', { token: auth.token });
  addCheck('bootstrap.authed', '/api/bootstrap', bootstrapAuthed);

  const activities = await request('/api/activities', { token: auth.token });
  addCheck('activities', '/api/activities', activities, {
    count: Array.isArray(activities.data?.activities) ? activities.data.activities.length : 0,
  });

  const pointsSummary = await request('/api/points/summary', { token: auth.token });
  addCheck('points.summary', '/api/points/summary', pointsSummary, {
    balance: Number(pointsSummary.data?.balance || 0),
  });

  const pointsDetail = await request('/api/points/detail', { token: auth.token });
  addCheck('points.detail', '/api/points/detail', pointsDetail);

  const mallItems = await request('/api/mall/items', { token: auth.token });
  addCheck('mall.items', '/api/mall/items', mallItems, {
    count: Array.isArray(mallItems.data?.items) ? mallItems.data.items.length : 0,
  });

  const mallActivities = await request('/api/mall/activities', { token: auth.token });
  addCheck('mall.activities', '/api/mall/activities', mallActivities, {
    count: Array.isArray(mallActivities.data?.activities) ? mallActivities.data.activities.length : 0,
  });

  const orders = await request('/api/orders', { token: auth.token });
  addCheck('orders.list', '/api/orders', orders);

  const redemptions = await request('/api/redemptions', { token: auth.token });
  addCheck('redemptions.list', '/api/redemptions', redemptions);

  const learningCourses = await request('/api/learning/courses', { token: auth.token });
  addCheck('learning.courses', '/api/learning/courses', learningCourses, {
    count: Array.isArray(learningCourses.data?.list) ? learningCourses.data.list.length : 0,
  });

  const learningGames = await request('/api/learning/games');
  addCheck('learning.games', '/api/learning/games', learningGames);

  const insuranceOverview = await request('/api/insurance/overview', { token: auth.token });
  addCheck('insurance.overview', '/api/insurance/overview', insuranceOverview);

  console.log(
    JSON.stringify(
      {
        ok: true,
        base: BASE,
        actor: auth,
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
