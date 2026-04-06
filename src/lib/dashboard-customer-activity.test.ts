import assert from 'node:assert/strict';
import test from 'node:test';

import { getDashboardCustomerActivityFullRows, getDashboardCustomerActivityPreviewRows } from './dashboard-customer-activity';

const rows = [
  { id: '1', occurredAt: '2026-03-31T09:01:00.000Z' },
  { id: '2', occurredAt: '2026-03-31T09:02:00.000Z' },
  { id: '3', occurredAt: '2026-03-31T09:03:00.000Z' },
  { id: '4', occurredAt: '2026-03-31T09:04:00.000Z' },
  { id: '5', occurredAt: '2026-03-31T09:05:00.000Z' },
  { id: '6', occurredAt: '2026-03-31T09:06:00.000Z' },
  { id: '7', occurredAt: '2026-03-31T09:07:00.000Z' },
  { id: '8', occurredAt: '2026-03-31T09:08:00.000Z' },
  { id: '9', occurredAt: '2026-03-31T09:09:00.000Z' },
  { id: '10', occurredAt: '2026-03-31T09:10:00.000Z' },
] as const;

test('keeps home preview capped while preserving the full same-day activity list for view-all', () => {
  assert.deepEqual(
    getDashboardCustomerActivityPreviewRows(rows).map((row) => row.id),
    ['10', '9', '8', '7', '6', '5', '4', '3'],
  );

  assert.deepEqual(
    getDashboardCustomerActivityFullRows(rows).map((row) => row.id),
    ['10', '9', '8', '7', '6', '5', '4', '3', '2', '1'],
  );
});
