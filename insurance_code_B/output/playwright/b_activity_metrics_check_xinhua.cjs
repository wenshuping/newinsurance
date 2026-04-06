const { chromium } = require('playwright');
(async() => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1600 } });
  const log = (...args) => console.log(...args);
  await page.goto('http://127.0.0.1:3004/', { waitUntil: 'networkidle' });
  await page.getByPlaceholder('请输入员工账号(邮箱/手机号)').fill('xinhua@126.com');
  await page.getByPlaceholder('请输入密码').fill('123456');
  await page.locator('input[type="checkbox"]').first().check();
  await page.getByRole('button', { name: '登 录' }).click();
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: '获客工具' }).click();
  await page.waitForTimeout(4000);

  const card = page.locator('div.bg-white.rounded-xl.shadow-sm.border.border-slate-100').filter({ hasText: '链路活动_1772764102921' }).first();
  if (!(await card.isVisible())) throw new Error('TARGET_ACTIVITY_CARD_NOT_VISIBLE');
  log('CARD_TEXT', (await card.innerText()).replace(/\s+/g, ' ').trim());

  await card.getByRole('button', { name: /报名/ }).click();
  await page.waitForTimeout(1600);
  log('SIGNUP_MODAL', await page.getByRole('heading', { name: '活动报名客户' }).isVisible());
  const signupRows = page.locator('button.w-full.rounded-2xl.border.border-slate-200.bg-white');
  log('SIGNUP_ROWS', await signupRows.count());
  if (await signupRows.count()) {
    log('FIRST_SIGNUP_ROW', (await signupRows.first().innerText()).replace(/\s+/g, ' ').trim());
    await signupRows.first().click();
    await page.waitForTimeout(1500);
    log('OPENED_CUSTOMER', await page.locator('text=互动轨迹').first().isVisible().catch(() => false));
  }

  await page.goto('http://127.0.0.1:3004/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '获客工具' }).click();
  await page.waitForTimeout(4000);
  const card2 = page.locator('div.bg-white.rounded-xl.shadow-sm.border.border-slate-100').filter({ hasText: '链路活动_1772764102921' }).first();
  await card2.getByRole('button', { name: /参加/ }).click();
  await page.waitForTimeout(1600);
  log('ATTENDED_MODAL', await page.getByRole('heading', { name: '活动参加客户' }).isVisible());
  const attendedRows = page.locator('button.w-full.rounded-2xl.border.border-slate-200.bg-white');
  log('ATTENDED_ROWS', await attendedRows.count());
  if (await attendedRows.count()) {
    log('FIRST_ATTENDED_ROW', (await attendedRows.first().innerText()).replace(/\s+/g, ' ').trim());
  }
  await page.screenshot({ path: 'output/playwright/b-activity-signup-attended-xinhua.png', fullPage: true });
  await browser.close();
})();
