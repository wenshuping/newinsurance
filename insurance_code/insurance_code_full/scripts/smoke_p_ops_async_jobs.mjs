#!/usr/bin/env node

const BASE = process.env.API_BASE_URL || 'http://127.0.0.1:4000';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function api(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { status: response.status, body };
}

async function loginPAdmin() {
  const password = process.env.SMOKE_P_PASSWORD || '123456';
  const candidates = process.env.SMOKE_P_ACCOUNT
    ? [process.env.SMOKE_P_ACCOUNT]
    : [
        'xinhua@126.com',
        'fangyuqing@126.com',
        'tenanta_admin@demo.local',
        'tenanta_admin',
        'platform001',
      ];
  let lastStatus = 0;
  for (const account of candidates) {
    const res = await api('/api/p/auth/login', {
      method: 'POST',
      body: JSON.stringify({ account, password }),
    });
    lastStatus = res.status;
    if (res.status !== 200) continue;
    const token = String(res.body?.session?.token || '');
    const csrfToken = String(res.body?.session?.csrfToken || '');
    const tenantId = Number(res.body?.session?.tenantId || 0);
    if (!token || !csrfToken || tenantId <= 0) continue;
    return { token, csrfToken, tenantId };
  }
  throw new Error(`p admin login failed: ${lastStatus}`);
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  const auth = await loginPAdmin();
  const forceFailTimes = Math.max(0, Number(process.env.SMOKE_OPS_JOB_FORCE_FAIL_TIMES || 0));
  const headers = {
    authorization: `Bearer ${auth.token}`,
    'x-csrf-token': auth.csrfToken,
    'x-tenant-id': String(auth.tenantId),
  };

  const create = await api('/api/p/ops/jobs', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      jobType: 'reconciliation_run',
      payload: {
        day: new Date().toISOString().slice(0, 10),
        forceFailTimes,
      },
      maxAttempts: 2,
    }),
  });
  assert(create.status === 202, `create async job failed: ${create.status}`);
  const jobId = Number(create.body?.job?.id || 0);
  assert(jobId > 0, 'create async job missing id');

  const run1 = await api('/api/p/ops/jobs/run-pending', {
    method: 'POST',
    headers,
    body: JSON.stringify({ limit: 5 }),
  });
  assert(run1.status === 200, `run pending #1 failed: ${run1.status}`);
  const run1Processed = Number(run1.body?.summary?.processed || 0);

  const detail1 = await api(`/api/p/ops/jobs/${jobId}`, { method: 'GET', headers });
  assert(detail1.status === 200, `job detail #1 failed: ${detail1.status}`);
  const statusAfterRun1 = String(detail1.body?.item?.status || '');
  if (forceFailTimes > 0) {
    assert(statusAfterRun1 === 'retrying', `job should be retrying after first simulated fail, got ${statusAfterRun1}`);
    assert(run1Processed >= 1, 'run pending #1 should process at least one job');
  } else {
    assert(['success', 'running', 'queued'].includes(statusAfterRun1), `unexpected status after run #1: ${statusAfterRun1}`);
  }

  if (statusAfterRun1 !== 'success') {
    await sleep(1200);
    const run2 = await api('/api/p/ops/jobs/run-pending', {
      method: 'POST',
      headers,
      body: JSON.stringify({ limit: 5 }),
    });
    assert(run2.status === 200, `run pending #2 failed: ${run2.status}`);
  }

  const detail2 = await api(`/api/p/ops/jobs/${jobId}`, { method: 'GET', headers });
  assert(detail2.status === 200, `job detail #2 failed: ${detail2.status}`);
  assert(String(detail2.body?.item?.status || '') === 'success', `job should be success, got ${String(detail2.body?.item?.status || '')}`);

  const logsRes = await api(`/api/p/ops/jobs/${jobId}/logs`, { method: 'GET', headers });
  assert(logsRes.status === 200, `job logs failed: ${logsRes.status}`);
  const logs = Array.isArray(logsRes.body?.logs) ? logsRes.body.logs : [];
  assert(logs.length >= 3, `job logs should have >=3 entries, got ${logs.length}`);
  const messages = logs.map((row) => String(row.message || ''));
  assert(messages.some((x) => x.includes('job running attempt=')), 'job logs missing run entry');
  if (forceFailTimes > 0) {
    assert(messages.some((x) => x.includes('retry scheduled')), 'job logs missing retry entry');
  }
  assert(messages.some((x) => x.includes('job completed')), 'job logs missing completion entry');

  console.log(
    JSON.stringify(
      {
        ok: true,
        jobId,
        status: detail2.body?.item?.status,
        forceFailTimes,
        logs: logs.length,
      },
      null,
      2
    )
  );
}

run().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: String(error?.message || error),
      },
      null,
      2
    )
  );
  process.exit(1);
});
