function isLoopbackHost(hostname: string) {
  const host = String(hostname || '').trim().toLowerCase();
  return host === '127.0.0.1' || host === 'localhost' || host === '0.0.0.0';
}

function isPrivateIpv4Host(hostname: string) {
  const host = String(hostname || '').trim();
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) return false;
  const [a, b] = host.split('.').map((part) => Number(part));
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

export function resolveRuntimeAssetUrl(raw: string) {
  const value = String(raw || '').trim();
  if (!value) return '';
  if (typeof window === 'undefined') return value;
  const currentHref = String(window.location?.href || '').trim();
  if (!currentHref) return value;
  let current: URL;
  try {
    current = new URL(currentHref);
  } catch {
    return value;
  }
  if (value.startsWith('/')) {
    return `${current.origin}${value}`;
  }
  try {
    const target = new URL(value);
    if (!target.pathname.startsWith('/uploads/')) return value;
    if (
      isLoopbackHost(target.hostname) ||
      (isPrivateIpv4Host(target.hostname) && target.hostname !== current.hostname)
    ) {
      return `${current.origin}${target.pathname}${target.search}${target.hash}`;
    }
    return value;
  } catch {
    return value;
  }
}
