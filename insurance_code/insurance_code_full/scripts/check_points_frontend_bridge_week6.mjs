#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const API_FILE = path.join(ROOT, 'src/lib/api.ts');
const SRC_ROOT = path.join(ROOT, 'src');

function fail(message, context = null) {
  console.error(JSON.stringify({ ok: false, message, context }, null, 2));
  process.exit(1);
}

function mustContain(code, pattern, file, why) {
  if (!code.includes(pattern)) fail(why, { file, pattern });
}

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;
      walkFiles(full, out);
      continue;
    }
    if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function main() {
  if (!fs.existsSync(API_FILE)) fail('src/lib/api.ts not found', { file: API_FILE });

  const apiCode = fs.readFileSync(API_FILE, 'utf8');

  mustContain(apiCode, 'const POINTS_SERVICE_BASE = normalizeBase(import.meta.env.VITE_POINTS_SERVICE_BASE || API_BASE);', API_FILE, 'api bridge must define POINTS_SERVICE_BASE');
  mustContain(apiCode, "request<{ ok: boolean; reward: number; balance: number }>('/api/sign-in', { method: 'POST' }, { baseUrl: POINTS_SERVICE_BASE })", API_FILE, 'signIn must use POINTS_SERVICE_BASE');
  mustContain(apiCode, "request<PointsSummaryResponse>('/api/points/summary', undefined, { baseUrl: POINTS_SERVICE_BASE })", API_FILE, 'pointsSummary must use POINTS_SERVICE_BASE');
  mustContain(apiCode, "request<{ list: any[] }>('/api/points/transactions', undefined, { baseUrl: POINTS_SERVICE_BASE })", API_FILE, 'pointsTransactions must use POINTS_SERVICE_BASE');
  mustContain(apiCode, "request<{ balance: number; groups: PointDetailGroup[] }>('/api/points/detail', undefined, { baseUrl: POINTS_SERVICE_BASE })", API_FILE, 'pointsDetail must use POINTS_SERVICE_BASE');
  mustContain(apiCode, "request<{ items: any[] }>('/api/mall/items', undefined, { baseUrl: POINTS_SERVICE_BASE })", API_FILE, 'mallItems must use POINTS_SERVICE_BASE');
  mustContain(apiCode, "request<{ list: any[] }>('/api/mall/activities', undefined, { baseUrl: POINTS_SERVICE_BASE })", API_FILE, 'mallActivities must use POINTS_SERVICE_BASE');
  mustContain(apiCode, "'/api/mall/redeem'", API_FILE, 'redeem route must stay in bridge');
  mustContain(apiCode, "`/api/mall/activities/${id}/join`", API_FILE, 'joinMallActivity route must stay in bridge');
  mustContain(apiCode, "request<{ list: any[] }>('/api/redemptions', undefined, { baseUrl: POINTS_SERVICE_BASE })", API_FILE, 'redemptions must use POINTS_SERVICE_BASE');
  mustContain(apiCode, "request<{ ok: boolean }>(`/api/redemptions/${id}/writeoff`", API_FILE, 'writeoff must use POINTS_SERVICE_BASE');
  mustContain(apiCode, "request<{ list: any[] }>('/api/orders', undefined, { baseUrl: POINTS_SERVICE_BASE })", API_FILE, 'orders must use POINTS_SERVICE_BASE');
  mustContain(apiCode, "request<{ order: any; redemption: any | null }>(`/api/orders/${id}`", API_FILE, 'orderDetail must use POINTS_SERVICE_BASE');
  mustContain(apiCode, "request<{ ok: boolean; order: any }>('/api/orders', {", API_FILE, 'createOrder must use POINTS_SERVICE_BASE');
  mustContain(apiCode, "request<{ ok: boolean; order: any; redemption: any | null }>(`/api/orders/${id}/pay`", API_FILE, 'payOrder must use POINTS_SERVICE_BASE');
  mustContain(apiCode, "request<{ ok: boolean; order: any }>(`/api/orders/${id}/cancel`", API_FILE, 'cancelOrder must use POINTS_SERVICE_BASE');
  mustContain(apiCode, "request<{ ok: boolean; order: any }>(`/api/orders/${id}/refund`", API_FILE, 'refundOrder must use POINTS_SERVICE_BASE');

  const guardedPatterns = [
    '/api/sign-in',
    '/api/points/summary',
    '/api/points/transactions',
    '/api/points/detail',
    '/api/mall/items',
    '/api/mall/activities',
    '/api/mall/redeem',
    '/api/redemptions',
    '/api/orders',
  ];

  const directRouteLeaks = [];
  for (const file of walkFiles(SRC_ROOT)) {
    if (file === API_FILE) continue;
    const code = fs.readFileSync(file, 'utf8');
    const rel = path.relative(ROOT, file).replaceAll('\\', '/');
    for (const pattern of guardedPatterns) {
      if (code.includes(pattern)) {
        directRouteLeaks.push({ file: rel, pattern });
      }
    }
  }

  if (directRouteLeaks.length > 0) {
    fail('points frontend routes must stay behind src/lib/api.ts', { directRouteLeaks });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        checks: [
          'points_service_base_defined',
          'points_owned_routes_use_points_service_base',
          'no_direct_points_route_literals_outside_api_bridge',
        ],
      },
      null,
      2
    )
  );
}

main();
