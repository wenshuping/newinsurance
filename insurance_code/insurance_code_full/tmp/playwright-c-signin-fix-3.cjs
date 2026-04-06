const { chromium } = require('playwright');
const API = 'http://127.0.0.1:4100';
const APP = 'http://127.0.0.1:3003/?tenantId=2';
async function request(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers || {}) },
  });
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
}
(async () => {
  const headers = { 'x-tenant-id': '2', 'x-tenant-code': 'tenant-alpha' };
  await request('/api/auth/send-code', { method: 'POST', headers, body: JSON.stringify({ mobile: '13800000719' }) });
  const login = await request('/api/auth/verify-basic', { method: 'POST', headers, body: JSON.stringify({ name: '方雨晴客户', mobile: '13800000719', code: '123456', tenantId: 2, tenantCode: 'tenant-alpha' }) });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const dialogs = [];
  page.on('dialog', async d => { dialogs.push(d.message()); await d.accept(); });
  await page.addInitScript(({ token, csrfToken }) => {
    localStorage.setItem('insurance_tenant_id', '2');
    sessionStorage.setItem('insurance_token', token);
    sessionStorage.setItem('insurance_csrf_token', csrfToken);
  }, { token: login.body.token, csrfToken: login.body.csrfToken });
  await page.goto(APP, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(3000);
  await page.locator('text=立即签到领积分').click();
  await page.waitForTimeout(2000);
  const result = {
    dialogs,
    tokenPresent: await page.evaluate(() => Boolean(sessionStorage.getItem('insurance_token'))),
    csrfPresent: await page.evaluate(() => Boolean(sessionStorage.getItem('insurance_csrf_token'))),
    bodyText: await page.locator('body').innerText(),
  };
  console.log(JSON.stringify(result, null, 2));
  await page.screenshot({ path: 'tmp/c-signin-fix-3.png', fullPage: true });
  await browser.close();
})();
