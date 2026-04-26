import type { IamInstanceId } from '../iam/types.js';
import type { SqlExecutor, SqlStatement } from '../iam/repositories/types.js';

export type IntegrationProviderKey = 'sva_mainserver';

export type InstanceIntegrationRecord = {
  readonly instanceId: IamInstanceId;
  readonly providerKey: IntegrationProviderKey;
  readonly graphqlBaseUrl: string;
  readonly oauthTokenUrl: string;
  readonly enabled: boolean;
  readonly lastVerifiedAt?: string;
  readonly lastVerifiedStatus?: string;
};

export type InstanceIntegrationRepository = {
  getByInstanceId(
    instanceId: IamInstanceId,
    providerKey: IntegrationProviderKey
  ): Promise<InstanceIntegrationRecord | null>;
  upsert(input: InstanceIntegrationRecord): Promise<void>;
};

export type CachedInstanceIntegrationLoader = {
  load(
    instanceId: IamInstanceId,
    providerKey: IntegrationProviderKey
  ): Promise<InstanceIntegrationRecord | null>;
  clear(): void;
};

type InstanceIntegrationRow = {
  readonly instance_id: string;
  readonly provider_key: IntegrationProviderKey;
  readonly graphql_base_url: string;
  readonly oauth_token_url: string;
  readonly enabled: boolean;
  readonly last_verified_at: string | null;
  readonly last_verified_status: string | null;
};

type CacheEntry = {
  readonly value: InstanceIntegrationRecord;
  readonly expiresAtMs: number;
};

export const DEFAULT_INSTANCE_INTEGRATION_CACHE_TTL_MS = 300_000;

const mapRow = (row: InstanceIntegrationRow): InstanceIntegrationRecord => ({
  instanceId: row.instance_id,
  providerKey: row.provider_key,
  graphqlBaseUrl: row.graphql_base_url,
  oauthTokenUrl: row.oauth_token_url,
  enabled: row.enabled,
  lastVerifiedAt: row.last_verified_at ?? undefined,
  lastVerifiedStatus: row.last_verified_status ?? undefined,
});

const selectStatement = (
  instanceId: IamInstanceId,
  providerKey: IntegrationProviderKey
): SqlStatement => ({
  text: `
SELECT
  instance_id,
  provider_key,
  graphql_base_url,
  oauth_token_url,
  enabled,
  last_verified_at,
  last_verified_status
FROM iam.instance_integrations
WHERE instance_id = $1
  AND provider_key = $2
LIMIT 1;
`,
  values: [instanceId, providerKey],
});

const upsertStatement = (input: InstanceIntegrationRecord): SqlStatement => ({
  text: `
INSERT INTO iam.instance_integrations (
  instance_id,
  provider_key,
  graphql_base_url,
  oauth_token_url,
  enabled,
  last_verified_at,
  last_verified_status
)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (instance_id, provider_key) DO UPDATE
SET graphql_base_url = EXCLUDED.graphql_base_url,
    oauth_token_url = EXCLUDED.oauth_token_url,
    enabled = EXCLUDED.enabled,
    last_verified_at = EXCLUDED.last_verified_at,
    last_verified_status = EXCLUDED.last_verified_status,
    updated_at = NOW();
`,
  values: [
    input.instanceId,
    input.providerKey,
    input.graphqlBaseUrl,
    input.oauthTokenUrl,
    input.enabled,
    input.lastVerifiedAt ?? null,
    input.lastVerifiedStatus ?? null,
  ],
});

export const createInstanceIntegrationRepository = (
  executor: SqlExecutor
): InstanceIntegrationRepository => ({
  async getByInstanceId(instanceId, providerKey) {
    const result = await executor.execute<InstanceIntegrationRow>(selectStatement(instanceId, providerKey));
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  },
  async upsert(input) {
    await executor.execute(upsertStatement(input));
  },
});

export const createCachedInstanceIntegrationLoader = (
  loadRecord: (
    instanceId: IamInstanceId,
    providerKey: IntegrationProviderKey
  ) => Promise<InstanceIntegrationRecord | null>,
  options: {
    cacheTtlMs?: number;
    now?: () => number;
  } = {}
): CachedInstanceIntegrationLoader => {
  const now = options.now ?? (() => Date.now());
  const cacheTtlMs = options.cacheTtlMs ?? DEFAULT_INSTANCE_INTEGRATION_CACHE_TTL_MS;
  const cache = new Map<string, CacheEntry>();
  const inflightLoads = new Map<string, Promise<InstanceIntegrationRecord | null>>();

  const sweepExpiredEntries = (nowMs: number): void => {
    for (const [key, entry] of cache.entries()) {
      if (entry.expiresAtMs <= nowMs) {
        cache.delete(key);
      }
    }
  };

  const buildCacheKey = (instanceId: IamInstanceId, providerKey: IntegrationProviderKey): string =>
    `${instanceId}:${providerKey}`;

  return {
    async load(instanceId, providerKey) {
      const nowMs = now();
      const cacheKey = buildCacheKey(instanceId, providerKey);

      sweepExpiredEntries(nowMs);

      const cached = cache.get(cacheKey);
      if (cached && cached.expiresAtMs > nowMs) {
        return cached.value;
      }

      const inflight = inflightLoads.get(cacheKey);
      if (inflight) {
        return inflight;
      }

      const loadPromise = loadRecord(instanceId, providerKey).then((record) => {
        if (record) {
          cache.set(cacheKey, {
            value: record,
            expiresAtMs: now() + cacheTtlMs,
          });
        }
        return record;
      });

      inflightLoads.set(cacheKey, loadPromise);
      try {
        return await loadPromise;
      } finally {
        inflightLoads.delete(cacheKey);
      }
    },
    clear() {
      cache.clear();
      inflightLoads.clear();
    },
  };
};

export const instanceIntegrationStatements = {
  select: selectStatement,
  upsert: upsertStatement,
} as const;

export type { SqlExecutionResult } from '../iam/repositories/types.js';
