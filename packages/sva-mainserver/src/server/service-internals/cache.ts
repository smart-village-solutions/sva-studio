export type TimedCacheEntry<TValue> = {
  value: TValue;
  expiresAtMs: number;
  lastUsedAtMs: number;
};

const pruneTimedCache = <TValue>(
  cache: Map<string, TimedCacheEntry<TValue>>,
  nowMs: number,
  maxSize: number
): void => {
  let oldestLiveKey: string | null = null;
  let oldestLiveTimestamp = Number.POSITIVE_INFINITY;

  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAtMs <= nowMs) {
      cache.delete(key);
      continue;
    }

    if (entry.lastUsedAtMs < oldestLiveTimestamp) {
      oldestLiveTimestamp = entry.lastUsedAtMs;
      oldestLiveKey = key;
    }
  }

  while (cache.size > maxSize) {
    if (oldestLiveKey !== null) {
      cache.delete(oldestLiveKey);
    } else {
      const firstKey = cache.keys().next().value;
      if (firstKey === undefined) {
        return;
      }
      cache.delete(firstKey);
    }

    oldestLiveKey = null;
    oldestLiveTimestamp = Number.POSITIVE_INFINITY;
    for (const [key, entry] of cache.entries()) {
      if (entry.lastUsedAtMs < oldestLiveTimestamp) {
        oldestLiveTimestamp = entry.lastUsedAtMs;
        oldestLiveKey = key;
      }
    }
  }
};

export const readTimedCacheValue = <TValue>(
  cache: Map<string, TimedCacheEntry<TValue>>,
  key: string,
  nowMs: number,
  maxSize: number
): TValue | null => {
  pruneTimedCache(cache, nowMs, maxSize);

  const entry = cache.get(key);
  if (!entry) {
    return null;
  }

  if (entry.expiresAtMs <= nowMs) {
    cache.delete(key);
    return null;
  }

  entry.lastUsedAtMs = nowMs;
  return entry.value;
};

export const writeTimedCacheValue = <TValue>(
  cache: Map<string, TimedCacheEntry<TValue>>,
  key: string,
  value: TValue,
  expiresAtMs: number,
  nowMs: number,
  maxSize: number
): void => {
  cache.set(key, {
    value,
    expiresAtMs,
    lastUsedAtMs: nowMs,
  });

  pruneTimedCache(cache, nowMs, maxSize);
};
