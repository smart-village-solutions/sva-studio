import type { QueryClient } from './query-client.js';
import type { OrganizationRow } from './organization-query.mapping.js';

export type HierarchyResolution =
  | { readonly ok: true; readonly hierarchyPath: readonly string[]; readonly depth: number }
  | {
      readonly ok: false;
      readonly status: number;
      readonly code: 'invalid_organization_id' | 'conflict' | 'organization_inactive';
      readonly message: string;
    };

export const isHierarchyError = (
  value: unknown
): value is Extract<HierarchyResolution, { readonly ok: false }> =>
  typeof value === 'object' && value !== null && 'ok' in value && value.ok === false;

export const loadOrganizationById = async (
  client: QueryClient,
  input: { readonly instanceId: string; readonly organizationId: string }
): Promise<OrganizationRow | undefined> => {
  const result = await client.query<OrganizationRow>(
    `
SELECT
  organization.id,
  organization.organization_key,
  organization.display_name,
  organization.parent_organization_id,
  parent.display_name AS parent_display_name,
  organization.organization_type,
  organization.content_author_policy,
  organization.is_active,
  organization.depth,
  organization.hierarchy_path,
  organization.metadata,
  (
    SELECT COUNT(*)::int
    FROM iam.organizations child
    WHERE child.instance_id = organization.instance_id
      AND child.parent_organization_id = organization.id
  ) AS child_count,
  (
    SELECT COUNT(*)::int
    FROM iam.account_organizations membership
    WHERE membership.instance_id = organization.instance_id
      AND membership.organization_id = organization.id
  ) AS membership_count
FROM iam.organizations organization
LEFT JOIN iam.organizations parent
  ON parent.instance_id = organization.instance_id
 AND parent.id = organization.parent_organization_id
WHERE organization.instance_id = $1
  AND organization.id = $2::uuid
LIMIT 1;
`,
    [input.instanceId, input.organizationId]
  );

  return result.rows[0];
};

export const resolveHierarchyFields = async (
  client: QueryClient,
  input: {
    readonly instanceId: string;
    readonly organizationId?: string;
    readonly parentOrganizationId?: string | null;
  }
): Promise<HierarchyResolution> => {
  if (!input.parentOrganizationId) {
    return { ok: true, hierarchyPath: [], depth: 0 };
  }

  if (input.organizationId && input.parentOrganizationId === input.organizationId) {
    return {
      ok: false,
      status: 409,
      code: 'conflict',
      message: 'Organisation kann nicht sich selbst als Parent setzen.',
    };
  }

  const parent = await loadOrganizationById(client, {
    instanceId: input.instanceId,
    organizationId: input.parentOrganizationId,
  });

  if (!parent) {
    return {
      ok: false,
      status: 400,
      code: 'invalid_organization_id',
      message: 'Ungültige Parent-Organisation.',
    };
  }

  if (!parent.is_active) {
    return {
      ok: false,
      status: 409,
      code: 'organization_inactive',
      message: 'Inaktive Parent-Organisation ist unzulässig.',
    };
  }

  if (input.organizationId && (parent.hierarchy_path ?? []).includes(input.organizationId)) {
    return {
      ok: false,
      status: 409,
      code: 'conflict',
      message: 'Zyklische Organisationshierarchie ist unzulässig.',
    };
  }

  return {
    ok: true,
    hierarchyPath: [...(parent.hierarchy_path ?? []), parent.id],
    depth: parent.depth + 1,
  };
};

export const rebuildOrganizationSubtree = async (
  client: QueryClient,
  input: { readonly instanceId: string; readonly organizationId: string }
): Promise<void> => {
  await client.query(
    `
WITH RECURSIVE organization_tree AS (
  SELECT
    organization.id,
    organization.instance_id,
    organization.hierarchy_path,
    organization.depth,
    ARRAY[organization.id]::uuid[] AS traversed_ids
  FROM iam.organizations organization
  WHERE organization.instance_id = $1
    AND organization.id = $2::uuid

  UNION ALL

  SELECT
    child.id,
    child.instance_id,
    organization_tree.hierarchy_path || child.parent_organization_id,
    organization_tree.depth + 1,
    organization_tree.traversed_ids || child.id
  FROM iam.organizations child
  JOIN organization_tree
    ON organization_tree.instance_id = child.instance_id
   AND organization_tree.id = child.parent_organization_id
  WHERE NOT child.id = ANY(organization_tree.traversed_ids)
)
UPDATE iam.organizations organization
SET
  hierarchy_path = organization_tree.hierarchy_path,
  depth = organization_tree.depth,
  updated_at = NOW()
FROM organization_tree
WHERE organization.instance_id = organization_tree.instance_id
  AND organization.id = organization_tree.id;
`,
    [input.instanceId, input.organizationId]
  );
};
