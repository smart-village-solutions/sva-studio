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

type PermissionLookupInput = {
  instanceId: string;
  keycloakSubject: string;
  organizationId?: string;
};

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
  source.source_kind,
  $3::uuid AS organization_id
FROM iam.accounts a
JOIN (
  SELECT ar.account_id, ar.role_id, ar.instance_id, NULL::uuid AS group_id, 'direct_role'::text AS source_kind
  FROM iam.account_roles ar
  WHERE ar.valid_from <= NOW()
    AND (ar.valid_to IS NULL OR ar.valid_to > NOW())
  UNION
  SELECT d.delegatee_account_id AS account_id, d.role_id, d.instance_id, NULL::uuid AS group_id, 'direct_role'::text AS source_kind
  FROM iam.delegations d
  WHERE d.status = 'active'
    AND now() BETWEEN d.starts_at AND d.ends_at
  UNION
  SELECT ag.account_id, gr.role_id, ag.instance_id, ag.group_id, 'group_role'::text AS source_kind
  FROM iam.account_groups ag
  JOIN iam.groups g
    ON g.instance_id = ag.instance_id
   AND g.id = ag.group_id
   AND g.is_active = true
  JOIN iam.group_roles gr
    ON gr.instance_id = ag.instance_id
   AND gr.group_id = ag.group_id
  WHERE (ag.valid_from IS NULL OR ag.valid_from <= NOW())
    AND (ag.valid_to IS NULL OR ag.valid_to > NOW())
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
  );
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
  source.source_kind,
  ao.organization_id
FROM iam.accounts a
JOIN (
  SELECT ar.account_id, ar.role_id, ar.instance_id, NULL::uuid AS group_id, 'direct_role'::text AS source_kind
  FROM iam.account_roles ar
  WHERE ar.valid_from <= NOW()
    AND (ar.valid_to IS NULL OR ar.valid_to > NOW())
  UNION
  SELECT d.delegatee_account_id AS account_id, d.role_id, d.instance_id, NULL::uuid AS group_id, 'direct_role'::text AS source_kind
  FROM iam.delegations d
  WHERE d.status = 'active'
    AND now() BETWEEN d.starts_at AND d.ends_at
  UNION
  SELECT ag.account_id, gr.role_id, ag.instance_id, ag.group_id, 'group_role'::text AS source_kind
  FROM iam.account_groups ag
  JOIN iam.groups g
    ON g.instance_id = ag.instance_id
   AND g.id = ag.group_id
   AND g.is_active = true
  JOIN iam.group_roles gr
    ON gr.instance_id = ag.instance_id
   AND gr.group_id = ag.group_id
  WHERE (ag.valid_from IS NULL OR ag.valid_from <= NOW())
    AND (ag.valid_to IS NULL OR ag.valid_to > NOW())
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
WHERE a.keycloak_subject = $2;
`,
    [input.instanceId, input.keycloakSubject]
  );

  return unscopedQuery.rows;
};

const listPermissionRows = async (
  client: QueryClient,
  input: PermissionLookupInput
): Promise<readonly PermissionRow[]> =>
  input.organizationId ? listScopedPermissionRows(client, { ...input, organizationId: input.organizationId }) : listUnscopedPermissionRows(client, input);

const loadPermissionsFromDb = async (input: PermissionLookupInput): Promise<readonly EffectivePermission[]> => {
  const rows = await withInstanceScopedDb(input.instanceId, async (client) => listPermissionRows(client, input));
  return toEffectivePermissions(rows);
};

export const resolveEffectivePermissions = async (input: PermissionLookupInput): Promise<EffectivePermissionsResolution> => {
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
