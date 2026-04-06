import { describe, expect, it } from 'vitest';
import { buildProfilePolicyCountCacheKey, clearLegacyProfilePolicyCount, countActivePolicies, readProfilePolicyCount, writeProfilePolicyCount } from '../src/lib/profile-policy-count';

class MemoryStorage {
  private map = new Map<string, string>();

  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key)! : null;
  }

  setItem(key: string, value: string) {
    this.map.set(key, value);
  }

  removeItem(key: string) {
    this.map.delete(key);
  }
}

describe('profile policy count helpers', () => {
  it('scopes cached policy counts by current user id', () => {
    const storage = new MemoryStorage();
    writeProfilePolicyCount(101, 1, storage);
    writeProfilePolicyCount(202, 9, storage);

    expect(readProfilePolicyCount(101, storage)).toBe(1);
    expect(readProfilePolicyCount(202, storage)).toBe(9);
    expect(buildProfilePolicyCountCacheKey(101)).not.toBe(buildProfilePolicyCountCacheKey(202));
  });

  it('clears legacy unscoped cache key and counts only active policies', () => {
    const storage = new MemoryStorage();
    storage.setItem('insurance_profile_policy_count', '9');
    clearLegacyProfilePolicyCount(storage);

    expect(storage.getItem('insurance_profile_policy_count')).toBeNull();
    expect(
      countActivePolicies([
        { id: 1, status: '保障中' } as any,
        { id: 2, status: '失效' } as any,
        { id: 3, status: 'active' } as any,
      ]),
    ).toBe(2);
  });
});
