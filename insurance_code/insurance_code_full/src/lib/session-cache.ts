const SESSION_CACHE_VERSION = 'v1';

function normalizeSessionToken(sessionToken?: string | null) {
  return String(sessionToken || '').trim();
}

function fingerprintSessionToken(sessionToken: string) {
  let hash = 2166136261;
  for (let index = 0; index < sessionToken.length; index += 1) {
    hash ^= sessionToken.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function buildSessionScopedStorageKey(baseKey: string, sessionToken?: string | null) {
  const normalizedToken = normalizeSessionToken(sessionToken);
  if (!normalizedToken) return baseKey;
  return `${baseKey}:${SESSION_CACHE_VERSION}:${fingerprintSessionToken(normalizedToken)}`;
}
