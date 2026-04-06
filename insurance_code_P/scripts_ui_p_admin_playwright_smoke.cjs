#!/usr/bin/env node
/* eslint-disable no-console */
const { chromium } = require('playwright');

const BASE_URL = process.env.P_WEB_BASE || 'http://127.0.0.1:3015';

function unique(label) {
  return `${label}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

async function clickByText(page, text) {
  const target = page.getByText(text, { exact: true }).first();
  await target.click();
}

async function ensureLogin(page) {
  if ((await page.getByText('P端管理后台登录', { exact: true }).count()) === 0) return;
  await page.getByPlaceholder('company001').fill(process.env.P_ACCOUNT || 'company001');
  await page.getByPlaceholder('123456').fill(process.env.P_PASSWORD || '123456');
  await clickByText(page, '登录');
  await page.getByText('租户列表', { exact: true }).first().waitFor();
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);

  const report = [];
  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await ensureLogin(page);

    const employeeName = unique('自动化员工');
    const employeeEmail = `${Date.now()}@example.com`;
    await clickByText(page, '员工管理');
    await clickByText(page, '添加员工');
    await page.getByPlaceholder('例如: 张三').fill(employeeName);
    await page.getByPlaceholder('robert@company.com').fill(employeeEmail);
    await page.locator('select').first().selectOption('salesperson');
    await clickByText(page, '发送邀请');
    await page.waitForTimeout(800);
    const employeeError = page.locator('div.rounded-lg.border.border-red-200').first();
    if (await employeeError.count()) {
      throw new Error(`employee submit failed: ${await employeeError.innerText()}`);
    }
    await page.getByText(employeeName).first().waitFor();
    report.push('employee create ui flow ok');

    const productTitle = unique('自动化商品');
    await clickByText(page, '积分商城');
    await clickByText(page, '新增上架商品');
    await page.getByPlaceholder('例如：高端定制体检套餐').fill(productTitle);
    await page.getByPlaceholder('请输入分值').fill('188');
    await page.locator('label:has-text("初始库存") input').first().fill('11');
    await page.locator('label:has-text("上架排序") input').first().fill('66');
    await clickByText(page, '保存并上架');
    await page.waitForTimeout(800);
    await page.getByText(productTitle).first().waitFor();
    report.push('mall product create ui flow ok');

    const activityTitle = unique('自动化活动');
    await clickByText(page, '活动货架');
    await clickByText(page, '新增上架活动');
    await page.getByPlaceholder('从活动中心选择').fill(activityTitle);
    await page.getByPlaceholder('输入在积分商城的展示名称').fill(activityTitle);
    await page.locator('label:has-text("所需积分") input').first().fill('88');
    await page.getByPlaceholder('例如：10').fill('44');
    await clickByText(page, '确认并上架');
    await page.waitForTimeout(900);
    await clickByText(page, '活动货架');
    await page.getByText(activityTitle).first().waitFor();
    report.push('mall activity create ui flow ok');

    console.log(JSON.stringify({ ok: true, report }, null, 2));
  } catch (err) {
    const screenshot = '/tmp/p_admin_playwright_failure.png';
    let errorBox = '';
    let pageSnippet = '';
    try {
      await page.screenshot({ path: screenshot, fullPage: true });
      const errNode = page.locator('div.rounded-lg.border.border-red-200').first();
      if (await errNode.count()) errorBox = await errNode.innerText();
      pageSnippet = (await page.locator('body').innerText()).slice(0, 600);
    } catch (_) {}
    console.error(
      JSON.stringify(
        {
          ok: false,
          report,
          error: err.message,
          screenshot,
          errorBox,
          pageSnippet,
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
