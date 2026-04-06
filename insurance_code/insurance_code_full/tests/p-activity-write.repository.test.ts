import { describe, expect, it } from 'vitest';
import { insertPActivity, removePActivityByIndex } from '../server/skeleton-c-v1/repositories/p-activity-write.repository.mjs';

describe('p-activity-write.repository', () => {
  it('keeps activities and pActivities in sync when they are different arrays', () => {
    const state = {
      activities: [] as Array<Record<string, unknown>>,
      pActivities: [] as Array<Record<string, unknown>>,
    };
    const row = { id: 101, title: '同步活动' };

    insertPActivity({ state, row });

    expect(state.activities).toHaveLength(1);
    expect(state.pActivities).toHaveLength(1);
    expect(state.activities[0]).toBe(row);
    expect(state.pActivities[0]).toBe(row);

    const removed = removePActivityByIndex({ state, index: 0 });

    expect(removed).toBe(true);
    expect(state.activities).toHaveLength(0);
    expect(state.pActivities).toHaveLength(0);
  });
});
