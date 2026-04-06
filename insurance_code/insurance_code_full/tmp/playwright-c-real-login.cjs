const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const requests = [];
  page.on('response', (res) => {
    const url = res.url();
    if (url.includes('/api/')) requests.push({ status: res.status(), url });
  });

  await page.goto('http://127.0.0.1:3003', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '我的' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: '去实名' }).click();
  await page.getByPlaceholder('请输入您的真实姓名').fill('哈哈');
  await page.getByPlaceholder('请输入您的手机号码').fill('13800000719');
  await page.getByRole('button', { name: /获取验证码|\d+s 后重试/ }).click();
  await page.getByPlaceholder('请输入验证码').fill('123456');
  await page.getByRole('button', { name: '提交认证' }).click();
  await page.waitForTimeout(3000);

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
    verifyBasicStatuses: requests.filter((x) => x.url.includes('/api/auth/verify-basic')).map((x) => x.status),
  }, null, 2));

  await browser.close();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
