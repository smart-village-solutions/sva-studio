import type { z } from 'zod';
import { updateOrganizationSchema } from './organization-schemas.js';
import type {
  OrganizationMutationHandlerDeps,
  PreparedOrganizationMutationActor,
} from './organization-mutation-handlers.js';
import { revokeOrganizationMemberSessions } from './organization-mutation-membership-remove.js';
import { createAdminMutationHandler, readOrganizationId } from './organization-mutation-request.js';
import type { QueryClient } from './query-client.js';

const hasMainserverCredentialPatch = (value: z.infer<typeof updateOrganizationSchema>): boolean =>
  Object.prototype.hasOwnProperty.call(value, 'mainserverApplicationId') ||
  Object.prototype.hasOwnProperty.call(value, 'mainserverApplicationSecret');
type UpdateState = {
  readonly actor: PreparedOrganizationMutationActor;
  readonly organizationId: string;
  readonly input: { readonly data: z.infer<typeof updateOrganizationSchema> };
};
type DeleteState = {
  readonly actor: PreparedOrganizationMutationActor;
  readonly organizationId: string;
};

const persistUpdate = async <TFeatureFlags>(
  deps: OrganizationMutationHandlerDeps<TFeatureFlags>,
  state: UpdateState,
  client: QueryClient
): Promise<unknown | undefined> => {
  const { actor, organizationId, input } = state;
  const existing = await deps.loadOrganizationById(client, {
    instanceId: actor.instanceId,
    organizationId,
  });
  if (!existing) {
    return undefined;
  }

  const nextParentOrganizationId =
    input.data.parentOrganizationId === undefined
      ? existing.parent_organization_id
      : input.data.parentOrganizationId;
  const hierarchy = await deps.resolveHierarchyFields(client, {
    instanceId: actor.instanceId,
    organizationId,
    parentOrganizationId: nextParentOrganizationId,
  });
  if (!hierarchy.ok) {
    throw hierarchy;
  }

  if (existing.is_active && input.data.isActive === false) {
    await revokeOrganizationMemberSessions(deps, client, actor.instanceId, organizationId);
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
  is_active = COALESCE($8, is_active),
  metadata = COALESCE($9::jsonb, metadata),
  hierarchy_path = $10::uuid[],
  depth = $11::int,
  updated_at = NOW()
WHERE instance_id = $1
  AND id = $2::uuid;
`,
    [
      actor.instanceId,
      organizationId,
      input.data.organizationKey ?? null,
      input.data.displayName ?? null,
      nextParentOrganizationId ?? null,
      input.data.organizationType ?? null,
      input.data.contentAuthorPolicy ?? null,
      input.data.isActive ?? null,
      input.data.metadata ? JSON.stringify(input.data.metadata) : null,
      hierarchy.hierarchyPath,
      hierarchy.depth,
    ]
  );
  if (hasMainserverCredentialPatch(input.data)) {
    await deps.upsertOrganizationMainserverCredentials(client, {
      instanceId: actor.instanceId,
      organizationId,
      actorAccountId: actor.actorAccountId,
      mainserverApplicationId: input.data.mainserverApplicationId,
      mainserverApplicationSecret: input.data.mainserverApplicationSecret,
    });
  }

  await deps.rebuildOrganizationSubtree(client, {
    instanceId: actor.instanceId,
    organizationId,
  });
  await deps.emitActivityLog(client, {
    instanceId: actor.instanceId,
    accountId: actor.actorAccountId,
    eventType: 'organization.updated',
    result: 'success',
    payload: { organizationId, parentOrganizationId: nextParentOrganizationId },
    requestId: actor.requestId,
    traceId: actor.traceId,
  });

  return deps.loadOrganizationDetail(client, {
    instanceId: actor.instanceId,
    organizationId,
  });
};

const executeUpdate = async <TFeatureFlags>(
  deps: OrganizationMutationHandlerDeps<TFeatureFlags>,
  state: UpdateState
): Promise<Response> => {
  const { actor } = state;
  try {
    const updated = await deps.withInstanceScopedDb(actor.instanceId, (client) =>
      persistUpdate(deps, state, client)
    );
    if (!updated) {
      return deps.createApiError(404, 'not_found', 'Organisation nicht gefunden.', actor.requestId);
    }
    return deps.jsonResponse(200, deps.asApiItem(updated, actor.requestId));
  } catch (error) {
    if (deps.isHierarchyError(error)) {
      return deps.createApiError(error.status, error.code, error.message, actor.requestId);
    }
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('organizations_instance_key_uniq')) {
      return deps.createApiError(
        409,
        'conflict',
        'Organisation mit diesem Schlüssel existiert bereits.',
        actor.requestId
      );
    }
    if (message === 'organization_mainserver_provisioning_in_progress') {
      return deps.createApiError(
        409,
        'conflict',
        'Mainserver-Zugang wird gerade provisioniert.',
        actor.requestId
      );
    }
    return deps.createApiError(
      503,
      'database_unavailable',
      'IAM-Datenbank ist nicht erreichbar.',
      actor.requestId
    );
  }
};

const persistDelete = async <TFeatureFlags>(
  deps: OrganizationMutationHandlerDeps<TFeatureFlags>,
  state: DeleteState,
  client: QueryClient
): Promise<{ readonly status: 'ok' | 'conflict' | 'not_found' }> => {
  const { actor, organizationId } = state;
  const organization = await deps.loadOrganizationById(client, {
    instanceId: actor.instanceId,
    organizationId,
  });
  if (!organization) {
    return { status: 'not_found' as const };
  }
  if (organization.child_count > 0) {
    return { status: 'conflict' as const };
  }

  if (organization.membership_count > 0) {
    await revokeOrganizationMemberSessions(deps, client, actor.instanceId, organizationId);
    await client.query(
      `
WITH deleted_memberships AS (
  DELETE FROM iam.account_organizations
  WHERE instance_id = $1
    AND organization_id = $2::uuid
  RETURNING account_id, is_default_context
),
fallback_memberships AS (
  SELECT DISTINCT ON (membership.account_id)
    membership.account_id,
    membership.organization_id
  FROM iam.account_organizations membership
  JOIN deleted_memberships deleted
    ON deleted.account_id = membership.account_id
  WHERE membership.instance_id = $1
    AND deleted.is_default_context = true
  ORDER BY membership.account_id, membership.created_at ASC, membership.organization_id ASC
)
UPDATE iam.account_organizations membership
SET is_default_context = true
FROM fallback_memberships
WHERE membership.instance_id = $1
  AND membership.account_id = fallback_memberships.account_id
  AND membership.organization_id = fallback_memberships.organization_id;
`,
      [actor.instanceId, organizationId]
    );
  }

  await client.query(
    `
UPDATE iam.contents
SET organization_id = CASE WHEN organization_id = $2::uuid THEN NULL ELSE organization_id END,
    owner_organization_id = CASE WHEN owner_organization_id = $2::uuid THEN NULL ELSE owner_organization_id END,
    author_display_mode = CASE
      WHEN organization_id = $2::uuid AND author_display_mode = 'organization' THEN 'user'
      ELSE author_display_mode
    END,
    updated_at = NOW()
WHERE instance_id = $1
  AND (organization_id = $2::uuid OR owner_organization_id = $2::uuid);
`,
    [actor.instanceId, organizationId]
  );
  const deleteResult = await client.query(
    `
DELETE FROM iam.organizations
WHERE instance_id = $1
  AND id = $2::uuid;
`,
    [actor.instanceId, organizationId]
  );
  if (deleteResult.rowCount === 0) {
    return { status: 'not_found' as const };
  }
  if (organization.membership_count > 0) {
    await deps.notifyPermissionInvalidation(client, {
      instanceId: actor.instanceId,
      trigger: 'organization_membership_removed',
    });
  }
  await deps.emitActivityLog(client, {
    instanceId: actor.instanceId,
    accountId: actor.actorAccountId,
    eventType: 'organization.deleted',
    result: 'success',
    payload: { organizationId },
    requestId: actor.requestId,
    traceId: actor.traceId,
  });
  return { status: 'ok' as const };
};

const executeDelete = async <TFeatureFlags>(
  deps: OrganizationMutationHandlerDeps<TFeatureFlags>,
  state: DeleteState
): Promise<Response> => {
  const { actor, organizationId } = state;
  try {
    const result = await deps.withInstanceScopedDb(actor.instanceId, (client) =>
      persistDelete(deps, state, client)
    );
    if (result.status === 'not_found') {
      return deps.createApiError(404, 'not_found', 'Organisation nicht gefunden.', actor.requestId);
    }
    if (result.status === 'conflict') {
      return deps.createApiError(
        409,
        'conflict',
        'Organisation mit Kind-Organisationen kann nicht gelöscht werden.',
        actor.requestId
      );
    }
    return deps.jsonResponse(200, deps.asApiItem({ id: organizationId }, actor.requestId));
  } catch (error) {
    if ((error as { code?: string } | null)?.code === '23503') {
      return deps.createApiError(
        409,
        'conflict',
        'Organisation mit Kind-Organisationen kann nicht gelöscht werden.',
        actor.requestId
      );
    }
    return deps.createApiError(
      503,
      'database_unavailable',
      'IAM-Datenbank ist nicht erreichbar.',
      actor.requestId
    );
  }
};

export const createOrganizationUpdateHandlers = <TFeatureFlags>(
  deps: OrganizationMutationHandlerDeps<TFeatureFlags>
) => {
  const updateOrganizationInternal = createAdminMutationHandler(deps, {
    requireRateLimit: true,
    prepare: ({ request, actor }) => {
      const organizationId = readOrganizationId(deps, request, actor.requestId);
      return organizationId instanceof Response ? organizationId : { organizationId };
    },
    parse: async ({ request, actor }) => {
      const parsed = await deps.parseRequestBody(request, updateOrganizationSchema);
      return parsed.ok
        ? parsed
        : deps.createApiError(400, 'invalid_request', 'Ungültiger Payload.', actor.requestId);
    },
    execute: (state) => executeUpdate(deps, state),
  });
  const deleteOrganizationInternal = createAdminMutationHandler(deps, {
    requireRateLimit: true,
    prepare: ({ request, actor }) => {
      const organizationId = readOrganizationId(deps, request, actor.requestId);
      return organizationId instanceof Response ? organizationId : { organizationId };
    },
    parse: async () => undefined,
    execute: (state) => executeDelete(deps, state),
  });
  return { updateOrganizationInternal, deleteOrganizationInternal };
};
