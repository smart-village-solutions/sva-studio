import type { EffectivePermission } from '@sva/core';

import type { PermSnapshotKey } from './redis-permission-snapshot.server.js';
import {
  getRedisPermissionSnapshot,
  setRedisPermissionSnapshot,
} from './redis-permission-snapshot.server.js';
import type { EffectivePermissionsResolution, PermissionRow } from './shared.js';
import {
  buildRequestContext,
  cacheLogger,
  cacheMetricsState,
  ensureInvalidationListener,
  iamCacheLookupCounter,
  logger,
  permissionSnapshotCache,
  recordPermissionCacheColdStart,
  recordPermissionCacheRecompute,
  recordPermissionCacheRedisLatency,
  toEffectivePermissions,
  withInstanceScopedDb,
} from './shared.js';
import type { QueryClient } from '../shared/db-helpers.js';

type PermissionLookupInput = {
  instanceId: string;
  keycloakSubject: string;
  organizationId?: string;
};

export type PermissionResolutionDeps = Readonly<{
  ensureInvalidationListener: () => Promise<void>;
  cache: Pick<typeof permissionSnapshotCache, 'get' | 'set' | 'size'>;
  getRedisPermissionSnapshot: typeof getRedisPermissionSnapshot;
  setRedisPermissionSnapshot: typeof setRedisPermissionSnapshot;
  loadPermissionsFromDb: (input: PermissionLookupInput) => Promise<readonly EffectivePermission[]>;
  recordPermissionCacheColdStart: typeof recordPermissionCacheColdStart;
  recordPermissionCacheRedisLatency: typeof recordPermissionCacheRedisLatency;
  recordPermissionCacheRecompute: typeof recordPermissionCacheRecompute;
  iamCacheLookupCounter: typeof iamCacheLookupCounter;
  cacheLogger: typeof cacheLogger;
  logger: typeof logger;
  cacheMetricsState: typeof cacheMetricsState;
}>;

const toRedisSnapshotKey = (input: PermissionLookupInput): PermSnapshotKey => ({
  instanceId: input.instanceId,
  userId: input.keycloakSubject,
  organizationId: input.organizationId,
});

const listScopedPermissionRows = async (
  client: QueryClient,
  input: PermissionLookupInput & { organizationId: string }
): Promise<readonly PermissionRow[]> => {
  const scopedQuery = await client.query<PermissionRow>(
    `
WITH target_organization AS (
  SELECT id, hierarchy_path
  FROM iam.organizations
  WHERE instance_id = $1
    AND id = $3::uuid
    AND is_active = true
)
SELECT DISTINCT
  p.permission_key,
  p.action,
  p.resource_type,
  p.resource_id,
  p.effect,
  p.scope,
  source.role_id,
  source.group_id,
  source.group_key,
  source.source_kind,
  $3::uuid AS organization_id
FROM iam.accounts a
JOIN (
  SELECT ar.account_id, ar.role_id, ar.instance_id, NULL::uuid AS group_id, NULL::text AS group_key, 'direct_role'::text AS source_kind
  FROM iam.account_roles ar
  WHERE ar.valid_from <= NOW()
    AND (ar.valid_to IS NULL OR ar.valid_to > NOW())
  UNION
  SELECT d.delegatee_account_id AS account_id, d.role_id, d.instance_id, NULL::uuid AS group_id, NULL::text AS group_key, 'direct_role'::text AS source_kind
  FROM iam.delegations d
  WHERE d.status = 'active'
    AND now() BETWEEN d.starts_at AND d.ends_at
  UNION
  SELECT ag.account_id, gr.role_id, ag.instance_id, ag.group_id, g.group_key, 'group_role'::text AS source_kind
  FROM iam.account_groups ag
  JOIN iam.group_roles gr ON gr.instance_id = ag.instance_id AND gr.group_id = ag.group_id
  JOIN iam.groups g ON g.instance_id = ag.instance_id AND g.id = ag.group_id AND g.is_active = true
  WHERE (ag.valid_from IS NULL OR ag.valid_from <= NOW())
    AND (ag.valid_until IS NULL OR ag.valid_until > now())
) source
  ON source.account_id = a.id
 AND source.instance_id = $1
JOIN iam.account_organizations ao
  ON ao.instance_id = source.instance_id
 AND ao.account_id = source.account_id
JOIN target_organization target
  ON TRUE
JOIN iam.role_permissions rp
  ON rp.instance_id = source.instance_id
 AND rp.role_id = source.role_id
JOIN iam.permissions p
 ON p.instance_id = rp.instance_id
 AND p.id = rp.permission_id
WHERE a.keycloak_subject = $2
  AND (
    ao.organization_id = target.id
    OR ao.organization_id = ANY(target.hierarchy_path)
  )
`,
    [input.instanceId, input.keycloakSubject, input.organizationId]
  );

  return scopedQuery.rows;
};

