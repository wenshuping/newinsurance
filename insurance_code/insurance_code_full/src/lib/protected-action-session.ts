export type ProtectedActionSessionUser = {
  is_verified_basic?: boolean | null;
} | null | undefined;

export type ProtectedActionSessionMode = 'direct' | 'restore' | 'auth';

export function resolveProtectedActionSessionMode(input: {
  token?: string | null;
  csrfToken?: string | null;
  user?: ProtectedActionSessionUser;
}): ProtectedActionSessionMode {
  const token = String(input.token || '').trim();
  const csrfToken = String(input.csrfToken || '').trim();
  const isVerifiedBasic = Boolean(input.user?.is_verified_basic);

  if (token && csrfToken && isVerifiedBasic) return 'direct';
  if (token && isVerifiedBasic) return 'restore';
  return 'auth';
}
