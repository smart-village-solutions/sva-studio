import { describe, expect, it } from 'vitest';

import { readTimedCacheValue, writeTimedCacheValue, type TimedCacheEntry } from './cache.js';

describe('service-internals/cache', () => {
  it('returns cached values until they expire and updates last-used timestamps', () => {
    const cache = new Map<string, TimedCacheEntry<string>>();

    writeTimedCacheValue(cache, 'alpha', 'value-a', 1_000, 100, 2);

    expect(readTimedCacheValue(cache, 'alpha', 150, 2)).toBe('value-a');
    expect(cache.get('alpha')?.lastUsedAtMs).toBe(150);
    expect(readTimedCacheValue(cache, 'alpha', 1_000, 2)).toBeNull();
    expect(cache.has('alpha')).toBe(false);
  });

  it('evicts the least recently used live entry when the cache exceeds its max size', () => {
    const cache = new Map<string, TimedCacheEntry<string>>();

    writeTimedCacheValue(cache, 'alpha', 'value-a', 1_000, 100, 2);
    writeTimedCacheValue(cache, 'beta', 'value-b', 1_000, 200, 2);

    expect(readTimedCacheValue(cache, 'alpha', 250, 2)).toBe('value-a');

    writeTimedCacheValue(cache, 'gamma', 'value-c', 1_000, 300, 2);

    expect(cache.has('alpha')).toBe(true);
    expect(cache.has('beta')).toBe(false);
    expect(cache.has('gamma')).toBe(true);
  });
});
