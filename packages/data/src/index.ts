import { coreVersion } from '@sva/core';
import { z } from 'zod';

export * from './iam/repositories';
export * from './iam/seed-plan';
export * from './iam/types';
export * from './integrations/instance-integrations';

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
  const warnedPaths = new Set<string>();

  const emitMissingSchemaWarning = (path: string) => {
    if (warnedPaths.has(path)) {
      return;
    }
    warnedPaths.add(path);
    if (typeof process !== 'undefined' && typeof process.emitWarning === 'function') {
      process.emitWarning(`DataClient.get(${path}) called without runtime schema validation`, {
        code: 'SVA_DATA_RUNTIME_SCHEMA',
      });
    }
  };

  const isZodSchema = <T>(value: unknown): value is z.ZodType<T> => {
    return !!value && typeof value === 'object' && typeof (value as { parse?: unknown }).parse === 'function';
  };

  const get = async <T>(
    path: string,
    schemaOrInit?: z.ZodType<T> | RequestInit,
    maybeInit?: RequestInit
  ): Promise<T> => {
    const schema = isZodSchema<T>(schemaOrInit) ? schemaOrInit : undefined;
    const init: RequestInit | undefined = schema
      ? maybeInit
      : (schemaOrInit as RequestInit | undefined);
    if (!schema) {
      emitMissingSchemaWarning(path);
    }

    const cacheKey = `GET:${path}`;
    const cached = inMemoryCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return schema ? schema.parse(cached.value) : (cached.value as T);
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

    const rawPayload: unknown = await response.json();
    const payload = schema ? schema.parse(rawPayload) : (rawPayload as T);
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
