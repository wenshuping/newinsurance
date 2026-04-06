function normalizeBase(base: string) {
  return String(base || '').replace(/\/+$/, '');
}

function isLoopbackHost(hostname: string) {
  const host = String(hostname || '').trim().toLowerCase();
  return host === '127.0.0.1' || host === 'localhost' || host === '0.0.0.0';
}

export function resolveRuntimeBase(base: string, currentHref?: string) {
  const normalized = normalizeBase(base);
  if (!normalized || normalized.startsWith('/')) return normalized;

  try {
    const target = new URL(normalized);
    const current = new URL(currentHref || (typeof window === 'undefined' ? 'http://127.0.0.1/' : window.location.href));
    if (!isLoopbackHost(target.hostname) || isLoopbackHost(current.hostname)) {
      return normalized;
    }
    target.hostname = current.hostname;
    if (current.protocol === 'https:' && target.protocol === 'http:') {
      target.protocol = 'https:';
    }
    return normalizeBase(target.toString());
  } catch {
    return normalized;
  }
}
