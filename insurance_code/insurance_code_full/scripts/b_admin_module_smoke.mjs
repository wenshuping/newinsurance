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

function readAccountsFromDbJson() {
  try {
    if (!fs.existsSync(DB_JSON)) return [];
    const raw = fs.readFileSync(DB_JSON, 'utf8');
    const db = JSON.parse(raw);
    const agents = Array.isArray(db?.agents) ? db.agents : [];
    const candidates = [];
    for (const a of agents) {
      const password = String(a?.password || a?.initialPassword || '').trim();
      const account = String(a?.email || a?.account || a?.mobile || '').trim();
      if (!account || !password) continue;
      candidates.push({ account, password, source: 'db.json' });
    }
    return candidates;
  } catch {
    return [];
  }
}

async function loginBAdmin() {
  const envAccount = String(process.env.B_ADMIN_ACCOUNT || '').trim();
  const envPassword = String(process.env.B_ADMIN_PASSWORD || '').trim();

  const candidates = [];
  if (envAccount && envPassword) candidates.push({ account: envAccount, password: envPassword, source: 'env' });
  candidates.push({ account: 'fangyuqing@126.com', password: '123456', source: 'fallback' });
  candidates.push({ account: 'agent001@demo.local', password: '123456', source: 'fallback' });
  candidates.push(...readAccountsFromDbJson());

  const seen = new Set();
  for (const c of candidates) {
    const key = `${c.account}::${c.password}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const login = await request('/api/b/auth/login', {
      method: 'POST',
      body: { account: c.account, password: c.password },
    });
    if (!login.ok) continue;
    const token = String(login.data?.session?.token || '');
    const csrfToken = String(login.data?.session?.csrfToken || '');
    if (token && csrfToken) {
      return { token, csrfToken, account: c.account, source: c.source, loginData: login.data };
    }
  }

  fail('B admin login failed for all candidates', { tried: candidates.map((x) => ({ account: x.account, source: x.source })) });
}

async function main() {
  const { token, csrfToken, account, source } = await loginBAdmin();
  const checks = [];

  const addCheck = (name, path, res, extra = {}) => {
    checks.push({ name, path, status: res.status, ok: res.ok, ...extra });
    if (!res.ok) fail(`Smoke check failed: ${name}`, { path, response: res });
  };

  const customers = await request('/api/b/customers', { token });
  addCheck('customers.list', '/api/b/customers', customers, {
    count: Array.isArray(customers.data?.list) ? customers.data.list.length : 0,
  });

  const firstCustomerId = Number(customers.data?.list?.[0]?.id || 0);
  if (firstCustomerId > 0) {
    const profile = await request(`/api/b/customers/${firstCustomerId}/profile`, { token });
    addCheck('customers.profile', `/api/b/customers/${firstCustomerId}/profile`, profile);

    const customTagName = `smoke_${Date.now()}`;
    const tag = await request(`/api/b/customers/${firstCustomerId}/tags`, {
      method: 'POST',
      token,
      csrfToken,
      body: { tag: customTagName },
    });
    addCheck('customers.add_tag', `/api/b/customers/${firstCustomerId}/tags`, tag);
  } else {
    checks.push({
      name: 'customers.profile',
      path: '/api/b/customers/:id/profile',
      ok: false,
      skipped: true,
      reason: 'no accessible customer in scope',
    });
  }

  const tagLibrary = await request('/api/b/tags/library', { token });
  addCheck('tags.library', '/api/b/tags/library', tagLibrary);

  const tagCreate = await request('/api/b/tags/custom', {
    method: 'POST',
    token,
    csrfToken,
    body: { name: `smoke_custom_${Date.now()}`.slice(0, 10) },
  });
  addCheck('tags.custom_create', '/api/b/tags/custom', tagCreate);

  const contentList = await request('/api/b/content/items', { token });
  addCheck('content.list', '/api/b/content/items', contentList);

  const activityList = await request('/api/b/activity-configs', { token });
  addCheck('activity.list', '/api/b/activity-configs', activityList);

  const mallProducts = await request('/api/b/mall/products', { token });
  addCheck('mall.products', '/api/b/mall/products', mallProducts);

  const mallActivities = await request('/api/b/mall/activities', { token });
  addCheck('mall.activities', '/api/b/mall/activities', mallActivities);

  const orders = await request('/api/b/orders', { token });
  addCheck('orders.list', '/api/b/orders', orders);

  console.log(
    JSON.stringify(
      {
        ok: true,
        base: BASE,
        actor: { account, source },
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
