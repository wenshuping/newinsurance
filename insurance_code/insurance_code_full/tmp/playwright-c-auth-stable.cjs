const { chromium } = require('playwright');

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

(async () => {
  const base = 'http://127.0.0.1:4100';
  const web = 'http://127.0.0.1:3003';
  const mobile = '13800000719';
  const name = '哈哈';

  const sent = await postJson(`${base}/api/auth/send-code`, { mobile });
  if (sent.status !== 200) throw new Error(`send-code failed: ${sent.status} ${JSON.stringify(sent.json)}`);
  const code = sent.json.dev_code || '123456';
  const verified = await postJson(`${base}/api/auth/verify-basic`, { mobile, name, code });
  if (verified.status !== 200) throw new Error(`verify-basic failed: ${verified.status} ${JSON.stringify(verified.json)}`);
  const token = verified.json.token;
  const csrfToken = verified.json.csrfToken || '';

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const requests = [];
  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('/api/')) requests.push({ status: res.status(), url });
  });

  await page.addInitScript(({ token, csrfToken }) => {
    sessionStorage.setItem('insurance_token', token);
    if (csrfToken) sessionStorage.setItem('insurance_csrf_token', csrfToken);
  }, { token, csrfToken });

  await page.goto(web, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '我的' }).click();
  await page.waitForTimeout(2500);

  const state = await page.evaluate(() => ({
    token: sessionStorage.getItem('insurance_token') || '',
    csrf: sessionStorage.getItem('insurance_csrf_token') || '',
    body: document.body.innerText,
  }));

  console.log(JSON.stringify({
    tokenPresent: Boolean(state.token),
    csrfPresent: Boolean(state.csrf),
    hasVerifiedLabel: state.body.includes('已实名'),
    hasNeedVerifyLabel: state.body.includes('去实名'),
    points401s: requests.filter((x) => x.status === 401 && (x.url.includes('/api/redemptions') || x.url.includes('/api/orders'))),
    meStatuses: requests.filter((x) => x.url.includes('/api/me')).map((x) => x.status),
    sampleRequests: requests.slice(-20),
  }, null, 2));

  await browser.close();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
