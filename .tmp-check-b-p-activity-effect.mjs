import { chromium } from 'playwright';

async function login(page, url, account, password) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.locator('input').first().fill(account);
  await page.locator('input').nth(1).fill(password);
  await page.getByRole('button', { name: /登录/ }).click();
  await page.waitForTimeout(1500);
}

const browser = await chromium.launch({ headless: true });
try {
  const results = {};
  const bPage = await browser.newPage();
  await login(bPage, 'http://127.0.0.1:3004/', 'fangyuqing@126.com', '123456');
  await bPage.getByText('决策', { exact: true }).click({ timeout: 5000 });
  await bPage.getByText('活动效果', { exact: true }).click({ timeout: 5000 });
  await bPage.waitForTimeout(1200);
  const bText = await bPage.locator('main').innerText();
  results.b = {
    hasActivityCount: bText.includes('活动总数'),
    hasShareCount: bText.includes('分享活动总次数'),
    hasViewCount: bText.includes('查看分享链接次数'),
    hasParticipantCount: bText.includes('活动报名人数'),
    hasTeamScope: bText.includes('团队数据'),
  };

  const pPage = await browser.newPage();
  await login(pPage, 'http://127.0.0.1:3005/', 'platform001', '123456');
  await pPage.getByText('业绩看板', { exact: true }).click({ timeout: 5000 });
  await pPage.waitForTimeout(1500);
  const pText = await pPage.locator('main').innerText();
  results.p = {
    hasSection: pText.includes('活动效果指标'),
    hasActivityCount: pText.includes('活动总数'),
    hasShareCount: pText.includes('分享活动总次数'),
    hasViewCount: pText.includes('查看分享链接次数'),
    hasParticipantCount: pText.includes('活动报名人数'),
    hasPlatformScope: pText.includes('平台总览'),
  };

  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
