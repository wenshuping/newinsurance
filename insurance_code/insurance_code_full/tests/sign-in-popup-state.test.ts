import { beforeEach, describe, expect, it } from 'vitest';

import { clearCachedSignedToday, readCachedSignedToday, resolveInitialSignPopupState, shouldAutoOpenSignInPopup, writeCachedSignedToday } from '../src/lib/sign-in-popup-state';

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

describe('sign-in popup state', () => {
  const storage = new MemoryStorage();
  const today = new Date('2026-03-30T10:00:00+08:00');

  beforeEach(() => {
    clearCachedSignedToday('token-a', { storage });
    clearCachedSignedToday('token-b', { storage });
  });

  it('keeps sign status pending when a session exists but user info is not hydrated yet', () => {
    expect(resolveInitialSignPopupState('token-a', null, { date: today, storage })).toEqual({
      hasSignedToday: false,
      signStatusReady: false,
    });
  });

  it('restores signed-today state from session-scoped cache after refresh', () => {
    writeCachedSignedToday('token-a', { date: today, storage });

    expect(readCachedSignedToday('token-a', { date: today, storage })).toBe(true);
    expect(resolveInitialSignPopupState('token-a', null, { date: today, storage })).toEqual({
      hasSignedToday: true,
      signStatusReady: true,
    });
    expect(resolveInitialSignPopupState('token-b', null, { date: today, storage })).toEqual({
      hasSignedToday: false,
      signStatusReady: false,
    });
  });

  it('allows popup fallback for known unverified users', () => {
    expect(resolveInitialSignPopupState('token-a', { is_verified_basic: false }, { date: today, storage })).toEqual({
      hasSignedToday: false,
      signStatusReady: true,
    });
  });

  it('does not auto-open the sign-in popup for already verified users', () => {
    expect(
      shouldAutoOpenSignInPopup({
        isSharePage: false,
        openMall: false,
        currentTab: 'home',
        showAuthModal: false,
        signStatusReady: true,
        hasSignedToday: false,
        isVerifiedBasic: true,
      })
    ).toBe(false);
  });
});
