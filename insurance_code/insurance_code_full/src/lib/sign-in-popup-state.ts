import type { User } from './api';
import { buildSessionScopedStorageKey } from './session-cache';

const SIGNED_TODAY_CACHE_KEY = 'insurance_signed_today_cache';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type MinimalUser = Pick<User, 'is_verified_basic'> | null | undefined;
type SignInPopupVisibilityInput = {
  isSharePage: boolean;
  openMall: boolean;
  currentTab: string;
  showAuthModal: boolean;
  signStatusReady: boolean;
  hasSignedToday: boolean;
  isVerifiedBasic: boolean;
};

function resolveStorage(storage?: StorageLike | null) {
  if (storage) return storage;
  if (typeof localStorage === 'undefined') return null;
  return localStorage;
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function formatLocalDayKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function resolveSignedTodayStorageKey(sessionToken?: string | null) {
  return buildSessionScopedStorageKey(SIGNED_TODAY_CACHE_KEY, sessionToken);
}

export function readCachedSignedToday(sessionToken?: string | null, options: { date?: Date; storage?: StorageLike | null } = {}) {
  const normalizedToken = String(sessionToken || '').trim();
  if (!normalizedToken) return false;
  const storage = resolveStorage(options.storage);
  if (!storage) return false;
  return storage.getItem(resolveSignedTodayStorageKey(normalizedToken)) === formatLocalDayKey(options.date);
}

export function writeCachedSignedToday(sessionToken?: string | null, options: { date?: Date; storage?: StorageLike | null } = {}) {
  const normalizedToken = String(sessionToken || '').trim();
  const storage = resolveStorage(options.storage);
  if (!normalizedToken || !storage) return;
  storage.removeItem(SIGNED_TODAY_CACHE_KEY);
  storage.setItem(resolveSignedTodayStorageKey(normalizedToken), formatLocalDayKey(options.date));
}

export function clearCachedSignedToday(sessionToken?: string | null, options: { storage?: StorageLike | null } = {}) {
  const storage = resolveStorage(options.storage);
  if (!storage) return;
  storage.removeItem(SIGNED_TODAY_CACHE_KEY);
  storage.removeItem(resolveSignedTodayStorageKey(sessionToken));
}

export function resolveInitialSignPopupState(sessionToken?: string | null, user?: MinimalUser, options: { date?: Date; storage?: StorageLike | null } = {}) {
  const normalizedToken = String(sessionToken || '').trim();
  if (!normalizedToken) {
    return {
      hasSignedToday: false,
      signStatusReady: true,
    };
  }

  const cachedSignedToday = readCachedSignedToday(normalizedToken, options);
  if (cachedSignedToday) {
    return {
      hasSignedToday: true,
      signStatusReady: true,
    };
  }

  if (!user) {
    return {
      hasSignedToday: false,
      signStatusReady: false,
    };
  }

  if (user.is_verified_basic) {
    return {
      hasSignedToday: false,
      signStatusReady: false,
    };
  }

  return {
    hasSignedToday: false,
    signStatusReady: true,
  };
}

export function shouldAutoOpenSignInPopup(input: SignInPopupVisibilityInput) {
  if (input.isSharePage) return false;
  if (input.openMall) return false;
  if (input.currentTab !== 'home') return false;
  if (input.showAuthModal) return false;
  if (!input.signStatusReady) return false;
  if (input.hasSignedToday) return false;
  if (input.isVerifiedBasic) return false;
  return true;
}
