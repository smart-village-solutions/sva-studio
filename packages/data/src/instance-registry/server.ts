import { normalizeHost, type InstanceRegistryRecord } from '@sva/core';
import { Pool } from 'pg';
import { createSdkLogger } from '@sva/sdk/server';

import { createInstanceRegistryRepository } from './index';

const logger = createSdkLogger({ component: 'instance-registry-server', level: 'info' });

type QueryResult<TRow> = {
  readonly rowCount: number;
  readonly rows: readonly TRow[];
};

type QueryClient = {
  query<TRow = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[]
  ): Promise<QueryResult<TRow>>;
  release(): void;
};

type CacheEntry = {
  readonly expiresAt: number;
  readonly value: InstanceRegistryRecord | null;
};

const HOST_CACHE_MAX_ENTRIES = 500;
const hostCache = new Map<string, CacheEntry>();
const poolsByDatabaseUrl = new Map<string, Pool>();

const ensureValidIamDatabaseUrl = (databaseUrl: string | undefined): string | null => {
  if (!databaseUrl) {
    return null;
  }

  try {
    return new URL(databaseUrl).toString();
  } catch (error) {
    throw new Error(`iam_database_url_invalid: ${(error instanceof Error ? error.message : String(error)).trim()}`);
  }
};

const resolveIamDatabaseUrl = (): string | undefined => {
  const explicit = process.env.IAM_DATABASE_URL?.trim();
  if (explicit) {
    return explicit;
  }

  const password = process.env.APP_DB_PASSWORD?.trim() ?? process.env.POSTGRES_PASSWORD?.trim();
  if (!password) {
    return undefined;
  }

  const user = process.env.APP_DB_USER?.trim() || 'sva_app';
  const database = process.env.POSTGRES_DB?.trim() || 'sva_studio';
  const host = process.env.POSTGRES_HOST?.trim() || 'postgres';
  const port = process.env.POSTGRES_PORT?.trim() || '5432';

  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(database)}`;
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

const getPool = (databaseUrl: string | undefined): Pool | null => {
  const normalizedDatabaseUrl = ensureValidIamDatabaseUrl(databaseUrl);
  if (!normalizedDatabaseUrl) {
    logger.warn('IAM database URL is not configured; instance-registry lookup cannot use the server repository', {
      reason: 'iam_database_url_missing',
    });
    return null;
  }
  const existing = poolsByDatabaseUrl.get(normalizedDatabaseUrl);
  if (existing) {
    return existing;
  }

  const pool = new Pool({
    connectionString: normalizedDatabaseUrl,
    max: 5,
    idleTimeoutMillis: 10_000,
  });
  poolsByDatabaseUrl.set(normalizedDatabaseUrl, pool);
  return pool;
};

const withClient = async <T>(
  work: (client: QueryClient) => Promise<T>,
  options: { readonly getDatabaseUrl?: () => string | undefined } = {}
): Promise<T> => {
  const getDatabaseUrl = options.getDatabaseUrl ?? resolveIamDatabaseUrl;
  const pool = getPool(getDatabaseUrl());
  if (!pool) {
    throw new Error('iam_database_url_missing: IAM database not configured');
  }

  const client = await pool.connect();
  try {
    return await work(client as QueryClient);
  } finally {
    client.release();
  }
};

const createExecutor = (client: QueryClient) => ({
  execute: async <TRow = Record<string, unknown>>(statement: { text: string; values: readonly unknown[] }) => {
    const result = await client.query<TRow>(statement.text, statement.values);
    return {
      rowCount: result.rowCount,
      rows: result.rows,
    };
  },
});

export const resetInstanceRegistryCache = (): void => {
  hostCache.clear();
};

export const resetInstanceRegistryServerState = async (): Promise<void> => {
  resetInstanceRegistryCache();

  const poolsToClose = [...poolsByDatabaseUrl.values()];
  poolsByDatabaseUrl.clear();
  for (const pool of poolsToClose) {
    await pool.end();
  }
};

export const invalidateInstanceRegistryHost = (hostname: string): void => {
  const normalizedHostname = normalizeHost(hostname);
  for (const cacheKey of hostCache.keys()) {
    if (cacheKey.endsWith(`::${normalizedHostname}`)) {
      hostCache.delete(cacheKey);
    }
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
  const cacheKey = buildHostCacheKey(databaseUrl, normalizedHostname);
  const cached = hostCache.get(cacheKey);

  if (cached && cached.expiresAt > now()) {
    logger.info('Instance hostname lookup served from cache', {
      hostname: normalizedHostname,
      cache_hit: true,
      instance_id: cached.value?.instanceId ?? undefined,
    });
    return cached.value;
  }

  pruneHostCache(now());
  const value = await withClient(
    async (client) => {
      try {
        const repository = createInstanceRegistryRepository(createExecutor(client));
        const result = await repository.resolveHostname(normalizedHostname);
        logger.info('Instance hostname lookup completed via database', {
          hostname: normalizedHostname,
          cache_hit: false,
          instance_id: result?.instanceId ?? undefined,
          status: result?.status ?? undefined,
        });
        return result;
      } catch (error) {
        logger.error('Instance hostname lookup failed in repository layer', {
          hostname: normalizedHostname,
          reason: 'tenant_host_resolution_failed',
          error: error instanceof Error ? error.message : String(error),
        });
        throw new Error(
          `tenant_host_resolution_failed: ${normalizedHostname}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
    { getDatabaseUrl: () => databaseUrl }
  );

  hostCache.set(cacheKey, {
    value,
    expiresAt: now() + cacheTtlMs,
  });
  pruneHostCache(now());

  return value;
};

export const loadInstanceById = async (
  instanceId: string,
  options: { readonly getDatabaseUrl?: () => string | undefined } = {}
): Promise<InstanceRegistryRecord | null> =>
  withClient(
    async (client) => {
      const repository = createInstanceRegistryRepository(createExecutor(client));
      return repository.getInstanceById(instanceId);
    },
    { getDatabaseUrl: options.getDatabaseUrl }
  );

export const loadInstanceAuthClientSecretCiphertext = async (
  instanceId: string,
  options: { readonly getDatabaseUrl?: () => string | undefined } = {}
): Promise<string | null> =>
  withClient(
    async (client) => {
      const repository = createInstanceRegistryRepository(createExecutor(client));
      return repository.getAuthClientSecretCiphertext(instanceId);
    },
    { getDatabaseUrl: options.getDatabaseUrl }
  );
