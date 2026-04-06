import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveEffectiveTimeMs, sortByEffectiveTimeDesc } from './effectiveTimeSort';

test('resolveEffectiveTimeMs prefers effective time over update time', () => {
  assert.equal(
    resolveEffectiveTimeMs({
      effectiveStartAt: '2026-03-20T10:00:00.000Z',
      updatedAt: '2026-03-19T10:00:00.000Z',
      createdAt: '2026-03-18T10:00:00.000Z',
    }),
    Date.parse('2026-03-20T10:00:00.000Z')
  );
});

test('sortByEffectiveTimeDesc sorts newer effective time first', () => {
  const rows = sortByEffectiveTimeDesc([
    { id: 1, updatedAt: '2026-03-18T10:00:00.000Z' },
    { id: 2, updatedAt: '2026-03-20T10:00:00.000Z' },
    { id: 3, updatedAt: '2026-03-19T10:00:00.000Z' },
  ]);

  assert.deepEqual(
    rows.map((row) => row.id),
    [2, 3, 1]
  );
});

test('sortByEffectiveTimeDesc falls back to createdAt and then id desc', () => {
  const rows = sortByEffectiveTimeDesc([
    { id: 7, createdAt: '2026-03-18T10:00:00.000Z' },
    { id: 9, createdAt: '2026-03-18T10:00:00.000Z' },
    { id: 5, createdAt: '2026-03-17T10:00:00.000Z' },
  ]);

  assert.deepEqual(
    rows.map((row) => row.id),
    [9, 7, 5]
  );
});
