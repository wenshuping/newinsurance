const { chromium, request } = require('playwright');

const API = 'http://127.0.0.1:4000';
const B_WEB = 'http://127.0.0.1:3004';
const C_WEB = 'http://127.0.0.1:3003';

function activeCount(list = []) {
  const ok = new Set(['active', 'online', 'published', 'ongoing', 'on', '进行中', '生效']);
  return (list || []).filter((x) => ok.has(String(x?.status || '').toLowerCase())).length;
}

(async () => {
  const api = await request.newContext();

  const bLoginRes = await api.post(`${API}/api/b/auth/login`, { data: { account: 'agent001@demo.local', password: '123456' } });
  const bLogin = await bLoginRes.json();
  const bSession = bLogin.session;

  const cVerifyRes = await api.post(`${API}/api/auth/verify-basic`, {
    headers: { 'x-tenant-id': '1' },
    data: { name: '哈哈', mobile: '18616135811', code: '123456' },
  });
  const cVerify = await cVerifyRes.json();

  const browser = await chromium.launch({ headless: true });

  const bCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await bCtx.addInitScript((s) => {
    window.sessionStorage.setItem('b_staff_session_v1', JSON.stringify(s));
    if (s?.csrfToken) window.sessionStorage.setItem('b_staff_csrf_v1', s.csrfToken);
  }, bSession);
  const bPage = await bCtx.newPage();
  await bPage.goto(B_WEB, { waitUntil: 'networkidle' });

  const bData = await bPage.evaluate(async () => {
    const session = JSON.parse(sessionStorage.getItem('b_staff_session_v1') || '{}');
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.token || ''}`,
      'x-csrf-token': String(session.csrfToken || ''),
      'x-actor-type': String(session.actorType || 'agent'),
      'x-actor-id': String(session.actorId || ''),
      'x-tenant-id': String(session.tenantId || ''),
      'x-org-id': String(session.orgId || ''),
      'x-team-id': String(session.teamId || ''),
    };
    const [learn, act, prod, mact] = await Promise.all([
      fetch('http://127.0.0.1:4000/api/b/content/items', { headers }).then((r) => r.json()),
      fetch('http://127.0.0.1:4000/api/b/activity-configs', { headers }).then((r) => r.json()),
      fetch('http://127.0.0.1:4000/api/b/mall/products', { headers }).then((r) => r.json()),
      fetch('http://127.0.0.1:4000/api/b/mall/activities', { headers }).then((r) => r.json()),
    ]);
    return { learn, act, prod, mact };
  });
  await bPage.screenshot({ path: '/tmp/b_browser_page.png', fullPage: true });

  const cCtx = await browser.newContext({ viewport: { width: 430, height: 932 } });
  await cCtx.addInitScript((token) => {
    window.localStorage.setItem('insurance_token', token);
  }, cVerify.token);
  const cPage = await cCtx.newPage();
  await cPage.goto(C_WEB, { waitUntil: 'networkidle' });

  const cData = await cPage.evaluate(async () => {
    const token = localStorage.getItem('insurance_token') || '';
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
    const [learn, act, prod, mact] = await Promise.all([
      fetch('http://127.0.0.1:4000/api/learning/courses', { headers }).then((r) => r.json()),
      fetch('http://127.0.0.1:4000/api/activities', { headers }).then((r) => r.json()),
      fetch('http://127.0.0.1:4000/api/mall/items', { headers }).then((r) => r.json()),
      fetch('http://127.0.0.1:4000/api/mall/activities', { headers }).then((r) => r.json()),
    ]);
    return { learn, act, prod, mact, tokenPresent: Boolean(token) };
  });
  await cPage.screenshot({ path: '/tmp/c_browser_page.png', fullPage: true });

  const result = {
    bActor: { id: bSession.actorId, name: bSession.name, tenantId: bSession.tenantId },
    customer: { mobile: '18616135811', tokenPresent: Boolean(cVerify.token) },
    b: {
      learningActive: activeCount(bData.learn.list || []),
      activityActive: activeCount(bData.act.list || []),
      mallProductsActive: activeCount(bData.prod.list || []),
      mallActivitiesActive: activeCount(bData.mact.list || []),
    },
    c: {
      learning: (cData.learn.courses || []).length,
      activity: (cData.act.activities || []).length,
      mallProducts: (cData.prod.items || []).length,
      mallActivities: (cData.mact.list || []).length,
      tokenPresentInPage: cData.tokenPresent,
    },
    screenshots: ['/tmp/b_browser_page.png', '/tmp/c_browser_page.png'],
  };

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})();
