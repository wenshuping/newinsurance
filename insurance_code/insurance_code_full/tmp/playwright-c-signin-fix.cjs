const { chromium } = require('playwright');

const API = 'http://127.0.0.1:4100';
const APP = 'http://127.0.0.1:3003/?tenantId=2';

async function request(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, headers: Object.fromEntries(res.headers.entries()), body };
}

(async () => {
  const headers = { 'x-tenant-id': '2', 'x-tenant-code': 'tenant-alpha' };
  await request('/api/auth/send-code', { method: 'POST', headers, body: JSON.stringify({ mobile: '13800000719' }) });
  const login = await request('/api/auth/verify-basic', {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: '方雨晴客户', mobile: '13800000719', code: '123456', tenantId: 2, tenantCode: 'tenant-alpha' }),
  });
  if (login.status !== 200) throw new Error(`login failed ${login.status}`);
  const token = login.body.token;
  const csrfToken = login.body.csrfToken;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const dialogs = [];
  page.on('dialog', async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.accept();
  });
  page.on('console', (msg) => console.log('console', msg.type(), msg.text()));

  await page.addInitScript(({ token, csrfToken }) => {
    localStorage.setItem('insurance_tenant_id', '2');
    sessionStorage.setItem('insurance_token', token);
    sessionStorage.setItem('insurance_csrf_token', csrfToken);
  }, { token, csrfToken });

  await page.goto(APP, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '立即签到领奖' }).click();
  await page.waitForTimeout(1500);

  const result = {
    dialogs,
    hasVerified: await page.locator('text=已实名').count(),
    hasNeedVerify: await page.locator('text=去实名').count(),
    tokenPresent: await page.evaluate(() => Boolean(sessionStorage.getItem('insurance_token'))),
    csrfPresent: await page.evaluate(() => Boolean(sessionStorage.getItem('insurance_csrf_token'))),
    title: await page.title(),
  };
  console.log(JSON.stringify(result, null, 2));
  await page.screenshot({ path: 'tmp/c-signin-fix.png', fullPage: true });
  await browser.close();
})();
