#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { chromium, request } from 'playwright';

const API = String(process.env.API_BASE_URL || 'http://127.0.0.1:4000').replace(/\/+$/, '');
const C_WEB = String(process.env.C_WEB_BASE_URL || 'http://127.0.0.1:3003').replace(/\/+$/, '');
const MOBILE = String(process.env.C_SMOKE_MOBILE || '13800000719');
const NAME = String(process.env.C_SMOKE_NAME || '哈哈');
const TENANT_ID = Number(process.env.C_SMOKE_TENANT_ID || 2);
const OUT_DIR = path.join(process.cwd(), 'tmp', 'smoke');

function fail(message, context = null) {
  const err = new Error(message);
  err.context = context;
  throw err;
}

async function getJson(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { raw: text };
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const api = await request.newContext();
  const verifyRes = await api.post(`${API}/api/auth/verify-basic`, {
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': String(TENANT_ID) },
    data: { name: NAME, mobile: MOBILE, code: '123456', tenantId: TENANT_ID },
  });
  const verify = await getJson(verifyRes);
  if (!verify?.token || !verify?.csrfToken) {
    fail('customer verify-basic failed', { status: verifyRes.status(), verify });
  }

  const headers = { Authorization: `Bearer ${verify.token}`, 'Content-Type': 'application/json' };
  const [learningRes, activitiesRes, mallItemsRes] = await Promise.all([
    api.get(`${API}/api/learning/courses`, { headers }),
    api.get(`${API}/api/activities`, { headers }),
    api.get(`${API}/api/mall/items`, { headers }),
  ]);
  const [learning, activities, mallItems] = await Promise.all([
    getJson(learningRes),
    getJson(activitiesRes),
    getJson(mallItemsRes),
  ]);

  const expected = {
    learning: Array.isArray(learning?.courses) ? learning.courses.length : 0,
    activities: Array.isArray(activities?.activities) ? activities.activities.length : 0,
    mallItems: Array.isArray(mallItems?.items) ? mallItems.items.length : 0,
  };
  if (expected.learning <= 0 || expected.activities <= 0 || expected.mallItems <= 0) {
    fail('customer api baseline is empty', expected);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 430, height: 932 } });
  await context.addInitScript(
    ({ token, csrfToken, tenantId }) => {
      window.sessionStorage.setItem('insurance_token', token);
      window.sessionStorage.setItem('insurance_csrf_token', csrfToken);
      window.localStorage.setItem('insurance_tenant_id', String(tenantId));
      window.localStorage.removeItem('insurance_user_cache');
      window.localStorage.removeItem('insurance_balance_cache');
    },
    { token: verify.token, csrfToken: verify.csrfToken, tenantId: TENANT_ID }
  );

  const page = await context.newPage();
  await page.goto(C_WEB, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1200);

  const marketingTitle = page.getByText('每日签到好礼');
  if (await marketingTitle.isVisible().catch(() => false)) {
    await page.mouse.click(12, 12);
    await page.waitForTimeout(300);
    if (await marketingTitle.isVisible().catch(() => false)) {
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(300);
    }
  }

  const meRes = await page.evaluate(async (apiBase) => {
    const token = window.sessionStorage.getItem('insurance_token') || '';
    const res = await fetch(`${apiBase}/api/me`, { headers: { Authorization: `Bearer ${token}` } });
    return { status: res.status, body: await res.json() };
  }, API);
  if (Number(meRes?.status || 0) !== 200) {
    fail('browser session me failed', meRes);
  }

  await page.getByRole('button', { name: '知识学习' }).click();
  await page.waitForTimeout(1200);
  await page.getByText('我的课程进度').waitFor({ state: 'visible', timeout: 10000 });
  const learningEmpty = await page.getByText('当前分类暂无课程').isVisible().catch(() => false);
  const learningCards = await page.locator('h3.text-lg.font-bold.mb-1').count();
  await page.screenshot({ path: path.join(OUT_DIR, 'fang-c-learning.png'), fullPage: true });
  if (learningEmpty || learningCards <= 0) {
    fail('learning page did not render visible courses', { learningEmpty, learningCards, expected: expected.learning });
  }

  await page.getByRole('button', { name: '活动中心' }).click();
  await page.waitForTimeout(1200);
  await page.getByRole('heading', { name: '活动中心' }).waitFor({ state: 'visible', timeout: 10000 });
  const activityEmpty = await page.getByText('暂无活动').isVisible().catch(() => false);
  const activityCards = await page.locator('h4.font-bold.text-sm.mt-1').count();
  await page.screenshot({ path: path.join(OUT_DIR, 'fang-c-activities.png'), fullPage: true });
  if (activityEmpty || activityCards <= 0) {
    fail('activities page did not render visible activities', { activityEmpty, activityCards, expected: expected.activities });
  }

  await page.getByRole('button', { name: '首页' }).click();
  await page.waitForTimeout(800);
  await page.getByText('去积分商城').first().click();
  await page.waitForTimeout(1200);
  await page.getByRole('heading', { name: '积分商城' }).waitFor({ state: 'visible', timeout: 10000 });
  const mallError = await page.getByText('商品获取失败').isVisible().catch(() => false);
  const mallEmpty = await page.getByText('暂无商品').isVisible().catch(() => false);
  const mallCards = await page.locator('article').count();
  await page.screenshot({ path: path.join(OUT_DIR, 'fang-c-mall.png'), fullPage: true });
  if (mallError || mallEmpty || mallCards <= 0) {
    fail('mall page did not render visible products', { mallError, mallEmpty, mallCards, expected: expected.mallItems });
  }

  await browser.close();
  await api.dispose();

  console.log(
    JSON.stringify(
      {
        ok: true,
        customer: { mobile: MOBILE, tenantId: TENANT_ID },
        expected,
        visible: {
          learningCards,
          activityCards,
          mallCards,
        },
        screenshots: {
          learning: path.join(OUT_DIR, 'fang-c-learning.png'),
          activities: path.join(OUT_DIR, 'fang-c-activities.png'),
          mall: path.join(OUT_DIR, 'fang-c-mall.png'),
        },
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: String(err?.message || err),
        context: err?.context || null,
      },
      null,
      2
    )
  );
  process.exit(1);
});
