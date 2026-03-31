import type { EffectivePermission } from '@sva/core';
import { createHash } from 'node:crypto';

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
  geoUnitId?: string;
  geoHierarchy?: readonly string[];
};

const normalizeGeoContext = (input: PermissionLookupInput) => {
  const geoUnitId = input.geoUnitId?.trim() || undefined;
  const geoHierarchy = input.geoHierarchy
    ?.map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (!geoUnitId && (!geoHierarchy || geoHierarchy.length === 0)) {
    return undefined;
  }

  return {
    ...(geoUnitId ? { geoUnitId } : {}),
    ...(geoHierarchy && geoHierarchy.length > 0 ? { geoHierarchy: [...new Set(geoHierarchy)] } : {}),
  };
};

const toGeoContextHash = (input: PermissionLookupInput): string | undefined => {
  const normalized = normalizeGeoContext(input);
  if (!normalized) {
    return undefined;
  }

  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex').slice(0, 8);
};

const toSnapshotLookupKey = (input: PermissionLookupInput) => ({
  instanceId: input.instanceId,
  keycloakSubject: input.keycloakSubject,
  organizationId: input.organizationId,
  geoContextHash: toGeoContextHash(input),
});

const toRedisSnapshotKey = (
  snapshotKey: ReturnType<typeof toSnapshotLookupKey>
): PermSnapshotKey => ({
  instanceId: snapshotKey.instanceId,
  userId: snapshotKey.keycloakSubject,
  organizationId: snapshotKey.organizationId,
  geoCtxHash: snapshotKey.geoContextHash,
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
  COALESCE(ap_direct.effect, p.effect) AS effect,
  p.scope,
  source.account_id,
  source.role_id,
  source.group_id,
  source.group_key,
  source.source_kind,
  $3::uuid AS organization_id
FROM iam.accounts a
JOIN (
  SELECT im.account_id, NULL::uuid AS role_id, im.instance_id, NULL::uuid AS group_id, NULL::text AS group_key, 'direct_user'::text AS source_kind
  FROM iam.instance_memberships im
  UNION
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
JOIN iam.permissions p
 ON p.instance_id = source.instance_id
LEFT JOIN iam.account_permissions ap_direct
  ON source.role_id IS NULL
 AND ap_direct.instance_id = source.instance_id
 AND ap_direct.account_id = source.account_id
 AND ap_direct.permission_id = p.id
WHERE a.keycloak_subject = $2
  AND (
    (
      source.role_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM iam.role_permissions rp
        WHERE rp.instance_id = source.instance_id
          AND rp.role_id = source.role_id
          AND rp.permission_id = p.id
      )
    )
    OR (
      source.role_id IS NULL
      AND ap_direct.permission_id IS NOT NULL
    )
  )
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
  COALESCE(ap_direct.effect, p.effect) AS effect,
  p.scope,
  source.account_id,
  source.role_id,
  source.group_id,
  source.group_key,
  source.source_kind,
  ao.organization_id
FROM iam.accounts a
JOIN (
  SELECT im.account_id, NULL::uuid AS role_id, im.instance_id, NULL::uuid AS group_id, NULL::text AS group_key, 'direct_user'::text AS source_kind
  FROM iam.instance_memberships im
  UNION
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
JOIN iam.permissions p
  ON p.instance_id = source.instance_id
LEFT JOIN iam.account_permissions ap_direct
  ON source.role_id IS NULL
 AND ap_direct.instance_id = source.instance_id
 AND ap_direct.account_id = source.account_id
 AND ap_direct.permission_id = p.id
WHERE a.keycloak_subject = $2
  AND (
    (
      source.role_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM iam.role_permissions rp
        WHERE rp.instance_id = source.instance_id
          AND rp.role_id = source.role_id
          AND rp.permission_id = p.id
      )
    )
    OR (
      source.role_id IS NULL
      AND ap_direct.permission_id IS NOT NULL
    )
  )
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

export const resolveEffectivePermissions = async (input: PermissionLookupInput): Promise<EffectivePermissionsResolution> => {
  await ensureInvalidationListener();

  const snapshotLookupKey = toSnapshotLookupKey(input);
  const lookup = permissionSnapshotCache.get(snapshotLookupKey);

  if (lookup.status === 'hit' && lookup.snapshot) {
    cacheMetricsState.lookups += 1;
    iamCacheLookupCounter.add(1, { hit: true });
    cacheLogger.debug('Permission snapshot cache lookup', {
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
    cacheMetricsState.staleLookups += 1;
    cacheLogger.warn('Stale permission snapshot detected', {
      operation: 'cache_stale_detected',
      age_s: lookup.ageSeconds,
      max_ttl_s: 300,
      ...buildRequestContext(input.instanceId),
    });
  }

  if (permissionSnapshotCache.size() === 0) {
    recordPermissionCacheColdStart(input.instanceId);
  }

  const redisKey = toRedisSnapshotKey(snapshotLookupKey);
  const redisLookupStartedAt = performance.now();
  const redisLookup = await getRedisPermissionSnapshot(redisKey);
  recordPermissionCacheRedisLatency(
    performance.now() - redisLookupStartedAt,
    redisLookup.hit || redisLookup.reason !== 'redis_unavailable'
  );

  if (redisLookup.hit) {
    cacheMetricsState.lookups += 1;
    const snapshot = permissionSnapshotCache.set(
      snapshotLookupKey,
      redisLookup.permissions,
      Date.now(),
      redisLookup.version
    );
    iamCacheLookupCounter.add(1, { hit: true });
    cacheLogger.debug('Permission snapshot cache lookup', {
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
    cacheMetricsState.lookups += 1;
    iamCacheLookupCounter.add(1, { hit: false });
    logger.error('Redis permission snapshot lookup failed', {
      operation: 'cache_lookup_failed',
      error: redisLookup.reason,
      ...buildRequestContext(input.instanceId),
    });
    return { ok: false, error: 'database_unavailable' };
  }

  cacheMetricsState.lookups += 1;
  iamCacheLookupCounter.add(1, { hit: false });
  cacheLogger.debug('Permission snapshot cache lookup', {
    operation: 'cache_lookup',
    hit: false,
    cache_layer: 'redis',
    miss_reason: redisLookup.reason,
    ...buildRequestContext(input.instanceId),
  });

  try {
    const permissions = await loadPermissionsFromDb(input);
    const redisWrite = await setRedisPermissionSnapshot(redisKey, permissions);
    if (!redisWrite.ok) {
      logger.error('Redis permission snapshot write failed after recompute', {
        operation: 'cache_store_failed',
        error: redisWrite.reason,
        ...buildRequestContext(input.instanceId),
      });
      return { ok: false, error: 'database_unavailable' };
    }
    recordPermissionCacheRecompute();
    const snapshot = permissionSnapshotCache.set(
      snapshotLookupKey,
      permissions,
      Date.now(),
      redisWrite.version
    );

    if (lookup.status === 'stale') {
      cacheLogger.info('Permission snapshot recomputed after stale detection', {
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
    logger.error('Failed to recompute permission snapshot', {
      operation: 'cache_invalidate_failed',
      error: error instanceof Error ? error.message : String(error),
      ...buildRequestContext(input.instanceId),
    });

    return { ok: false, error: 'database_unavailable' };
  }
};
