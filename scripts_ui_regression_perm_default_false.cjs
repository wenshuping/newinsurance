#!/usr/bin/env node
/* eslint-disable no-console */
const { chromium } = require('playwright');

const P_BASE = process.env.P_WEB_BASE || 'http://127.0.0.1:3015';
const B_BASE = process.env.B_WEB_BASE || 'http://127.0.0.1:3002';

function uniq(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

async function loginP(page, account, password) {
  await page.goto(P_BASE, { waitUntil: 'domcontentloaded' });
  const loginTitle = page.getByText('P端管理后台登录', { exact: true }).first();
  if ((await loginTitle.count()) > 0) {
    await page.getByPlaceholder('company001').fill(account);
    await page.getByPlaceholder('123456').fill(password);
    await page.getByRole('button', { name: '登录' }).click();
  }
  await page.getByText('租户列表', { exact: true }).first().waitFor({ timeout: 20000 });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(20000);

  const checks = [];
  const artifacts = {};

  try {
    await loginP(page, process.env.P_ACCOUNT || 'platform001', process.env.P_PASSWORD || '123456');
    checks.push('P login ok');

    const tenantName = uniq('回归租户');
    const adminEmail = `${Date.now()}_mgr@test.local`;
    const adminPassword = '123456';

    const createTenantResp = await page.evaluate(async ({ tenantName, adminEmail, adminPassword }) => {
      const sessionRaw = localStorage.getItem('p_admin_session_v1');
      const s = sessionRaw ? JSON.parse(sessionRaw) : null;
      if (!s) return { ok: false, error: 'NO_SESSION_IN_BROWSER' };
      const res = await fetch('http://127.0.0.1:4000/api/p/tenants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-actor-type': String(s.actorType || 'employee'),
          'x-actor-id': String(s.actorId || ''),
          'x-tenant-id': String(s.tenantId || ''),
          'x-org-id': String(s.orgId || ''),
          'x-team-id': String(s.teamId || ''),
        },
        body: JSON.stringify({ name: tenantName, type: 'company', adminEmail, initialPassword: adminPassword }),
      });
      const data = await res.json().catch(() => ({}));
      return { status: res.status, data };
    }, { tenantName, adminEmail, adminPassword });

    if (createTenantResp.status !== 200 || !createTenantResp.data?.tenant?.id) {
      throw new Error(`create tenant failed: ${JSON.stringify(createTenantResp)}`);
    }
    const tenantId = Number(createTenantResp.data.tenant.id);
    artifacts.tenantId = tenantId;
    artifacts.adminEmail = adminEmail;
    checks.push('create tenant by browser fetch ok');

    const permResp = await page.evaluate(async ({ tenantId }) => {
      const sessionRaw = localStorage.getItem('p_admin_session_v1');
      const s = sessionRaw ? JSON.parse(sessionRaw) : null;
      if (!s) return { ok: false, error: 'NO_SESSION_IN_BROWSER' };
      const res = await fetch(`http://127.0.0.1:4000/api/p/permissions/company-admin-pages?tenantId=${tenantId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-actor-type': String(s.actorType || 'employee'),
          'x-actor-id': String(s.actorId || ''),
          'x-tenant-id': String(s.tenantId || ''),
          'x-org-id': String(s.orgId || ''),
          'x-team-id': String(s.teamId || ''),
        },
      });
      const data = await res.json().catch(() => ({}));
      return { status: res.status, data };
    }, { tenantId });

    if (permResp.status !== 200 || !Array.isArray(permResp.data?.grants)) {
      throw new Error(`query perms failed: ${JSON.stringify(permResp)}`);
    }
    const grants = permResp.data.grants;
    const allFalse = grants.length > 0 && grants.every((g) => Boolean(g.enabled) === false);
    if (!allFalse) {
      throw new Error(`default perms not all false: ${JSON.stringify(grants.slice(0, 8))}`);
    }
    checks.push('company-admin-pages default all false ok');

    const bPage = await browser.newPage();
    bPage.setDefaultTimeout(20000);
    await bPage.goto(B_BASE, { waitUntil: 'domcontentloaded' });
    await bPage.getByPlaceholder(/员工账号|账号/i).first().fill(adminEmail);
    await bPage.getByPlaceholder(/密码/i).first().fill(adminPassword);
    await bPage.getByRole('button', { name: /登\s*录/ }).first().click();
    const loginError = bPage.getByText('账号或密码错误', { exact: false }).first();
    await bPage.waitForTimeout(1500);
    if (await loginError.count()) {
      throw new Error('B login failed for created tenant admin');
    }
    checks.push('B login with created admin ok');
    await bPage.close();

    console.log(JSON.stringify({ ok: true, checks, artifacts }, null, 2));
  } catch (err) {
    const shot = '/tmp/regression_perm_default_false_failure.png';
    await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
    console.log(JSON.stringify({ ok: false, checks, artifacts, error: err?.message || String(err), screenshot: shot }, null, 2));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
