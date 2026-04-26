import type {
  IamOrganizationContextOption,
  IamOrganizationDetail,
  IamOrganizationListItem,
  IamOrganizationMembership,
  IamOrganizationMembershipVisibility,
  IamOrganizationType,
} from '@sva/core';

import { revealField } from './encryption.js';
import type { QueryClient } from './query-client.js';
import { resolveUserDisplayName } from './user-mapping.js';

export type OrganizationRow = {
  readonly id: string;
  readonly organization_key: string;
  readonly display_name: string;
  readonly parent_organization_id: string | null;
  readonly parent_display_name: string | null;
  readonly organization_type: IamOrganizationType;
  readonly content_author_policy: 'org_only' | 'org_or_personal';
  readonly is_active: boolean;
  readonly depth: number;
  readonly hierarchy_path: readonly string[] | null;
  readonly child_count: number;
  readonly membership_count: number;
  readonly metadata?: Record<string, unknown> | null;
};

export type MembershipRow = {
  readonly account_id: string;
  readonly keycloak_subject: string;
  readonly display_name_ciphertext: string | null;
  readonly first_name_ciphertext: string | null;
  readonly last_name_ciphertext: string | null;
  readonly email_ciphertext: string | null;
  readonly membership_visibility: IamOrganizationMembershipVisibility;
  readonly is_default_context: boolean;
  readonly created_at: string;
};

export type ContextOptionRow = {
  readonly organization_id: string;
  readonly organization_key: string;
  readonly display_name: string;
  readonly organization_type: IamOrganizationType;
  readonly is_active: boolean;
  readonly is_default_context: boolean;
};

export type HierarchyResolution =
  | { readonly ok: true; readonly hierarchyPath: readonly string[]; readonly depth: number }
  | {
      readonly ok: false;
      readonly status: number;
      readonly code: 'invalid_organization_id' | 'conflict' | 'organization_inactive';
      readonly message: string;
    };

type ChildRow = {
  readonly id: string;
  readonly organization_key: string;
  readonly display_name: string;
  readonly is_active: boolean;
};

const ORGANIZATION_TYPE_VALUES = [
  'county',
  'municipality',
  'district',
  'company',
  'agency',
  'other',
] as const satisfies readonly IamOrganizationType[];

const ORGANIZATION_LIST_SOURCE_SQL = `
FROM iam.organizations organization
LEFT JOIN iam.organizations parent
  ON parent.instance_id = organization.instance_id
 AND parent.id = organization.parent_organization_id
`;

const ORGANIZATION_LIST_FILTER_SQL = `
WHERE organization.instance_id = $1
  AND ($2::text IS NULL
    OR organization.display_name ILIKE $2 ESCAPE '\\'
    OR organization.organization_key ILIKE $2 ESCAPE '\\')
  AND ($3::text IS NULL OR organization.organization_type = $3)
  AND ($4::boolean IS NULL OR organization.is_active = $4)
`;

const readString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const mapOrganizationListItem = (row: OrganizationRow): IamOrganizationListItem => ({
  id: row.id,
  organizationKey: row.organization_key,
  displayName: row.display_name,
  parentOrganizationId: row.parent_organization_id ?? undefined,
  parentDisplayName: row.parent_display_name ?? undefined,
  organizationType: row.organization_type,
  contentAuthorPolicy: row.content_author_policy,
  isActive: row.is_active,
  depth: row.depth,
  hierarchyPath: [...(row.hierarchy_path ?? [])],
  childCount: row.child_count,
  membershipCount: row.membership_count,
});

export const mapMembershipRow = (row: MembershipRow): IamOrganizationMembership => {
  const firstName = revealField(row.first_name_ciphertext, `iam.accounts.first_name:${row.keycloak_subject}`);
  const lastName = revealField(row.last_name_ciphertext, `iam.accounts.last_name:${row.keycloak_subject}`);
  const decryptedDisplayName = revealField(
    row.display_name_ciphertext,
    `iam.accounts.display_name:${row.keycloak_subject}`
  );

  return {
    accountId: row.account_id,
    keycloakSubject: row.keycloak_subject,
    displayName: resolveUserDisplayName({
      decryptedDisplayName,
      firstName,
      lastName,
      keycloakSubject: row.keycloak_subject,
    }),
    email: revealField(row.email_ciphertext, `iam.accounts.email:${row.keycloak_subject}`),
    visibility: row.membership_visibility,
    isDefaultContext: row.is_default_context,
    createdAt: row.created_at,
  };
};

