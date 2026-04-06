import { describe, expect, it } from 'vitest';

import { resolveProtectedActionSessionMode } from '../src/lib/protected-action-session';

describe('resolveProtectedActionSessionMode', () => {
  it('uses direct mode only when token, csrf, and verified user are all present', () => {
    expect(
      resolveProtectedActionSessionMode({
        token: 'token-1',
        csrfToken: 'csrf-1',
        user: { is_verified_basic: true },
      })
    ).toBe('direct');
  });

  it('forces session restore when a verified session is missing csrf', () => {
    expect(
      resolveProtectedActionSessionMode({
        token: 'token-1',
        csrfToken: '',
        user: { is_verified_basic: true },
      })
    ).toBe('restore');
  });

  it('requires fresh auth when there is no verified session', () => {
    expect(
      resolveProtectedActionSessionMode({
        token: '',
        csrfToken: '',
        user: null,
      })
    ).toBe('auth');
  });
});
