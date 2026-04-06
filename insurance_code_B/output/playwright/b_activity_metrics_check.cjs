const { chromium } = require('playwright');
(async() => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1600 } });
  const log = (...args) => console.log(...args);
  await page.goto('http://127.0.0.1:3004/', { waitUntil: 'networkidle' });
  await page.getByPlaceholder('请输入员工账号(邮箱/手机号)').fill('fangyuqing@126.com');
  await page.getByPlaceholder('请输入密码').fill('123456');
  const checkbox = page.locator('input[type="checkbox"]').first();
  if (await checkbox.isVisible()) await checkbox.check();
  await page.getByRole('button', { name: '登 录' }).click();
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: '获客工具' }).click();
  await page.waitForLoadState('networkidle');

  const cards = page.locator('div.bg-white.rounded-xl.shadow-sm.border.border-slate-100');
  const count = await cards.count();
  let card = null;
  for (let i = 0; i < count; i += 1) {
    const candidate = cards.nth(i);
    const text = await candidate.innerText();
    if (text.includes('活动效果') && text.includes('报名') && text.includes('参加')) {
      card = candidate;
      break;
    }
  }
  if (!card) throw new Error('ACTIVITY_CARD_NOT_FOUND');
  const title = (await card.locator('h3').textContent())?.trim();
  log('TITLE', title);
  await card.getByRole('button', { name: /报名/ }).click();
  await page.waitForTimeout(1200);
  log('SIGNUP_MODAL', await page.getByRole('heading', { name: '活动报名客户' }).isVisible().catch(() => false));
  const signupRows = page.locator('button.w-full.rounded-2xl.border.border-slate-200.bg-white');
  log('SIGNUP_ROWS', await signupRows.count());
  if (await signupRows.count()) {
    await signupRows.first().click();
    await page.waitForTimeout(1200);
    log('CUSTOMER_DETAIL', await page.locator('text=互动轨迹').first().isVisible().catch(() => false));
  }

  await page.goto('http://127.0.0.1:3004/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '获客工具' }).click();
  await page.waitForLoadState('networkidle');
  const cards2 = page.locator('div.bg-white.rounded-xl.shadow-sm.border.border-slate-100');
  let card2 = null;
  const count2 = await cards2.count();
  for (let i = 0; i < count2; i += 1) {
    const candidate = cards2.nth(i);
    const text = await candidate.innerText();
    if (text.includes('活动效果') && text.includes('报名') && text.includes('参加')) {
      card2 = candidate;
      break;
    }
  }
  if (!card2) throw new Error('ACTIVITY_CARD_NOT_FOUND_2');
  await card2.getByRole('button', { name: /参加/ }).click();
  await page.waitForTimeout(1200);
  log('ATTENDED_MODAL', await page.getByRole('heading', { name: '活动参加客户' }).isVisible().catch(() => false));
  log('ATTENDED_EMPTY', (await page.locator('body').innerText()).includes('当前没有活动参加客户'));
  await page.screenshot({ path: 'output/playwright/b-activity-signup-attended.png', fullPage: true });
  await browser.close();
})();
