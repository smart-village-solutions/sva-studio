import { randomUUID } from 'node:crypto';

import type {
  IamOrganizationContext,
  IamOrganizationDetail,
  IamOrganizationType,
} from '@sva/core';
import { createSdkLogger, getWorkspaceContext } from '@sva/sdk/server';

import type { AuthenticatedRequestContext } from '../middleware.server';
import { getSession, updateSession } from '../redis-session.server';
import type { QueryClient } from '../shared/db-helpers';
import { jsonResponse } from '../shared/db-helpers';
import { isUuid } from '../shared/input-readers';

import { ADMIN_ROLES } from '../iam-account-management/constants';
import {
  asApiItem,
  asApiList,
  createApiError,
  parseRequestBody,
  readPage,
  readPathSegment,
  requireIdempotencyKey,
  toPayloadHash,
} from '../iam-account-management/api-helpers';
import { consumeRateLimit } from '../iam-account-management/rate-limit';
import {
  completeIdempotency,
  emitActivityLog,
  logger as iamLogger,
  notifyPermissionInvalidation,
  requireRoles,
  reserveIdempotency,
  resolveActorInfo,
  withInstanceScopedDb,
} from '../iam-account-management/shared';
import { ensureFeature, getFeatureFlags } from '../iam-account-management/feature-flags';
import { validateCsrf } from '../iam-account-management/csrf';

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
} from './handlers.helpers';
import {
  assignOrganizationMembershipSchema,
  createOrganizationSchema,
  updateOrganizationContextSchema,
  updateOrganizationSchema,
} from './schemas';

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
WHERE organization.instance_id = $1::uuid
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
WHERE organization.instance_id = $1::uuid
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
  WHERE instance_id = $1::uuid
    AND parent_organization_id IS NOT NULL
  GROUP BY parent_organization_id
),
membership_counts AS (
  SELECT organization_id, COUNT(*)::int AS membership_count
  FROM iam.account_organizations
  WHERE instance_id = $1::uuid
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
WHERE membership.instance_id = $1::uuid
  AND membership.organization_id = $2::uuid
ORDER BY membership.is_default_context DESC, membership.created_at ASC;
`,
    [input.instanceId, input.organizationId]
  );

  const childrenResult = await client.query<ChildRow>(
    `
SELECT id, organization_key, display_name, is_active
FROM iam.organizations
WHERE instance_id = $1::uuid
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
WHERE membership.instance_id = $1::uuid
  AND membership.account_id = $2::uuid
ORDER BY membership.is_default_context DESC, organization.depth ASC, organization.display_name ASC;
`,
    [input.instanceId, input.accountId]
  );

  return result.rows.map(mapContextOption);
};

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
  WHERE organization.instance_id = $1::uuid
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

const listOrganizationsInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_admin', requestContext.requestId);
  if (featureCheck) {
    return featureCheck;
  }
  const roleCheck = requireRoles(ctx, ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) {
    return roleCheck;
  }

  const actorResolution = await resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }

  const rateLimit = consumeRateLimit({
    instanceId: actorResolution.actor.instanceId,
    actorKeycloakSubject: ctx.user.id,
    scope: 'read',
    requestId: actorResolution.actor.requestId,
  });
  if (rateLimit) {
    return rateLimit;
  }

  const { page, pageSize } = readPage(request);
  const url = new URL(request.url);
  const search = readString(url.searchParams.get('search'));
  const organizationType = readOrganizationTypeFilter(request);
  if (organizationType === 'invalid') {
    return createApiError(400, 'invalid_request', 'Ungültiger organizationType-Filter.', actorResolution.actor.requestId);
  }
  const isActive = readStatusFilter(request);

  try {
    const organizations = await withInstanceScopedDb(actorResolution.actor.instanceId, (client) =>
      loadOrganizationList(client, {
        instanceId: actorResolution.actor.instanceId,
        page,
        pageSize,
        search,
        organizationType,
        isActive,
      })
    );

    return jsonResponse(
      200,
      asApiList(organizations.items, { page, pageSize, total: organizations.total }, actorResolution.actor.requestId)
    );
  } catch {
    return createApiError(503, 'database_unavailable', 'IAM-Datenbank ist nicht erreichbar.', actorResolution.actor.requestId);
  }
};

const getOrganizationInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_admin', requestContext.requestId);
  if (featureCheck) {
    return featureCheck;
  }
  const roleCheck = requireRoles(ctx, ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) {
    return roleCheck;
  }

  const actorResolution = await resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }

  const rateLimit = consumeRateLimit({
    instanceId: actorResolution.actor.instanceId,
    actorKeycloakSubject: ctx.user.id,
    scope: 'read',
    requestId: actorResolution.actor.requestId,
  });
  if (rateLimit) {
    return rateLimit;
  }

  const organizationId = readPathSegment(request, 4);
  if (!organizationId || !isUuid(organizationId)) {
    return createApiError(400, 'invalid_organization_id', 'Ungültige organizationId.', actorResolution.actor.requestId);
  }

  try {
    const organization = await withInstanceScopedDb(actorResolution.actor.instanceId, (client) =>
      loadOrganizationDetail(client, { instanceId: actorResolution.actor.instanceId, organizationId })
    );

    if (!organization) {
      return createApiError(404, 'not_found', 'Organisation nicht gefunden.', actorResolution.actor.requestId);
    }

    return jsonResponse(200, asApiItem(organization, actorResolution.actor.requestId));
  } catch {
    return createApiError(503, 'database_unavailable', 'IAM-Datenbank ist nicht erreichbar.', actorResolution.actor.requestId);
  }
};

const createOrganizationInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_admin', requestContext.requestId);
  if (featureCheck) {
    return featureCheck;
  }
  const roleCheck = requireRoles(ctx, ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) {
    return roleCheck;
  }

  const actorResolution = await resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }
  if (!actorResolution.actor.actorAccountId) {
    return createApiError(403, 'forbidden', 'Akteur-Account nicht gefunden.', actorResolution.actor.requestId);
  }
  const actorAccountId = actorResolution.actor.actorAccountId;

  const csrfError = validateCsrf(request, actorResolution.actor.requestId);
  if (csrfError) {
    return csrfError;
  }

  const rateLimit = consumeRateLimit({
    instanceId: actorResolution.actor.instanceId,
    actorKeycloakSubject: ctx.user.id,
    scope: 'write',
    requestId: actorResolution.actor.requestId,
  });
  if (rateLimit) {
    return rateLimit;
  }

  const idempotency = requireIdempotencyKey(request, actorResolution.actor.requestId);
  if ('error' in idempotency) {
    return idempotency.error;
  }

  const parsed = await parseRequestBody(request, createOrganizationSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', 'Ungültiger Payload.', actorResolution.actor.requestId);
  }

  const reserve = await reserveIdempotency({
    instanceId: actorResolution.actor.instanceId,
    actorAccountId,
    endpoint: 'POST:/api/v1/iam/organizations',
    idempotencyKey: idempotency.key,
    payloadHash: toPayloadHash(parsed.rawBody),
  });
  if (reserve.status === 'replay') {
    return jsonResponse(reserve.responseStatus, reserve.responseBody);
  }
  if (reserve.status === 'conflict') {
    return createApiError(409, 'idempotency_key_reuse', reserve.message, actorResolution.actor.requestId);
  }

  try {
    const created = await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
      const hierarchy = await resolveHierarchyFields(client, {
        instanceId: actorResolution.actor.instanceId,
        parentOrganizationId: parsed.data.parentOrganizationId,
      });
      if (!hierarchy.ok) {
        throw hierarchy;
      }

      const organizationId = randomUUID();
      const inserted = await client.query<{ id: string }>(
        `
INSERT INTO iam.organizations (
  id,
  instance_id,
  organization_key,
  display_name,
  metadata,
  organization_type,
  content_author_policy,
  parent_organization_id,
  hierarchy_path,
  depth,
  is_active
)
VALUES ($1::uuid, $2::uuid, $3, $4, $5::jsonb, $6, $7, $8::uuid, $9::uuid[], $10::int, true)
RETURNING id;
`,
        [
          organizationId,
          actorResolution.actor.instanceId,
          parsed.data.organizationKey,
          parsed.data.displayName,
          JSON.stringify(parsed.data.metadata ?? {}),
          parsed.data.organizationType,
          parsed.data.contentAuthorPolicy,
          parsed.data.parentOrganizationId ?? null,
          hierarchy.hierarchyPath,
          hierarchy.depth,
        ]
      );

      const createdOrganizationId = inserted.rows[0]?.id ?? organizationId;
      await emitActivityLog(client, {
        instanceId: actorResolution.actor.instanceId,
        accountId: actorAccountId,
        eventType: 'organization.created',
        result: 'success',
        payload: {
          organizationId: createdOrganizationId,
          organizationKey: parsed.data.organizationKey,
          organizationType: parsed.data.organizationType,
        },
        requestId: actorResolution.actor.requestId,
        traceId: actorResolution.actor.traceId,
      });

      return loadOrganizationDetail(client, {
        instanceId: actorResolution.actor.instanceId,
        organizationId: createdOrganizationId,
      });
    });

    if (!created) {
      throw new Error('organization_not_created');
    }

    logger.info('Organization created', {
      workspace_id: actorResolution.actor.instanceId,
      request_id: actorResolution.actor.requestId,
      trace_id: actorResolution.actor.traceId,
      context: {
        operation: 'organization_created',
        organization_id: created.id,
        organization_key: created.organizationKey,
      },
    });

    const responseBody = asApiItem(created, actorResolution.actor.requestId);
    await completeIdempotency({
      instanceId: actorResolution.actor.instanceId,
      actorAccountId,
      endpoint: 'POST:/api/v1/iam/organizations',
      idempotencyKey: idempotency.key,
      status: 'COMPLETED',
      responseStatus: 201,
      responseBody,
    });

    return jsonResponse(201, responseBody);
  } catch (error) {
    if (isHierarchyError(error)) {
      const hierarchyError = error;
      const responseBody = {
        error: { code: hierarchyError.code, message: hierarchyError.message },
        ...(actorResolution.actor.requestId ? { requestId: actorResolution.actor.requestId } : {}),
      };
      await completeIdempotency({
        instanceId: actorResolution.actor.instanceId,
        actorAccountId,
        endpoint: 'POST:/api/v1/iam/organizations',
        idempotencyKey: idempotency.key,
        status: 'FAILED',
        responseStatus: hierarchyError.status,
        responseBody,
      });
      return jsonResponse(hierarchyError.status, responseBody);
    }

    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes('organizations_instance_key_uniq') ? 409 : 503;
    const code = status === 409 ? 'conflict' : 'database_unavailable';
    const responseBody = {
      error: {
        code,
        message:
          status === 409
            ? 'Organisation mit diesem Schlüssel existiert bereits.'
            : 'IAM-Datenbank ist nicht erreichbar.',
      },
      ...(actorResolution.actor.requestId ? { requestId: actorResolution.actor.requestId } : {}),
    };
    await completeIdempotency({
      instanceId: actorResolution.actor.instanceId,
      actorAccountId: actorResolution.actor.actorAccountId,
      endpoint: 'POST:/api/v1/iam/organizations',
      idempotencyKey: idempotency.key,
      status: 'FAILED',
      responseStatus: status,
      responseBody,
    });
    return jsonResponse(status, responseBody);
  }
};

const updateOrganizationInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_admin', requestContext.requestId);
  if (featureCheck) {
    return featureCheck;
  }
  const roleCheck = requireRoles(ctx, ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) {
    return roleCheck;
  }

  const actorResolution = await resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }
  if (!actorResolution.actor.actorAccountId) {
    return createApiError(403, 'forbidden', 'Akteur-Account nicht gefunden.', actorResolution.actor.requestId);
  }
  const actorAccountId = actorResolution.actor.actorAccountId;

  const organizationId = readPathSegment(request, 4);
  if (!organizationId || !isUuid(organizationId)) {
    return createApiError(400, 'invalid_organization_id', 'Ungültige organizationId.', actorResolution.actor.requestId);
  }

  const csrfError = validateCsrf(request, actorResolution.actor.requestId);
  if (csrfError) {
    return csrfError;
  }

  const rateLimit = consumeRateLimit({
    instanceId: actorResolution.actor.instanceId,
    actorKeycloakSubject: ctx.user.id,
    scope: 'write',
    requestId: actorResolution.actor.requestId,
  });
  if (rateLimit) {
    return rateLimit;
  }

  const parsed = await parseRequestBody(request, updateOrganizationSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', 'Ungültiger Payload.', actorResolution.actor.requestId);
  }

  try {
    const updated = await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
      const existing = await loadOrganizationById(client, {
        instanceId: actorResolution.actor.instanceId,
        organizationId,
      });
      if (!existing) {
        return undefined;
      }

      const nextParentOrganizationId =
        parsed.data.parentOrganizationId === undefined ? existing.parent_organization_id : parsed.data.parentOrganizationId;
      const hierarchy = await resolveHierarchyFields(client, {
        instanceId: actorResolution.actor.instanceId,
        organizationId,
        parentOrganizationId: nextParentOrganizationId,
      });
      if (!hierarchy.ok) {
        throw hierarchy;
      }

      await client.query(
        `
UPDATE iam.organizations
SET
  organization_key = COALESCE($3, organization_key),
  display_name = COALESCE($4, display_name),
  parent_organization_id = $5::uuid,
  organization_type = COALESCE($6, organization_type),
  content_author_policy = COALESCE($7, content_author_policy),
  metadata = COALESCE($8::jsonb, metadata),
  hierarchy_path = $9::uuid[],
  depth = $10::int,
  updated_at = NOW()
WHERE instance_id = $1::uuid
  AND id = $2::uuid;
`,
        [
          actorResolution.actor.instanceId,
          organizationId,
          parsed.data.organizationKey ?? null,
          parsed.data.displayName ?? null,
          nextParentOrganizationId ?? null,
          parsed.data.organizationType ?? null,
          parsed.data.contentAuthorPolicy ?? null,
          parsed.data.metadata ? JSON.stringify(parsed.data.metadata) : null,
          hierarchy.hierarchyPath,
          hierarchy.depth,
        ]
      );

      await rebuildOrganizationSubtree(client, {
        instanceId: actorResolution.actor.instanceId,
        organizationId,
      });

      await emitActivityLog(client, {
        instanceId: actorResolution.actor.instanceId,
        accountId: actorAccountId,
        eventType: 'organization.updated',
        result: 'success',
        payload: {
          organizationId,
          parentOrganizationId: nextParentOrganizationId,
        },
        requestId: actorResolution.actor.requestId,
        traceId: actorResolution.actor.traceId,
      });

      return loadOrganizationDetail(client, {
        instanceId: actorResolution.actor.instanceId,
        organizationId,
      });
    });

    if (!updated) {
      return createApiError(404, 'not_found', 'Organisation nicht gefunden.', actorResolution.actor.requestId);
    }

    return jsonResponse(200, asApiItem(updated, actorResolution.actor.requestId));
  } catch (error) {
    if (isHierarchyError(error)) {
      const hierarchyError = error;
      return createApiError(
        hierarchyError.status,
        hierarchyError.code,
        hierarchyError.message,
        actorResolution.actor.requestId
      );
    }
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('organizations_instance_key_uniq')) {
      return createApiError(409, 'conflict', 'Organisation mit diesem Schlüssel existiert bereits.', actorResolution.actor.requestId);
    }
    return createApiError(503, 'database_unavailable', 'IAM-Datenbank ist nicht erreichbar.', actorResolution.actor.requestId);
  }
};

const deactivateOrganizationInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_admin', requestContext.requestId);
  if (featureCheck) {
    return featureCheck;
  }
  const roleCheck = requireRoles(ctx, ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) {
    return roleCheck;
  }

  const actorResolution = await resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }
  if (!actorResolution.actor.actorAccountId) {
    return createApiError(403, 'forbidden', 'Akteur-Account nicht gefunden.', actorResolution.actor.requestId);
  }

  const organizationId = readPathSegment(request, 4);
  if (!organizationId || !isUuid(organizationId)) {
    return createApiError(400, 'invalid_organization_id', 'Ungültige organizationId.', actorResolution.actor.requestId);
  }

  const csrfError = validateCsrf(request, actorResolution.actor.requestId);
  if (csrfError) {
    return csrfError;
  }

  const rateLimit = consumeRateLimit({
    instanceId: actorResolution.actor.instanceId,
    actorKeycloakSubject: ctx.user.id,
    scope: 'write',
    requestId: actorResolution.actor.requestId,
  });
  if (rateLimit) {
    return rateLimit;
  }

  try {
    const result = await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
      const organization = await loadOrganizationById(client, {
        instanceId: actorResolution.actor.instanceId,
        organizationId,
      });
      if (!organization) {
        return { status: 'not_found' as const };
      }
      if (organization.child_count > 0 || organization.membership_count > 0) {
        return { status: 'conflict' as const };
      }

      await client.query(
        `
UPDATE iam.organizations
SET is_active = false,
    updated_at = NOW()
WHERE instance_id = $1::uuid
  AND id = $2::uuid;
`,
        [actorResolution.actor.instanceId, organizationId]
      );

      await emitActivityLog(client, {
        instanceId: actorResolution.actor.instanceId,
        accountId: actorResolution.actor.actorAccountId,
        eventType: 'organization.deactivated',
        result: 'success',
        payload: { organizationId },
        requestId: actorResolution.actor.requestId,
        traceId: actorResolution.actor.traceId,
      });

      return { status: 'ok' as const };
    });

    if (result.status === 'not_found') {
      return createApiError(404, 'not_found', 'Organisation nicht gefunden.', actorResolution.actor.requestId);
    }
    if (result.status === 'conflict') {
      return createApiError(
        409,
        'conflict',
        'Organisation mit Children oder Memberships kann nicht deaktiviert werden.',
        actorResolution.actor.requestId
      );
    }

    return jsonResponse(200, asApiItem({ id: organizationId }, actorResolution.actor.requestId));
  } catch {
    return createApiError(503, 'database_unavailable', 'IAM-Datenbank ist nicht erreichbar.', actorResolution.actor.requestId);
  }
};

const assignOrganizationMembershipInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_admin', requestContext.requestId);
  if (featureCheck) {
    return featureCheck;
  }
  const roleCheck = requireRoles(ctx, ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) {
    return roleCheck;
  }

  const actorResolution = await resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }
  if (!actorResolution.actor.actorAccountId) {
    return createApiError(403, 'forbidden', 'Akteur-Account nicht gefunden.', actorResolution.actor.requestId);
  }

  const organizationId = readPathSegment(request, 4);
  if (!organizationId || !isUuid(organizationId)) {
    return createApiError(400, 'invalid_organization_id', 'Ungültige organizationId.', actorResolution.actor.requestId);
  }

  const csrfError = validateCsrf(request, actorResolution.actor.requestId);
  if (csrfError) {
    return csrfError;
  }

  const idempotency = requireIdempotencyKey(request, actorResolution.actor.requestId);
  if ('error' in idempotency) {
    return idempotency.error;
  }

  const parsed = await parseRequestBody(request, assignOrganizationMembershipSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', 'Ungültiger Payload.', actorResolution.actor.requestId);
  }

  const reserve = await reserveIdempotency({
    instanceId: actorResolution.actor.instanceId,
    actorAccountId: actorResolution.actor.actorAccountId,
    endpoint: 'POST:/api/v1/iam/organizations/$organizationId/memberships',
    idempotencyKey: idempotency.key,
    payloadHash: toPayloadHash(parsed.rawBody),
  });
  if (reserve.status === 'replay') {
    return jsonResponse(reserve.responseStatus, reserve.responseBody);
  }
  if (reserve.status === 'conflict') {
    return createApiError(409, 'idempotency_key_reuse', reserve.message, actorResolution.actor.requestId);
  }

  try {
    const organization = await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
      const org = await loadOrganizationById(client, {
        instanceId: actorResolution.actor.instanceId,
        organizationId,
      });
      if (!org) {
        return { status: 'not_found' as const };
      }
      if (!org.is_active) {
        return { status: 'inactive' as const };
      }

      const membershipAccount = await client.query<{ id: string }>(
        `
SELECT id
FROM iam.accounts
WHERE id = $1::uuid
  AND instance_id = $2::uuid
LIMIT 1;
`,
        [parsed.data.accountId, actorResolution.actor.instanceId]
      );
      if (membershipAccount.rowCount === 0) {
        return { status: 'invalid_account' as const };
      }

      if (parsed.data.isDefaultContext) {
        await client.query(
          `
UPDATE iam.account_organizations
SET is_default_context = false
WHERE instance_id = $1::uuid
  AND account_id = $2::uuid;
`,
          [actorResolution.actor.instanceId, parsed.data.accountId]
        );
      }

      const existingDefault = await client.query<{ organization_id: string }>(
        `
SELECT organization_id
FROM iam.account_organizations
WHERE instance_id = $1::uuid
  AND account_id = $2::uuid
  AND is_default_context = true
LIMIT 1;
`,
        [actorResolution.actor.instanceId, parsed.data.accountId]
      );

      const shouldUseDefault = parsed.data.isDefaultContext ?? existingDefault.rowCount === 0;

      await client.query(
        `
INSERT INTO iam.account_organizations (
  instance_id,
  account_id,
  organization_id,
  is_default_context,
  membership_visibility
)
VALUES ($1::uuid, $2::uuid, $3::uuid, $4::boolean, $5)
ON CONFLICT (instance_id, account_id, organization_id) DO UPDATE
SET
  is_default_context = EXCLUDED.is_default_context,
  membership_visibility = EXCLUDED.membership_visibility;
`,
        [
          actorResolution.actor.instanceId,
          parsed.data.accountId,
          organizationId,
          shouldUseDefault,
          parsed.data.visibility ?? 'internal',
        ]
      );

      await notifyPermissionInvalidation(client, {
        instanceId: actorResolution.actor.instanceId,
        trigger: 'organization_membership_assigned',
      });

      await emitActivityLog(client, {
        instanceId: actorResolution.actor.instanceId,
        accountId: actorResolution.actor.actorAccountId,
        subjectId: parsed.data.accountId,
        eventType: 'organization.membership_assigned',
        result: 'success',
        payload: {
          organizationId,
          accountId: parsed.data.accountId,
          isDefaultContext: shouldUseDefault,
        },
        requestId: actorResolution.actor.requestId,
        traceId: actorResolution.actor.traceId,
      });

      const detail = await loadOrganizationDetail(client, {
        instanceId: actorResolution.actor.instanceId,
        organizationId,
      });
      return { status: 'ok' as const, detail };
    });

    if (organization.status === 'not_found') {
      return createApiError(404, 'not_found', 'Organisation nicht gefunden.', actorResolution.actor.requestId);
    }
    if (organization.status === 'inactive') {
      return createApiError(409, 'organization_inactive', 'Inaktive Organisation erlaubt keine neue Membership.', actorResolution.actor.requestId);
    }
    if (organization.status === 'invalid_account') {
      return createApiError(400, 'invalid_request', 'Account gehört nicht zur aktiven Instanz.', actorResolution.actor.requestId);
    }

    const responseBody = asApiItem(organization.detail, actorResolution.actor.requestId);
    await completeIdempotency({
      instanceId: actorResolution.actor.instanceId,
      actorAccountId: actorResolution.actor.actorAccountId,
      endpoint: 'POST:/api/v1/iam/organizations/$organizationId/memberships',
      idempotencyKey: idempotency.key,
      status: 'COMPLETED',
      responseStatus: 200,
      responseBody,
    });
    return jsonResponse(200, responseBody);
  } catch {
    const responseBody = {
      error: { code: 'database_unavailable' as const, message: 'IAM-Datenbank ist nicht erreichbar.' },
      ...(actorResolution.actor.requestId ? { requestId: actorResolution.actor.requestId } : {}),
    };
    await completeIdempotency({
      instanceId: actorResolution.actor.instanceId,
      actorAccountId: actorResolution.actor.actorAccountId,
      endpoint: 'POST:/api/v1/iam/organizations/$organizationId/memberships',
      idempotencyKey: idempotency.key,
      status: 'FAILED',
      responseStatus: 503,
      responseBody,
    });
    return jsonResponse(503, responseBody);
  }
};

const removeOrganizationMembershipInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_admin', requestContext.requestId);
  if (featureCheck) {
    return featureCheck;
  }
  const roleCheck = requireRoles(ctx, ADMIN_ROLES, requestContext.requestId);
  if (roleCheck) {
    return roleCheck;
  }

  const actorResolution = await resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }
  if (!actorResolution.actor.actorAccountId) {
    return createApiError(403, 'forbidden', 'Akteur-Account nicht gefunden.', actorResolution.actor.requestId);
  }

  const organizationId = readPathSegment(request, 4);
  const accountId = readPathSegment(request, 6);
  if (!organizationId || !isUuid(organizationId)) {
    return createApiError(400, 'invalid_organization_id', 'Ungültige organizationId.', actorResolution.actor.requestId);
  }
  if (!accountId || !isUuid(accountId)) {
    return createApiError(400, 'invalid_request', 'Ungültige accountId.', actorResolution.actor.requestId);
  }

  const csrfError = validateCsrf(request, actorResolution.actor.requestId);
  if (csrfError) {
    return csrfError;
  }

  const rateLimit = consumeRateLimit({
    instanceId: actorResolution.actor.instanceId,
    actorKeycloakSubject: ctx.user.id,
    scope: 'write',
    requestId: actorResolution.actor.requestId,
  });
  if (rateLimit) {
    return rateLimit;
  }

  try {
    const result = await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
      const current = await client.query<{ is_default_context: boolean }>(
        `
SELECT is_default_context
FROM iam.account_organizations
WHERE instance_id = $1::uuid
  AND account_id = $2::uuid
  AND organization_id = $3::uuid
LIMIT 1;
`,
        [actorResolution.actor.instanceId, accountId, organizationId]
      );
      if (current.rowCount === 0) {
        return { status: 'not_found' as const };
      }

      await client.query(
        `
DELETE FROM iam.account_organizations
WHERE instance_id = $1::uuid
  AND account_id = $2::uuid
  AND organization_id = $3::uuid;
`,
        [actorResolution.actor.instanceId, accountId, organizationId]
      );

      if (current.rows[0]?.is_default_context) {
        await client.query(
          `
WITH fallback_membership AS (
  SELECT organization_id
  FROM iam.account_organizations
  WHERE instance_id = $1::uuid
    AND account_id = $2::uuid
  ORDER BY created_at ASC, organization_id ASC
  LIMIT 1
)
UPDATE iam.account_organizations membership
SET is_default_context = true
FROM fallback_membership
WHERE membership.instance_id = $1::uuid
  AND membership.account_id = $2::uuid
  AND membership.organization_id = fallback_membership.organization_id;
`,
          [actorResolution.actor.instanceId, accountId]
        );
      }

      await notifyPermissionInvalidation(client, {
        instanceId: actorResolution.actor.instanceId,
        trigger: 'organization_membership_removed',
      });

      await emitActivityLog(client, {
        instanceId: actorResolution.actor.instanceId,
        accountId: actorResolution.actor.actorAccountId,
        subjectId: accountId,
        eventType: 'organization.membership_removed',
        result: 'success',
        payload: { organizationId, accountId },
        requestId: actorResolution.actor.requestId,
        traceId: actorResolution.actor.traceId,
      });

      const detail = await loadOrganizationDetail(client, {
        instanceId: actorResolution.actor.instanceId,
        organizationId,
      });
      return { status: 'ok' as const, detail };
    });

    if (result.status === 'not_found') {
      return createApiError(404, 'not_found', 'Membership nicht gefunden.', actorResolution.actor.requestId);
    }

    return jsonResponse(200, asApiItem(result.detail, actorResolution.actor.requestId));
  } catch {
    return createApiError(503, 'database_unavailable', 'IAM-Datenbank ist nicht erreichbar.', actorResolution.actor.requestId);
  }
};

const getMyOrganizationContextInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_ui', requestContext.requestId);
  if (featureCheck) {
    return featureCheck;
  }

  const actorResolution = await resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }
  if (!actorResolution.actor.actorAccountId) {
    return createApiError(403, 'forbidden', 'Akteur-Account nicht gefunden.', actorResolution.actor.requestId);
  }
  const actorAccountId = actorResolution.actor.actorAccountId;

  try {
    const organizations = await withInstanceScopedDb(actorResolution.actor.instanceId, (client) =>
      loadContextOptions(client, {
        instanceId: actorResolution.actor.instanceId,
        accountId: actorAccountId,
      })
    );
    const session = await getSession(ctx.sessionId);
    const activeOrganizationId = chooseActiveOrganizationId({
      storedActiveOrganizationId: session?.activeOrganizationId,
      organizations,
    });

    if (session && session.activeOrganizationId !== activeOrganizationId) {
      await updateSession(ctx.sessionId, { activeOrganizationId });
    }

    const response: IamOrganizationContext = {
      activeOrganizationId,
      organizations,
    };

    return jsonResponse(200, asApiItem(response, actorResolution.actor.requestId));
  } catch {
    return createApiError(503, 'database_unavailable', 'IAM-Datenbank ist nicht erreichbar.', actorResolution.actor.requestId);
  }
};

const updateMyOrganizationContextInternal = async (
  request: Request,
  ctx: AuthenticatedRequestContext
): Promise<Response> => {
  const requestContext = getWorkspaceContext();
  const featureCheck = ensureFeature(getFeatureFlags(), 'iam_ui', requestContext.requestId);
  if (featureCheck) {
    return featureCheck;
  }

  const actorResolution = await resolveActorInfo(request, ctx, { requireActorMembership: true });
  if ('error' in actorResolution) {
    return actorResolution.error;
  }
  if (!actorResolution.actor.actorAccountId) {
    return createApiError(403, 'forbidden', 'Akteur-Account nicht gefunden.', actorResolution.actor.requestId);
  }
  const actorAccountId = actorResolution.actor.actorAccountId;

  const csrfError = validateCsrf(request, actorResolution.actor.requestId);
  if (csrfError) {
    return csrfError;
  }

  const parsed = await parseRequestBody(request, updateOrganizationContextSchema);
  if (!parsed.ok) {
    return createApiError(400, 'invalid_request', 'Ungültiger Payload.', actorResolution.actor.requestId);
  }

  try {
    const organizations = await withInstanceScopedDb(actorResolution.actor.instanceId, (client) =>
      loadContextOptions(client, {
        instanceId: actorResolution.actor.instanceId,
        accountId: actorAccountId,
      })
    );
    const target = organizations.find((organization) => organization.organizationId === parsed.data.organizationId);
    if (!target) {
      return createApiError(400, 'invalid_organization_id', 'Organisation gehört nicht zum Benutzerkontext.', actorResolution.actor.requestId);
    }
    if (!target.isActive) {
      return createApiError(409, 'organization_inactive', 'Inaktive Organisation kann kein aktiver Kontext sein.', actorResolution.actor.requestId);
    }

    await updateSession(ctx.sessionId, { activeOrganizationId: target.organizationId });

    await withInstanceScopedDb(actorResolution.actor.instanceId, async (client) => {
      await notifyPermissionInvalidation(client, {
        instanceId: actorResolution.actor.instanceId,
        keycloakSubject: ctx.user.id,
        trigger: 'organization_context_switched',
      });
      await emitActivityLog(client, {
        instanceId: actorResolution.actor.instanceId,
        accountId: actorAccountId,
        subjectId: actorAccountId,
        eventType: 'organization.context_switched',
        result: 'success',
        payload: {
          organizationId: target.organizationId,
          organizationKey: target.organizationKey,
        },
        requestId: actorResolution.actor.requestId,
        traceId: actorResolution.actor.traceId,
      });
    });

    const response: IamOrganizationContext = {
      activeOrganizationId: target.organizationId,
      organizations,
    };

    iamLogger.info('Organization context switched', {
      workspace_id: actorResolution.actor.instanceId,
      request_id: actorResolution.actor.requestId,
      trace_id: actorResolution.actor.traceId,
      context: {
        operation: 'organization_context_switched',
        organization_id: target.organizationId,
      },
    });

    return jsonResponse(200, asApiItem(response, actorResolution.actor.requestId));
  } catch {
    return createApiError(503, 'database_unavailable', 'IAM-Datenbank ist nicht erreichbar.', actorResolution.actor.requestId);
  }
};

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
