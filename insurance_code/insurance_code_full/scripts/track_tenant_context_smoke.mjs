#!/usr/bin/env node

const BASE = String(process.env.API_BASE_URL || process.env.API_BASE || 'http://127.0.0.1:4000').replace(/\/+$/, '');

async function request(path, { method = 'GET', body, extraHeaders = {} } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...extraHeaders,
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

function assert(condition, message, context) {
  if (!condition) {
    const err = new Error(message);
    err.context = context;
    throw err;
  }
}

async function main() {
  const payload = {
    event: 'c_smoke_track_event',
    properties: { source: 'track_tenant_context_smoke' },
  };

  const noTenant = await request('/api/track/events', { method: 'POST', body: payload });
  assert(
    noTenant.status === 400 && String(noTenant.data?.code || '') === 'TENANT_CONTEXT_REQUIRED',
    'track route should reject missing tenant context',
    noTenant
  );

  const withTenant = await request('/api/track/events', {
    method: 'POST',
    body: payload,
    extraHeaders: { 'x-tenant-id': '1' },
  });
  assert(withTenant.ok && withTenant.status === 200 && withTenant.data?.ok === true, 'track route should accept tenant-scoped event', withTenant);

  console.log(
    JSON.stringify(
      {
        ok: true,
        base: BASE,
        checks: [
          { name: 'track.reject_missing_tenant', status: noTenant.status, code: noTenant.data?.code || '' },
          { name: 'track.accept_with_tenant', status: withTenant.status, ok: Boolean(withTenant.data?.ok) },
        ],
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

