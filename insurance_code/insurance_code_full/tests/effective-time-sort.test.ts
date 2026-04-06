import { describe, expect, it } from 'vitest';

import { sortRowsByEffectiveTimeDesc } from '../server/skeleton-c-v1/common/effective-time-sort.mjs';

describe('sortRowsByEffectiveTimeDesc', () => {
  it('sorts rows by effective time descending with updatedAt and id fallback', () => {
    const rows = [
      { id: 101, createdAt: '2026-03-18T08:00:00.000Z', updatedAt: '2026-03-18T08:00:00.000Z' },
      { id: 102, createdAt: '2026-03-18T08:00:00.000Z', updatedAt: '2026-03-20T08:00:00.000Z' },
      { id: 103, createdAt: '2026-03-18T08:00:00.000Z', effectiveAt: '2026-03-21T08:00:00.000Z' },
      { id: 104, createdAt: '2026-03-18T08:00:00.000Z', effectiveStartAt: '2026-03-19T08:00:00.000Z' },
      { id: 105, createdAt: '2026-03-19T12:00:00.000Z' },
    ];

    const sorted = sortRowsByEffectiveTimeDesc(rows);

    expect(sorted.map((row) => row.id)).toEqual([103, 102, 105, 104, 101]);
  });
});
