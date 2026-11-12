type CacheEntry = { value: unknown; expiresAt: number };

const queryCache = new Map<string, CacheEntry>();

export function getCachedQuery<T>(key: string): T | null {
  const entry = queryCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    queryCache.delete(key);
    return null;
  }
  return entry.value as T;
}

export function setCachedQuery<T>(key: string, value: T, maxAgeMs: number): void {
  queryCache.set(key, { value, expiresAt: Date.now() + maxAgeMs });
}

export function clearQueryCache(key?: string): void {
  if (key) queryCache.delete(key);
  else queryCache.clear();
}
