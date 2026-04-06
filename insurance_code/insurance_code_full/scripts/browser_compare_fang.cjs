const { request } = require('playwright');

const API = 'http://127.0.0.1:4000';

function activeCount(list = []) {
  const ok = new Set(['active', 'online', 'published', 'ongoing', 'on', '进行中', '生效']);
  return (list || []).filter((x) => ok.has(String(x?.status || '').toLowerCase())).length;
}

async function getJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

(async () => {
  const api = await request.newContext();

  const bLoginRes = await api.post(`${API}/api/b/auth/login`, {
    data: { account: 'fangyuqing@126.com', password: '123456' },
  });
  const bLogin = await getJson(bLoginRes);
  if (!bLogin?.session?.token) {
    console.log(
      JSON.stringify(
        { ok: false, step: 'b_login', status: bLoginRes.status(), payload: bLogin },
        null,
        2
      )
    );
    process.exit(1);
  }

  const bSession = bLogin.session;
  const bHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${bSession.token}`,
    'x-csrf-token': String(bSession.csrfToken || ''),
    'x-actor-type': String(bSession.actorType || 'employee'),
    'x-actor-id': String(bSession.actorId || ''),
    'x-tenant-id': String(bSession.tenantId || ''),
    'x-org-id': String(bSession.orgId || ''),
    'x-team-id': String(bSession.teamId || ''),
  };

  const [bLearnRes, bActRes, bProdRes, bMallActRes, bCustomersRes] = await Promise.all([
    api.get(`${API}/api/b/content/items`, { headers: bHeaders }),
    api.get(`${API}/api/b/activity-configs`, { headers: bHeaders }),
    api.get(`${API}/api/b/mall/products`, { headers: bHeaders }),
    api.get(`${API}/api/b/mall/activities`, { headers: bHeaders }),
    api.get(`${API}/api/b/customers`, { headers: bHeaders }),
  ]);

  const [bLearn, bAct, bProd, bMallAct, bCustomers] = await Promise.all([
    getJson(bLearnRes),
    getJson(bActRes),
    getJson(bProdRes),
    getJson(bMallActRes),
    getJson(bCustomersRes),
  ]);

  const bCounts = {
    learningActive: activeCount(bLearn?.list || []),
    activityActive: activeCount(bAct?.list || []),
    mallProductsActive: activeCount(bProd?.list || []),
    mallActivitiesActive: activeCount(bMallAct?.list || []),
  };

  const mine = (bCustomers?.list || []).filter(
    (c) => Number(c.ownerUserId || 0) === Number(bSession.actorId || 0)
  );

  const mismatch = [];
  const details = [];

  for (const c of mine) {
    const mobile = String(c.mobile || '').trim();
    if (!mobile) continue;

    const verifyRes = await api.post(`${API}/api/auth/verify-basic`, {
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': String(bSession.tenantId || 1),
      },
      data: { name: c.name || '客户', mobile, code: '123456', tenantId: Number(bSession.tenantId || 1) },
    });
    const verify = await getJson(verifyRes);
    if (!verify?.token) {
      details.push({ mobile, ok: false, reason: 'c_verify_failed', payload: verify });
      continue;
    }

    const cHeaders = {
      Authorization: `Bearer ${verify.token}`,
      'Content-Type': 'application/json',
    };
    const [learnRes, actRes, prodRes, mallActRes] = await Promise.all([
      api.get(`${API}/api/learning/courses`, { headers: cHeaders }),
      api.get(`${API}/api/activities`, { headers: cHeaders }),
      api.get(`${API}/api/mall/items`, { headers: cHeaders }),
      api.get(`${API}/api/mall/activities`, { headers: cHeaders }),
    ]);

    const [learn, act, prod, mallAct] = await Promise.all([
      getJson(learnRes),
      getJson(actRes),
      getJson(prodRes),
      getJson(mallActRes),
    ]);

    const one = {
      customerId: Number(c.id),
      name: String(c.name || ''),
      mobile,
      b: bCounts,
      c: {
        learning: Array.isArray(learn?.courses) ? learn.courses.length : 0,
        activity: Array.isArray(act?.activities) ? act.activities.length : 0,
        mallProducts: Array.isArray(prod?.items) ? prod.items.length : 0,
        mallActivities: Array.isArray(mallAct?.list) ? mallAct.list.length : 0,
      },
    };
    details.push(one);

    if (
      one.b.learningActive !== one.c.learning ||
      one.b.activityActive !== one.c.activity ||
      one.b.mallProductsActive !== one.c.mallProducts ||
      one.b.mallActivitiesActive !== one.c.mallActivities
    ) {
      mismatch.push(one);
    }
  }

  await api.dispose();

  console.log(
    JSON.stringify(
      {
        ok: mismatch.length === 0,
        mode: 'api-contract-compare',
        bActor: {
          id: Number(bSession.actorId),
          account: 'fangyuqing@126.com',
          name: String(bSession.name || ''),
          tenantId: Number(bSession.tenantId || 0),
        },
        bCounts,
        ownedCustomerCount: mine.length,
        mismatchCount: mismatch.length,
        mismatch,
        details,
      },
      null,
      2
    )
  );
})().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: String(error?.message || error),
        stack: String(error?.stack || ''),
      },
      null,
      2
    )
  );
  process.exit(1);
});
