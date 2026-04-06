import { describe, expect, it } from 'vitest';

import { canOpenProtectedShareTarget } from '../src/lib/share-access';

describe('canOpenProtectedShareTarget', () => {
  it('allows anonymous viewers to open shared content pages', () => {
    expect(
      canOpenProtectedShareTarget({
        loginRequired: true,
        isAuthenticated: false,
        isVerifiedBasic: false,
      })
    ).toBe(true);
  });

  it('still allows verified viewers to open shared content pages', () => {
    expect(
      canOpenProtectedShareTarget({
        loginRequired: true,
        isAuthenticated: true,
        isVerifiedBasic: true,
      })
    ).toBe(true);
  });

  it('allows public share pages as well', () => {
    expect(
      canOpenProtectedShareTarget({
        loginRequired: false,
        isAuthenticated: false,
        isVerifiedBasic: false,
      })
    ).toBe(true);
  });
});
