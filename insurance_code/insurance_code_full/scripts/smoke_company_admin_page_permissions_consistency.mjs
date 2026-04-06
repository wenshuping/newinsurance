#!/usr/bin/env node

const BASE = String(process.env.API_BASE_URL || process.env.API_BASE || 'http://127.0.0.1:4100').replace(/\/+$/, '');
const TENANT_ID = Math.max(1, Number(process.env.PERMISSION_TENANT_ID || 2));
const PLATFORM_ACCOUNT = String(process.env.PLATFORM_ADMIN_ACCOUNT || 'platform001').trim();
const PLATFORM_PASSWORD = String(process.env.PLATFORM_ADMIN_PASSWORD || '123456').trim();
const COMPANY_ACCOUNT = String(process.env.COMPANY_ADMIN_ACCOUNT || 'xinhua@126.com').trim();
const COMPANY_PASSWORD = String(process.env.COMPANY_ADMIN_PASSWORD || '123456').trim();

function buildError(message, context = null) {
  const err = new Error(message);
  err.context = context;
  return err;
}

async function request(pathname, { method = 'GET', headers = {}, body } = {}) {
  const res = await fetch(`${BASE}${pathname}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data };
}

async function login(pathname, account, password) {
  const res = await request(pathname, {
    method: 'POST',
    body: { account, password },
  });
  if (!res.ok) {
    throw buildError(`login failed: ${pathname}`, {
      pathname,
      account,
      status: res.status,
      response: res.data,
    });
  }
  const session = res.data?.session || {};
  const token = String(session.token || '');
  const csrfToken = String(session.csrfToken || '');
  if (!token || !csrfToken) {
    throw buildError('session token missing after login', {
      pathname,
      account,
      session,
    });
  }
  return session;
}

function actorHeaders(session) {
  return {
    Authorization: `Bearer ${String(session.token || '')}`,
    'x-actor-type': String(session.actorType || 'employee'),
    'x-actor-id': String(session.actorId || ''),
    'x-tenant-id': String(session.tenantId || ''),
    'x-org-id': String(session.orgId || ''),
    'x-team-id': String(session.teamId || ''),
    'x-csrf-token': String(session.csrfToken || ''),
  };
}

function enabledPageIdsFromP(payload) {
  return [...new Set((payload?.grants || []).filter((row) => Boolean(row?.enabled)).map((row) => String(row?.pageId || '')).filter(Boolean))].sort();
}

function enabledPageIdsFromB(payload) {
  return [...new Set((payload?.allowedViews || []).map((row) => String(row || '')).filter(Boolean))].sort();
}

async function main() {
  const platformSession = await login('/api/p/auth/login', PLATFORM_ACCOUNT, PLATFORM_PASSWORD);
  const companySession = await login('/api/b/auth/login', COMPANY_ACCOUNT, COMPANY_PASSWORD);

  if (Number(companySession.tenantId || 0) !== TENANT_ID) {
    throw buildError('company admin tenant mismatch', {
      expectedTenantId: TENANT_ID,
      actualTenantId: Number(companySession.tenantId || 0),
      account: COMPANY_ACCOUNT,
    });
  }

  const pRes = await request(`/api/p/permissions/company-admin-pages?tenantId=${TENANT_ID}`, {
    headers: actorHeaders(platformSession),
  });
  if (!pRes.ok) {
    throw buildError('platform permission read failed', {
      status: pRes.status,
      response: pRes.data,
    });
  }

  const bRes = await request('/api/b/permissions/page-views', {
    headers: actorHeaders(companySession),
  });
  if (!bRes.ok) {
    throw buildError('b admin permission read failed', {
      status: bRes.status,
      response: bRes.data,
    });
  }

  const pEnabled = enabledPageIdsFromP(pRes.data);
  const bEnabled = enabledPageIdsFromB(bRes.data);

  if (JSON.stringify(pEnabled) !== JSON.stringify(bEnabled)) {
    throw buildError('company admin page permissions diverged between P and B', {
      tenantId: TENANT_ID,
      platform: {
        enabledPageIds: pEnabled,
        raw: pRes.data,
      },
      bAdmin: {
        enabledPageIds: bEnabled,
        raw: bRes.data,
      },
    });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        base: BASE,
        tenantId: TENANT_ID,
        companyAccount: COMPANY_ACCOUNT,
        enabledPageIds: bEnabled,
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