export const mapContextOption = (row: ContextOptionRow): IamOrganizationContextOption => ({
  organizationId: row.organization_id,
  organizationKey: row.organization_key,
  displayName: row.display_name,
  organizationType: row.organization_type,
  isActive: row.is_active,
  isDefaultContext: row.is_default_context,
});

export const isHierarchyError = (value: unknown): value is Extract<HierarchyResolution, { readonly ok: false }> =>
  typeof value === 'object' && value !== null && 'ok' in value && value.ok === false;

export const readStatusFilter = (request: Request): boolean | undefined => {
  const status = readString(new URL(request.url).searchParams.get('status'));
  if (!status || status === 'all') {
    return undefined;
  }
  if (status === 'active') {
    return true;
  }
  if (status === 'inactive') {
    return false;
  }
  return undefined;
};

export const readOrganizationTypeFilter = (request: Request): IamOrganizationType | undefined | 'invalid' => {
  const organizationType = readString(new URL(request.url).searchParams.get('organizationType'));
  if (!organizationType) {
    return undefined;
  }
  return (ORGANIZATION_TYPE_VALUES as readonly string[]).includes(organizationType)
    ? (organizationType as IamOrganizationType)
    : 'invalid';
};

export const escapeIlikePattern = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');

export const chooseActiveOrganizationId = (input: {
  readonly storedActiveOrganizationId?: string;
  readonly organizations: readonly IamOrganizationContextOption[];
}): string | undefined => {
  const activeIds = new Set(
    input.organizations.filter((organization) => organization.isActive).map((organization) => organization.organizationId)
  );
  if (input.storedActiveOrganizationId && activeIds.has(input.storedActiveOrganizationId)) {
    return input.storedActiveOrganizationId;
  }

  const defaultOrganization = input.organizations.find(
    (organization) => organization.isActive && organization.isDefaultContext
  );
  if (defaultOrganization) {
    return defaultOrganization.organizationId;
  }

  return input.organizations.find((organization) => organization.isActive)?.organizationId;
};

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

export const loadOrganizationList = async (
  client: QueryClient,
  input: {
    readonly instanceId: string;
    readonly page: number;
    readonly pageSize: number;
    readonly search?: string;
    readonly organizationType?: IamOrganizationType;
    readonly isActive?: boolean;
  }
): Promise<{ readonly items: readonly IamOrganizationListItem[]; readonly total: number }> => {
  const offset = (input.page - 1) * input.pageSize;
  const searchPattern = input.search ? `%${escapeIlikePattern(input.search)}%` : null;
  const filterParams = [input.instanceId, searchPattern, input.organizationType ?? null, input.isActive ?? null] as const;
  const totalResult = await client.query<{ readonly total: number }>(
    `
SELECT COUNT(*)::int AS total
${ORGANIZATION_LIST_SOURCE_SQL}
${ORGANIZATION_LIST_FILTER_SQL};
`,
    filterParams
  );

  const result = await client.query<OrganizationRow>(
    `
WITH child_counts AS (
  SELECT parent_organization_id AS organization_id, COUNT(*)::int AS child_count
  FROM iam.organizations
  WHERE instance_id = $1
    AND parent_organization_id IS NOT NULL
  GROUP BY parent_organization_id
),
membership_counts AS (
  SELECT organization_id, COUNT(*)::int AS membership_count
  FROM iam.account_organizations
  WHERE instance_id = $1
  GROUP BY organization_id
)
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
  COALESCE(child_counts.child_count, 0) AS child_count,
  COALESCE(membership_counts.membership_count, 0) AS membership_count
${ORGANIZATION_LIST_SOURCE_SQL}
LEFT JOIN child_counts
  ON child_counts.organization_id = organization.id
LEFT JOIN membership_counts
  ON membership_counts.organization_id = organization.id
${ORGANIZATION_LIST_FILTER_SQL}
ORDER BY organization.depth ASC, organization.display_name ASC
LIMIT $5::int OFFSET $6::int;
`,
    [...filterParams, input.pageSize, offset]
  );

  return {
    items: result.rows.map(mapOrganizationListItem),
    total: totalResult.rows[0]?.total ?? 0,
  };
};

