#!/usr/bin/env node
/* eslint-disable no-console */
const { chromium, firefox, webkit } = require('playwright');

const BASE_URL = process.env.B_WEB_BASE || 'http://127.0.0.1:3002';
const LOGIN_ACCOUNT = process.env.B_LOGIN_ACCOUNT || '';
const LOGIN_PASSWORD = process.env.B_LOGIN_PASSWORD || '';

async function launchBrowser() {
  const launchers = [
    ['chromium', () => chromium.launch({ headless: true })],
    ['firefox', () => firefox.launch({ headless: true })],
    ['webkit', () => webkit.launch({ headless: true })],
  ];
  const errors = [];
  for (const [name, fn] of launchers) {
    try {
      const browser = await fn();
      return { browser, browserName: name, errors };
    } catch (err) {
      errors.push({ browser: name, message: err?.message || String(err) });
    }
  }
  return { browser: null, browserName: '', errors };
}

async function clickNav(page, label) {
  await page.locator(`button:has-text("${label}")`).first().click();
}

async function waitForAnyVisible(page, texts) {
  for (const text of texts) {
    const loc = page.getByText(text, { exact: false }).first();
    if ((await loc.count()) > 0) {
      await loc.waitFor();
      return text;
    }
  }
  throw new Error(`none_of_expected_text_visible: ${texts.join(', ')}`);
}

async function run() {
  const { browser, browserName, errors } = await launchBrowser();
  if (!browser) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          skipped: true,
          reason: 'browser_launch_failed',
          base: BASE_URL,
          launchErrors: errors,
        },
        null,
        2
      )
    );
    return;
  }

  const page = await browser.newPage();
  page.setDefaultTimeout(15000);
  const checks = [];

  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    const loginTitle = page.getByText('欢迎登录', { exact: true }).first();
    if ((await loginTitle.count()) > 0) {
      if (LOGIN_ACCOUNT) {
        await page.getByPlaceholder(/员工账号|账号/i).first().fill(LOGIN_ACCOUNT);
      }
      if (LOGIN_PASSWORD) {
        await page.getByPlaceholder(/密码/i).first().fill(LOGIN_PASSWORD);
      }
      await page.getByRole('button', { name: /登\s*录/ }).first().click();
    }

    await page.getByText('实时数据:', { exact: false }).first().waitFor();
    checks.push('login ok');

    await clickNav(page, '客户库');
    await page.getByText('客户库', { exact: true }).first().waitFor();
    checks.push('customers nav ok');

    await page.locator('main .rounded-xl').first().click();
    await page.getByText('客户档案', { exact: true }).first().waitFor();
    checks.push('customer detail open ok');

    await page.locator('header button').first().click();
    await page.getByText('客户库', { exact: true }).first().waitFor();
    checks.push('customer detail back ok');

    await page.locator('button:has-text("标签")').first().click();
    await page.getByText('编辑标签', { exact: true }).first().waitFor();
    checks.push('tag editor open ok');

    await page.locator('header button').first().click();
    await page.getByText('客户库', { exact: true }).first().waitFor();
    checks.push('tag editor back ok');

    await page.locator('button.absolute.bottom-24.right-6').first().click();
    await page.getByText('录入客户资料', { exact: true }).first().waitFor();
    checks.push('customer create open ok');

    await page.locator('header button').first().click();
    await page.getByText('客户库', { exact: true }).first().waitFor();
    checks.push('customer create back ok');

    await clickNav(page, '获客工具');
    await page.getByText('获客工具', { exact: true }).first().waitFor();
    checks.push('tools nav ok');

    await page.locator('button:has-text("积分商城")').first().click();
    await waitForAnyVisible(page, ['新增商品', '新增活动', '商品', '活动', '积分商城']);
    checks.push('tools mall tab ok');

    await clickNav(page, '决策');
    await page.getByText('数据中心', { exact: true }).first().waitFor();
    checks.push('analytics nav ok');

    await clickNav(page, '我的');
    await page.getByText('个人中心', { exact: true }).first().waitFor();
    checks.push('profile nav ok');

    console.log(
      JSON.stringify(
        {
          ok: true,
          browser: browserName,
          base: BASE_URL,
          checks,
        },
        null,
        2
      )
    );
  } catch (err) {
    const screenshot = '/tmp/b_mainflow_failure.png';
    await page.screenshot({ path: screenshot, fullPage: true }).catch(() => {});
    console.log(
      JSON.stringify(
        {
          ok: false,
          browser: browserName,
          base: BASE_URL,
          checks,
          error: err?.message || String(err),
          screenshot,
        },
        null,
        2
      )
    );
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();
