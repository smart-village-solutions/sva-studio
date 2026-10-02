import type {
  IamOrganizationContextOption,
  IamOrganizationDetail,
  IamOrganizationListItem,
  IamOrganizationType,
} from '@sva/core';

import { loadOrganizationById } from './organization-hierarchy.js';
import { loadOrganizationMainserverCredentialState } from './organization-mainserver-credentials.js';
import { escapeIlikePattern, mapContextOption, mapMembershipRow, mapOrganizationListItem } from './organization-query.mapping.js';
import type {
  ContextOptionRow,
  MembershipRow,
  OrganizationListSortDirection,
  OrganizationListSortField,
  OrganizationRow,
} from './organization-query.mapping.js';
import type { QueryClient } from './query-client.js';

export {
  isHierarchyError,
  loadOrganizationById,
  rebuildOrganizationSubtree,
  resolveHierarchyFields,
  type HierarchyResolution,
} from './organization-hierarchy.js';
export {
  chooseActiveOrganizationId,
  escapeIlikePattern,
  mapContextOption,
  mapMembershipRow,
  mapOrganizationListItem,
  ORGANIZATION_LIST_SORT_FIELDS,
  readOrganizationListSort,
  readOrganizationTypeFilter,
  readStatusFilter,
  type ContextOptionRow,
  type MembershipRow,
  type OrganizationListSortDirection,
  type OrganizationListSortField,
  type OrganizationRow,
} from './organization-query.mapping.js';

type ChildRow = {
  readonly id: string;
  readonly organization_key: string;
  readonly display_name: string;
  readonly is_active: boolean;
};

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
  AND ($5::uuid IS NULL OR organization.id <> $5::uuid)
`;

export const loadOrganizationList = async (
  client: QueryClient,
  input: {
    readonly instanceId: string;
    readonly page: number;
    readonly pageSize: number;
    readonly search?: string;
    readonly organizationType?: IamOrganizationType;
    readonly isActive?: boolean;
    readonly excludeOrganizationId?: string;
    readonly sortBy: OrganizationListSortField;
    readonly sortDirection: OrganizationListSortDirection;
  }
): Promise<{ readonly items: readonly IamOrganizationListItem[]; readonly total: number }> => {
  const offset = (input.page - 1) * input.pageSize;
  const searchPattern = input.search ? `%${escapeIlikePattern(input.search)}%` : null;
  const filterParams = [
    input.instanceId,
    searchPattern,
    input.organizationType ?? null,
    input.isActive ?? null,
    input.excludeOrganizationId ?? null,
  ] as const;
  const sortExpressionByField = {
    displayName: 'LOWER(organization.display_name) COLLATE "C"',
    parentDisplayName: 'LOWER(parent.display_name) COLLATE "C"',
    childCount: 'COALESCE(child_counts.child_count, 0)',
    membershipCount: 'COALESCE(membership_counts.membership_count, 0)',
    isActive: 'organization.is_active',
  } as const satisfies Record<OrganizationListSortField, string>;
  const sortExpression = sortExpressionByField[input.sortBy];
  const sortDirection = input.sortDirection === 'asc' ? 'ASC' : 'DESC';
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
ORDER BY (${sortExpression} IS NULL) ASC, ${sortExpression} ${sortDirection}, organization.id ASC
LIMIT $6::int OFFSET $7::int;
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
  const credentials = await loadOrganizationMainserverCredentialState(client, input);

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
    mainserverApplicationId: credentials.mainserverApplicationId,
    mainserverApplicationSecretSet: credentials.mainserverApplicationSecretSet,
    mainserverProvisioning: {
      status: credentials.provisioningStatus,
      technicalAccountId: credentials.technicalAccountId,
      phase: credentials.provisioningPhase,
      attemptCount: credentials.attemptCount,
      lastErrorCode: credentials.lastErrorCode,
      lastAttemptAt: credentials.lastAttemptAt,
      completedAt: credentials.completedAt,
      lastVerifiedAt: credentials.lastVerifiedAt,
      operationInProgress:
        credentials.provisioningStatus === 'provisioning' &&
        Boolean(credentials.leaseExpiresAt && Date.parse(credentials.leaseExpiresAt) > Date.now()),
    },
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
  organization.content_author_policy,
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
