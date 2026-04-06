import type { InsurancePolicy } from './api';

const LEGACY_POLICY_COUNT_CACHE_KEY = 'insurance_profile_policy_count';
const POLICY_COUNT_CACHE_PREFIX = 'insurance_profile_policy_count:v2';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function normalizeUserId(userId?: number | null) {
  const value = Number(userId || 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function resolveStorage(storage?: StorageLike | null) {
  if (storage) return storage;
  if (typeof localStorage !== 'undefined') return localStorage;
  return null;
}

export function buildProfilePolicyCountCacheKey(userId?: number | null) {
  const normalizedUserId = normalizeUserId(userId);
  return `${POLICY_COUNT_CACHE_PREFIX}:${normalizedUserId > 0 ? normalizedUserId : 'guest'}`;
}

export function readProfilePolicyCount(userId?: number | null, storage?: StorageLike | null) {
  const targetStorage = resolveStorage(storage);
  if (!targetStorage) return 0;
  const raw = targetStorage.getItem(buildProfilePolicyCountCacheKey(userId));
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

export function writeProfilePolicyCount(userId: number | null | undefined, count: number, storage?: StorageLike | null) {
  const targetStorage = resolveStorage(storage);
  if (!targetStorage) return;
  const normalized = Number.isFinite(Number(count)) ? Math.max(0, Number(count)) : 0;
  targetStorage.setItem(buildProfilePolicyCountCacheKey(userId), String(normalized));
}

export function clearLegacyProfilePolicyCount(storage?: StorageLike | null) {
  const targetStorage = resolveStorage(storage);
  if (!targetStorage) return;
  targetStorage.removeItem(LEGACY_POLICY_COUNT_CACHE_KEY);
}

export function countActivePolicies(policies: InsurancePolicy[] = []) {
  return policies.filter((policy) => {
    const status = String(policy?.status || '').trim();
    return status === '保障中' || status.toLowerCase() === 'active';
  }).length;
}
