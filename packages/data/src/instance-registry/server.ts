import { normalizeHost, type InstanceRegistryRecord } from '@sva/core';
import { Pool } from 'pg';

import { createInstanceRegistryRepository } from './index';

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
  if (!databaseUrl) {
    return null;
  }
  const existing = poolsByDatabaseUrl.get(databaseUrl);
  if (existing) {
    return existing;
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    max: 5,
    idleTimeoutMillis: 10_000,
  });
  poolsByDatabaseUrl.set(databaseUrl, pool);
  return pool;
};

const withClient = async <T>(
  work: (client: QueryClient) => Promise<T>,
  options: { readonly getDatabaseUrl?: () => string | undefined } = {}
): Promise<T> => {
  const getDatabaseUrl = options.getDatabaseUrl ?? (() => process.env.IAM_DATABASE_URL);
  const pool = getPool(getDatabaseUrl());
  if (!pool) {
    throw new Error('IAM database not configured');
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
  const databaseUrl = options.getDatabaseUrl?.() ?? process.env.IAM_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('IAM database not configured');
  }
  const cacheKey = buildHostCacheKey(databaseUrl, normalizedHostname);
  const cached = hostCache.get(cacheKey);

  if (cached && cached.expiresAt > now()) {
    return cached.value;
  }

  pruneHostCache(now());
  const value = await withClient(
    async (client) => {
      const repository = createInstanceRegistryRepository(createExecutor(client));
      return repository.resolveHostname(normalizedHostname);
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
