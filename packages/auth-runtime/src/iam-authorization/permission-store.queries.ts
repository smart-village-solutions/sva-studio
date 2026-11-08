import type { EffectivePermission } from '@sva/iam-core';
import { tenantCorePermissionCatalog, normalizeCompetenceLanguages } from '@sva/core';
import { revealField } from '@sva/server-runtime';
import { filterTenantEffectivePermissions } from './root-only-permissions.js';

import type { QueryClient } from '../db.js';

import { listScopeSensitivePermissionKeys } from './permission-scope-semantics.js';
import { type PermissionRow, toEffectivePermissions } from './shared-effective-permissions.js';
import { withInstanceScopedDb } from './shared.js';

export type PermissionLookupInput = {
  instanceId: string;
  keycloakSubject: string;
  organizationId?: string;
  geoUnitId?: string;
  geoHierarchy?: readonly string[];
};

const SCOPE_SENSITIVE_PERMISSION_KEYS = listScopeSensitivePermissionKeys();
const TENANT_CORE_PERMISSION_KEYS = tenantCorePermissionCatalog.map((permission) => permission.key);

export const ROLE_ASSIGNMENT_SOURCE_SQL = `
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
`;

const PERMISSION_ROW_SELECTION_SQL = `
SELECT DISTINCT
  p.permission_key,
  p.action,
  p.resource_type,
  p.resource_id,
  p.scope,
  rp.access_scope,
  source.role_id,
  source.group_id,
  source.group_key,
  source.source_kind,
`;

const ROLE_PERMISSION_JOIN_SQL = `
FROM iam.accounts a
JOIN (
${ROLE_ASSIGNMENT_SOURCE_SQL}
) source
  ON source.account_id = a.id AND source.instance_id = a.instance_id
  AND a.status = 'active' AND a.is_blocked = false
  AND a.soft_deleted_at IS NULL AND a.permanently_deleted_at IS NULL
  AND a.deletion_lifecycle_state = 'active' AND a.deactivated_at IS NULL
  AND EXISTS (SELECT 1 FROM iam.instance_memberships membership WHERE membership.instance_id = a.instance_id AND membership.account_id = a.id)
`;

export type TenantPermissionProjectionSubject = Readonly<{
  keycloakSubject: string;
  roleNames: readonly string[];
  permissionIds: readonly string[];
  languages?: readonly string[];
  displayName?: string;
}>;

type TenantPermissionProjectionRow = Readonly<{
  keycloak_subject: string;
  role_name: string;
  permission_key: string;
  access_scope?: PermissionRow['access_scope'];
  scope?: Record<string, unknown>;
  resource_id?: string;
  resource_type?: string;
  action?: string;
  competence_languages?: readonly string[];
  display_name_ciphertext?: string | null;
  first_name_ciphertext?: string | null;
  last_name_ciphertext?: string | null;
}>;

