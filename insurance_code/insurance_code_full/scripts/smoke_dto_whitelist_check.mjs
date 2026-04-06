#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const BASE = String(process.env.API_BASE_URL || process.env.API_BASE || 'http://127.0.0.1:4000').replace(/\/+$/, '');
const TENANT_ID = String(process.env.SMOKE_TENANT_ID || '1');
const WHITELIST_PATH = path.join(process.cwd(), 'docs', 'dto-whitelist-v1.json');

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function typeOf(value) {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}

function validateShape(value, schema, currentPath, errors) {
  if (!schema || schema.any) return;

  if (value === null) {
    if (!schema.nullable) errors.push(`${currentPath}: should not be null`);
    return;
  }

  if (schema.type === 'object') {
    if (!isObject(value)) {
      errors.push(`${currentPath}: expected object, got ${typeOf(value)}`);
      return;
    }
    const props = schema.properties || {};
    const required = new Set(schema.required || []);
    for (const key of required) {
      if (!(key in value)) errors.push(`${currentPath}.${key}: missing required field`);
    }
    if (schema.allowExtra === false) {
      for (const key of Object.keys(value)) {
        if (!(key in props)) errors.push(`${currentPath}.${key}: extra field not in whitelist`);
      }
    }
    for (const [key, propSchema] of Object.entries(props)) {
      if (!(key in value)) continue;
      validateShape(value[key], propSchema, `${currentPath}.${key}`, errors);
    }
    return;
  }

  if (schema.type === 'array') {
    if (!Array.isArray(value)) {
      errors.push(`${currentPath}: expected array, got ${typeOf(value)}`);
      return;
    }
    const itemSchema = schema.item;
    if (!itemSchema) return;
    const maxCheck = Math.min(value.length, Number(process.env.SMOKE_DTO_ARRAY_SAMPLE || 5));
    for (let i = 0; i < maxCheck; i += 1) {
      validateShape(value[i], itemSchema, `${currentPath}[${i}]`, errors);
    }
    return;
  }

  if (schema.type === 'number') {
    if (typeof value !== 'number' || Number.isNaN(value)) errors.push(`${currentPath}: expected number, got ${typeOf(value)}`);
    return;
  }
  if (schema.type === 'string') {
    if (typeof value !== 'string') errors.push(`${currentPath}: expected string, got ${typeOf(value)}`);
    return;
  }
  if (schema.type === 'boolean') {
    if (typeof value !== 'boolean') errors.push(`${currentPath}: expected boolean, got ${typeOf(value)}`);
  }
}

async function request(pathname, { method = 'GET', body, token = '', csrfToken = '' } = {}) {
  const headers = {
    ...(body ? { 'content-type': 'application/json' } : {}),
    'x-tenant-id': TENANT_ID,
  };
  if (token) headers.authorization = `Bearer ${token}`;
  if (csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) headers['x-csrf-token'] = csrfToken;

  const res = await fetch(`${BASE}${pathname}`, {
    method,
    headers,
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

function assertOk(response, label) {
  if (!response.ok) {
    throw new Error(`${label} failed with status=${response.status}, code=${response.data?.code || ''}`);
  }
}

async function main() {
  if (!fs.existsSync(WHITELIST_PATH)) {
    throw new Error(`dto whitelist not found: ${WHITELIST_PATH}`);
  }
  const whitelist = JSON.parse(fs.readFileSync(WHITELIST_PATH, 'utf8'));
  const endpoints = Array.isArray(whitelist.endpoints) ? whitelist.endpoints : [];

  const mobile = `139${String(Date.now()).slice(-8)}`;
  const verifyBasicBody = { name: '张三', mobile, code: '123456' };
  const auth = { token: '', csrfToken: '' };
  const report = [];
  const failures = [];

  for (const endpoint of endpoints) {
    const method = String(endpoint.method || 'GET').toUpperCase();
    const pathValue = String(endpoint.path || '');
    const schema = endpoint.schema || null;
    const body = endpoint.bodyFromContext === 'verifyBasicBody' ? verifyBasicBody : undefined;
    const response = await request(pathValue, {
      method,
      body,
      token: endpoint.auth ? auth.token : '',
      csrfToken: endpoint.auth ? auth.csrfToken : '',
    });
    assertOk(response, endpoint.name || pathValue);

    if (pathValue === '/api/auth/verify-basic') {
      auth.token = String(response.data?.token || '');
      auth.csrfToken = String(response.data?.csrfToken || '');
      if (!auth.token) throw new Error('verify-basic response missing token');
      if (!auth.csrfToken) throw new Error('verify-basic response missing csrfToken');
    }

    const errors = [];
    validateShape(response.data, schema, '$', errors);
    if (errors.length > 0) {
      failures.push({
        endpoint: endpoint.name || pathValue,
        method,
        path: pathValue,
        errors,
      });
    }
    report.push({
      endpoint: endpoint.name || pathValue,
      method,
      path: pathValue,
      status: response.status,
      ok: errors.length === 0,
    });
  }

  if (failures.length > 0) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          base: BASE,
          failures,
          report,
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        base: BASE,
        checked: report.length,
        report,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
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