export const loadOrganizationDetail = async (
  client: QueryClient,
  input: { readonly instanceId: string; readonly organizationId: string }
): Promise<IamOrganizationDetail | undefined> => {
  const organization = await loadOrganizationById(client, input);
  if (!organization) {
    return undefined;
  }

  const membershipsResult = await client.query<MembershipRow>(
    `
SELECT
  account.id AS account_id,
  account.keycloak_subject,
  account.display_name_ciphertext,
  account.first_name_ciphertext,
  account.last_name_ciphertext,
  account.email_ciphertext,
  membership.membership_visibility,
  membership.is_default_context,
  membership.created_at::text
FROM iam.account_organizations membership
JOIN iam.accounts account
  ON account.id = membership.account_id
WHERE membership.instance_id = $1
  AND membership.organization_id = $2::uuid
ORDER BY membership.is_default_context DESC, membership.created_at ASC;
`,
    [input.instanceId, input.organizationId]
  );

  const childrenResult = await client.query<ChildRow>(
    `
SELECT id, organization_key, display_name, is_active
FROM iam.organizations
WHERE instance_id = $1
  AND parent_organization_id = $2::uuid
ORDER BY display_name ASC;
`,
    [input.instanceId, input.organizationId]
  );

  return {
    ...mapOrganizationListItem(organization),
    metadata: organization.metadata ?? {},
    memberships: membershipsResult.rows.map(mapMembershipRow),
    children: childrenResult.rows.map((row) => ({
      id: row.id,
      organizationKey: row.organization_key,
      displayName: row.display_name,
      isActive: row.is_active,
    })),
  };
};

export const loadContextOptions = async (
  client: QueryClient,
  input: { readonly instanceId: string; readonly accountId: string }
): Promise<readonly IamOrganizationContextOption[]> => {
  const result = await client.query<ContextOptionRow>(
    `
SELECT
  organization.id AS organization_id,
  organization.organization_key,
  organization.display_name,
  organization.organization_type,
  organization.is_active,
  membership.is_default_context
FROM iam.account_organizations membership
JOIN iam.organizations organization
  ON organization.instance_id = membership.instance_id
 AND organization.id = membership.organization_id
WHERE membership.instance_id = $1
  AND membership.account_id = $2::uuid
ORDER BY membership.is_default_context DESC, organization.depth ASC, organization.display_name ASC;
`,
    [input.instanceId, input.accountId]
  );

  return result.rows.map(mapContextOption);
};

export const resolveHierarchyFields = async (
  client: QueryClient,
  input: { readonly instanceId: string; readonly organizationId?: string; readonly parentOrganizationId?: string | null }
): Promise<HierarchyResolution> => {
  if (!input.parentOrganizationId) {
    return { ok: true, hierarchyPath: [], depth: 0 };
  }

  if (input.organizationId && input.parentOrganizationId === input.organizationId) {
    return { ok: false, status: 409, code: 'conflict', message: 'Organisation kann nicht sich selbst als Parent setzen.' };
  }

  const parent = await loadOrganizationById(client, {
    instanceId: input.instanceId,
    organizationId: input.parentOrganizationId,
  });

  if (!parent) {
    return { ok: false, status: 400, code: 'invalid_organization_id', message: 'Ungültige Parent-Organisation.' };
  }

  if (!parent.is_active) {
    return { ok: false, status: 409, code: 'organization_inactive', message: 'Inaktive Parent-Organisation ist unzulässig.' };
  }

  if (input.organizationId && (parent.hierarchy_path ?? []).includes(input.organizationId)) {
    return { ok: false, status: 409, code: 'conflict', message: 'Zyklische Organisationshierarchie ist unzulässig.' };
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
