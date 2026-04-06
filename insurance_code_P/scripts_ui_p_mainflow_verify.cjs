#!/usr/bin/env node
/* eslint-disable no-console */
const { chromium } = require('playwright');

const BASE_URL = process.env.P_WEB_BASE || 'http://127.0.0.1:3003';

async function clickText(page, text) {
  await page.getByText(text, { exact: true }).first().click();
}

async function clickMenu(page, text) {
  await page.locator(`a:has-text("${text}")`).first().click();
}
async function clickViewOrDetail(page) {
  const viewBtn = page.getByText('查看', { exact: true }).first();
  if ((await viewBtn.count()) > 0) {
    await viewBtn.click();
    return;
  }
  await page.getByText('详情', { exact: true }).first().click();
}

async function ensureText(page, text) {
  await page.getByText(text, { exact: true }).first().waitFor();
}

async function ensureLogin(page) {
  if ((await page.getByText('P端管理后台登录', { exact: true }).count()) === 0) return;
  await page.getByPlaceholder('company001').fill(process.env.P_ACCOUNT || 'company001');
  await page.getByPlaceholder('123456').fill(process.env.P_PASSWORD || '123456');
  await clickText(page, '登录');
  await ensureText(page, '租户列表');
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);

  const checks = [];
  const findings = [];

  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await ensureLogin(page);

    await ensureText(page, '租户列表');
    await ensureText(page, '创建租户');
    if ((await page.getByText('机场列表', { exact: true }).count()) > 0) {
      findings.push('P1: 左侧菜单仍出现“机场列表”旧文案');
    }
    checks.push('sidebar labels ok');

    await clickMenu(page, '租户列表');
    await ensureText(page, '租户管理');
    checks.push('tenant list page ok');

    await clickMenu(page, '创建租户');
    await ensureText(page, '创建新租户');
    checks.push('create tenant page ok');

    await clickMenu(page, '活动中心');
    await ensureText(page, '活动中心');
    await clickViewOrDetail(page);
    await ensureText(page, '活动详情');
    await clickText(page, '返回活动中心');
    checks.push('activity detail navigation ok');

    await clickMenu(page, '学习资料');
    await ensureText(page, '学习资料');
    await clickViewOrDetail(page);
    await ensureText(page, '学习资料详情');
    await clickText(page, '返回学习资料');
    await clickText(page, '新增');
    await ensureText(page, '新增学习资料');
    await ensureText(page, '返回');
    const titleSize = await page.getByText('新增学习资料', { exact: true }).first().evaluate((el) => Number(getComputedStyle(el).fontSize.replace('px', '')));
    const uploadLabel = page.getByText('点击上传', { exact: false }).first();
    const uploadSize = await uploadLabel.evaluate((el) => Number(getComputedStyle(el).fontSize.replace('px', '')));
    if (titleSize > 36 || uploadSize > 30) findings.push(`P2: 新增学习资料页字号过大（title=${titleSize}px, upload=${uploadSize}px）`);
    await clickText(page, '返回');
    checks.push('learning detail/create navigation ok');

    await clickMenu(page, '积分商城');
    await ensureText(page, '积分商城');
    await clickText(page, '查看');
    await ensureText(page, '商品货架详情');
    await clickText(page, '返回货架');
    await clickText(page, '新增上架商品');
    await ensureText(page, '新增商城商品');
    await clickText(page, '返回');
    await clickText(page, '活动货架');
    await ensureText(page, '活动货架管理');
    await page.locator('button:has-text("新增上架活动")').first().click();
    await ensureText(page, '新增上架活动');
    await clickText(page, '返回');
    await clickText(page, '活动货架');
    await ensureText(page, '活动货架管理');
    await clickText(page, '查看');
    await ensureText(page, '活动货架详情');
    await clickText(page, '返回货架');
    checks.push('mall product/activity navigation ok');

    await clickMenu(page, '策略引擎');
    await ensureText(page, '策略引擎');
    await clickText(page, '新增策略引擎');
    await ensureText(page, '策略引擎配置');
    await clickText(page, '返回列表');
    checks.push('strategy list/config navigation ok');

    await clickMenu(page, '业绩看板');
    await ensureText(page, '业绩看板');
    if ((await page.getByText('内容与营销 / 活动中心', { exact: true }).count()) > 0) {
      findings.push('P1: 业绩看板顶部出现错误面包屑“内容与营销 / 活动中心”');
    }
    checks.push('stats page nav ok');

    await clickMenu(page, '财务对账');
    await ensureText(page, '财务对账');
    await clickText(page, '发起对账');
    await page.waitForTimeout(800);
    checks.push('finance reconcile action ok');

    console.log(JSON.stringify({ ok: true, checks, findings }, null, 2));
  } catch (err) {
    const screenshot = '/tmp/p_admin_mainflow_failure.png';
    await page.screenshot({ path: screenshot, fullPage: true }).catch(() => {});
    console.error(
      JSON.stringify(
        {
          ok: false,
          checks,
          findings,
          error: err.message,
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
