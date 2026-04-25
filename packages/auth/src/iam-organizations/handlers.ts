import { randomUUID } from 'node:crypto';

import type {
  IamOrganizationContextOption,
  IamOrganizationDetail,
  IamOrganizationListItem,
  IamOrganizationType,
} from '@sva/core';
import { createOrganizationMutationHandlers, createOrganizationReadHandlers } from '@sva/iam-admin';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';

import { getSession, updateSession } from '../redis-session.server.js';
import type { QueryClient } from '../shared/db-helpers.js';
import { jsonResponse } from '../shared/db-helpers.js';
import { isUuid, readString } from '../shared/input-readers.js';

import {
  asApiItem,
  asApiList,
  createApiError,
  parseRequestBody,
  readPage,
  readPathSegment,
  requireIdempotencyKey,
  toPayloadHash,
} from '../iam-account-management/api-helpers.js';
import { createActorResolutionDetails } from '../iam-account-management/diagnostics.js';
import { consumeRateLimit } from '../iam-account-management/rate-limit.js';
import {
  completeIdempotency,
  emitActivityLog,
  notifyPermissionInvalidation,
  requireRoles,
  reserveIdempotency,
  resolveActorInfo,
  withInstanceScopedDb,
} from '../iam-account-management/shared.js';
import { ensureFeature, getFeatureFlags } from '../iam-account-management/feature-flags.js';
import { validateCsrf } from '../iam-account-management/csrf.js';

import {
  chooseActiveOrganizationId,
  escapeIlikePattern,
  isHierarchyError,
  mapContextOption,
  mapMembershipRow,
  mapOrganizationListItem,
  readOrganizationTypeFilter,
  readStatusFilter,
  type ContextOptionRow,
  type HierarchyResolution,
  type MembershipRow,
  type OrganizationRow,
} from './handlers.helpers.js';

const logger = createSdkLogger({ component: 'iam-organizations', level: 'info' });

type ChildRow = {
  id: string;
  organization_key: string;
  display_name: string;
  is_active: boolean;
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
`;

const loadOrganizationById = async (
  client: QueryClient,
  input: { instanceId: string; organizationId: string }
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

const loadOrganizationList = async (
  client: QueryClient,
  input: {
    instanceId: string;
    page: number;
    pageSize: number;
    search?: string;
    organizationType?: IamOrganizationType;
    isActive?: boolean;
  }
): Promise<{ items: readonly IamOrganizationListItem[]; total: number }> => {
  const offset = (input.page - 1) * input.pageSize;
  const searchPattern = input.search ? `%${escapeIlikePattern(input.search)}%` : null;
  const filterParams = [input.instanceId, searchPattern, input.organizationType ?? null, input.isActive ?? null] as const;
  const totalResult = await client.query<{ total: number }>(
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

const loadOrganizationDetail = async (
  client: QueryClient,
  input: { instanceId: string; organizationId: string }
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

const loadContextOptions = async (
  client: QueryClient,
  input: { instanceId: string; accountId: string }
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

const organizationReadHandlers = createOrganizationReadHandlers({
  asApiItem,
  asApiList,
  chooseActiveOrganizationId,
  consumeRateLimit,
  createApiError,
  ensureFeature,
  getFeatureFlags,
  getSession,
  getWorkspaceContext,
  isUuid,
  jsonResponse,
  loadContextOptions,
  loadOrganizationDetail,
  loadOrganizationList,
  readOrganizationTypeFilter,
  readPage,
  readPathSegment,
  readStatusFilter,
  readString,
  requireRoles,
  resolveActorInfo,
  updateSession,
  withInstanceScopedDb,
});

const resolveHierarchyFields = async (
  client: QueryClient,
  input: { instanceId: string; organizationId?: string; parentOrganizationId?: string | null }
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

const rebuildOrganizationSubtree = async (
  client: QueryClient,
  input: { instanceId: string; organizationId: string }
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

const organizationMutationHandlers = createOrganizationMutationHandlers({
  asApiItem,
  completeIdempotency,
  consumeRateLimit,
  createActorResolutionDetails,
  createApiError,
  emitActivityLog,
  ensureFeature,
  getFeatureFlags,
  getWorkspaceContext,
  isHierarchyError,
  isUuid,
  jsonResponse,
  loadContextOptions,
  loadOrganizationById,
  loadOrganizationDetail,
  logger,
  notifyPermissionInvalidation,
  parseRequestBody,
  randomUUID,
  readPathSegment,
  rebuildOrganizationSubtree,
  requireIdempotencyKey,
  requireRoles,
  reserveIdempotency,
  resolveActorInfo,
  resolveHierarchyFields,
  toPayloadHash,
  updateSession,
  validateCsrf,
  withInstanceScopedDb,
});

const { getOrganizationInternal, listOrganizationsInternal } = organizationReadHandlers;

const { createOrganizationInternal } = organizationMutationHandlers;

const { updateOrganizationInternal } = organizationMutationHandlers;

const { deactivateOrganizationInternal } = organizationMutationHandlers;

const { assignOrganizationMembershipInternal } = organizationMutationHandlers;

const { removeOrganizationMembershipInternal } = organizationMutationHandlers;

const { getMyOrganizationContextInternal } = organizationReadHandlers;

const { updateMyOrganizationContextInternal } = organizationMutationHandlers;

export {
  assignOrganizationMembershipInternal,
  createOrganizationInternal,
  deactivateOrganizationInternal,
  getMyOrganizationContextInternal,
  getOrganizationInternal,
  listOrganizationsInternal,
  removeOrganizationMembershipInternal,
  updateMyOrganizationContextInternal,
  updateOrganizationInternal,
};
