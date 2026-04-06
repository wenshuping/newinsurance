#!/usr/bin/env node
/* eslint-disable no-console */

const BASE = process.env.API_BASE || 'http://127.0.0.1:4000';
const HEADERS = {
  'Content-Type': 'application/json',
  'x-actor-type': 'employee',
  'x-actor-id': '9001',
  'x-tenant-id': '1',
};

function rand(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

async function req(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...HEADERS,
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${path} -> ${res.status} ${JSON.stringify(data)}`);
  }
  return data;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

(async () => {
  const report = [];
  try {
    const health = await req('/api/health', { headers: {} });
    assert(health.ok === true, 'health check failed');
    report.push('health ok');

    const tenantName = rand('租户联调');
    await req('/api/p/tenants', { method: 'POST', body: JSON.stringify({ name: tenantName, type: 'company' }) });
    const tenants = await req('/api/p/tenants');
    assert(Array.isArray(tenants.list) && tenants.list.some((x) => x.name === tenantName), 'tenant create/list mismatch');
    report.push('tenant create/list ok');

    const employeeName = rand('员工联调');
    const email = `${Date.now()}@example.com`;
    await req('/api/p/employees', {
      method: 'POST',
      headers: { 'x-actor-id': '9002' },
      body: JSON.stringify({ name: employeeName, email, role: 'salesperson' }),
    });
    const employees = await req('/api/p/employees', { headers: { 'x-actor-id': '9002' } });
    assert(Array.isArray(employees.list) && employees.list.some((x) => x.name === employeeName), 'employee create/list mismatch');
    const employeeLogin = await req('/api/p/auth/login', {
      method: 'POST',
      headers: {},
      body: JSON.stringify({ account: email, password: '123456' }),
    });
    assert(employeeLogin.ok === true && employeeLogin.session, 'employee login with initial password failed');
    report.push('employee create/list ok');

    const productTitle = rand('商品联调');
    await req('/api/p/mall/products', {
      method: 'POST',
      headers: { 'x-actor-id': '9002' },
      body: JSON.stringify({
        title: productTitle,
        points: 123,
        stock: 9,
        sortOrder: 77,
        media: [{ name: 'mall-product.png', type: 'image/png' }],
      }),
    });
    const products = await req('/api/p/mall/products', { headers: { 'x-actor-id': '9002' } });
    assert(
      Array.isArray(products.list) &&
        products.list.some((x) => (x.title || x.name) === productTitle),
      'mall product create/list mismatch'
    );
    assert(
      products.list.some(
        (x) =>
          (x.title || x.name) === productTitle &&
          Array.isArray(x.media) &&
          x.media.some((m) => m.name === 'mall-product.png')
      ),
      'mall product media persistence mismatch'
    );
    report.push('mall product create/list ok');

    const activityTitle = rand('活动联调');
    await req('/api/p/mall/activities', {
      method: 'POST',
      headers: { 'x-actor-id': '9002' },
      body: JSON.stringify({
        title: activityTitle,
        type: 'task',
        rewardPoints: 66,
        sortOrder: 55,
        media: [{ name: 'mall-activity.png', type: 'image/png' }],
      }),
    });
    const activities = await req('/api/p/mall/activities', { headers: { 'x-actor-id': '9002' } });
    assert(Array.isArray(activities.list) && activities.list.some((x) => x.title === activityTitle), 'mall activity create/list mismatch');
    assert(
      activities.list.some(
        (x) =>
          x.title === activityTitle &&
          Array.isArray(x.media) &&
          x.media.some((m) => m.name === 'mall-activity.png')
      ),
      'mall activity media persistence mismatch'
    );
    report.push('mall activity create/list ok');

    const publishActivityTitle = rand('活动发布');
    await req('/api/p/activities', {
      method: 'POST',
      headers: { 'x-actor-id': '9002' },
      body: JSON.stringify({
        title: publishActivityTitle,
        category: 'task',
        rewardPoints: 35,
        content: 'activity publish smoke',
        media: [{ name: 'activity-cover.jpg', type: 'image/jpeg' }],
      }),
    });
    const pActivities = await req('/api/p/activities', { headers: { 'x-actor-id': '9002' } });
    assert(Array.isArray(pActivities.activities) && pActivities.activities.some((x) => x.title === publishActivityTitle), 'publish activity create/list mismatch');
    report.push('activity publish create/list ok');

    const learningTitle = rand('学习资料');
    await req('/api/p/learning/courses', {
      method: 'POST',
      headers: { 'x-actor-id': '9002' },
      body: JSON.stringify({
        title: learningTitle,
        category: '通用培训',
        points: 30,
        contentType: 'video',
        level: '中级',
        content: 'learning create smoke',
        media: [{ name: 'learning-video.mp4', type: 'video/mp4' }],
      }),
    });
    const courses = await req('/api/learning/courses', { headers: { 'x-actor-id': '9002' } });
    assert(Array.isArray(courses.courses) && courses.courses.some((x) => x.title === learningTitle), 'learning create/list mismatch');
    report.push('learning create/list ok');

    const reconciliation = await req('/api/p/reconciliation/run', { method: 'POST', body: JSON.stringify({}) });
    assert(reconciliation.ok === true && reconciliation.report, 'reconciliation run failed');
    report.push('reconciliation run ok');

    console.log(JSON.stringify({ ok: true, checks: report }, null, 2));
  } catch (err) {
    console.error(JSON.stringify({ ok: false, error: err.message, checks: report }, null, 2));
    process.exit(1);
  }
})();
