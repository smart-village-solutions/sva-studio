import type { EffectivePermission } from '@sva/core';

import type { EffectivePermissionsResolution, PermissionRow } from './shared';
import {
  buildRequestContext,
  cacheLogger,
  cacheMetricsState,
  ensureInvalidationListener,
  iamCacheLookupCounter,
  logger,
  permissionSnapshotCache,
  toEffectivePermissions,
  withInstanceScopedDb,
} from './shared';
import type { QueryClient } from '../shared/db-helpers';

const listPermissionRows = async (
  client: QueryClient,
  input: {
    instanceId: string;
    keycloakSubject: string;
    organizationId?: string;
  }
): Promise<readonly PermissionRow[]> => {
  if (input.organizationId) {
    const scopedQuery = await client.query<PermissionRow>(
      `
SELECT DISTINCT
  p.permission_key,
  source.role_id,
  $3::uuid AS organization_id
FROM iam.accounts a
JOIN (
  SELECT ar.account_id, ar.role_id, ar.instance_id
  FROM iam.account_roles ar
  UNION
  SELECT d.delegatee_account_id AS account_id, d.role_id, d.instance_id
  FROM iam.delegations d
  WHERE d.status = 'active'
    AND now() BETWEEN d.starts_at AND d.ends_at
) source
  ON source.account_id = a.id
 AND source.instance_id = $1
JOIN iam.role_permissions rp
  ON rp.instance_id = source.instance_id
 AND rp.role_id = source.role_id
JOIN iam.permissions p
  ON p.instance_id = rp.instance_id
 AND p.id = rp.permission_id
WHERE a.keycloak_subject = $2
  AND EXISTS (
    SELECT 1
    FROM iam.account_organizations ao
    WHERE ao.instance_id = source.instance_id
      AND ao.account_id = source.account_id
      AND ao.organization_id = $3::uuid
  );
`,
      [input.instanceId, input.keycloakSubject, input.organizationId]
    );

    return scopedQuery.rows;
  }

  const unscopedQuery = await client.query<PermissionRow>(
    `
SELECT DISTINCT
  p.permission_key,
  source.role_id,
  NULL::uuid AS organization_id
FROM iam.accounts a
JOIN (
  SELECT ar.account_id, ar.role_id, ar.instance_id
  FROM iam.account_roles ar
  UNION
  SELECT d.delegatee_account_id AS account_id, d.role_id, d.instance_id
  FROM iam.delegations d
  WHERE d.status = 'active'
    AND now() BETWEEN d.starts_at AND d.ends_at
) source
  ON source.account_id = a.id
 AND source.instance_id = $1
JOIN iam.role_permissions rp
  ON rp.instance_id = source.instance_id
 AND rp.role_id = source.role_id
JOIN iam.permissions p
  ON p.instance_id = rp.instance_id
 AND p.id = rp.permission_id
WHERE a.keycloak_subject = $2;
`,
    [input.instanceId, input.keycloakSubject]
  );

  return unscopedQuery.rows;
};

const loadPermissionsFromDb = async (input: {
  instanceId: string;
  keycloakSubject: string;
  organizationId?: string;
}): Promise<readonly EffectivePermission[]> => {
  const rows = await withInstanceScopedDb(input.instanceId, async (client) => listPermissionRows(client, input));
  return toEffectivePermissions(rows);
};

export const resolveEffectivePermissions = async (input: {
  instanceId: string;
  keycloakSubject: string;
  organizationId?: string;
}): Promise<EffectivePermissionsResolution> => {
  await ensureInvalidationListener();

  cacheMetricsState.lookups += 1;
  const lookup = permissionSnapshotCache.get(input);

  if (lookup.status === 'hit' && lookup.snapshot) {
    iamCacheLookupCounter.add(1, { hit: true });
    cacheLogger.debug('Permission snapshot cache lookup', {
      operation: 'cache_lookup',
      hit: true,
      ttl_remaining_s: lookup.ttlRemainingSeconds,
      ...buildRequestContext(input.instanceId),
    });
    return { ok: true, permissions: lookup.snapshot.permissions };
  }

  iamCacheLookupCounter.add(1, { hit: false });
  cacheLogger.debug('Permission snapshot cache lookup', {
    operation: 'cache_lookup',
    hit: false,
    ...buildRequestContext(input.instanceId),
  });

  if (lookup.status === 'stale') {
    cacheMetricsState.staleLookups += 1;
    cacheLogger.warn('Stale permission snapshot detected', {
      operation: 'cache_stale_detected',
      age_s: lookup.ageSeconds,
      max_ttl_s: 300,
      ...buildRequestContext(input.instanceId),
    });
  }

  try {
    const permissions = await loadPermissionsFromDb(input);
    permissionSnapshotCache.set(input, permissions);

    if (lookup.status === 'stale') {
      cacheLogger.info('Permission snapshot recomputed after stale detection', {
        operation: 'cache_invalidate',
        trigger: 'recompute',
        affected_keys: 1,
        ...buildRequestContext(input.instanceId),
      });
    }

    return { ok: true, permissions };
  } catch (error) {
    logger.error('Failed to recompute permission snapshot', {
      operation: 'cache_invalidate_failed',
      error: error instanceof Error ? error.message : String(error),
      ...buildRequestContext(input.instanceId),
    });

    if (lookup.status === 'stale') {
      return { ok: false, error: 'cache_stale_guard' };
    }

    return { ok: false, error: 'database_unavailable' };
  }
};
