import { normalizeHost, type InstanceRegistryRecord } from '@sva/core';

import { createInstanceRegistryRepository } from './index.js';
import {
  createExecutor,
  ensureValidIamDatabaseUrl,
  logger,
  type QueryClient,
  readErrorType,
  resolveIamDatabaseUrl,
  withClient,
} from './server-client.js';

type CacheEntry = {
  readonly expiresAt: number;
  readonly value: InstanceRegistryRecord | null;
};

const HOST_CACHE_MAX_ENTRIES = 500;
const hostCache = new Map<string, CacheEntry>();

const shouldRetryWithPrimaryHostname = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes('instance_hostnames') ||
    message.includes('permission denied') ||
    message.includes('does not exist') ||
    message.includes('undefined_table')
  );
};

const withErrorCause = (message: string, cause: unknown): Error => {
  const error = new Error(message);
  Object.defineProperty(error, 'cause', {
    value: cause,
    configurable: true,
    enumerable: false,
    writable: true,
  });
  return error;
};

const buildHostCacheKey = (databaseUrl: string, hostname: string) => `${databaseUrl}::${hostname}`;

const pruneHostCache = (now: number): void => {
  for (const [cacheKey, entry] of hostCache) {
    if (entry.expiresAt <= now) {
      hostCache.delete(cacheKey);
    }
  }

  while (hostCache.size > HOST_CACHE_MAX_ENTRIES) {
    const oldestKey = hostCache.keys().next().value;
    if (!oldestKey) {
      return;
    }
    hostCache.delete(oldestKey);
  }
};

export const resetInstanceRegistryCache = (): void => {
  hostCache.clear();
};

export const invalidateInstanceRegistryHost = (hostname: string): void => {
  const normalizedHostname = normalizeHost(hostname);
  for (const cacheKey of hostCache.keys()) {
    if (cacheKey.endsWith(`::${normalizedHostname}`)) {
      hostCache.delete(cacheKey);
    }
  }
};

const resolveHostnameFromRepository = async (
  client: QueryClient,
  normalizedHostname: string
): Promise<InstanceRegistryRecord | null> => {
  try {
    const repository = createInstanceRegistryRepository(createExecutor(client));
    let result = await repository.resolveHostname(normalizedHostname);
    result ??= await repository.resolvePrimaryHostname(normalizedHostname);
    logger.debug('Instance hostname lookup completed via database', {
      hostname: normalizedHostname,
      cache_hit: false,
      instance_id: result?.instanceId ?? undefined,
      status: result?.status ?? undefined,
    });
    return result;
  } catch (error) {
    if (shouldRetryWithPrimaryHostname(error)) {
      const repository = createInstanceRegistryRepository(createExecutor(client));
      try {
        const fallbackResult = await repository.resolvePrimaryHostname(normalizedHostname);
        logger.warn('Instance hostname lookup retried via primary_hostname fallback', {
          hostname: normalizedHostname,
          reason_code: 'tenant_host_resolution_primary_hostname_fallback',
          error_type: readErrorType(error),
          dependency: 'iam_database',
          instance_id: fallbackResult?.instanceId ?? undefined,
        });
        return fallbackResult;
      } catch (fallbackError) {
        logger.error('Instance hostname lookup failed in primary_hostname fallback', {
          hostname: normalizedHostname,
          reason_code: 'tenant_host_resolution_fallback_failed',
          error_type: readErrorType(fallbackError),
          dependency: 'iam_database',
        });
        throw withErrorCause('tenant_host_resolution_fallback_failed', fallbackError);
      }
    }
    logger.error('Instance hostname lookup failed in repository layer', {
      hostname: normalizedHostname,
      reason_code: 'tenant_host_resolution_failed',
      error_type: readErrorType(error),
      dependency: 'iam_database',
    });
    throw withErrorCause('tenant_host_resolution_failed', error);
  }
};

export const loadInstanceByHostname = async (
  hostname: string,
  options: {
    readonly cacheTtlMs?: number;
    readonly now?: () => number;
    readonly getDatabaseUrl?: () => string | undefined;
  } = {}
): Promise<InstanceRegistryRecord | null> => {
  const normalizedHostname = normalizeHost(hostname);
  const now = options.now ?? Date.now;
  const cacheTtlMs = options.cacheTtlMs ?? 5_000;
  const databaseUrl = options.getDatabaseUrl?.() ?? resolveIamDatabaseUrl();
  if (!databaseUrl) {
    logger.warn('Instance hostname lookup aborted because no IAM database URL could be resolved', {
      hostname: normalizedHostname,
      reason: 'iam_database_url_missing',
    });
    throw new Error('iam_database_url_missing: IAM database not configured');
  }
  const normalizedDatabaseUrl = ensureValidIamDatabaseUrl(databaseUrl);
  if (!normalizedDatabaseUrl) {
    logger.warn('Instance hostname lookup aborted because no IAM database URL could be resolved', {
      hostname: normalizedHostname,
      reason: 'iam_database_url_missing',
    });
    throw new Error('iam_database_url_missing: IAM database not configured');
  }

  const cacheKey = buildHostCacheKey(normalizedDatabaseUrl, normalizedHostname);
  const cached = hostCache.get(cacheKey);

  if (cached && cached.expiresAt > now()) {
    logger.debug('Instance hostname lookup served from cache', {
      hostname: normalizedHostname,
      cache_hit: true,
      instance_id: cached.value?.instanceId ?? undefined,
    });
    return cached.value;
  }

  pruneHostCache(now());
  const value = await withClient(
    (client) => resolveHostnameFromRepository(client, normalizedHostname),
    { getDatabaseUrl: () => normalizedDatabaseUrl }
  );

  hostCache.set(cacheKey, {
    value,
    expiresAt: now() + cacheTtlMs,
  });
  pruneHostCache(now());

  return value;
};