const listUnscopedPermissionRows = async (
  client: QueryClient,
  input: PermissionLookupInput
): Promise<readonly PermissionRow[]> => {
  const unscopedQuery = await client.query<PermissionRow>(
    `
SELECT DISTINCT
  p.permission_key,
  p.action,
  p.resource_type,
  p.resource_id,
  p.effect,
  p.scope,
  source.role_id,
  source.group_id,
  source.group_key,
  source.source_kind,
  ao.organization_id
FROM iam.accounts a
JOIN (
  SELECT ar.account_id, ar.role_id, ar.instance_id, NULL::uuid AS group_id, NULL::text AS group_key, 'direct_role'::text AS source_kind
  FROM iam.account_roles ar
  WHERE ar.valid_from <= NOW()
    AND (ar.valid_to IS NULL OR ar.valid_to > NOW())
  UNION
  SELECT d.delegatee_account_id AS account_id, d.role_id, d.instance_id, NULL::uuid AS group_id, NULL::text AS group_key, 'direct_role'::text AS source_kind
  FROM iam.delegations d
  WHERE d.status = 'active'
    AND now() BETWEEN d.starts_at AND d.ends_at
  UNION
  SELECT ag.account_id, gr.role_id, ag.instance_id, ag.group_id, g.group_key, 'group_role'::text AS source_kind
  FROM iam.account_groups ag
  JOIN iam.group_roles gr ON gr.instance_id = ag.instance_id AND gr.group_id = ag.group_id
  JOIN iam.groups g ON g.instance_id = ag.instance_id AND g.id = ag.group_id AND g.is_active = true
  WHERE (ag.valid_from IS NULL OR ag.valid_from <= NOW())
    AND (ag.valid_until IS NULL OR ag.valid_until > now())
) source
  ON source.account_id = a.id
 AND source.instance_id = $1
LEFT JOIN iam.account_organizations ao
  ON ao.instance_id = source.instance_id
 AND ao.account_id = source.account_id
JOIN iam.role_permissions rp
  ON rp.instance_id = source.instance_id
 AND rp.role_id = source.role_id
JOIN iam.permissions p
  ON p.instance_id = rp.instance_id
 AND p.id = rp.permission_id
WHERE a.keycloak_subject = $2
`,
    [input.instanceId, input.keycloakSubject]
  );

  return unscopedQuery.rows;
};

const listPermissionRows = async (
  client: QueryClient,
  input: PermissionLookupInput
): Promise<readonly PermissionRow[]> =>
  input.organizationId
    ? listScopedPermissionRows(client, { ...input, organizationId: input.organizationId })
    : listUnscopedPermissionRows(client, input);

const loadPermissionsFromDb = async (input: PermissionLookupInput): Promise<readonly EffectivePermission[]> => {
  const rows = await withInstanceScopedDb(input.instanceId, async (client) => listPermissionRows(client, input));
  return toEffectivePermissions(rows);
};

const defaultPermissionResolutionDeps: PermissionResolutionDeps = {
  ensureInvalidationListener,
  cache: permissionSnapshotCache,
  getRedisPermissionSnapshot,
  setRedisPermissionSnapshot,
  loadPermissionsFromDb,
  recordPermissionCacheColdStart,
  recordPermissionCacheRedisLatency,
  recordPermissionCacheRecompute,
  iamCacheLookupCounter,
  cacheLogger,
  logger,
  cacheMetricsState,
};

