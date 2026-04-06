import { resolveRuntimeBase } from './runtimeBase';

function normalizeBase(base: string) {
  return String(base || '').replace(/\/+$/, '');
}

export function buildApiUrl(base: string, path: string) {
  const normalizedPath = String(path || '').trim();
  if (!normalizedPath) return normalizeBase(base);
  if (/^https?:\/\//i.test(normalizedPath)) return normalizedPath;

  const resolvedBase = resolveRuntimeBase(base || '');
  if (!resolvedBase) return normalizedPath;
  if (resolvedBase.startsWith('/')) {
    return normalizedPath.startsWith(resolvedBase) ? normalizedPath : `${resolvedBase}${normalizedPath}`;
  }
  return `${normalizeBase(resolvedBase)}${normalizedPath}`;
}
