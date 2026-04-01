import type { EffectivePermission } from '@sva/core';

import type { QueryClient } from '../shared/db-helpers.js';

import { type PermissionRow, toEffectivePermissions } from './shared-effective-permissions.js';
import { withInstanceScopedDb } from './shared.js';

export type PermissionLookupInput = {
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

export const loadPermissionsFromDb = async (
  input: PermissionLookupInput
): Promise<readonly EffectivePermission[]> => {
  const rows = await withInstanceScopedDb(input.instanceId, async (client) =>
    input.organizationId
      ? listScopedPermissionRows(client, { ...input, organizationId: input.organizationId })
      : listUnscopedPermissionRows(client, input)
  );
  return toEffectivePermissions(rows);
};
