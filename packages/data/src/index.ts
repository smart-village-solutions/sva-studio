import { coreVersion } from '@sva/core';
import { z } from 'zod';

export * from './iam/repositories.js';
export * from './iam/seed-plan.js';
export * from './iam/types.js';
export * from './integrations/instance-integrations.js';
export * from './instance-registry/index.js';

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

type DataClientLogger = {
  debug: (event: string, context?: Record<string, unknown>) => void;
  error: (event: string, context?: Record<string, unknown>) => void;
};

const inMemoryCache = new Map<string, CacheEntry<unknown>>();

// Default no-op logger to avoid SDK dependency in universal module.
const defaultLogger: DataClientLogger = {
  debug: () => undefined,
  error: () => undefined,
};

export type DataClientOptions = {
  baseUrl: string;
  cacheTtlMs?: number;
  logger?: DataClientLogger;
};

const isZodSchema = <T>(value: unknown): value is z.ZodType<T> =>
  !!value && typeof value === 'object' && typeof (value as { parse?: unknown }).parse === 'function';

const resolveGetArguments = <T>(
  schemaOrInit?: z.ZodType<T> | RequestInit,
  maybeInit?: RequestInit
): {
  init: RequestInit | undefined;
  schema: z.ZodType<T> | undefined;
} => {
  const schema = isZodSchema<T>(schemaOrInit) ? schemaOrInit : undefined;
  return {
    init: schema ? maybeInit : (schemaOrInit as RequestInit | undefined),
    schema,
  };
};

const parsePayload = <T>(input: {
  cacheKey?: string;
  logger: DataClientLogger;
  path: string;
  rawPayload: unknown;
  schema: z.ZodType<T> | undefined;
  source: 'cache' | 'network';
}): T => {
  if (!input.schema) {
    return input.rawPayload as T;
  }

  try {
    return input.schema.parse(input.rawPayload);
  } catch (error) {
    input.logger.error('schema_validation_failed', {
      operation: 'get',
      path: input.path,
      ...(input.cacheKey ? { cache_key: input.cacheKey } : {}),
      source: input.source,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

export const createDataClient = (options: DataClientOptions) => {
  const cacheTtlMs = options.cacheTtlMs ?? 30_000;
  const logger = options.logger ?? defaultLogger;
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

  const get = async <T>(
    path: string,
    schemaOrInit?: z.ZodType<T> | RequestInit,
    maybeInit?: RequestInit
  ): Promise<T> => {
    const { init, schema } = resolveGetArguments(schemaOrInit, maybeInit);
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
      try {
        return parsePayload({
          cacheKey,
          logger,
          path,
          rawPayload: cached.value,
          schema,
          source: 'cache',
        });
      } catch (error) {
        inMemoryCache.delete(cacheKey);
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
    const payload = parsePayload({
      logger,
      path,
      rawPayload,
      schema,
      source: 'network',
    });
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
