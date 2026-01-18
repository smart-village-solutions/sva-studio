import { coreVersion } from '@sva-studio/core';

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const inMemoryCache = new Map<string, CacheEntry<unknown>>();

export type DataClientOptions = {
  baseUrl: string;
  cacheTtlMs?: number;
};

export const createDataClient = (options: DataClientOptions) => {
  const cacheTtlMs = options.cacheTtlMs ?? 30_000;

  const get = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const cacheKey = `GET:${path}`;
    const cached = inMemoryCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as T;
    }

    const response = await fetch(`${options.baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...init?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`DataClient GET ${path} failed with ${response.status}`);
    }

    const payload = (await response.json()) as T;
    inMemoryCache.set(cacheKey, {
      value: payload,
      expiresAt: Date.now() + cacheTtlMs,
    });

    return payload;
  };

  return {
    coreVersion,
    get,
  };
};
