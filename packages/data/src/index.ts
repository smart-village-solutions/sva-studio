import { coreVersion } from '@sva/core';
import { createSdkLogger } from '@sva/sdk/server';
import { z } from 'zod';

export * from './iam/repositories';
export * from './iam/seed-plan';
export * from './iam/types';
export * from './integrations/instance-integrations';
export * from './instance-registry';

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const inMemoryCache = new Map<string, CacheEntry<unknown>>();
const logger = createSdkLogger({ component: 'data-client', level: 'info' });

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
      logger.debug('cache_hit', {
        operation: 'get',
        path,
        cache_key: cacheKey,
      });
      if (!schema) {
        return cached.value as T;
      }
      try {
        return schema.parse(cached.value);
      } catch (error) {
        logger.error('schema_validation_failed', {
          operation: 'get',
          path,
          cache_key: cacheKey,
          source: 'cache',
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }

    logger.debug('cache_miss', {
      operation: 'get',
      path,
      cache_key: cacheKey,
    });
    logger.debug('request_started', {
      operation: 'get',
      path,
      base_url: options.baseUrl,
    });

    const response = await fetch(`${options.baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...init?.headers,
      },
    });

    if (!response.ok) {
      logger.error('request_failed', {
        operation: 'get',
        path,
        status: response.status,
      });
      throw new Error(`DataClient GET ${path} failed with ${response.status}`);
    }

    const rawPayload: unknown = await response.json();
    let payload: T;
    if (schema) {
      try {
        payload = schema.parse(rawPayload);
      } catch (error) {
        logger.error('schema_validation_failed', {
          operation: 'get',
          path,
          source: 'network',
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    } else {
      payload = rawPayload as T;
    }
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