export const resolveEffectivePermissionsWithDeps = async (
  input: PermissionLookupInput,
  deps: PermissionResolutionDeps
): Promise<EffectivePermissionsResolution> => {
  await deps.ensureInvalidationListener();

  const lookup = deps.cache.get(input);

  if (lookup.status === 'hit' && lookup.snapshot) {
    deps.cacheMetricsState.lookups += 1;
    deps.iamCacheLookupCounter.add(1, { hit: true });
    deps.cacheLogger.debug('Permission snapshot cache lookup', {
      operation: 'cache_lookup',
      hit: true,
      cache_layer: 'memory',
      ttl_remaining_s: lookup.ttlRemainingSeconds,
      ...buildRequestContext(input.instanceId),
    });
    return {
      ok: true,
      permissions: lookup.snapshot!.permissions,
      cacheStatus: 'hit',
      snapshotVersion: lookup.snapshot?.snapshotVersion,
    };
  }

  if (lookup.status === 'stale') {
    deps.cacheMetricsState.staleLookups += 1;
    deps.cacheLogger.warn('Stale permission snapshot detected', {
      operation: 'cache_stale_detected',
      age_s: lookup.ageSeconds,
      max_ttl_s: 300,
      ...buildRequestContext(input.instanceId),
    });
  }

  if (deps.cache.size() === 0) {
    deps.recordPermissionCacheColdStart(input.instanceId);
  }

  const redisKey = toRedisSnapshotKey(input);
  const redisLookupStartedAt = performance.now();
  const redisLookup = await deps.getRedisPermissionSnapshot(redisKey);
  deps.recordPermissionCacheRedisLatency(
    performance.now() - redisLookupStartedAt,
    redisLookup.hit || redisLookup.reason !== 'redis_unavailable'
  );

  if (redisLookup.hit) {
    deps.cacheMetricsState.lookups += 1;
    const snapshot = deps.cache.set(input, redisLookup.permissions, Date.now(), redisLookup.version);
    deps.iamCacheLookupCounter.add(1, { hit: true });
    deps.cacheLogger.debug('Permission snapshot cache lookup', {
      operation: 'cache_lookup',
      hit: true,
      cache_layer: 'redis',
      ...buildRequestContext(input.instanceId),
    });
    return {
      ok: true,
      permissions: redisLookup.permissions,
      cacheStatus: 'hit',
      snapshotVersion: snapshot.snapshotVersion,
    };
  }

  if (redisLookup.reason === 'redis_unavailable') {
    deps.cacheMetricsState.lookups += 1;
    deps.iamCacheLookupCounter.add(1, { hit: false });
    deps.logger.error('Redis permission snapshot lookup failed', {
      operation: 'cache_lookup_failed',
      error: redisLookup.reason,
      ...buildRequestContext(input.instanceId),
    });
    return { ok: false, error: 'database_unavailable' };
  }

  deps.cacheMetricsState.lookups += 1;
  deps.iamCacheLookupCounter.add(1, { hit: false });
  deps.cacheLogger.debug('Permission snapshot cache lookup', {
    operation: 'cache_lookup',
    hit: false,
    cache_layer: 'redis',
    miss_reason: redisLookup.reason,
    ...buildRequestContext(input.instanceId),
  });

  try {
    const permissions = await deps.loadPermissionsFromDb(input);
    const redisWrite = await deps.setRedisPermissionSnapshot(redisKey, permissions);
    if (!redisWrite.ok) {
      deps.logger.error('Redis permission snapshot write failed after recompute', {
        operation: 'cache_store_failed',
        error: redisWrite.reason,
        ...buildRequestContext(input.instanceId),
      });
      return { ok: false, error: 'database_unavailable' };
    }
    deps.recordPermissionCacheRecompute();
    const snapshot = deps.cache.set(input, permissions, Date.now(), redisWrite.version);

    if (lookup.status === 'stale') {
      deps.cacheLogger.info('Permission snapshot recomputed after stale detection', {
        operation: 'cache_invalidate',
        trigger: 'recompute',
        affected_keys: 1,
        ...buildRequestContext(input.instanceId),
      });
    }

    return {
      ok: true,
      permissions,
      cacheStatus: lookup.status === 'stale' ? 'recompute' : 'miss',
      snapshotVersion: snapshot.snapshotVersion,
    };
  } catch (error) {
    deps.logger.error('Failed to recompute permission snapshot', {
      operation: 'cache_invalidate_failed',
      error: error instanceof Error ? error.message : String(error),
      ...buildRequestContext(input.instanceId),
    });

    return { ok: false, error: 'database_unavailable' };
  }
};

export const resolveEffectivePermissions = async (input: PermissionLookupInput): Promise<EffectivePermissionsResolution> =>
  resolveEffectivePermissionsWithDeps(input, defaultPermissionResolutionDeps);
