const { chromium } = require('playwright');
(async() => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1600 } });
  await page.goto('http://127.0.0.1:3004/', { waitUntil: 'networkidle' });
  await page.getByPlaceholder('请输入员工账号(邮箱/手机号)').fill('fangyuqing@126.com');
  await page.getByPlaceholder('请输入密码').fill('123456');
  await page.locator('input[type="checkbox"]').first().check();
  await page.getByRole('button', { name: '登 录' }).click();
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: '获客工具' }).click();
  await page.waitForLoadState('networkidle');
  console.log((await page.locator('body').innerText()).slice(0, 3000));
  await page.screenshot({ path: 'output/playwright/b-debug-tools.png', fullPage: true });
  await browser.close();
})();