export const loadTenantPermissionProjectionSubjectsWithClient = async (
  client: QueryClient,
  input: Readonly<{
    instanceId: string;
    permissionIds: readonly string[];
    includeProfile?: boolean;
  }>
): Promise<readonly TenantPermissionProjectionSubject[]> => {
  if (input.permissionIds.length === 0) return [];

  const result = await client.query<TenantPermissionProjectionRow>(
    `
SELECT DISTINCT
  a.keycloak_subject,
  r.role_name,
  p.permission_key, p.action, p.resource_type, p.resource_id, p.scope, rp.access_scope,
  a.competence_languages,
  ${input.includeProfile ? 'a.display_name_ciphertext, a.first_name_ciphertext, a.last_name_ciphertext' : 'NULL::text AS display_name_ciphertext, NULL::text AS first_name_ciphertext, NULL::text AS last_name_ciphertext'}
${ROLE_PERMISSION_JOIN_SQL}
 AND source.instance_id = $1
JOIN iam.roles r
  ON r.instance_id = source.instance_id
 AND r.id = source.role_id
JOIN iam.role_permissions rp
  ON rp.instance_id = source.instance_id
 AND rp.role_id = source.role_id
JOIN iam.permissions p
  ON p.instance_id = rp.instance_id
 AND p.id = rp.permission_id
LEFT JOIN iam.instance_modules permission_module
  ON permission_module.instance_id = p.instance_id
 AND permission_module.module_id = split_part(p.permission_key, '.', 1)
WHERE a.instance_id = $1
  AND a.processing_restricted_at IS NULL
  AND p.permission_key = ANY($2::text[])
  AND (p.permission_key = ANY($3::text[]) OR permission_module.effective_active = true)
ORDER BY a.keycloak_subject, r.role_name, p.permission_key
`,
    [
      input.instanceId,
      [...new Set(input.permissionIds)].sort((left, right) => left.localeCompare(right)),
      TENANT_CORE_PERMISSION_KEYS,
    ]
  );

  const resolveUserDisplayName = input.includeProfile ? (await import('@sva/iam-admin')).resolveUserDisplayName : undefined;
  const projectionBySubject = new Map<
    string,
    { roleNames: Set<string>; permissionIds: Set<string>; languages?: readonly string[]; displayName?: string }
  >();
  for (const row of result.rows) {
    // Flat claims/directories have no record or organization context. Restricted
    // grants must never be widened into a tenant-wide capability.
    const effective = filterTenantEffectivePermissions(toEffectivePermissions([{ ...row, organization_id: null }]));
    if (!effective.some(permission =>
      permission.action === row.permission_key &&
      (!permission.accessScope || permission.accessScope === 'all') &&
      !permission.resourceId && !permission.organizationId &&
      (!permission.scope || Object.keys(permission.scope).length === 0))) continue;
    const projection = projectionBySubject.get(row.keycloak_subject) ?? {
      roleNames: new Set<string>(),
      permissionIds: new Set<string>(),
      ...(row.competence_languages ? { languages: normalizeCompetenceLanguages(row.competence_languages) } : {}),
      ...(resolveUserDisplayName ? { displayName: resolveUserDisplayName({
        keycloakSubject: row.keycloak_subject,
        decryptedDisplayName: revealField(row.display_name_ciphertext, `iam.accounts.display_name:${row.keycloak_subject}`),
        firstName: revealField(row.first_name_ciphertext, `iam.accounts.first_name:${row.keycloak_subject}`),
        lastName: revealField(row.last_name_ciphertext, `iam.accounts.last_name:${row.keycloak_subject}`),
      }) } : {}),
    };
    projection.roleNames.add(row.role_name);
    projection.permissionIds.add(row.permission_key);
    projectionBySubject.set(row.keycloak_subject, projection);
  }
  return [...projectionBySubject].map(([keycloakSubject, projection]) => ({
    keycloakSubject,
    ...(projection.languages ? { languages: projection.languages } : {}),
    ...(projection.displayName ? { displayName: projection.displayName } : {}),
    roleNames: [...projection.roleNames].sort((left, right) => left.localeCompare(right)),
    permissionIds: [...projection.permissionIds].sort((left, right) => left.localeCompare(right)),
  }));
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
${PERMISSION_ROW_SELECTION_SQL}
  CASE
    WHEN (
      (rp.access_scope IS NOT NULL AND rp.access_scope <> 'all')
      OR (rp.access_scope IS NULL AND p.permission_key = ANY($4::text[]))
    ) THEN $3::uuid
    ELSE NULL::uuid
  END AS organization_id
${ROLE_PERMISSION_JOIN_SQL}
 AND source.instance_id = $1
LEFT JOIN iam.account_organizations ao
  ON ao.instance_id = source.instance_id
 AND ao.account_id = source.account_id
LEFT JOIN target_organization target
  ON TRUE
JOIN iam.role_permissions rp
  ON rp.instance_id = source.instance_id
 AND rp.role_id = source.role_id
JOIN iam.permissions p
 ON p.instance_id = rp.instance_id
 AND p.id = rp.permission_id
LEFT JOIN iam.instance_modules permission_module
 ON permission_module.instance_id = p.instance_id
 AND permission_module.module_id = split_part(p.permission_key, '.', 1)
WHERE a.keycloak_subject = $2
  AND a.instance_id = $1
  AND (p.permission_key = ANY($5::text[]) OR permission_module.effective_active = true)
  AND (
    (
      rp.access_scope IS NULL
      AND NOT (p.permission_key = ANY($4::text[]))
    )
    OR (
      (
        rp.access_scope = 'all'
      )
      OR (
        (
          rp.access_scope IS NOT NULL
          AND rp.access_scope <> 'all'
        )
        AND target.id IS NOT NULL
        AND (
          ao.organization_id = target.id
          OR ao.organization_id = ANY(target.hierarchy_path)
        )
      )
      OR (
        (
          rp.access_scope IS NULL
          AND p.permission_key = ANY($4::text[])
        )
        AND target.id IS NOT NULL
        AND (
          ao.organization_id = target.id
          OR ao.organization_id = ANY(target.hierarchy_path)
        )
      )
    )
  )
`,
    [
      input.instanceId,
      input.keycloakSubject,
      input.organizationId,
      SCOPE_SENSITIVE_PERMISSION_KEYS,
      TENANT_CORE_PERMISSION_KEYS,
    ]
  );

  return scopedQuery.rows;
};

const listUnscopedPermissionRows = async (
  client: QueryClient,
  input: PermissionLookupInput
): Promise<readonly PermissionRow[]> => {
  const unscopedQuery = await client.query<PermissionRow>(
    `
${PERMISSION_ROW_SELECTION_SQL}
  CASE
    WHEN (
      (rp.access_scope IS NOT NULL AND rp.access_scope <> 'all')
      OR (rp.access_scope IS NULL AND p.permission_key = ANY($3::text[]))
    ) THEN ao.organization_id
    ELSE NULL::uuid
  END AS organization_id
${ROLE_PERMISSION_JOIN_SQL}
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
LEFT JOIN iam.instance_modules permission_module
  ON permission_module.instance_id = p.instance_id
 AND permission_module.module_id = split_part(p.permission_key, '.', 1)
WHERE a.keycloak_subject = $2
  AND a.instance_id = $1
  AND (p.permission_key = ANY($4::text[]) OR permission_module.effective_active = true)
`,
    [
      input.instanceId,
      input.keycloakSubject,
      SCOPE_SENSITIVE_PERMISSION_KEYS,
      TENANT_CORE_PERMISSION_KEYS,
    ]
  );

  return unscopedQuery.rows;
};

export const loadPermissionsWithClient = async (
  client: QueryClient,
  input: PermissionLookupInput
): Promise<readonly EffectivePermission[]> => {
  const rows = input.organizationId
    ? await listScopedPermissionRows(client, { ...input, organizationId: input.organizationId })
    : await listUnscopedPermissionRows(client, input);
  return toEffectivePermissions(rows);
};

export const loadPermissionsFromDb = async (
  input: PermissionLookupInput
): Promise<readonly EffectivePermission[]> =>
  withInstanceScopedDb(input.instanceId, (client) => loadPermissionsWithClient(client, input));
