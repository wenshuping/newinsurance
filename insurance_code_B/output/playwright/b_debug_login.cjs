const { chromium } = require('playwright');
(async() => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });
  await page.goto('http://127.0.0.1:3004/', { waitUntil: 'networkidle' });
  console.log('TITLE', await page.title());
  console.log('BODY', (await page.locator('body').innerText()).slice(0, 1000));
  const buttons = await page.locator('button').allTextContents();
  console.log('BUTTONS', JSON.stringify(buttons));
  const inputs = await page.locator('input').evaluateAll((els) => els.map((el) => ({type: el.type, placeholder: el.getAttribute('placeholder'), name: el.getAttribute('name')})));
  console.log('INPUTS', JSON.stringify(inputs));
  await page.screenshot({ path: 'output/playwright/b-debug-login.png', fullPage: true });
  await browser.close();
})();
