import { test } from 'playwright/test';

test('verify B vs C data in browser context', async ({ page, context, request }) => {
  const bLoginRes = await request.post('http://127.0.0.1:4000/api/b/auth/login', {
    data: { account: 'xinhua@126.com', password: '123456' },
  });
  const bLogin = await bLoginRes.json();

  const cLoginRes = await request.post('http://127.0.0.1:4000/api/auth/verify-basic', {
    data: { name: '看看', mobile: '13800000719', code: '123456' },
  });
  const cLogin = await cLoginRes.json();

  await page.goto('http://127.0.0.1:3004', { waitUntil: 'domcontentloaded' });
  await page.evaluate((session) => {
    sessionStorage.setItem('b_staff_session_v1', JSON.stringify(session));
    if (session?.csrfToken) sessionStorage.setItem('b_staff_csrf_v1', String(session.csrfToken));
  }, bLogin.session);
  await page.reload({ waitUntil: 'networkidle' });

  const bData = await page.evaluate(async () => {
    const raw = sessionStorage.getItem('b_staff_session_v1');
    const s = raw ? JSON.parse(raw) : null;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${s.token}`,
      'x-csrf-token': String(s.csrfToken || ''),
      'x-actor-type': String(s.actorType || 'employee'),
      'x-actor-id': String(s.actorId || ''),
      'x-tenant-id': String(s.tenantId || ''),
      'x-org-id': String(s.orgId || ''),
      'x-team-id': String(s.teamId || ''),
    };
    const [a, p, m] = await Promise.all([
      fetch('http://127.0.0.1:4000/api/b/activity-configs', { headers }).then((r) => r.json()),
      fetch('http://127.0.0.1:4000/api/b/mall/products', { headers }).then((r) => r.json()),
      fetch('http://127.0.0.1:4000/api/b/mall/activities', { headers }).then((r) => r.json()),
    ]);
    return {
      activities: (a.list || []).map((x: any) => x.title),
      products: (p.list || []).map((x: any) => x.title),
      mallActivities: (m.list || []).map((x: any) => x.title),
    };
  });

  const pageC = await context.newPage();
  await pageC.goto('http://127.0.0.1:3003', { waitUntil: 'domcontentloaded' });
  await pageC.evaluate((token) => {
    localStorage.setItem('insurance_token', token);
  }, cLogin.token);
  await pageC.reload({ waitUntil: 'networkidle' });

  const cData = await pageC.evaluate(async () => {
    const token = localStorage.getItem('insurance_token') || '';
    const headers = { Authorization: `Bearer ${token}` };
    const [a, p, m] = await Promise.all([
      fetch('http://127.0.0.1:4000/api/activities', { headers }).then((r) => r.json()),
      fetch('http://127.0.0.1:4000/api/mall/items', { headers }).then((r) => r.json()),
      fetch('http://127.0.0.1:4000/api/mall/activities', { headers }).then((r) => r.json()),
    ]);
    return {
      activities: (a.activities || []).map((x: any) => x.title),
      products: (p.items || []).map((x: any) => x.title || x.name),
      mallActivities: (m.list || []).map((x: any) => x.title),
    };
  });

  await page.screenshot({ path: '/tmp/b_side_after_fix.png', fullPage: true });
  await pageC.screenshot({ path: '/tmp/c_side_after_fix.png', fullPage: true });

  console.log('B_DATA=' + JSON.stringify(bData));
  console.log('C_DATA=' + JSON.stringify(cData));
});
